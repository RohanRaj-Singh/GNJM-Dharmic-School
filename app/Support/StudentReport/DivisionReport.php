<?php

namespace App\Support\StudentReport;

/**
 * Per-division report: attendance + fees + (Kirtan) performance + calendar.
 *
 * `enrolled` is false when the student has no enrollment in this division.
 * The other fields are then safe defaults (zeros, empty arrays).
 */
final class DivisionReport
{
    /**
     * @param  list<MonthCell>  $months
     */
    public function __construct(
        public readonly string $division, // open division key (Stage A3)
        public readonly bool $enrolled,
        public readonly AttendanceSummary $attendance,
        public readonly FeeSummary $fees,
        public readonly ?KirtanScore $kirtanScore,    // Kirtan only
        public readonly array $months,
    ) {}

    public function toArray(): array
    {
        return [
            'division' => $this->division,
            'division_label' => ucfirst($this->division),
            'enrolled' => $this->enrolled,
            'attendance' => $this->attendance->toArray(),
            'fees' => $this->fees->toArray(),
            'kirtan_score' => $this->kirtanScore?->toArray(),
            'months' => array_map(fn (MonthCell $m) => $m->toArrayForJson(), $this->months),
        ];
    }
}
