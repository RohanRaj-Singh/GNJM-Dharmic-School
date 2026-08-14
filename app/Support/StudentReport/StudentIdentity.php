<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\StudentStatus;
use App\Support\StudentReport\Enums\StudentType;

/**
 * The "Student Snapshot" — the data shown in the report header.
 *
 * Loaded by {@see \App\Services\StudentReport\StudentIdentityResolver}.
 * Pure value object; no DB calls after construction.
 */
final class StudentIdentity
{
    /**
     * @param  list<EnrollmentInfo>  $enrollments
     */
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly ?string $fatherName,
        public readonly ?string $fatherPhone,
        public readonly ?string $motherPhone,
        public readonly StudentStatus $status,
        public readonly StudentType $studentType,
        public readonly array $enrollments,
        public readonly ?string $enrollmentDate,   // 'YYYY-MM-DD' or null
        public readonly ?string $lastAttendanceDate, // 'YYYY-MM-DD' or null
        public readonly ?string $lastPaymentDate,   // 'YYYY-MM-DD' or null
        public readonly int $outstandingAmount,    // PKR
        public readonly int $outstandingMonths,
    ) {}

    /**
     * Human label for the divisions the student is enrolled in.
     *   "Gurmukhi" if only Gurmukhi sections
     *   "Kirtan" if only Kirtan sections
     *   "Gurmukhi + Kirtan" if both
     */
    public function divisionLabel(): string
    {
        $divisions = array_unique(array_map(fn ($e) => ucfirst($e->division), $this->enrollments));
        sort($divisions);
        return implode(' + ', $divisions);
    }

    /**
     * Convenience: does the student have at least one enrollment in this division?
     */
    public function isEnrolledIn(string $division): bool
    {
        foreach ($this->enrollments as $e) {
            if ($e->division === $division) {
                return true;
            }
        }
        return false;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'father_name' => $this->fatherName,
            'father_phone' => $this->fatherPhone,
            'mother_phone' => $this->motherPhone,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'student_type' => $this->studentType->value,
            'student_type_label' => $this->studentType->label(),
            'enrollments' => array_map(fn (EnrollmentInfo $e) => $e->toArray(), $this->enrollments),
            'division_label' => $this->divisionLabel(),
            'enrollment_date' => $this->enrollmentDate,
            'last_attendance_date' => $this->lastAttendanceDate,
            'last_payment_date' => $this->lastPaymentDate,
            'outstanding_amount' => $this->outstandingAmount,
            'outstanding_months' => $this->outstandingMonths,
        ];
    }
}
