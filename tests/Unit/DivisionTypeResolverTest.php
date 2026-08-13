<?php

namespace Tests\Unit;

use App\Support\DivisionTypeResolver;
use PHPUnit\Framework\TestCase;

/**
 * Pins the canonical division-type resolution rule (Sprint 1.3).
 *
 * This is the single source of truth that replaces the duplicated
 * `$isClassType` / `classTypeToken` / `normalizeDivisionType` /
 * `isKirtanClass` implementations spread across attendance.php,
 * AbsenteeService, StudentController, the admin controllers, and the
 * front-end pages.
 *
 * Resolution order (all comparisons lowercase + trimmed):
 *  1. `type` contains 'kirtan'          -> kirtan
 *  2. `type` contains 'gurmukhi'        -> gurmukhi
 *  3. `name` (non-empty) contains 'kirtan' -> kirtan
 *  4. otherwise                         -> gurmukhi
 *
 * Note the asymmetry is intentional: a Gurmukhi *name* is never matched by
 * step 3; it only matters as a kirtan fallback. Unknown/unexpected types
 * collapse to the default (gurmukhi).
 */
class DivisionTypeResolverTest extends TestCase
{
    /* ───────────────────────────────────────────────
       Exact matches
       ─────────────────────────────────────────────── */

    public function test_exact_kirtan_type_is_kirtan(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division('kirtan'));
        $this->assertTrue(DivisionTypeResolver::isKirtan('kirtan'));
        $this->assertFalse(DivisionTypeResolver::isGurmukhi('kirtan'));
    }

    public function test_exact_gurmukhi_type_is_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('gurmukhi'));
        $this->assertFalse(DivisionTypeResolver::isKirtan('gurmukhi'));
        $this->assertTrue(DivisionTypeResolver::isGurmukhi('gurmukhi'));
    }

    /* ───────────────────────────────────────────────
       Case differences
       ─────────────────────────────────────────────── */

    public function test_capitalised_and_padded_types_are_normalised(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division(' Kirtan '));
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('GURMUKHI'));
    }

    /* ───────────────────────────────────────────────
       Substring matching on type
       ─────────────────────────────────────────────── */

    public function test_kirtan_substring_type_is_kirtan(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division('Kirtan Class'));
        $this->assertSame('kirtan', DivisionTypeResolver::division('kirtan-track'));
        $this->assertSame('kirtan', DivisionTypeResolver::division('kirtanclass'));
    }

    public function test_gurmukhi_substring_type_is_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('GURMUKHI-LEVEL-1'));
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('gurmukhi class'));
    }

    /* ───────────────────────────────────────────────
       Name fallback (substring on class name)
       ─────────────────────────────────────────────── */

    public function test_null_type_with_kirtan_name_falls_back_to_kirtan(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division(null, 'Kirtan Tabla'));
        $this->assertTrue(DivisionTypeResolver::isKirtan(null, 'Kirtan Tabla'));
    }

    public function test_empty_type_with_kirtan_name_falls_back_to_kirtan(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division('', 'Kirtan Evening'));
    }

    public function test_null_type_with_gurmukhi_name_defaults_to_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', DivisionTypeResolver::division(null, 'Gurmukhi Sec A'));
    }

    public function test_type_precedence_beats_kirtan_name(): void
    {
        // A class tagged gurmukhi is gurmukhi even if its name mentions Kirtan.
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('gurmukhi', 'Kirtan'));
    }

    /* ───────────────────────────────────────────────
       Empty / null / unexpected values
       ─────────────────────────────────────────────── */

    public function test_null_type_and_null_name_default_to_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', DivisionTypeResolver::division(null, null));
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('', ''));
        $this->assertFalse(DivisionTypeResolver::isKirtan(null, null));
    }

    public function test_unknown_type_and_name_default_to_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('music', 'Music'));
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('elective', null));
        $this->assertFalse(DivisionTypeResolver::isKirtan('elective', 'Music'));
    }

    public function test_gurmukhi_name_does_not_force_gurmukhi_away_from_kirtan_type(): void
    {
        $this->assertSame('kirtan', DivisionTypeResolver::division('kirtan', 'Gurmukhi Beginner'));
    }
}
