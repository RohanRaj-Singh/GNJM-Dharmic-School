<?php

namespace App\Support\StudentReport;

/**
 * One month's calendar grid for a single division's attendance.
 *
 * The `days` map is keyed by day-of-month (1..31). Each DayCell is null if
 * the day was not marked (calendar shows "—"). Counts are pre-computed
 * so the React page and the PDF both render from the same numbers without
 * re-iterating the day array.
 */
final class MonthCell
{
    /**
     * @param  array<int, DayCell>  $days
     */
    public function __construct(
        public readonly int $year,
        public readonly int $month,
        public readonly string $label,
        public readonly array $days = [],
        public readonly int $presentCount = 0,
        public readonly int $absentCount = 0,
        public readonly int $leaveCount = 0,
    ) {}

    public function percentage(): float
    {
        $marked = $this->presentCount + $this->absentCount + $this->leaveCount;
        return $marked > 0 ? round(($this->presentCount / $marked) * 100, 2) : 0.0;
    }

    public function isEmpty(): bool
    {
        return $this->presentCount + $this->absentCount + $this->leaveCount === 0;
    }

    public function toArrayForJson(): array
    {
        $days = [];
        foreach ($this->days as $d => $cell) {
            $days[(string) $d] = [
                'status' => $cell->status?->value,
                'lesson_learned' => $cell->lessonLearned,
            ];
        }
        return [
            'year' => $this->year,
            'month' => $this->month,
            'label' => $this->label,
            'days' => $days,
            'present_count' => $this->presentCount,
            'absent_count' => $this->absentCount,
            'leave_count' => $this->leaveCount,
            'percentage' => $this->percentage(),
        ];
    }
}
