<?php

namespace Tests\Unit\StudentReport;

use App\Support\StudentReport\MonthRange;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class MonthRangeTest extends TestCase
{
    public function test_calendar_year_produces_12_months(): void
    {
        $r = MonthRange::forCalendarYear(2026);
        $this->assertSame(12, $r->totalMonths);
        $this->assertSame('2026-01', $r->startLabel);
        $this->assertSame('2026-12', $r->endLabel);
        $this->assertSame('Jan 2026', $r->months[0]->label);
        $this->assertSame('Dec 2026', $r->months[11]->label);
    }

    public function test_academic_session_is_april_to_march(): void
    {
        $r = MonthRange::forAcademicSession(2025);
        $this->assertSame(12, $r->totalMonths);
        $this->assertSame('2025-04', $r->startLabel);
        $this->assertSame('2026-03', $r->endLabel);
        $this->assertSame('Apr 2025', $r->months[0]->label);
        $this->assertSame('Mar 2026', $r->months[11]->label);
    }

    public function test_single_month_produces_one_cell(): void
    {
        $r = MonthRange::forMonth('2026-03');
        $this->assertSame(1, $r->totalMonths);
        $this->assertSame('Mar 2026', $r->months[0]->label);
    }

    public function test_custom_range_18_months(): void
    {
        $r = MonthRange::forRange('2025-01', '2026-06');
        $this->assertSame(18, $r->totalMonths);
        $this->assertSame('Jan 2025', $r->months[0]->label);
        $this->assertSame('Jun 2026', $r->months[17]->label);
    }

    public function test_inverted_range_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MonthRange::forRange('2026-06', '2025-01');
    }

    public function test_invalid_format_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MonthRange::forRange('2026-13', '2026-12');
    }

    public function test_non_string_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MonthRange::forRange('not-a-date', '2026-12');
    }

    public function test_over_120_months_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        // 2014-01 → 2026-12 is 156 months, well over 120.
        MonthRange::forRange('2014-01', '2026-12');
    }

    public function test_exactly_120_months_passes(): void
    {
        // 2016-01 → 2025-12 is exactly 120 months.
        $r = MonthRange::forRange('2016-01', '2025-12');
        $this->assertSame(120, $r->totalMonths);
        $this->assertSame('Jan 2016', $r->months[0]->label);
        $this->assertSame('Dec 2025', $r->months[119]->label);
    }

    public function test_121_months_throws(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MonthRange::forRange('2016-01', '2026-01');
    }
}
