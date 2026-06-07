<?php

namespace App\Support\StudentReport;

final class StudentReportMeta
{
    public function __construct(
        public readonly string $reportType,        // 'performance'
        public readonly string $generatedAt,       // 'YYYY-MM-DD HH:MM:SS'
        public readonly string $rangeMode,
        public readonly string $rangeLabel,        // '2025-04 → 2026-03 (Academic Session 2025-26)'
    ) {}

    public function toArray(): array
    {
        return [
            'report_type' => $this->reportType,
            'generated_at' => $this->generatedAt,
            'range_mode' => $this->rangeMode,
            'range_label' => $this->rangeLabel,
        ];
    }
}
