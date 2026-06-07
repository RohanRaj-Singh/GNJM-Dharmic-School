<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\Division;

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
        public readonly Division $division,
        public readonly bool $enrolled,
        public readonly AttendanceSummary $attendance,
        public readonly FeeSummary $fees,
        public readonly ?KirtanScore $kirtanScore,    // Kirtan only
        public readonly array $months,
    ) {}

    public function toArray(): array
    {
        return [
            'division' => $this->division->value,
            'division_label' => $this->division->label(),
            'enrolled' => $this->enrolled,
            'attendance' => $this->attendance->toArray(),
            'fees' => $this->fees->toArray(),
            'kirtan_score' => $this->kirtanScore?->toArray(),
            'months' => array_map(fn (MonthCell $m) => $m->toArrayForJson(), $this->months),
        ];
    }
}
