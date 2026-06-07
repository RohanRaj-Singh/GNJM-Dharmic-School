<?php

namespace Tests\Unit\StudentReport;

use App\Support\StudentReport\Enums\Division;
use App\Support\StudentReport\NormalizeDivision;
use PHPUnit\Framework\TestCase;

class NormalizeDivisionTest extends TestCase
{
    public function test_exact_kirtan_type(): void
    {
        $this->assertSame(Division::Kirtan, NormalizeDivision::fromClass('kirtan'));
    }

    public function test_exact_gurmukhi_type(): void
    {
        $this->assertSame(Division::Gurmukhi, NormalizeDivision::fromClass('gurmukhi'));
    }

    public function test_capitalised_kirtan_type(): void
    {
        $this->assertSame(Division::Kirtan, NormalizeDivision::fromClass('Kirtan Class'));
    }

    public function test_substring_match_on_type(): void
    {
        $this->assertSame(Division::Kirtan, NormalizeDivision::fromClass('kirtan-track'));
        $this->assertSame(Division::Gurmukhi, NormalizeDivision::fromClass('GURMUKHI-LEVEL-1'));
    }

    public function test_null_type_with_kirtan_name_falls_back_to_name(): void
    {
        $this->assertSame(Division::Kirtan, NormalizeDivision::fromClass(null, 'Kirtan Tabla'));
    }

    public function test_null_type_with_gurmukhi_name_falls_back_to_name(): void
    {
        $this->assertSame(Division::Gurmukhi, NormalizeDivision::fromClass(null, 'Gurmukhi Sec A'));
    }

    public function test_both_null_defaults_to_gurmukhi(): void
    {
        $this->assertSame(Division::Gurmukhi, NormalizeDivision::fromClass(null, null));
        $this->assertSame(Division::Gurmukhi, NormalizeDivision::fromClass('', ''));
    }
}
