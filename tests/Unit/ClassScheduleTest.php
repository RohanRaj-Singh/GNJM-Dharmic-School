<?php

namespace Tests\Unit;

use App\Models\SchoolClass;
use App\Support\ClassSchedule;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * Stage B seam — "what configuration does this class have?"
 *
 * Locks two contracts:
 *  1. Legacy rows with NULL config resolve exactly as today: Kirtan is
 *     Sunday-only and excluded from monthly fees; every other class is
 *     Monday–Saturday and participates in fees.
 *  2. Explicit config wins — a configured third class never touches the
 *     Kirtan fallback.
 */
class ClassScheduleTest extends TestCase
{
    public function test_legacy_gurmukhi_is_monday_to_saturday_and_charges_fees(): void
    {
        $this->assertSame(
            [1, 2, 3, 4, 5, 6],
            ClassSchedule::attendanceDays('gurmukhi', 'Gurmukhi'),
        );
        $this->assertTrue(ClassSchedule::chargesMonthlyFee('gurmukhi', 'Gurmukhi'));
    }

    public function test_legacy_kirtan_is_sunday_only_and_excluded_from_fees(): void
    {
        $this->assertSame(
            [0],
            ClassSchedule::attendanceDays('kirtan', 'Kirtan'),
        );
        $this->assertFalse(ClassSchedule::chargesMonthlyFee('kirtan', 'Kirtan'));
    }

    public function test_explicit_attendance_days_win_over_legacy_inference(): void
    {
        // A kirtan-named class configured to run Mon–Sat keeps that config.
        $this->assertSame(
            [1, 2, 3, 4, 5, 6],
            ClassSchedule::attendanceDays('music', 'Tabla', [1, 2, 3, 4, 5, 6]),
        );

        // A class that explicitly opts into Sunday is allowed it.
        $this->assertSame(
            [0, 1, 2, 3, 4, 5, 6],
            ClassSchedule::attendanceDays('music', 'Tabla', [0, 1, 2, 3, 4, 5, 6]),
        );
    }

    public function test_explicit_fee_policy_wins_over_legacy_inference(): void
    {
        // A music class that opts into monthly fees.
        $this->assertTrue(ClassSchedule::chargesMonthlyFee('music', 'Tabla', true));
        // A non-kirtan class that opts out.
        $this->assertFalse(ClassSchedule::chargesMonthlyFee('gurmukhi', 'Gurmukhi', false));
    }

    public function test_is_attendance_day_matches_effective_days(): void
    {
        $sunday = Carbon::parse('2026-08-16'); // 2026-08-16 is a Sunday
        $monday = Carbon::parse('2026-08-17'); // 2026-08-17 is a Monday

        $this->assertTrue(ClassSchedule::isAttendanceDay('kirtan', 'Kirtan', null, $sunday));
        $this->assertFalse(ClassSchedule::isAttendanceDay('kirtan', 'Kirtan', null, $monday));

        $this->assertTrue(ClassSchedule::isAttendanceDay('gurmukhi', 'Gurmukhi', null, $monday));
        $this->assertFalse(ClassSchedule::isAttendanceDay('gurmukhi', 'Gurmukhi', null, $sunday));

        // Explicit full-week class: every day is valid.
        $this->assertTrue(ClassSchedule::isAttendanceDay('music', 'Tabla', [0, 1, 2, 3, 4, 5, 6], $sunday));
    }

    public function test_model_accessors_delegate_to_the_seam(): void
    {
        $gurmukhi = new SchoolClass(['type' => 'gurmukhi', 'name' => 'Gurmukhi']);
        $this->assertSame([1, 2, 3, 4, 5, 6], $gurmukhi->attendanceDays());
        $this->assertTrue($gurmukhi->chargesMonthlyFee());
        $this->assertSame('Monday–Saturday', $gurmukhi->attendanceDaysLabel());

        $kirtan = new SchoolClass(['type' => 'kirtan', 'name' => 'Kirtan']);
        $this->assertSame([0], $kirtan->attendanceDays());
        $this->assertFalse($kirtan->chargesMonthlyFee());
        $this->assertSame('Sunday', $kirtan->attendanceDaysLabel());

        $tabla = new SchoolClass([
            'type' => 'music',
            'name' => 'Tabla',
            'division' => 'tabla',
            'attendance_days' => [1, 2, 3, 4, 5, 6],
            'charges_monthly_fee' => true,
        ]);
        $this->assertSame([1, 2, 3, 4, 5, 6], $tabla->attendanceDays());
        $this->assertTrue($tabla->chargesMonthlyFee());
        $this->assertTrue($tabla->isAttendanceDay(Carbon::parse('2026-08-17'))); // Monday
    }

    public function test_day_label_lists_explicit_days(): void
    {
        $this->assertSame(
            'Wednesday, Sunday',
            ClassSchedule::dayLabel('music', 'Tabla', [3, 0]),
        );
    }
}
