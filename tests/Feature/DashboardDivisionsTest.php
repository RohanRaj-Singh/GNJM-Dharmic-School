<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * B14 — `/admin/dashboard/summary` returns one bucket per distinct division
 * the resolver surfaces.
 *
 * The audit flagged DashboardController::buildDivisions because an earlier
 * shape assumed two fixed keys (gurmukhi + kirtan) and silently dropped a
 * third+ division. The fix routes the bucket list through
 * DivisionTypeResolver::division() so adding a Music class surfaces a
 * 'music' bucket automatically.
 *
 * These tests pin four things:
 *  1. Three divisions → three buckets, in deterministic order (ksort by key).
 *  2. The Stage A2 explicit-division seam (classes.division='music' on a
 *     type='misc' row resolves to 'music', not the legacy gurmukhi default).
 *  3. Multiple Gurmukhi classes collapse into a single 'gurmukhi' bucket.
 *  4. Each bucket exposes the same shape (stats + fees + attendance + classes),
 *     so a third+ bucket renders identically to the others on the dashboard.
 */
class DashboardDivisionsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'dashboard_divisions',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_three_division_buckets_for_three_classes(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $kirtan   = $this->makeClass('Kirtan', 'kirtan', 'kirtan');
        $music    = $this->makeClass('Music', 'music', 'music');

        $body = $this->getDashboard();

        $this->assertCount(3, $body['divisions']);
        $this->assertSame('gurmukhi', $body['divisions'][0]['type']);
        $this->assertSame('Gurmukhi', $body['divisions'][0]['title']);
        $this->assertSame('kirtan', $body['divisions'][1]['type']);
        $this->assertSame('Kirtan', $body['divisions'][1]['title']);
        $this->assertSame('music', $body['divisions'][2]['type']);
        $this->assertSame('Music', $body['divisions'][2]['title']);
    }

    public function test_explicit_division_seam_drives_buckets(): void
    {
        // Stage A2 seam: a class with type='misc' but division='music' must
        // resolve to 'music'. The dashboard should expose 'music' as its own
        // bucket, not collapse it into 'gurmukhi'.
        $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Special Music', 'misc', 'music');

        $body = $this->getDashboard();

        $types = array_column($body['divisions'], 'type');
        $this->assertContains('music', $types);
        $this->assertNotContains('misc', $types);
        $this->assertCount(2, $body['divisions']);
    }

    public function test_multiple_gurmukhi_classes_share_one_bucket(): void
    {
        // Two Gurmukhi classes must produce ONE 'gurmukhi' bucket (the
        // resolver's union) so the dashboard doesn't double-count students.
        $this->makeClass('Gurmukhi Beginners', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Gurmukhi Advanced', 'gurmukhi', 'gurmukhi');
        $kirtan = $this->makeClass('Kirtan', 'kirtan', 'kirtan');

        $body = $this->getDashboard();

        $this->assertCount(2, $body['divisions']);
        $gurmukhiBucket = collect($body['divisions'])->firstWhere('type', 'gurmukhi');
        $this->assertNotNull($gurmukhiBucket);
        $this->assertSame(2, $gurmukhiBucket['stats']['classes_count']);
        $this->assertCount(2, $gurmukhiBucket['classes']);
    }

    public function test_third_division_bucket_has_full_shape(): void
    {
        // Regression: a third+ bucket must expose every field the dashboard
        // renders, so a "Music" tile looks identical to a "Gurmukhi" tile.
        $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Kirtan', 'kirtan', 'kirtan');
        $music = $this->makeClass('Music', 'music', 'music');

        // Pin the Music bucket has all the expected keys.
        $body = $this->getDashboard();
        $musicBucket = collect($body['divisions'])->firstWhere('type', 'music');
        $this->assertNotNull($musicBucket);

        $this->assertSame([
            'type', 'title', 'stats', 'fees', 'attendance', 'classes',
        ], array_keys($musicBucket));

        $this->assertSame([
            'classes_count', 'sections_count', 'students_count',
            'free_students_count', 'active_students_count', 'enrollments_count',
        ], array_keys($musicBucket['stats']));

        $this->assertSame(['total', 'collected', 'pending', 'percentage'], array_keys($musicBucket['fees']));
        $this->assertSame(['present', 'absent', 'leave', 'percentage'], array_keys($musicBucket['attendance']));

        // The Music class appears under its own bucket's 'classes' array.
        $musicClassIds = array_column($musicBucket['classes'], 'id');
        $this->assertContains($music->id, $musicClassIds);
    }

    public function test_buckets_count_distinct_active_students(): void
    {
        // Pin that the per-division stats actually use the bucket's class set,
        // not the whole table — a regression guard against the dashboard
        // accidentally double-counting a student who is enrolled in both
        // Gurmukhi and Kirtan.
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $kirtan   = $this->makeClass('Kirtan', 'kirtan', 'kirtan');

        $multi = Student::create([
            'name' => 'Multi Kid',
            'father_name' => 'Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $gSection = $this->makeSection($gurmukhi);
        $kSection = $this->makeSection($kirtan);

        StudentSection::create([
            'student_id' => $multi->id,
            'class_id' => $gurmukhi->id,
            'section_id' => $gSection->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        StudentSection::create([
            'student_id' => $multi->id,
            'class_id' => $kirtan->id,
            'section_id' => $kSection->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $body = $this->getDashboard();

        $gBucket = collect($body['divisions'])->firstWhere('type', 'gurmukhi');
        $kBucket = collect($body['divisions'])->firstWhere('type', 'kirtan');

        $this->assertSame(1, $gBucket['stats']['students_count']);
        $this->assertSame(1, $kBucket['stats']['students_count']);
        $this->assertSame(1, $gBucket['stats']['enrollments_count']);
        $this->assertSame(1, $kBucket['stats']['enrollments_count']);
    }

    /* ───────────────────────────────────────────────
       Fixture helpers
       ─────────────────────────────────────────────── */

    private function makeClass(string $name, string $type, string $division): SchoolClass
    {
        return SchoolClass::create([
            'name' => $name,
            'type' => $type,
            'division' => $division,
            'attendance_days' => $type === 'kirtan' ? [0] : [1, 2, 3, 4, 5, 6],
            'charges_monthly_fee' => $type !== 'kirtan',
            'default_monthly_fee' => $type === 'kirtan' ? 0 : 500,
        ]);
    }

    private function makeSection(SchoolClass $class): Section
    {
        return Section::create([
            'class_id' => $class->id,
            'name' => $class->name . ' A',
            'monthly_fee' => $class->default_monthly_fee,
        ]);
    }

    private function getDashboard(): array
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/admin/dashboard/summary?year=2026');

        $response->assertOk();
        return $response->json();
    }
}