<?php

namespace App\Support\StudentReport;

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
        public readonly int $classId,
        public readonly string $className,
        public readonly string $sectionName,
        public readonly string $division, // open division key (Stage A3)
    ) {}

    public function label(): string
    {
        return "{$this->className} - {$this->sectionName}";
    }

    public function toArray(): array
    {
        return [
            'student_section_id' => $this->studentSectionId,
            'class_id' => $this->classId,
            'class_name' => $this->className,
            'section_name' => $this->sectionName,
            'division' => $this->division,
            'division_label' => ucfirst($this->division),
            'label' => $this->label(),
        ];
    }
}
