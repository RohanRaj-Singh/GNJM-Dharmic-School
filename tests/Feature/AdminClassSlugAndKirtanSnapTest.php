<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * B16 — Pin the slug-derivation + Kirtan-name-snap rules documented in
 * `docs/08-business-rules.md` §8.16 so the docs and the code can't drift
 * apart in a future refactor.
 *
 * The companion test `AdminClassCreateTest` already pins the happy paths:
 *   - "Music" → division='music', Mon-Sat, charges fees (modal path)
 *   - "Kirtan" → division='kirtan', Sunday-only, no fees (snap fires)
 *   - "Tabla" → division='tabla', Mon-Sat, no fees (inline-row path)
 *   - existing-row update doesn't touch Stage B config
 *
 * This file pins the four *edge cases* the audit's C5/C7/M-3 call out:
 *
 *   1. Empty-slug fallback (name with no Latin characters → 'class').
 *   2. Case-insensitive Kirtan snap ('kirtan', 'KIRTAN', 'Kirtan' all snap).
 *   3. The "Kirtan Advanced" trap — only the exact string 'kirtan' snaps,
 *      not a substring or prefix; admin must override toggles manually.
 *   4. The 'Sunday' non-snap — name 'sunday' does NOT trigger Kirtan
 *      defaults (audit C7), because the match is exact-string 'kirtan'.
 */
class AdminClassSlugAndKirtanSnapTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'class_slug_snap',
        ]);
    }

    private function createClass(array $row): SchoolClass
    {
        $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [$row],
        ])->assertRedirect();

        return SchoolClass::where('name', $row['name'])->firstOrFail();
    }

    public function test_empty_slug_falls_back_to_class(): void
    {
        // Str::slug('ਸਿੱਖ�') returns '' (no Latin chars) → fallback 'class'.
        $class = $this->createClass(['name' => 'ਸਿੱਖ�']);

        $this->assertSame('class', $class->division);
        $this->assertSame('class', $class->type);
        // No snap fired (name is not 'kirtan'), so Mon-Sat defaults apply.
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendance_days);
        $this->assertFalse($class->charges_monthly_fee);
    }

    /** @return list<array{string}> */
    public static function kirtanNameProvider(): array
    {
        return [
            ['kirtan'],
            ['Kirtan'],
            ['KIRTAN'],
            ['KiRtAn'],
        ];
    }

    /**
     * @dataProvider kirtanNameProvider
     */
    public function test_kirtan_snap_is_case_insensitive(string $name): void
    {
        $class = $this->createClass(['name' => $name]);

        $this->assertSame('kirtan', $class->division);
        $this->assertSame([0], $class->attendance_days);
        $this->assertFalse($class->charges_monthly_fee);
    }

    public function test_kirtan_advanced_does_not_snap(): void
    {
        // Audit C7 / M-3 edge case: only the EXACT string 'kirtan' snaps.
        // "Kirtan Advanced" matches the resolver's substring fallback (which
        // routes to 'kirtan-advanced' via the explicit-division column), but
        // the snap handler in the route only fires on `name === 'kirtan'`.
        $class = $this->createClass(['name' => 'Kirtan Advanced']);

        $this->assertSame('kirtan-advanced', $class->division);
        // The snap did NOT fire — defaults are Mon-Sat + no fees.
        // If the admin wants Kirtan day-rule, they must rename to 'Kirtan'
        // or set the toggles manually in the modal.
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendance_days);
    }

    public function test_sunday_does_not_snap_to_kirtan(): void
    {
        // Audit C7: a class named 'Sunday' should NOT accidentally pick up
        // Kirtan defaults. The match is exact-string 'kirtan' only.
        $class = $this->createClass(['name' => 'Sunday']);

        $this->assertSame('sunday', $class->division);
        $this->assertSame([1, 2, 3, 4, 5, 6], $class->attendance_days);
        $this->assertFalse($class->charges_monthly_fee);
    }
}