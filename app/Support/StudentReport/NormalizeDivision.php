<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\Division;

/**
 * Single source of truth for "which division does this class belong to?".
 *
 * Replaces the literal `LOWER(classes.type) == 'kirtan'` checks that
 * previously diverged between the dashboard, the Fees controller, and the
 * Student Performa engine.
 *
 * Resolution order:
 *  1. Exact match on `classes.type` after lowercasing/trimming.
 *  2. Substring match on `classes.type` (catches 'Kirtan Class', 'kirtan-track').
 *  3. Substring match on `classes.name` (catches legacy rows with NULL type).
 *  4. Default: Gurmukhi.
 */
final class NormalizeDivision
{
    public static function fromClass(?string $classType, ?string $className = null): Division
    {
        $type = strtolower(trim((string) $classType));
        $name = strtolower(trim((string) $className));

        if ($type === 'kirtan' || str_contains($type, 'kirtan')) {
            return Division::Kirtan;
        }
        if ($type === 'gurmukhi' || str_contains($type, 'gurmukhi')) {
            return Division::Gurmukhi;
        }
        if ($name !== '' && str_contains($name, 'kirtan')) {
            return Division::Kirtan;
        }

        return Division::Gurmukhi;
    }
}
