<?php

namespace App\Support\StudentReport\Enums;

enum AttendanceStatus: string
{
    case Present = 'present';
    case Absent = 'absent';
    case Leave = 'leave';

    public function label(): string
    {
        return match ($this) {
            self::Present => 'Present',
            self::Absent => 'Absent',
            self::Leave => 'Leave',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::Present => 'P',
            self::Absent => 'A',
            self::Leave => 'L',
        };
    }

    public static function fromString(?string $raw): ?self
    {
        if ($raw === null) {
            return null;
        }
        return match (strtolower(trim($raw))) {
            'present' => self::Present,
            'absent' => self::Absent,
            'leave' => self::Leave,
            default => null,
        };
    }
}
