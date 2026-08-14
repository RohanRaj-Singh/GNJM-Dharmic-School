<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Stage B seam — "what configuration does this class have?" instead of "is
 * this Gurmukhi or Kirtan?" (approved plan: docs/architecture/
 * 12-MultiClass-Impact-Audit.md §12, decision gate cleared).
 *
 * Each class carries two configurable concerns:
 *
 *   - attendance days   (`classes.attendance_days`, JSON int[] of ISO
 *     day-of-week: 0=Sunday .. 6=Saturday) — which days may attendance be
 *     marked for this class.
 *   - monthly fee       (`classes.charges_monthly_fee`, bool) — does this
 *     class participate in monthly fee generation.
 *
 * Explicit configuration always wins. NULL falls back to the legacy rule so
 * every existing Gurmukhi/Kirtan row resolves exactly as before (no backfill):
 *
 *   - Kirtan  → Sunday-only attendance, no monthly fees   [real business rule]
 *   - default → Monday–Saturday attendance, monthly fees
 *
 * This is the ONLY Kirtan special-case left in the codebase. New classes
 * created through the admin UI set explicit config and never hit the fallback.
 *
 * Mirrors {@see DivisionTypeResolver}'s primitive-argument style so call sites
 * pass `$class->type, $class->name, $class->attendance_days, $class->division`.
 */
final class ClassSchedule
{
    /** Monday–Saturday (ISO day-of-week: 1=Monday .. 6=Saturday). */
    public const DEFAULT_ATTENDANCE_DAYS = [1, 2, 3, 4, 5, 6];

    /** Sunday only (0 = Carbon::SUNDAY). */
    public const KIRTAN_ATTENDANCE_DAYS = [0];

    /** @return list<int> ISO day-of-week numbers */
    public static function attendanceDays(
        ?string $classType,
        ?string $className = null,
        ?array $explicitDays = null,
        ?string $explicitDivision = null,
    ): array {
        if (is_array($explicitDays) && $explicitDays !== []) {
            return array_values(array_unique(array_map('intval', $explicitDays)));
        }

        return DivisionTypeResolver::isKirtan($classType, $className, $explicitDivision)
            ? self::KIRTAN_ATTENDANCE_DAYS
            : self::DEFAULT_ATTENDANCE_DAYS;
    }

    public static function chargesMonthlyFee(
        ?string $classType,
        ?string $className = null,
        ?bool $explicit = null,
        ?string $explicitDivision = null,
    ): bool {
        if ($explicit !== null) {
            return $explicit;
        }

        return ! DivisionTypeResolver::isKirtan($classType, $className, $explicitDivision);
    }

    public static function isAttendanceDay(
        ?string $classType,
        ?string $className,
        ?array $explicitDays,
        Carbon $date,
        ?string $explicitDivision = null,
    ): bool {
        return in_array(
            $date->dayOfWeek,
            self::attendanceDays($classType, $className, $explicitDays, $explicitDivision),
            true,
        );
    }

    /** Human-readable label for the class's attendance days. */
    public static function dayLabel(
        ?string $classType,
        ?string $className = null,
        ?array $explicitDays = null,
        ?string $explicitDivision = null,
    ): string {
        $days = self::attendanceDays($classType, $className, $explicitDays, $explicitDivision);

        if ($days === self::DEFAULT_ATTENDANCE_DAYS) {
            return 'Monday–Saturday';
        }

        $names = [
            0 => 'Sunday', 1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday',
            4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday',
        ];

        return implode(', ', array_map(
            fn (int $d) => $names[$d] ?? (string) $d,
            $days,
        ));
    }
}
