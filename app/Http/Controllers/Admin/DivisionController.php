<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\StudentSection;
use App\Support\ClassSchedule;
use App\Support\DivisionTypeResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Admin "division settings" page (Sprint 6.4 / L-1).
 *
 * Lists every distinct division the resolver surfaces with its
 * business-rule summary (attendance days, charges-monthly-fee toggle,
 * default monthly fee) and operational counts (classes, sections,
 * active students, free students). The intent is purely diagnostic —
 * no editing — so admins can verify "which bucket is Music actually
 * sitting in?" without writing SQL.
 *
 * Pure read; the page is data-driven so a third+ division surfaces
 * automatically.
 */
class DivisionController extends Controller
{
    public function index(Request $request)
    {
        $request->headers->set('Accept', 'application/json');

        $divisions = $this->buildDivisions();

        return Inertia::render('Admin/Divisions/Index', [
            'divisions' => $divisions,
        ]);
    }

    public function data(Request $request)
    {
        $request->headers->set('Accept', 'application/json');

        return response()->json([
            'divisions' => $this->buildDivisions(),
        ]);
    }

    private function buildDivisions(): array
    {
        $classes = SchoolClass::query()
            ->select(['id', 'name', 'type', 'division', 'attendance_days', 'charges_monthly_fee', 'default_monthly_fee'])
            ->orderBy('name')
            ->get();

        // Bucket classes by their resolved division (Stage A2 + A4). A
        // third+ division (set via classes.division) gets its own bucket
        // automatically — no fixed two-key map.
        $classIdsByDivision = [];
        foreach ($classes as $class) {
            $normalized = DivisionTypeResolver::division(
                $class->type,
                $class->name,
                $class->division
            );
            $classIdsByDivision[$normalized][] = (int) $class->id;
        }
        ksort($classIdsByDivision); // deterministic order: gurmukhi < kirtan < …

        $sectionCounts = DB::table('sections')
            ->select('class_id', DB::raw('COUNT(*) as total'))
            ->groupBy('class_id')
            ->pluck('total', 'class_id');

        $enrollmentCounts = DB::table('student_sections')
            ->select(
                'class_id',
                DB::raw('COUNT(DISTINCT student_id) as distinct_students'),
                DB::raw("COUNT(DISTINCT CASE WHEN student_type = 'free' THEN student_id END) as free_students"),
                DB::raw('COUNT(*) as enrollments')
            )
            ->groupBy('class_id')
            ->get()
            ->keyBy('class_id');

        $result = [];
        foreach ($classIdsByDivision as $divisionKey => $classIds) {
            $divisionClasses = $classes->whereIn('id', $classIds)->values();

            // Business-rule rollup: union of attendance days across the
            // division's classes, "any charges fees?" flag, fee range.
            $attendanceDays = [];
            $chargesFees = false;
            $feeMin = null;
            $feeMax = null;
            foreach ($divisionClasses as $class) {
                foreach ($class->attendanceDays() as $day) {
                    $day = (int) $day;
                    if (!in_array($day, $attendanceDays, true)) {
                        $attendanceDays[] = $day;
                    }
                }
                if ($class->chargesMonthlyFee()) {
                    $chargesFees = true;
                }
                $fee = (int) ($class->default_monthly_fee ?? 0);
                if ($feeMin === null || $fee < $feeMin) $feeMin = $fee;
                if ($feeMax === null || $fee > $feeMax) $feeMax = $fee;
            }
            sort($attendanceDays);

            $classRows = $divisionClasses->map(function (SchoolClass $class) use ($sectionCounts, $enrollmentCounts) {
                $counts = $enrollmentCounts[$class->id] ?? null;
                return [
                    'id' => (int) $class->id,
                    'name' => (string) $class->name,
                    'attendance_days' => $class->attendanceDays(),
                    'charges_monthly_fee' => $class->chargesMonthlyFee(),
                    'default_monthly_fee' => (int) ($class->default_monthly_fee ?? 0),
                    'sections_count' => (int) ($sectionCounts[$class->id] ?? 0),
                    'students_count' => (int) ($counts->distinct_students ?? 0),
                    'free_students_count' => (int) ($counts->free_students ?? 0),
                    'enrollments_count' => (int) ($counts->enrollments ?? 0),
                ];
            })->values()->all();

            $result[] = [
                'key' => (string) $divisionKey,
                'title' => ucfirst((string) $divisionKey),
                'attendance_days' => $attendanceDays,
                'charges_monthly_fee' => $chargesFees,
                'default_monthly_fee_min' => (int) ($feeMin ?? 0),
                'default_monthly_fee_max' => (int) ($feeMax ?? 0),
                'classes_count' => count($classIds),
                'sections_count' => (int) array_sum(array_map(
                    fn($id) => (int) ($sectionCounts[$id] ?? 0),
                    $classIds
                )),
                'students_count' => (int) array_sum(array_map(
                    fn($id) => (int) ($enrollmentCounts[$id]->distinct_students ?? 0),
                    $classIds
                )),
                'free_students_count' => (int) array_sum(array_map(
                    fn($id) => (int) ($enrollmentCounts[$id]->free_students ?? 0),
                    $classIds
                )),
                'enrollments_count' => (int) array_sum(array_map(
                    fn($id) => (int) ($enrollmentCounts[$id]->enrollments ?? 0),
                    $classIds
                )),
                'classes' => $classRows,
            ];
        }

        return $result;
    }
}