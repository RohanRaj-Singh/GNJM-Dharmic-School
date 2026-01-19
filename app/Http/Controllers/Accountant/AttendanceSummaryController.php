<?php

namespace App\Http\Controllers\Accountant;

use App\Http\Controllers\Controller;
use App\Models\StudentSection;
use App\Models\Attendance;
use Carbon\Carbon;

class AttendanceSummaryController extends Controller
{
    public function index()
    {
        $lastWorkingDay = $this->getLastWorkingDay();

        $absentYesterday = [];
        $absent2Days = [];
        $absent3Plus = [];
        $onLeave = [];

        // Get all active enrollments (Gurmukhi only)
        $enrollments = StudentSection::with([
            'student',
            'schoolClass',
            'section',
            'attendance' => function ($q) {
                $q->orderByDesc('date');
            }
        ])
        ->whereHas('schoolClass', fn ($q) => $q->where('type', 'gurmukhi'))
        ->get();

        foreach ($enrollments as $enrollment) {

            // Filter attendance: ignore Sundays
            $attendance = $enrollment->attendance
                ->filter(fn ($a) => Carbon::parse($a->date)->dayOfWeek !== Carbon::SUNDAY)
                ->values();

            if ($attendance->isEmpty()) {
                continue;
            }

            // Check last working day record
            $lastDayRecord = $attendance
                ->firstWhere('date', $lastWorkingDay->toDateString());

            if (!$lastDayRecord) {
                continue;
            }

            // LEAVE
            if ($lastDayRecord->status === 'leave') {
                $onLeave[] = $this->formatStudent($enrollment);
                continue;
            }

            // ABSENT STREAK COUNT
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
            'date' => $lastWorkingDay->toDateString(),
            'absent_yesterday' => $absentYesterday,
            'absent_2_days' => $absent2Days,
            'absent_3_plus' => $absent3Plus,
            'on_leave' => $onLeave,
        ]);
    }

    /**
     * Get last working day (skip Sunday)
     */
    private function getLastWorkingDay()
    {
        $date = Carbon::today()->subDay();

        while ($date->dayOfWeek === Carbon::SUNDAY) {
            $date->subDay();
        }

        return $date;
    }

    /**
     * Format student data for UI
     */
    private function formatStudent($enrollment)
    {
        return [
            'name' => $enrollment->student->name,
            'father_name' => $enrollment->student->father_name,
            'class' => $enrollment->schoolClass->name,
            'section' => $enrollment->section->name,
        ];
    }
}
