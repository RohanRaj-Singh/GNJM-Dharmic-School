<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $year = (int) ($request->input('year') ?: now(config('app.timezone'))->year);

        $overall = $this->buildOverall($year);
        $divisions = $this->buildDivisions($year);

        return response()->json([
            ...$overall,
            'divisions' => $divisions,
            'meta' => [
                'year' => $year,
                'generated_at' => now(config('app.timezone'))->toDateTimeString(),
            ],
        ]);
    }

    private function buildOverall(int $year): array
    {
        $fees = DB::table('fees')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->where(function ($q) use ($year) {
                $q->where(function ($qq) use ($year) {
                    $qq->where('fees.type', 'monthly')
                        ->where('fees.month', 'like', $year . '-%');
                })
                    ->orWhere(function ($qq) use ($year) {
                        $qq->where('fees.type', 'custom')
                            ->whereYear('fees.created_at', $year);
                    });
            })
            ->select(
                'fees.amount',
                DB::raw('payments.id IS NOT NULL as is_paid')
            )
            ->get();

        $totalFees = (int) $fees->sum('amount');
        $collectedFees = (int) $fees->where('is_paid', true)->sum('amount');
        $pendingFees = $totalFees - $collectedFees;

        $attendance = DB::table('attendance')
            ->whereYear('date', $year)
            ->select('status')
            ->get()
            ->map(fn ($r) => strtolower(trim((string) $r->status)));

        $present = $attendance->where('status', 'present')->count();
        $absent = $attendance->where('status', 'absent')->count();
        $leave = $attendance->where('status', 'leave')->count();
        $attendanceTotal = $present + $absent + $leave;

        return [
            'fees' => [
                'total' => $totalFees,
                'collected' => $collectedFees,
                'pending' => $pendingFees,
                'percentage' => $totalFees > 0 ? round(($collectedFees / $totalFees) * 100, 2) : 0,
            ],
            'attendance' => [
                'percentage' => $attendanceTotal > 0 ? round(($present / $attendanceTotal) * 100, 2) : 0,
                'present' => $present,
                'absent' => $absent,
                'leave' => $leave,
            ],
            'students' => [
                'total' => DB::table('students')->count(),
                'active' => DB::table('students')->where('status', 'active')->count(),
                'enrollments' => DB::table('student_sections')->count(),
            ],
        ];
    }

    private function buildDivisions(int $year): array
    {
        $classes = DB::table('classes')
            ->select('id', 'name', 'type')
            ->orderBy('name')
            ->get();

        $classIdsByDivision = [
            'gurmukhi' => $classes->where('type', 'gurmukhi')->pluck('id')->all(),
            'kirtan' => $classes->where('type', 'kirtan')->pluck('id')->all(),
        ];

        return collect($classIdsByDivision)->map(function (array $classIds, string $type) use ($year, $classes) {
            $divisionClasses = $classes->whereIn('id', $classIds)->values();
            $classRows = $this->buildClassRows(
                $classIds,
                $year,
                $divisionClasses->pluck('name', 'id')->all()
            );

            $stats = [
                'classes_count' => count($classIds),
                'sections_count' => (int) DB::table('sections')->whereIn('class_id', $classIds)->count(),
                'students_count' => (int) DB::table('student_sections')->whereIn('class_id', $classIds)->distinct('student_id')->count('student_id'),
                'active_students_count' => (int) DB::table('student_sections')
                    ->join('students', 'students.id', '=', 'student_sections.student_id')
                    ->whereIn('student_sections.class_id', $classIds)
                    ->where('students.status', 'active')
                    ->distinct('student_sections.student_id')
                    ->count('student_sections.student_id'),
                'enrollments_count' => (int) DB::table('student_sections')->whereIn('class_id', $classIds)->count(),
            ];

            $fees = $this->feesSummaryForScope('class', $classIds, $year);
            $attendance = $this->attendanceSummaryForScope('class', $classIds, $year);

            return [
                'type' => $type,
                'title' => $type === 'kirtan' ? 'Kirtan' : 'Gurmukhi',
                'stats' => $stats,
                'fees' => $fees,
                'attendance' => $attendance,
                'classes' => $divisionClasses->map(function ($class) use ($classRows) {
                    return $classRows[$class->id] ?? [
                        'id' => (int) $class->id,
                        'name' => $class->name,
                        'sections_count' => 0,
                        'students_count' => 0,
                        'enrollments_count' => 0,
                        'fees' => ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0],
                        'attendance' => ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0],
                        'sections' => [],
                    ];
                })->values(),
            ];
        })->values()->all();
    }

    private function buildClassRows(array $classIds, int $year, array $classNames): array
    {
        if (empty($classIds)) {
            return [];
        }

        $sectionRows = DB::table('sections')
            ->whereIn('class_id', $classIds)
            ->select('id', 'name', 'class_id')
            ->orderBy('name')
            ->get();

        $sectionIds = $sectionRows->pluck('id')->all();

        $sectionFees = $this->feesSummaryForScope('section', $sectionIds, $year, keyed: true);
        $sectionAttendance = $this->attendanceSummaryForScope('section', $sectionIds, $year, keyed: true);
        $sectionCounts = DB::table('student_sections')
            ->whereIn('section_id', $sectionIds)
            ->select(
                'section_id',
                DB::raw('COUNT(*) as enrollments_count'),
                DB::raw('COUNT(DISTINCT student_id) as students_count')
            )
            ->groupBy('section_id')
            ->get()
            ->keyBy('section_id');

        $sectionsByClass = $sectionRows->groupBy('class_id')->map(function ($sections) use ($sectionFees, $sectionAttendance, $sectionCounts) {
            return $sections->map(function ($section) use ($sectionFees, $sectionAttendance, $sectionCounts) {
                $counts = $sectionCounts[$section->id] ?? null;
                return [
                    'id' => (int) $section->id,
                    'name' => $section->name,
                    'students_count' => (int) ($counts->students_count ?? 0),
                    'enrollments_count' => (int) ($counts->enrollments_count ?? 0),
                    'fees' => $sectionFees[$section->id] ?? ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0],
                    'attendance' => $sectionAttendance[$section->id] ?? ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0],
                ];
            })->values()->all();
        });

        $classCounts = DB::table('student_sections')
            ->whereIn('class_id', $classIds)
            ->select(
                'class_id',
                DB::raw('COUNT(*) as enrollments_count'),
                DB::raw('COUNT(DISTINCT student_id) as students_count')
            )
            ->groupBy('class_id')
            ->get()
            ->keyBy('class_id');

        $classFees = $this->feesSummaryForScope('class', $classIds, $year, keyed: true);
        $classAttendance = $this->attendanceSummaryForScope('class', $classIds, $year, keyed: true);

        return collect($classIds)->mapWithKeys(function ($classId) use ($classCounts, $classFees, $classAttendance, $sectionsByClass) {
            $counts = $classCounts[$classId] ?? null;
            return [
                $classId => [
                    'id' => (int) $classId,
                    'name' => (string) ($classNames[$classId] ?? ''),
                    'sections_count' => count($sectionsByClass[$classId] ?? []),
                    'students_count' => (int) ($counts->students_count ?? 0),
                    'enrollments_count' => (int) ($counts->enrollments_count ?? 0),
                    'fees' => $classFees[$classId] ?? ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0],
                    'attendance' => $classAttendance[$classId] ?? ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0],
                    'sections' => $sectionsByClass[$classId] ?? [],
                ],
            ];
        })->all();
    }

    private function feesSummaryForScope(string $scope, array $ids, int $year, bool $keyed = false): array
    {
        if (empty($ids)) {
            return $keyed ? [] : ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0];
        }

        $column = $scope === 'section' ? 'student_sections.section_id' : 'student_sections.class_id';

        $rows = DB::table('fees')
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->whereIn($column, $ids)
            ->where(function ($q) use ($year) {
                $q->where(function ($qq) use ($year) {
                    $qq->where('fees.type', 'monthly')
                        ->where('fees.month', 'like', $year . '-%');
                })
                    ->orWhere(function ($qq) use ($year) {
                        $qq->where('fees.type', 'custom')
                            ->whereYear('fees.created_at', $year);
                    });
            })
            ->select(
                DB::raw($column . ' as scope_id'),
                DB::raw('SUM(fees.amount) as total'),
                DB::raw('SUM(CASE WHEN payments.id IS NOT NULL THEN fees.amount ELSE 0 END) as collected')
            )
            ->groupBy('scope_id')
            ->get();

        if (!$keyed) {
            $total = (int) $rows->sum('total');
            $collected = (int) $rows->sum('collected');
            return [
                'total' => $total,
                'collected' => $collected,
                'pending' => $total - $collected,
                'percentage' => $total > 0 ? round(($collected / $total) * 100, 2) : 0,
            ];
        }

        return $rows->mapWithKeys(function ($row) {
            $total = (int) ($row->total ?? 0);
            $collected = (int) ($row->collected ?? 0);
            return [
                (int) $row->scope_id => [
                    'total' => $total,
                    'collected' => $collected,
                    'pending' => $total - $collected,
                    'percentage' => $total > 0 ? round(($collected / $total) * 100, 2) : 0,
                ],
            ];
        })->all();
    }

    private function attendanceSummaryForScope(string $scope, array $ids, int $year, bool $keyed = false): array
    {
        if (empty($ids)) {
            return $keyed
                ? []
                : ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0];
        }

        $column = $scope === 'section' ? 'student_sections.section_id' : 'student_sections.class_id';

        $rows = DB::table('attendance')
            ->join('student_sections', 'student_sections.id', '=', 'attendance.student_section_id')
            ->whereIn($column, $ids)
            ->whereYear('attendance.date', $year)
            ->select(
                DB::raw($column . ' as scope_id'),
                DB::raw("SUM(CASE WHEN LOWER(attendance.status) = 'present' THEN 1 ELSE 0 END) as present"),
                DB::raw("SUM(CASE WHEN LOWER(attendance.status) = 'absent' THEN 1 ELSE 0 END) as absent"),
                DB::raw("SUM(CASE WHEN LOWER(attendance.status) = 'leave' THEN 1 ELSE 0 END) as on_leave")
            )
            ->groupBy('scope_id')
            ->get();

        if (!$keyed) {
            $present = (int) $rows->sum('present');
            $absent = (int) $rows->sum('absent');
            $leave = (int) $rows->sum('on_leave');
            $total = $present + $absent + $leave;
            return [
                'present' => $present,
                'absent' => $absent,
                'leave' => $leave,
                'percentage' => $total > 0 ? round(($present / $total) * 100, 2) : 0,
            ];
        }

        return $rows->mapWithKeys(function ($row) {
            $present = (int) ($row->present ?? 0);
            $absent = (int) ($row->absent ?? 0);
            $leave = (int) ($row->on_leave ?? 0);
            $total = $present + $absent + $leave;
            return [
                (int) $row->scope_id => [
                    'present' => $present,
                    'absent' => $absent,
                    'leave' => $leave,
                    'percentage' => $total > 0 ? round(($present / $total) * 100, 2) : 0,
                ],
            ];
        })->all();
    }
}
