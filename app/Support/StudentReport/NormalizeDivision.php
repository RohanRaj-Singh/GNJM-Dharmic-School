<?php

namespace App\Support\StudentReport;

use App\Support\DivisionTypeResolver;

/**
 * Single source of truth for "which division does this class belong to?".
 *
 * The detection rule lives in {@see \App\Support\DivisionTypeResolver}.
 *
 * Stage A3: returns a plain string — the open division key — instead of the
 * former closed two-case enum. A third+ division is now representable without
 * throwing (the enum's Division::from() threw ValueError on any value other
 * than gurmukhi/kirtan).
 *
 * Resolution order (see DivisionTypeResolver):
 *  0. explicit `division` (the nullable classes.division) -> returned verbatim
 *  1. `type` contains 'kirtan'   -> kirtan
 *  2. `type` contains 'gurmukhi' -> gurmukhi
 *  3. `name` contains 'kirtan'   -> kirtan
 *  4. otherwise                  -> gurmukhi
 */
final class NormalizeDivision
{
    public static function fromClass(?string $classType, ?string $className = null, ?string $explicitDivision = null): string
    {
        return DivisionTypeResolver::division($classType, $className, $explicitDivision);
    }
}
