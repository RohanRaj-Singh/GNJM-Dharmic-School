<?php

namespace App\Support\StudentReport\Enums;

/**
 * Whether a student is liable for monthly fees.
 *
 * Free students are still shown in the report, but the Fee section renders
 * an "exempt" message and only custom fees (if any) are listed.
 */
enum StudentType: string
{
    case Paid = 'paid';
    case Free = 'free';

    public function label(): string
    {
        return match ($this) {
            self::Paid => 'Paid',
            self::Free => 'Free',
        };
    }

    public static function fromString(?string $raw): self
    {
        return match (strtolower(trim((string) $raw))) {
            'free' => self::Free,
            default => self::Paid,
        };
    }
}
