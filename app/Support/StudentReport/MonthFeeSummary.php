<?php

namespace App\Support\StudentReport;

/**
 * One row of the monthly fee breakdown. Built from one or more FeeRow entries
 * for the same month (typically one monthly fee + zero custom fees).
 */
final class MonthFeeSummary
{
    public function __construct(
        public readonly string $month,        // 'YYYY-MM'
        public readonly int $charged,
        public readonly int $paid,
        public readonly int $pending,
        public readonly bool $isPaid,
    ) {}

    public function toArray(): array
    {
        return [
            'month' => $this->month,
            'charged' => $this->charged,
            'paid' => $this->paid,
            'pending' => $this->pending,
            'is_paid' => $this->isPaid,
        ];
    }
}
