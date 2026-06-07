<?php

namespace App\Support\StudentReport;

use Carbon\Carbon;

/**
 * School academic session: April 1 of the given year to March 31 of the next year.
 *
 * Hardcoded for V1. The boundary month (4 = April) is the only knob; refactoring
 * to a configurable value is a V1.1 task.
 *
 * "Session 2025-26" → April 2025 to March 2026.
 */
final class AcademicSession
{
    public const START_MONTH = 4; // April

    /**
     * @return array{start: string, end: string}  'YYYY-MM-01' and 'YYYY-MM-31'
     */
    public static function range(int $year): array
    {
        $start = Carbon::create($year, self::START_MONTH, 1)->startOfMonth();
        $end = $start->copy()->addYear()->subDay()->endOfMonth();

        return [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
        ];
    }

    /**
     * Render the human label for a session (e.g. "2025-26").
     */
    public static function label(int $year): string
    {
        $next = substr((string) ($year + 1), -2);
        return $year . '-' . $next;
    }
}
