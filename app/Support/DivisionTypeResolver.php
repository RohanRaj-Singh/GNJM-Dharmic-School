<?php

namespace App\Support;

/**
 * Canonical resolver for "which curriculum division does a class belong to?".
 *
 * Sprint 1.3 single source of truth. Replaces the duplicated, subtly-divergent
 * detection logic that previously lived in:
 *   - routes/attendance.php        ($isClassType closure)
 *   - app/Services/AbsenteeService  (isClassType)
 *   - app/Http/Controllers/StudentController::show (inline)
 *   - Admin controllers            (normalizeDivisionType / isKirtanClass)
 *   - app/Console/Commands/GenerateMonthlyFees.php (strict equality)
 *   - front-end pages              (classTypeToken copies)
 *
 * Resolution order (all comparisons lowercase + trimmed):
 *  0. explicit `division` (non-empty) -> returned verbatim   [Stage A2 seam]
 *  1. `type` contains 'kirtan'        -> kirtan
 *  2. `type` contains 'gurmukhi'      -> gurmukhi
 *  3. `name` (non-empty) contains 'kirtan' -> kirtan
 *  4. otherwise                       -> gurmukhi
 *
 * The explicit `division` (the nullable `classes.division` column) wins over
 * every inference rule. It is the seam that lets a third+ class escape the
 * Gurmukhi bucket. NULL/blank division falls through to the unchanged legacy
 * logic, so every existing row (all NULL) resolves exactly as before.
 *
 * The name fallback is intentionally kirtan-only: it exists so legacy rows
 * with a NULL/blank type but a Kirtan class name still honour the Sunday
 * day-rule. A Gurmukhi *name* never matches; unknown types collapse to the
 * default (gurmukhi).
 */
final class DivisionTypeResolver
{
    public static function division(?string $classType, ?string $className = null, ?string $explicitDivision = null): string
    {
        $explicit = strtolower(trim((string) $explicitDivision));
        if ($explicit !== '') {
            return $explicit;
        }

        $type = strtolower(trim((string) $classType));
        $name = strtolower(trim((string) $className));

        if (str_contains($type, 'kirtan')) {
            return 'kirtan';
        }
        if (str_contains($type, 'gurmukhi')) {
            return 'gurmukhi';
        }
        if ($name !== '' && str_contains($name, 'kirtan')) {
            return 'kirtan';
        }

        return 'gurmukhi';
    }

    public static function isKirtan(?string $classType, ?string $className = null, ?string $explicitDivision = null): bool
    {
        return self::division($classType, $className, $explicitDivision) === 'kirtan';
    }

    public static function isGurmukhi(?string $classType, ?string $className = null, ?string $explicitDivision = null): bool
    {
        return self::division($classType, $className, $explicitDivision) === 'gurmukhi';
    }
}
