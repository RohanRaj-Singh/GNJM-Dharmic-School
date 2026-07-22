<?php

namespace App\Support\StudentReport;

/**
 * Value object representing one historical enrollment in the report timeline.
 *
 * Each entry captures a student's time in one class/section, with
 * rolled-up stats (attendance counts, fee totals).
 */
final class EnrollmentHistory
{
    public function __construct(
        public readonly int $id,
        public readonly string $className,
        public readonly string $sectionName,
        public readonly ?string $startedAt,
        public readonly ?string $transferredAt,
        public readonly ?string $outcome,
        public readonly string $status,
        public readonly int $present,
        public readonly int $absent,
        public readonly int $leave,
        public readonly int $feesCharged,
        public readonly int $feesPaid,
    ) {}

    public function toArray(): array
    {
        return [
            'id'            => $this->id,
            'class_name'    => $this->className,
            'section_name'  => $this->sectionName,
            'started_at'    => $this->startedAt,
            'transferred_at' => $this->transferredAt,
            'outcome'       => $this->outcome,
            'status'        => $this->status,
            'attendance'    => [
                'present' => $this->present,
                'absent'  => $this->absent,
                'leave'   => $this->leave,
            ],
            'fees' => [
                'charged' => $this->feesCharged,
                'paid'    => $this->feesPaid,
            ],
        ];
    }
}
