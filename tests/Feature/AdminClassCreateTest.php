<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\User;
use App\Support\ClassSchedule;
use App\Support\DivisionTypeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Stage B10 — new-class creation round-trip.
 *
 * The standing failure mode the audit wants to prevent: a class named
 * "Music" created through the admin UI silently lands in the Gurmukhi
 * bucket because the legacy `type='gurmukhi'` default is preserved.
 * The fixed save endpoint writes an explicit `division` slug so the
 * resolver, attendance-day rules, and monthly-fee rules all pick the
 * correct bucket for a third+ class.
 *
 * The four cases here pin:
 *  1. full Stage B config (modal path) — division, attendance, fees
 *  2. Kirtan name → Sunday-only + no fees (real business rule)
 *  3. inline-row payload (no Stage B fields) — defaults to Mon-Sat
 *  4. existing id → update-only branch is unchanged
 */
class AdminClassCreateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'class_create_admin',
        ]);
    }

    public function test_modal_payload_creates_class_with_full_stage_b_config(): void
    {
        $response = $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'name' => 'Music',
                'attendance_days' => [1, 2, 3, 4, 5, 6],
                'charges_monthly_fee' => true,
                'default_monthly_fee' => 500,
            ]],
        ]);

        $response->assertRedirect();

        $class = SchoolClass::where('name', 'Music')->firstOrFail();
        $this->assertSame('music', $class->division);
        $this->assertSame('music', $class->type);
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendance_days);
        $this->assertTrue($class->charges_monthly_fee);
        $this->assertSame(500, (int) $class->default_monthly_fee);

        // Resolver and schedule both honour the explicit config.
        $this->assertSame('music', DivisionTypeResolver::division($class->type, $class->name, $class->division));
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendanceDays());
        $this->assertTrue($class->chargesMonthlyFee());
    }

    public function test_kirtan_name_defaults_to_sunday_only_without_monthly_fees(): void
    {
        $response = $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'name' => 'Kirtan',
            ]],
        ]);

        $response->assertRedirect();

        $class = SchoolClass::where('name', 'Kirtan')->firstOrFail();
        $this->assertSame('kirtan', $class->division);
        $this->assertSame([0], $class->attendance_days);
        $this->assertFalse($class->charges_monthly_fee);
        $this->assertSame(0, (int) $class->default_monthly_fee);

        // End-to-end behaviour matches the real business rule.
        $this->assertSame('kirtan', DivisionTypeResolver::division($class->type, $class->name, $class->division));
        $this->assertTrue($class->isAttendanceDay(\Illuminate\Support\Carbon::create(2026, 8, 16))); // Sunday
        $this->assertFalse($class->isAttendanceDay(\Illuminate\Support\Carbon::create(2026, 8, 13))); // Thursday
        $this->assertFalse($class->chargesMonthlyFee());
    }

    public function test_inline_row_payload_without_stage_b_fields_defaults_to_mon_sat(): void
    {
        $response = $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'name' => 'Tabla',
            ]],
        ]);

        $response->assertRedirect();

        $class = SchoolClass::where('name', 'Tabla')->firstOrFail();
        $this->assertSame('tabla', $class->division);
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendance_days);
        // The inline-row path historically had no monthly fees (default_monthly_fee=0).
        $this->assertFalse($class->charges_monthly_fee);
        $this->assertSame(0, (int) $class->default_monthly_fee);
    }

    public function test_existing_row_is_updated_not_replaced(): void
    {
        $existing = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'division' => 'gurmukhi',
            'attendance_days' => [1, 2, 3, 4, 5, 6],
            'charges_monthly_fee' => true,
            'default_monthly_fee' => 400,
        ]);

        $response = $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'id' => $existing->id,
                'name' => 'Gurmukhi Beginners',
                'type' => 'gurmukhi',
            ]],
        ]);

        $response->assertRedirect();

        $existing->refresh();
        $this->assertSame('Gurmukhi Beginners', $existing->name);
        // Stage B config is untouched on update — the audit only widens the
        // create path, leaving the existing edit-by-name pattern unchanged.
        $this->assertSame([1, 2, 3, 4, 5, 6], $existing->attendance_days);
        $this->assertSame(400, (int) $existing->default_monthly_fee);
    }
}
