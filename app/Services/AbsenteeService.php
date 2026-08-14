<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;

/**
 * Pure computation behind the /attendance/absentees page (Phase-2 Sprint 1.2).
 *
 * Extracted verbatim from the route closure that previously lived in
 * routes/attendance.php. The controller owns HTTP concerns (auth, request
 * filters, Inertia render); this service owns the business rules:
 *
 *   - status normalisation (legacy 'a'/'l'/'p' single-letter codes)
 *   - valid-day rules from the class's configured attendance days (Stage B;
 *     Kirtan's Sunday-only legacy rule is the unconfigured fallback)
 *   - streak + category computation (absent_1/2/3+, leave_1/2+, clear)
 *   - the (quirky) streak_days computation — preserved exactly
 *   - today-absentees classification and sorting by total_days ASC
 *
 * The valid-day question is delegated to the schoolClass's configuration
 * (explicit attendance_days, else the legacy Kirtan rule) — the duplicate
 * `isClassType` predicate that lived here was removed in Sprint 1.3.
 *
 * Behaviour is pinned by tests/Feature/AttendanceAbsenteesTest.php.
 */
class AbsenteeService
{
    /**
     * Normalise a raw attendance status value. Historical data contains
     * single-letter codes; the mark flow stores full words.
     */
    public function normalizeStatus(string $raw): string
    {
        $value = strtolower(trim($raw));

        return match ($value) {
            'a', 'absent'    => 'absent',
            'l', 'leave'     => 'leave',
            'p', 'present'   => 'present',
            default          => $value,
        };
    }

    /**
     * Build the students rows and today-absentees list for the absentees page.
     *
     * @param EloquentCollection<int, \App\Models\StudentSection> $enrollments
     *        active enrollments with student, section, schoolClass and
     *        attendance (ordered by date DESC) already loaded
     * @return array{students: array, today_absentees: array}
     */
    public function buildRows(
        EloquentCollection $enrollments,
        Carbon $today,
        Carbon $startDate,
        Carbon $endDate,
        bool $includeToday,
        ?int $classFilter,
        ?int $sectionFilter,
        ?string $search,
    ): array {
        $students = [];
        $todayAbsentees = [];

        foreach ($enrollments as $enrollment) {
            // Apply class filter
            if ($classFilter && $enrollment->section->schoolClass->id != $classFilter) {
                continue;
            }
            // Apply section filter
            if ($sectionFilter && $enrollment->section->id != $sectionFilter) {
                continue;
            }
            // Apply student search
            if ($search) {
                $studentName = strtolower($enrollment->student->name ?? '');
                if (!str_contains($studentName, strtolower($search))) {
                    continue;
                }
            }

            $class = $enrollment->schoolClass;

            $attendance = $enrollment->attendance
                // Filter by date range + valid day (config-driven)
                ->filter(function ($a) use ($startDate, $endDate, $includeToday, $today, $class) {
                    $date = Carbon::parse($a->date);

                    if (!$class->isAttendanceDay($date)) {
                        return false;
                    }

                    // If not including today, exclude today
                    if (!$includeToday && $date->isSameDay($today)) {
                        return false;
                    }

                    return $date->gte($startDate) && $date->lte($endDate);
                })
                ->values();

            // Check if absent TODAY (separate category)
            $todayAttendance = $enrollment->attendance
                ->filter(function ($a) use ($today, $class) {
                    $date = Carbon::parse($a->date);

                    return $class->isAttendanceDay($date) && $date->isSameDay($today);
                })
                ->first();

            $todayStatus = $todayAttendance ? $this->normalizeStatus($todayAttendance->status) : null;

            // If absent today, add to today category
            if ($todayStatus === 'absent') {
                $todayAbsentees[] = [
                    'id'        => $enrollment->student->id,
                    'name'      => $enrollment->student->name,
                    'father_name' => $enrollment->student->father_name,
                    'section'   => $enrollment->schoolClass->name . ' - ' . $enrollment->section->name,
                    'date'      => $todayAttendance->date,
                    'category'  => 'absent_today',
                ];
                // Don't include in streak calculation
                $attendance = $attendance->filter(fn ($a) => $a->date !== $todayAttendance->date)->values();
            }

            // Get all absent/leave dates for filtered view
            $absentDates = [];
            $leaveDates = [];

            foreach ($attendance as $record) {
                $status = $this->normalizeStatus($record->status);
                if ($status === 'absent') {
                    $absentDates[] = $record->date;
                } elseif ($status === 'leave') {
                    $leaveDates[] = $record->date;
                }
            }

            // Use latest available record within date range (up to yesterday when not including today)
            $lastDayRecord = $attendance->first();
            $status = $lastDayRecord ? $this->normalizeStatus($lastDayRecord->status) : null;

            // Calculate streak - count consecutive absent/leave days
            // Start from the last day and go backwards
            $streak = 0;
            $streakStartDate = null;

            if (in_array($status, ['absent', 'leave'], true)) {
                foreach ($attendance as $record) {
                    if ($this->normalizeStatus($record->status) === $status) {
                        if ($streak === 0) {
                            $streakStartDate = Carbon::parse($record->date);
                        }
                        $streak++;
                    } else {
                        break;
                    }
                }
            }

            if ($status === 'absent') {
                $category = $streak >= 3 ? 'absent_3_plus' : ($streak === 2 ? 'absent_2' : 'absent_1');
            } elseif ($status === 'leave') {
                $category = $streak >= 2 ? 'leave_2_plus' : 'leave_1';
            } else {
                $category = 'clear';
            }

            // Calculate days count for display
            $daysCount = $streak;
            if ($streakStartDate && $streak > 1) {
                $daysCount = $streakStartDate->diffInDays(Carbon::parse($lastDayRecord->date)) + 1;
            }

            // Total days (absent + leave) for sorting when filter is applied
            $totalDays = count($absentDates) + count($leaveDates);

            $students[] = [
                'id'               => $enrollment->student->id,
                'name'             => $enrollment->student->name,
                'father_name'      => $enrollment->student->father_name,
                'section'          => $enrollment->schoolClass->name . ' - ' . $enrollment->section->name,
                'date'             => $lastDayRecord?->date,
                'category'         => $category,
                'streak_days'      => $daysCount,
                'total_days'       => $totalDays,
                'all_absent_dates' => $absentDates,
                'all_leave_dates'  => $leaveDates,
            ];
        }

        // Sort by total_days ASCENDING (least days first)
        usort($students, function ($a, $b) {
            return $a['total_days'] - $b['total_days'];
        });

        return [
            'students'       => $students,
            'today_absentees' => $todayAbsentees,
        ];
    }
}
