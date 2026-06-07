<?php

namespace App\Support\StudentReport\Enums;

/**
 * The two curriculum divisions in the school.
 *
 * Detection logic lives in {@see \App\Support\StudentReport\NormalizeDivision}.
 * This enum is the canonical representation; everything else funnels through it.
 */
enum Division: string
{
    case Gurmukhi = 'gurmukhi';
    case Kirtan = 'kirtan';

    public function label(): string
    {
        return match ($this) {
            self::Gurmukhi => 'Gurmukhi',
            self::Kirtan => 'Kirtan',
        };
    }

    /**
     * Day-of-week rule: which days of the week does this division run?
     * Used by the calendar builder to mark non-school days.
     */
    public function runsOnSunday(): bool
    {
        return $this === self::Kirtan;
    }
}
