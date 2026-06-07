<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\AttendanceSummary;
use App\Support\StudentReport\Enums\AttendanceStatus;
use App\Support\StudentReport\Enums\Division;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Loads attendance for one division and computes the summary
 * (counts, percentage, current streak).
 */
final class AttendanceResolver
{
    /**
     * @param  list<int>  $sectionIds  student_section_ids for this division
     */
    public function resolve(array $sectionIds, string $startDate, string $endDate): AttendanceSummary
    {
        if (empty($sectionIds)) {
            return new AttendanceSummary(0, 0, 0, 0, 0.0, null, null);
        }

        $rows = DB::table('attendance')
            ->whereIn('student_section_id', $sectionIds)
            ->whereBetween('date', [$startDate, $endDate])
            ->orderBy('date')
            ->get(['date', 'status']);

        $present = 0;
        $absent = 0;
        $leave = 0;
        $daily = []; // 'YYYY-MM-DD' => best status
        foreach ($rows as $r) {
            $status = AttendanceStatus::fromString($r->status);
            if ($status === null) continue;
            $date = (string) $r->date;
            $current = $daily[$date] ?? null;
            $daily[$date] = $this->betterStatus($current, $status);
        }

        foreach ($daily as $s) {
            if ($s === AttendanceStatus::Present) $present++;
            elseif ($s === AttendanceStatus::Absent) $absent++;
            elseif ($s === AttendanceStatus::Leave) $leave++;
        }

        $marked = $present + $absent + $leave;
        $percentage = $marked > 0 ? round(($present / $marked) * 100, 2) : 0.0;

        // Current streak: from the latest day backward, count consecutive
        // same-status days (breaking on null or different status).
        $streakLength = null;
        $streakStatus = null;
        if (!empty($daily)) {
            ksort($daily);
            $dates = array_keys($daily);
            $lastDate = end($dates);
            $lastStatus = $daily[$lastDate];
            $streakStatus = $lastStatus;
            $streakLength = 1;
            // Walk backward.
            $cursor = Carbon::parse($lastDate);
            for ($i = count($dates) - 2; $i >= 0; $i--) {
                $expectedPrev = $cursor->copy()->subDay()->toDateString();
                if ($dates[$i] !== $expectedPrev) break; // gap
                if ($daily[$dates[$i]] !== $lastStatus) break;
                $streakLength++;
                $cursor = Carbon::parse($dates[$i]);
            }
        }

        return new AttendanceSummary(
            present: $present,
            absent: $absent,
            leave: $leave,
            markedDays: $marked,
            percentage: $percentage,
            currentStreakLength: $streakLength,
            currentStreakStatus: $streakStatus,
        );
    }

    private function betterStatus(?AttendanceStatus $a, AttendanceStatus $b): AttendanceStatus
    {
        // Merge precedence: present > leave > absent.
        if ($a === AttendanceStatus::Present) return $a;
        if ($b === AttendanceStatus::Present) return $b;
        if ($a === AttendanceStatus::Leave) return $a;
        if ($b === AttendanceStatus::Leave) return $b;
        return $a ?? $b;
    }
}
