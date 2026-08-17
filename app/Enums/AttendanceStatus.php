<?php

namespace App\Enums;

/**
 * Canonical attendance status values (Sprint 1.2).
 *
 * Backed string enum — the `->value` matches the raw string stored in
 * the `attendance.status` column, so the migration footprint is zero
 * (no schema change required). Legacy rows that contain single-letter
 * codes ('a' / 'l' / 'p') are still supported via `fromLegacy()`.
 *
 * Used by:
 *   - app/Services/AbsenteeService.php::normalizeStatus() — now
 *     delegates to fromLegacy() so the legacy-code mapping has a
 *     single source of truth.
 *   - app/Http/Controllers/Admin/AdminAttendanceController.php — the
 *     mark flow validates the incoming status against
 *     AttendanceStatus::values().
 *
 * NOT used by (yet — out of scope for this extraction):
 *   - The aggregation SUM-CASE queries in DashboardController,
 *     ReportController, etc. — these are string-keyed SQL aggregations
 *     where a typed parameter would add no value and would risk
 *     regressing carefully-tuned query plans. A separate DRY-by-enum
 *     refactor can touch them if/when a status-add or status-rename
 *     becomes a real change.
 */
enum AttendanceStatus: string
{
    case Present = 'present';
    case Absent  = 'absent';
    case Leave   = 'leave';

    /**
     * Canonicalize a raw status string. Historical data may contain
     * single-letter codes ('a'/'l'/'p') from a long-since-deprecated
     * attendance mark flow; the new mark flow writes the full words.
     *
     * Returns null for unknown values — callers that need a graceful
     * fallback (e.g. AbsenteeService::normalizeStatus() returning the
     * raw string downstream) handle null at the call site. For strict
     * validation (the mark flow), pair with `tryFrom()` or compare
     * the result against `null`.
     */
    public static function tryFromLegacy(string $raw): ?self
    {
        $value = strtolower(trim($raw));

        return match ($value) {
            'p', 'present'   => self::Present,
            'a', 'absent'    => self::Absent,
            'l', 'leave'     => self::Leave,
            default          => null,
        };
    }

    /**
     * Convenience for callers that need a plain-string allow-list
     * (e.g. request validation, the mark flow's `$allowedStatuses`).
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}