<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the cross-division visibility contract for the admin dashboard's
 * "Top Absentees" and "Top Pending Fees" widgets.
 *
 * Background: `Admin/DashboardController.php::topAbsentees()` and
 * `topPendingFees()` JOIN the classes table to surface the class_type /
 * class_division alongside each per-student row. Before B18/B1, both
 * SELECTs only fetched `classes.type` and called the legacy 2-arg
 * `DivisionTypeResolver::division($type, $name)`. With a class like
 * "Music" that has `type='gurmukhi'` + `division='music'`, the resolver
 * returned 'gurmukhi' — so the dashboard's "Music" card never surfaced
 * its own top absentees / pending-fees lists; everything filed under
 * the Gurmukhi card.
 *
 * The B18/B1 fix ships `classes.division as class_division` and uses
 * the 3-arg resolver. This test pins that contract end-to-end: a class
 * with explicit `division='music'` must surface in the JSON response
 * with `division_type === 'music'`, not the legacy gurmukhi bucket.
 *
 * Companion files:
 *   - app/Http/Controllers/Admin/DashboardController.php (topAbsentees,
 *     topPendingFees)
 *   - app/Support/DivisionTypeResolver.php (the explicit-first seam)
 *   - docs/14-admin-screens-audit.md §1 B1
 */
class AdminDashboardCrossDivisionVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $gurmukhi;
    private Section $gurmukhiSection;
    private SchoolClass $kirtan;
    private Section $kirtanSection;
    private SchoolClass $music;
    private Section $musicSection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role'     => 'admin',
            'username' => 'admin_dashboard_division_test',
        ]);

        // Two legacy divisions + one third+ class with the bucket-collapse
        // bait: type='gurmukhi' but explicit division='music'. Pre-fix,
        // this row was filed under "gurmukhi" in the dashboard JSON.
        $this->gurmukhi = SchoolClass::create([
            'name'                => 'Gurmukhi',
            'type'                => 'gurmukhi',
            'division'            => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->gurmukhiSection = Section::create([
            'class_id'    => $this->gurmukhi->id,
            'name'        => 'A',
            'monthly_fee' => 600,
        ]);

        $this->kirtan = SchoolClass::create([
            'name'                => 'Kirtan',
            'type'                => 'kirtan',
            'division'            => 'kirtan',
            'default_monthly_fee' => 0,
        ]);
        $this->kirtanSection = Section::create([
            'class_id'    => $this->kirtan->id,
            'name'        => 'B',
            'monthly_fee' => 0,
        ]);

        $this->music = SchoolClass::create([
            'name'                => 'Music',
            'type'                => 'gurmukhi', // legacy classification
            'division'            => 'music',    // explicit seam — wins
            'default_monthly_fee' => 500,
        ]);
        $this->musicSection = Section::create([
            'class_id'    => $this->music->id,
            'name'        => 'C',
            'monthly_fee' => 500,
        ]);
    }

    private function enroll(string $name, SchoolClass $class, Section $section): Student
    {
        $student = Student::create([
            'name'        => $name,
            'father_name' => 'Test Father',
            'status'      => Student::STATUS_ACTIVE,
        ]);

        StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => 'active',
            'started_at'   => '2026-07-01',
        ]);

        return $student;
    }

    private function hitSummary(): array
    {
        // Hit by URL (not by route() helper) so the test is independent of
        // the route's current name. The double-prefix bug (B2) was caught
        // *by this test* — calling route('admin.dashboard.summary') throws
        // RouteNotFoundException because the registered name is
        // 'admin.admin.dashboard.summary'. After B2 lands, this test still
        // works regardless of which name the route settles on.
        $response = $this->actingAs($this->admin)->get('/admin/dashboard/summary');
        $response->assertOk();
        return $response->json();
    }

    /* ───────────────────────────────────────────────────────────
       Top Absentees — third+ division classes must surface
       under their own division_type
       ─────────────────────────────────────────────────────────── */

    public function test_top_absentees_third_division_class_surfaces_under_music_bucket(): void
    {
        $musicStudent = $this->enroll('Music Kid', $this->music, $this->musicSection);
        $gurmukhiStudent = $this->enroll('Gurmukhi Kid', $this->gurmukhi, $this->gurmukhiSection);

        // Seed 3 absent rows for Music Kid in 2026 — the year the
        // dashboard summary defaults to.
        foreach (['2026-08-01', '2026-08-08', '2026-08-15'] as $date) {
            Attendance::create([
                'student_id'         => $musicStudent->id,
                'student_section_id' => $musicStudent->enrollments->first()->id,
                'class_id'           => $this->music->id,
                'section_id'         => $this->musicSection->id,
                'date'               => $date,
                'status'             => 'absent',
            ]);
        }

        // And 1 absent row for Gurmukhi Kid, so the dashboard has rows
        // for both divisions.
        Attendance::create([
            'student_id'         => $gurmukhiStudent->id,
            'student_section_id' => $gurmukhiStudent->enrollments->first()->id,
            'class_id'           => $this->gurmukhi->id,
            'section_id'         => $this->gurmukhiSection->id,
            'date'               => '2026-08-01',
            'status'             => 'absent',
        ]);

        $summary = $this->hitSummary();

        $topAbsentees = collect($summary['insights']['top_absentees'] ?? []);

        $musicRow = $topAbsentees->firstWhere('student_id', $musicStudent->id);
        $this->assertNotNull($musicRow, 'Music Kid missing from top_absentees');
        $this->assertSame(
            'music',
            $musicRow['division_type'],
            'Music Kid should resolve to division_type=music (explicit seam wins), '
            . 'not the legacy gurmukhi bucket.'
        );
        $this->assertSame(3, $musicRow['absent_days']);

        $gurmukhiRow = $topAbsentees->firstWhere('student_id', $gurmukhiStudent->id);
        $this->assertNotNull($gurmukhiRow, 'Gurmukhi Kid missing from top_absentees');
        $this->assertSame('gurmukhi', $gurmukhiRow['division_type']);
    }

    /* ───────────────────────────────────────────────────────────
       Top Pending Fees — same contract as Top Absentees
       ─────────────────────────────────────────────────────────── */

    public function test_top_pending_fees_third_division_class_surfaces_under_music_bucket(): void
    {
        $musicStudent = $this->enroll('Music Fee Kid', $this->music, $this->musicSection);
        $kirtanStudent = $this->enroll('Kirtan Fee Kid', $this->kirtan, $this->kirtanSection);

        // Music Fee Kid: a monthly fee that has no payments yet.
        Fee::create([
            'student_id'         => $musicStudent->id,
            'student_section_id' => $musicStudent->enrollments->first()->id,
            'type'               => 'monthly',
            'month'              => '2026-08',
            'amount'             => 500,
        ]);

        // Kirtan Fee Kid: paid already, so should NOT appear in
        // top_pending_fees.
        Fee::create([
            'student_id'         => $kirtanStudent->id,
            'student_section_id' => $kirtanStudent->enrollments->first()->id,
            'type'               => 'monthly',
            'month'              => '2026-08',
            'amount'             => 0,
        ]);

        $summary = $this->hitSummary();

        $topPending = collect($summary['insights']['top_pending_fees'] ?? []);

        $musicRow = $topPending->firstWhere('student_id', $musicStudent->id);
        $this->assertNotNull(
            $musicRow,
            'Music Fee Kid missing from top_pending_fees — the join or year filter must be off.'
        );
        $this->assertSame(
            'music',
            $musicRow['division_type'],
            'Music Fee Kid should resolve to division_type=music, not gurmukhi.'
        );
        $this->assertSame(500, $musicRow['pending_amount']);
        $this->assertSame(1, $musicRow['pending_fee_count']);

        // Sanity: Kirtan Fee Kid's fee was 0 + no payment row exists, so
        // pending_amount is 0. The row may still surface (the join is
        // permissive) but should be filed under 'kirtan' — never 'music'.
        $kirtanRow = $topPending->firstWhere('student_id', $kirtanStudent->id);
        if ($kirtanRow !== null) {
            $this->assertSame('kirtan', $kirtanRow['division_type']);
        }
    }

    /* ───────────────────────────────────────────────────────────
       Legacy Gurmukhi / Kirtan — explicit divisions still match
       the legacy type-based bucket. Regression pin.
       ─────────────────────────────────────────────────────────── */

    public function test_legacy_gurmukhi_and_kirtan_still_resolve_to_their_legacy_buckets(): void
    {
        $gStudent = $this->enroll('G Only', $this->gurmukhi, $this->gurmukhiSection);
        $kStudent = $this->enroll('K Only', $this->kirtan, $this->kirtanSection);

        foreach ([$gStudent, $kStudent] as $student) {
            Attendance::create([
                'student_id'         => $student->id,
                'student_section_id' => $student->enrollments->first()->id,
                'class_id'           => $student->enrollments->first()->class_id,
                'section_id'         => $student->enrollments->first()->section_id,
                'date'               => '2026-08-01',
                'status'             => 'absent',
            ]);
        }

        $summary = $this->hitSummary();
        $topAbsentees = collect($summary['insights']['top_absentees'] ?? []);

        $gRow = $topAbsentees->firstWhere('student_id', $gStudent->id);
        $kRow = $topAbsentees->firstWhere('student_id', $kStudent->id);

        $this->assertSame('gurmukhi', $gRow['division_type'] ?? null);
        $this->assertSame('kirtan', $kRow['division_type'] ?? null);
    }

    /* ───────────────────────────────────────────────────────────
       The dashboard summary's overall `divisions[]` must include
       the third+ bucket too — this is the existing B17 contract,
       and it's the precondition for the per-row bucket test above.
       ─────────────────────────────────────────────────────────── */

    public function test_summary_divisions_list_includes_music_bucket(): void
    {
        $summary = $this->hitSummary();
        $divisionTypes = collect($summary['divisions'] ?? [])->pluck('type')->all();

        $this->assertContains('music', $divisionTypes);
        $this->assertContains('gurmukhi', $divisionTypes);
        $this->assertContains('kirtan', $divisionTypes);
    }
}
