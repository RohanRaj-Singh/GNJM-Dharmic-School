<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\DayCell;
use App\Support\StudentReport\Enums\AttendanceStatus;
use App\Support\StudentReport\MonthCell;
use App\Support\StudentReport\MonthRange;
use Carbon\Carbon;

/**
 * Pure function: takes a MonthRange, a list of attendance rows for the
 * student for one division, and a target division. Returns a list of
 * MonthCell, one per month in the range, with day cells populated.
 *
 * The caller (StudentReportService) is responsible for pre-filtering rows
 * to only the division's class_ids, so this function receives rows that
 * already belong to the right division.
 *
 * When the student has multiple `student_section_id`s in the same division
 * on the same day, the status is merged as best-of: present > leave > absent.
 * lesson_learned is true if any record that day has lesson_learned=1.
 */
final class CalendarBuilder
{
    /**
     * @param  list<object>  $attendanceRows  rows with fields: date, status, lesson_learned, student_section_id
     * @return list<MonthCell>
     */
    public function build(
        MonthRange $range,
        array $attendanceRows,
        string $division, // open division key (Stage A3)
    ): array {
        // Group attendance rows by date.
        $byDate = [];
        foreach ($attendanceRows as $row) {
            $date = (string) $row->date;
            if (!isset($byDate[$date])) {
                $byDate[$date] = [];
            }
            $byDate[$date][] = $row;
        }

        $output = [];
        foreach ($range->months as $month) {
            $monthStart = Carbon::create($month->year, $month->month, 1)->startOfMonth();
            $daysInMonth = $monthStart->daysInMonth;
            $days = [];
            $present = 0;
            $absent = 0;
            $leave = 0;

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateStr = $monthStart->copy()->day($d)->toDateString();
                $dayRows = $byDate[$dateStr] ?? [];
                $statuses = [];
                $lessonLearned = false;
                foreach ($dayRows as $r) {
                    $s = AttendanceStatus::fromString($r->status ?? null);
                    if ($s !== null) {
                        $statuses[] = $s;
                    }
                    if ((int) ($r->lesson_learned ?? 0) === 1) {
                        $lessonLearned = true;
                    }
                }

                $status = $this->mergeStatus($statuses);
                $days[$d] = new DayCell(
                    status: $status,
                    lessonLearned: $lessonLearned,
                );

                if ($status === AttendanceStatus::Present) $present++;
                elseif ($status === AttendanceStatus::Absent) $absent++;
                elseif ($status === AttendanceStatus::Leave) $leave++;
            }

            $output[] = new MonthCell(
                year: $month->year,
                month: $month->month,
                label: $month->label,
                days: $days,
                presentCount: $present,
                absentCount: $absent,
                leaveCount: $leave,
            );
        }

        return $output;
    }

    /**
     * @param  list<AttendanceStatus>  $statuses
     */
    private function mergeStatus(array $statuses): ?AttendanceStatus
    {
        if (in_array(AttendanceStatus::Present, $statuses, true)) {
            return AttendanceStatus::Present;
        }
        if (in_array(AttendanceStatus::Leave, $statuses, true)) {
            return AttendanceStatus::Leave;
        }
        if (in_array(AttendanceStatus::Absent, $statuses, true)) {
            return AttendanceStatus::Absent;
        }
        return null;
    }
}
