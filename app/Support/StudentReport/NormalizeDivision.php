<?php

namespace App\Support\StudentReport;

use App\Support\DivisionTypeResolver;
use App\Support\StudentReport\Enums\Division;

/**
 * Single source of truth for "which division does this class belong to?".
 *
 * The detection rule itself now lives in {@see \App\Support\DivisionTypeResolver}
 * (Sprint 1.3 canonicalisation); this facade exists so the Student Report
 * suite keeps working with the enum-typed return it already relies on.
 *
 * Resolution order (see DivisionTypeResolver):
 *  1. `type` contains 'kirtan'   -> kirtan
 *  2. `type` contains 'gurmukhi' -> gurmukhi
 *  3. `name` contains 'kirtan'   -> kirtan
 *  4. otherwise                  -> gurmukhi
 */
final class NormalizeDivision
{
    public static function fromClass(?string $classType, ?string $className = null): Division
    {
        return Division::from(DivisionTypeResolver::division($classType, $className));
    }
}
