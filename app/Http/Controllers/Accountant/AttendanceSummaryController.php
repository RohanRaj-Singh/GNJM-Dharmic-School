<?php

namespace App\Http\Controllers\Accountant;

use App\Http\Controllers\Controller;
use App\Models\StudentSection;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Accountant attendance summary — yesterday's / 2-day / 3+ streak
 * absentees + leave, grouped by the class's configured attendance days.
 *
 * The controller is intentionally permissive on classes: pass `class_ids[]`
 * to scope to specific classes (otherwise all active enrollments are
 * considered). The legacy `where('type','gurmukhi')` is gone — a third
 * class with attendance_days set in classes.attendance_days shows up
 * automatically, with its own day-of-week filter.
 *
 * Per-class attendance day filtering delegates to
 * SchoolClass::isAttendanceDay() — the explicit config wins, the Kirtan
 * Sunday-only fallback applies when no config is present.
 */
class AttendanceSummaryController extends Controller
{
    public function index(Request $request)
    {
        $classIds = array_values(array_filter(
            (array) $request->input('class_ids', []),
            fn ($v) => is_numeric($v),
        ));
        $classIds = array_map('intval', $classIds);

        $enrollments = StudentSection::with([
            'student',
            'schoolClass',
            'section',
            'attendance' => fn ($q) => $q->orderByDesc('date'),
        ])
            ->where('status', 'active')
            ->whereNull('transferred_at')
            ->when($classIds, fn ($q) => $q->whereIn('class_id', $classIds))
            ->get();

        $today = Carbon::today();

        $absentYesterday = [];
        $absent2Days = [];
        $absent3Plus = [];
        $onLeave = [];

        foreach ($enrollments as $enrollment) {
            $class = $enrollment->schoolClass;

            // Per-class attendance-day filter — the config-driven seam. A
            // Gurmukhi class with Mon-Sat config still respects Sundays as
            // off-days; a Kirtan class with no config falls back to
            // Sunday-only via ClassSchedule.
            $attendance = $enrollment->attendance
                ->filter(fn ($a) => $class->isAttendanceDay(Carbon::parse($a->date)))
                ->values();

            if ($attendance->isEmpty()) {
                continue;
            }

            // Last working day is per-class: walk backwards from today until
            // we hit a day the class actually holds attendance.
            $lastWorkingDay = $this->lastWorkingDayFor($class, $today);

            $lastDayRecord = $attendance
                ->firstWhere('date', $lastWorkingDay->toDateString());

            if (!$lastDayRecord) {
                continue;
            }

            if ($lastDayRecord->status === 'leave') {
                $onLeave[] = $this->formatStudent($enrollment);
                continue;
            }

            $absentStreak = 0;
            foreach ($attendance as $record) {
                if ($record->status === 'absent') {
                    $absentStreak++;
                } else {
                    break;
                }
            }

            if ($absentStreak === 1) {
                $absentYesterday[] = $this->formatStudent($enrollment);
            } elseif ($absentStreak === 2) {
                $absent2Days[] = $this->formatStudent($enrollment);
            } elseif ($absentStreak >= 3) {
                $absent3Plus[] = $this->formatStudent($enrollment);
            }
        }

        return response()->json([
            'date' => $this->earliestLastWorkingDay($enrollments, $today)->toDateString(),
            'absent_yesterday' => $absentYesterday,
            'absent_2_days' => $absent2Days,
            'absent_3_plus' => $absent3Plus,
            'on_leave' => $onLeave,
        ]);
    }

    /**
     * Walk backwards from $today until we hit a day the class holds
     * attendance. Defaults to today-1 when no config is set, so a legacy
     * Gurmukhi class (Mon-Sat) still gets yesterday-or-earlier as its
     * anchor on a Sunday.
     */
    private function lastWorkingDayFor($class, Carbon $today): Carbon
    {
        $cursor = $today->copy()->subDay();
        for ($i = 0; $i < 14; $i++) {
            if ($class->isAttendanceDay($cursor)) {
                return $cursor;
            }
            $cursor->subDay();
        }
        return $today->copy()->subDay();
    }

    /**
     * The summary's top-level "date" is the most-recent common working day
     * across the included classes (used as the report label).
     */
    private function earliestLastWorkingDay($enrollments, Carbon $today): Carbon
    {
        if ($enrollments->isEmpty()) {
            return $today->copy()->subDay();
        }
        $earliest = $today->copy();
        foreach ($enrollments as $enrollment) {
            $last = $this->lastWorkingDayFor($enrollment->schoolClass, $today);
            if ($last->lt($earliest)) {
                $earliest = $last;
            }
        }
        return $earliest;
    }

    private function formatStudent($enrollment): array
    {
        return [
            'name' => $enrollment->student->name,
            'father_name' => $enrollment->student->father_name,
            'class' => $enrollment->schoolClass->name,
            'section' => $enrollment->section->name,
        ];
    }
}
