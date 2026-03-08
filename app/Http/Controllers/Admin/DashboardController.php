<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $yearInput = $request->input('years', $request->input('year', now(config('app.timezone'))->year));

        // Handle both single year (string/number) and multiple years (array)
        if (is_array($yearInput)) {
            $years = array_map('intval', $yearInput);
        } else {
            $years = [(int) $yearInput];
        }

        // Sort years descending for display
        rsort($years);
        $year = $years[0]; // Primary year for backward compatibility

        $overall = $this->buildOverall($years);
        $divisions = $this->buildDivisions($years);
        $insights = $this->buildInsights($years);

        return response()->json([
            ...$overall,
            'divisions' => $divisions,
            'insights' => $insights,
            'meta' => [
                'years' => $years,
                'year' => $year,
                'generated_at' => now(config('app.timezone'))->toDateTimeString(),
            ],
        ]);
    }

    private function buildOverall(array $years): array
    {
        $fees = DB::table('fees');
        $this->applyFeeYearFilter($fees, $years);

        $totalFees = (int) (clone $fees)->sum('fees.amount');
        $collectedFees = (int) (clone $fees)
            ->whereExists(function ($q) {
                $q->selectRaw('1')
                    ->from('payments')
                    ->whereColumn('payments.fee_id', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->sum('fees.amount');
        $pendingFees = $totalFees - $collectedFees;

        $attendanceCounts = DB::table('attendance')
            ->where(function ($q) use ($years) {
                $first = true;
                foreach ($years as $y) {
                    if ($first) {
                        $q->whereYear('date', $y);
                        $first = false;
                    } else {
                        $q->orWhereYear('date', $y);
                    }
                }
            })
            ->selectRaw('LOWER(TRIM(status)) as normalized_status, COUNT(*) as total')
            ->groupBy('normalized_status')
            ->get()
            ->pluck('total', 'normalized_status');

        $present = (int) ($attendanceCounts['present'] ?? 0);
        $absent = (int) ($attendanceCounts['absent'] ?? 0);
        $leave = (int) ($attendanceCounts['leave'] ?? 0);
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

    private function buildDivisions(array $years): array
    {
        $classes = DB::table('classes')
            ->select('id', 'name', 'type')
            ->orderBy('name')
            ->get();

        $classIdsByDivision = ['gurmukhi' => [], 'kirtan' => []];
        foreach ($classes as $class) {
            $rawType = strtolower(trim((string) ($class->type ?? '')));
            $normalizedType = $this->normalizeDivisionType($rawType, (string) $class->name);

            $classIdsByDivision[$normalizedType][] = (int) $class->id;
        }

        return collect($classIdsByDivision)->map(function (array $classIds, string $type) use ($years, $classes) {
            $divisionClasses = $classes->whereIn('id', $classIds)->values();
            $classRows = $this->buildClassRows(
                $classIds,
                $years,
                $divisionClasses->pluck('name', 'id')->all()
            );

            $stats = [
                'classes_count' => count($classIds),
                'sections_count' => (int) DB::table('sections')->whereIn('class_id', $classIds)->count(),
                'students_count' => (int) DB::table('student_sections')->whereIn('class_id', $classIds)->distinct('student_id')->count('student_id'),
                'free_students_count' => (int) DB::table('student_sections')
                    ->whereIn('class_id', $classIds)
                    ->where('student_type', 'free')
                    ->distinct('student_id')
                    ->count('student_id'),
                'active_students_count' => (int) DB::table('student_sections')
                    ->join('students', 'students.id', '=', 'student_sections.student_id')
                    ->whereIn('student_sections.class_id', $classIds)
                    ->where('students.status', 'active')
                    ->distinct('student_sections.student_id')
                    ->count('student_sections.student_id'),
                'enrollments_count' => (int) DB::table('student_sections')->whereIn('class_id', $classIds)->count(),
            ];

            $fees = $this->feesSummaryForScope('class', $classIds, $years);
            $attendance = $this->attendanceSummaryForScope('class', $classIds, $years);

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
                        'free_students_count' => 0,
                        'enrollments_count' => 0,
                        'fees' => ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0],
                        'attendance' => ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0],
                        'sections' => [],
                    ];
                })->values(),
            ];
        })->values()->all();
    }

    private function buildClassRows(array $classIds, array $years, array $classNames): array
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

        $sectionFees = $this->feesSummaryForScope('section', $sectionIds, $years, keyed: true);
        $sectionAttendance = $this->attendanceSummaryForScope('section', $sectionIds, $years, keyed: true);
        $sectionCounts = DB::table('student_sections')
            ->whereIn('section_id', $sectionIds)
            ->select(
                'section_id',
                DB::raw('COUNT(*) as enrollments_count'),
                DB::raw('COUNT(DISTINCT student_id) as students_count'),
                DB::raw("COUNT(DISTINCT CASE WHEN student_type = 'free' THEN student_id END) as free_students_count")
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
                    'free_students_count' => (int) ($counts->free_students_count ?? 0),
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
                DB::raw('COUNT(DISTINCT student_id) as students_count'),
                DB::raw("COUNT(DISTINCT CASE WHEN student_type = 'free' THEN student_id END) as free_students_count")
            )
            ->groupBy('class_id')
            ->get()
            ->keyBy('class_id');

        $classFees = $this->feesSummaryForScope('class', $classIds, $years, keyed: true);
        $classAttendance = $this->attendanceSummaryForScope('class', $classIds, $years, keyed: true);

        return collect($classIds)->mapWithKeys(function ($classId) use ($classCounts, $classFees, $classAttendance, $sectionsByClass) {
            $counts = $classCounts[$classId] ?? null;
            return [
                $classId => [
                    'id' => (int) $classId,
                    'name' => (string) ($classNames[$classId] ?? ''),
                    'sections_count' => count($sectionsByClass[$classId] ?? []),
                    'students_count' => (int) ($counts->students_count ?? 0),
                    'free_students_count' => (int) ($counts->free_students_count ?? 0),
                    'enrollments_count' => (int) ($counts->enrollments_count ?? 0),
                    'fees' => $classFees[$classId] ?? ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0],
                    'attendance' => $classAttendance[$classId] ?? ['present' => 0, 'absent' => 0, 'leave' => 0, 'percentage' => 0],
                    'sections' => $sectionsByClass[$classId] ?? [],
                ],
            ];
        })->all();
    }

    private function feesSummaryForScope(string $scope, array $ids, array $years, bool $keyed = false): array
    {
        if (empty($ids)) {
            return $keyed ? [] : ['total' => 0, 'collected' => 0, 'pending' => 0, 'percentage' => 0];
        }

        $column = $scope === 'section' ? 'student_sections.section_id' : 'student_sections.class_id';

        $rows = DB::table('fees')
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->whereIn($column, $ids)
            ->where(function ($q) use ($years) {
                $this->applyFeeYearFilter($q, $years);
            })
            ->select(
                DB::raw($column . ' as scope_id'),
                DB::raw('SUM(fees.amount) as total'),
                DB::raw('SUM(CASE WHEN EXISTS (SELECT 1 FROM payments WHERE payments.fee_id = fees.id AND payments.deleted_at IS NULL) THEN fees.amount ELSE 0 END) as collected')
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

    private function attendanceSummaryForScope(string $scope, array $ids, array $years, bool $keyed = false): array
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
            ->where(function ($q) use ($years) {
                $first = true;
                foreach ($years as $y) {
                    if ($first) {
                        $q->whereYear('attendance.date', $y);
                        $first = false;
                    } else {
                        $q->orWhereYear('attendance.date', $y);
                    }
                }
            })
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

    private function applyFeeYearFilter($query, array $years): void
    {
        if (count($years) === 1) {
            // Single year
            $year = $years[0];
            $query->where(function ($q) use ($year) {
                // Monthly fees - check month column (source = 'monthly' or NULL for legacy data)
                $q->where(function ($qq) use ($year) {
                    $qq->where('fees.source', 'monthly')
                        ->where('fees.month', 'like', $year . '-%');
                })->orWhere(function ($qq) use ($year) {
                    // Handle legacy data where source might be null
                    $qq->whereNull('fees.source')
                        ->where('fees.month', 'like', $year . '-%');
                })->orWhere(function ($qq) use ($year) {
                    // Custom fees - check created_at year
                    $qq->where('fees.source', 'custom')
                        ->whereYear('fees.created_at', $year);
                });
            });
        } else {
            // Multiple years
            $query->where(function ($q) use ($years) {
                $first = true;
                foreach ($years as $year) {
                    if ($first) {
                        $q->where(function ($qq) use ($year) {
                            $qq->where('fees.source', 'monthly')
                                ->where('fees.month', 'like', $year . '-%');
                        })->orWhere(function ($qq) use ($year) {
                            $qq->whereNull('fees.source')
                                ->where('fees.month', 'like', $year . '-%');
                        })->orWhere(function ($qq) use ($year) {
                            $qq->where('fees.source', 'custom')
                                ->whereYear('fees.created_at', $year);
                        });
                        $first = false;
                    } else {
                        $q->orWhere(function ($qq) use ($year) {
                            $qq->where('fees.source', 'monthly')
                                ->where('fees.month', 'like', $year . '-%');
                        })->orWhere(function ($qq) use ($year) {
                            $qq->whereNull('fees.source')
                                ->where('fees.month', 'like', $year . '-%');
                        })->orWhere(function ($qq) use ($year) {
                            $qq->where('fees.source', 'custom')
                                ->whereYear('fees.created_at', $year);
                        });
                    }
                }
            });
        }
    }

    private function buildInsights(array $years): array
    {
        return [
            'top_absentees' => $this->topAbsentees($years),
            'top_pending_fees' => $this->topPendingFees($years),
        ];
    }

    private function topAbsentees(array $years): array
    {
        $rows = DB::table('attendance')
            ->join('student_sections', 'student_sections.id', '=', 'attendance.student_section_id')
            ->join('students', 'students.id', '=', 'student_sections.student_id')
            ->join('classes', 'classes.id', '=', 'student_sections.class_id')
            ->leftJoin('sections', 'sections.id', '=', 'student_sections.section_id')
            ->where(function ($q) use ($years) {
                $first = true;
                foreach ($years as $y) {
                    if ($first) {
                        $q->whereYear('attendance.date', $y);
                        $first = false;
                    } else {
                        $q->orWhereYear('attendance.date', $y);
                    }
                }
            })
            ->whereRaw("LOWER(TRIM(attendance.status)) = 'absent'")
            ->select(
                'student_sections.id as enrollment_id',
                'student_sections.class_id',
                'student_sections.section_id',
                'students.id as student_id',
                'students.name as student_name',
                'students.father_name',
                'classes.name as class_name',
                'classes.type as class_type',
                'sections.name as section_name',
                DB::raw('COUNT(*) as absent_days')
            )
            ->groupBy(
                'student_sections.id',
                'student_sections.class_id',
                'student_sections.section_id',
                'students.id',
                'students.name',
                'students.father_name',
                'classes.name',
                'classes.type',
                'sections.name'
            )
            ->orderByDesc('absent_days')
            ->orderBy('students.name')
            ->limit(50)
            ->get();

        return $rows->map(function ($row) {
            return [
                'student_id' => (int) $row->student_id,
                'enrollment_id' => (int) $row->enrollment_id,
                'student_name' => (string) $row->student_name,
                'father_name' => (string) ($row->father_name ?? ''),
                'class_id' => (int) $row->class_id,
                'section_id' => (int) ($row->section_id ?? 0),
                'class_name' => (string) $row->class_name,
                'section_name' => (string) ($row->section_name ?? ''),
                'division_type' => $this->normalizeDivisionType((string) ($row->class_type ?? ''), (string) $row->class_name),
                'absent_days' => (int) ($row->absent_days ?? 0),
            ];
        })->all();
    }

    private function topPendingFees(array $years): array
    {
        $rows = DB::table('fees')
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->join('students', 'students.id', '=', 'student_sections.student_id')
            ->join('classes', 'classes.id', '=', 'student_sections.class_id')
            ->leftJoin('sections', 'sections.id', '=', 'student_sections.section_id')
            ->where(function ($q) use ($years) {
                $this->applyFeeYearFilter($q, $years);
            })
            ->whereNotExists(function ($q) {
                $q->selectRaw('1')
                    ->from('payments')
                    ->whereColumn('payments.fee_id', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->select(
                'student_sections.id as enrollment_id',
                'student_sections.class_id',
                'student_sections.section_id',
                'students.id as student_id',
                'students.name as student_name',
                'students.father_name',
                'classes.name as class_name',
                'classes.type as class_type',
                'sections.name as section_name',
                DB::raw('SUM(fees.amount) as pending_amount'),
                DB::raw('COUNT(fees.id) as pending_fee_count')
            )
            ->groupBy(
                'student_sections.id',
                'student_sections.class_id',
                'student_sections.section_id',
                'students.id',
                'students.name',
                'students.father_name',
                'classes.name',
                'classes.type',
                'sections.name'
            )
            ->orderByDesc('pending_amount')
            ->orderBy('students.name')
            ->limit(50)
            ->get();

        return $rows->map(function ($row) {
            return [
                'student_id' => (int) $row->student_id,
                'enrollment_id' => (int) $row->enrollment_id,
                'student_name' => (string) $row->student_name,
                'father_name' => (string) ($row->father_name ?? ''),
                'class_id' => (int) $row->class_id,
                'section_id' => (int) ($row->section_id ?? 0),
                'class_name' => (string) $row->class_name,
                'section_name' => (string) ($row->section_name ?? ''),
                'division_type' => $this->normalizeDivisionType((string) ($row->class_type ?? ''), (string) $row->class_name),
                'pending_amount' => (int) ($row->pending_amount ?? 0),
                'pending_fee_count' => (int) ($row->pending_fee_count ?? 0),
            ];
        })->all();
    }

    private function normalizeDivisionType(string $rawType, string $className): string
    {
        return match (strtolower(trim($rawType))) {
            'kirtan', 'kirtan class' => 'kirtan',
            'gurmukhi', 'gurmukhi class' => 'gurmukhi',
            default => str_contains(strtolower($className), 'kirtan') ? 'kirtan' : 'gurmukhi',
        };
    }
}
