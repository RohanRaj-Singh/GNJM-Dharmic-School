<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\AttendanceStatus;

/**
 * Aggregate attendance counts for one division over the report's range.
 *
 * `percentage` is computed against marked days, not school days. The audit
 * acknowledged this is a known limitation; V1.1 will add a school-days-based
 * percentage as a second number.
 */
final class AttendanceSummary
{
    public function __construct(
        public readonly int $present,
        public readonly int $absent,
        public readonly int $leave,
        public readonly int $markedDays,        // present+absent+leave
        public readonly float $percentage,      // present / markedDays * 100
        public readonly ?int $currentStreakLength,   // null if no attendance in range
        public readonly ?AttendanceStatus $currentStreakStatus,
    ) {}

    public function toArray(): array
    {
        return [
            'present' => $this->present,
            'absent' => $this->absent,
            'leave' => $this->leave,
            'marked_days' => $this->markedDays,
            'percentage' => $this->percentage,
            'current_streak_length' => $this->currentStreakLength,
            'current_streak_status' => $this->currentStreakStatus?->value,
        ];
    }
}
