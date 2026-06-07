<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\Division;

/**
 * Lightweight enrollment summary for the Student Snapshot.
 *
 * V1 only exposes current enrollments (transferred_at IS NULL). V2 will
 * expose historical transitions here.
 */
final class EnrollmentInfo
{
    public function __construct(
        public readonly int $studentSectionId,
        public readonly string $className,
        public readonly string $sectionName,
        public readonly Division $division,
    ) {}

    public function label(): string
    {
        return "{$this->className} - {$this->sectionName}";
    }

    public function toArray(): array
    {
        return [
            'student_section_id' => $this->studentSectionId,
            'class_name' => $this->className,
            'section_name' => $this->sectionName,
            'division' => $this->division->value,
            'division_label' => $this->division->label(),
            'label' => $this->label(),
        ];
    }
}
