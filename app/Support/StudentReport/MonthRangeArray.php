<?php

namespace App\Support\StudentReport;

final class MonthRangeArray
{
    /**
     * JSON-friendly representation of MonthRange.
     */
    public static function toArray(MonthRange $range): array
    {
        return [
            'start_label' => $range->startLabel,
            'end_label' => $range->endLabel,
            'total_months' => $range->totalMonths,
            'months' => array_map(
                fn (MonthCell $m) => ['year' => $m->year, 'month' => $m->month, 'label' => $m->label],
                $range->months,
            ),
        ];
    }
}
