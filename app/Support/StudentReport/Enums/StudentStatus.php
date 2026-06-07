<?php

namespace App\Support\StudentReport\Enums;

/**
 * The lifecycle statuses a student can be in.
 *
 * Stored in `students.status` (string column). The V1 engine reads this directly;
 * a future V2 will introduce a `student_status_history` table.
 */
enum StudentStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Graduated = 'graduated';
    case Transferred = 'transferred';
    case Dropped = 'dropped';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
            self::Graduated => 'Graduated',
            self::Transferred => 'Transferred',
            self::Dropped => 'Dropped',
        };
    }

    public static function fromString(?string $raw): self
    {
        $normalized = strtolower(trim((string) $raw));
        return match ($normalized) {
            'active' => self::Active,
            'inactive' => self::Inactive,
            'graduated' => self::Graduated,
            'transferred' => self::Transferred,
            'dropped' => self::Dropped,
            // Unknown values are treated as Active rather than throwing —
            // the existing `students.status` column is a free-form string and
            // the engine must not crash on legacy values.
            default => self::Active,
        };
    }
}
