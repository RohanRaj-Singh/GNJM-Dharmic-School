<?php

namespace Tests\Unit\StudentReport;

use App\Support\StudentReport\EnrollmentInfo;
use App\Support\StudentReport\NormalizeDivision;
use PHPUnit\Framework\TestCase;

class NormalizeDivisionTest extends TestCase
{
    public function test_exact_kirtan_type(): void
    {
        $this->assertSame('kirtan', NormalizeDivision::fromClass('kirtan'));
    }

    public function test_exact_gurmukhi_type(): void
    {
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass('gurmukhi'));
    }

    public function test_capitalised_kirtan_type(): void
    {
        $this->assertSame('kirtan', NormalizeDivision::fromClass('Kirtan Class'));
    }

    public function test_substring_match_on_type(): void
    {
        $this->assertSame('kirtan', NormalizeDivision::fromClass('kirtan-track'));
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass('GURMUKHI-LEVEL-1'));
    }

    public function test_null_type_with_kirtan_name_falls_back_to_name(): void
    {
        $this->assertSame('kirtan', NormalizeDivision::fromClass(null, 'Kirtan Tabla'));
    }

    public function test_null_type_with_gurmukhi_name_falls_back_to_name(): void
    {
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass(null, 'Gurmukhi Sec A'));
    }

    public function test_both_null_defaults_to_gurmukhi(): void
    {
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass(null, null));
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass('', ''));
    }

    /* ───────────────────────────────────────────────
       Stage A3 — open division (was a closed 2-case enum)
       ─────────────────────────────────────────────── */

    public function test_unknown_type_returns_plain_string_without_throwing(): void
    {
        // The resolver still maps an unknown type to the gurmukhi default, but
        // the return is now a plain string — a third+ division is representable
        // through the facade instead of throwing a ValueError on the old enum.
        $this->assertSame('gurmukhi', NormalizeDivision::fromClass('music', 'Music'));
    }

    public function test_third_division_string_flows_through_value_objects(): void
    {
        // The value objects that were enum-typed now accept any open division
        // key. This is the contract the closed enum could never satisfy.
        $info = new EnrollmentInfo(1, 2, 'Music', 'Music A', 'music');
        $this->assertSame('music', $info->toArray()['division']);
        $this->assertSame('Music', $info->toArray()['division_label']);
    }
}
