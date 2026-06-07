<?php

namespace App\Support\StudentReport;

/**
 * The complete Student Performance Report — a value object consumed by
 * both the React preview and the PDF. There is one shape, two consumers.
 *
 * `divisions` is a map keyed by division value ('gurmukhi' | 'kirtan').
 * Empty divisions (student not enrolled) are present with `enrolled=false`.
 */
final class StudentReport
{
    /**
     * @param  array<string, DivisionReport>  $divisions
     */
    public function __construct(
        public readonly StudentIdentity $identity,
        public readonly MonthRange $range,
        public readonly array $divisions,
        public readonly StudentReportMeta $meta,
    ) {}

    public function toArray(): array
    {
        $divisions = [];
        foreach ($this->divisions as $key => $report) {
            $divisions[$key] = $report->toArray();
        }
        return [
            'identity' => $this->identity->toArray(),
            'range' => $this->range->toArray(),
            'divisions' => $divisions,
            'meta' => $this->meta->toArray(),
        ];
    }
}
