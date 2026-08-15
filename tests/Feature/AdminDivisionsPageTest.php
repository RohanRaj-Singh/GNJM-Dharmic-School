<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Sprint 6.4 / L-1 — Pin the admin division settings page.
 *
 * Surfaces every division the resolver returns with its business-rule
 * summary (attendance days, charges-monthly-fee, default fee) and
 * operational counts. Pure read; no editing.
 *
 * Pins three things at the API level (`/admin/divisions/data`):
 *  1. The response is bucketed by division key, not by class.
 *  2. A third+ division (Music/Tabla) surfaces its own bucket without
 *     a code change.
 *  3. Business-rule rollups (attendance day union, charges-fees flag,
 *     fee range) are computed across the division's classes.
 *
 * Plus two page-level checks: route is reachable for an admin, and the
 * sidebar exposes the entry (mirrors AdminClassesSidebarLinkTest).
 */
class AdminDivisionsPageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'divisions_page',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeClass(
        string $name,
        ?string $overrideType = null,
        ?string $overrideDivision = null,
        array $attendanceDays = [1, 2, 3, 4, 5, 6],
        bool $chargesFees = true,
        int $defaultFee = 500,
    ): SchoolClass {
        $slug = \Illuminate\Support\Str::slug($name) ?: 'class';
        return SchoolClass::create([
            'name' => $name,
            'type' => $overrideType ?? $slug,
            'division' => $overrideDivision ?? ($overrideType ?? $slug),
            'attendance_days' => $attendanceDays,
            'charges_monthly_fee' => $chargesFees,
            'default_monthly_fee' => $defaultFee,
        ]);
    }

    private function enroll(SchoolClass $class, string $studentName, string $studentType = 'paid'): StudentSection
    {
        $section = Section::firstOrCreate(
            ['class_id' => $class->id, 'name' => $class->name . ' A'],
            ['monthly_fee' => $class->default_monthly_fee]
        );

        $student = Student::firstOrCreate(
            ['name' => $studentName],
            [
                'father_name' => 'Father of ' . $studentName,
                'status' => Student::STATUS_ACTIVE,
            ]
        );

        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => $studentType,
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
    }

    public function test_data_endpoint_buckets_three_divisions(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi');
        $kirtan = $this->makeClass('Kirtan', attendanceDays: [0], chargesFees: false, defaultFee: 0);
        $music = $this->makeClass('Music', defaultFee: 800);

        $response = $this->actingAs($this->admin)->getJson('/admin/divisions/data');
        $response->assertOk();

        $divisions = $response->json('divisions');
        $this->assertIsArray($divisions);
        $this->assertCount(3, $divisions);

        $keys = array_column($divisions, 'key');
        $this->assertEqualsCanonicalizing(['gurmukhi', 'kirtan', 'music'], $keys);
    }

    public function test_data_endpoint_rolls_up_business_rules_per_division(): void
    {
        // Kirtan bucket: Sunday-only + no fees (the audit's "Kirtan business rule").
        $this->makeClass('Kirtan', attendanceDays: [0], chargesFees: false, defaultFee: 0);

        // Music bucket: charges 800.
        $this->makeClass('Music', defaultFee: 800);

        // Gurmukhi bucket: single class — no range to test, but pin the basics.
        $this->makeClass('Gurmukhi', defaultFee: 500);

        $response = $this->actingAs($this->admin)->getJson('/admin/divisions/data');
        $response->assertOk();

        $byKey = collect($response->json('divisions'))->keyBy('key');

        $this->assertSame([0], $byKey['kirtan']['attendance_days']);
        $this->assertFalse($byKey['kirtan']['charges_monthly_fee']);
        $this->assertSame(0, $byKey['kirtan']['default_monthly_fee_min']);
        $this->assertSame(0, $byKey['kirtan']['default_monthly_fee_max']);

        $this->assertSame([1, 2, 3, 4, 5, 6], $byKey['gurmukhi']['attendance_days']);
        $this->assertTrue($byKey['gurmukhi']['charges_monthly_fee']);
        $this->assertSame(500, $byKey['gurmukhi']['default_monthly_fee_min']);
        $this->assertSame(500, $byKey['gurmukhi']['default_monthly_fee_max']);
        $this->assertSame(1, $byKey['gurmukhi']['classes_count']);

        $this->assertTrue($byKey['music']['charges_monthly_fee']);
        $this->assertSame(800, $byKey['music']['default_monthly_fee_min']);
    }

    public function test_data_endpoint_counts_active_and_free_students(): void
    {
        $paid = $this->makeClass('Gurmukhi');
        $free = $this->makeClass('Kirtan', attendanceDays: [0], chargesFees: false, defaultFee: 0);

        $this->enroll($paid, 'Paid One', 'paid');
        $this->enroll($paid, 'Paid Two', 'paid');
        $this->enroll($free, 'Free One', 'free');

        $response = $this->actingAs($this->admin)->getJson('/admin/divisions/data');
        $response->assertOk();

        $byKey = collect($response->json('divisions'))->keyBy('key');

        $this->assertSame(2, $byKey['gurmukhi']['students_count']);
        $this->assertSame(0, $byKey['gurmukhi']['free_students_count']);
        $this->assertSame(1, $byKey['kirtan']['students_count']);
        $this->assertSame(1, $byKey['kirtan']['free_students_count']);
    }

    public function test_index_page_renders_for_admin(): void
    {
        $response = $this->actingAs($this->admin)->get('/admin/divisions');
        $response->assertOk();
    }

    public function test_admin_sidebar_exposes_divisions_link(): void
    {
        $layoutPath = base_path('resources/js/Layouts/AdminLayout.jsx');
        $this->assertFileExists($layoutPath);

        $source = file_get_contents($layoutPath);

        $this->assertMatchesRegularExpression(
            '/<SidebarLink\b[^>]*href=["\']\/admin\/divisions["\'][^>]*\/>/s',
            $source,
            'AdminLayout.jsx must render a <SidebarLink href="/admin/divisions" /> so the division settings page is discoverable.'
        );

        // Confirm label is human-readable.
        preg_match(
            '/<SidebarLink\b[^>]*href=["\']\/admin\/divisions["\'][^>]*label=["\']([^"\']+)["\'][^>]*\/>/s',
            $source,
            $matches
        );
        $this->assertNotEmpty($matches);
        $this->assertSame('Divisions', $matches[1]);
    }
}