<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the cross-division visibility contract for the admin UI endpoints
 * that surface class lists to the frontend. After the B3 + B4 fixes:
 *
 *   - /admin/classes/options                          ships `division`
 *     (the endpoint the Attendance + StudentProgression frontends actually
 *     re-fetch after mount — the Inertia `classes` prop on each page is
 *     shadowed by this fetch).
 *
 *   - GET /admin/attendance                            Inertia `classes`
 *     prop ships `division` (defensive consistency for the rare SSR-only
 *     consumer and for parity with the options endpoint).
 *
 *   - /admin/utilities/student-progression/data        each enrollment
 *     object ships `classDivision`, so PromoteFlow + the typeBadge +
 *     uniqueTypes helpers can use the 3-arg DivisionTypeResolver
 *     (explicit-first seam) and a Music class (type='gurmukhi' +
 *     division='music') resolves to 'music' instead of collapsing into
 *     the legacy 'gurmukhi' bucket.
 *
 * Companion files:
 *   - app/Http/Controllers/Admin/AdminAttendanceController.php (index)
 *   - routes/admin.php                                  (lines 218-237, 334)
 *   - app/Support/DivisionTypeResolver.php              (the 3-arg seam)
 *   - resources/js/utils/divisionType.js                (frontend twin)
 *   - resources/js/Pages/Admin/Attendance/Index.jsx
 *   - resources/js/Pages/Admin/Utilities/StudentProgression.jsx
 *   - resources/js/Pages/Admin/Utilities/StudentProgression/PromoteFlow.jsx
 *   - docs/14-admin-screens-audit.md §3 B3, B4
 */
class AdminDivisionSeamContractTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $gurmukhi;
    private SchoolClass $kirtan;
    private SchoolClass $music;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role'     => 'admin',
            'username' => 'admin_division_seam_test',
        ]);

        // Legacy classes + a third+ bucket-collapse bait.
        $this->gurmukhi = SchoolClass::create([
            'name'                => 'Gurmukhi',
            'type'                => 'gurmukhi',
            'division'            => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);

        $this->kirtan = SchoolClass::create([
            'name'                => 'Kirtan',
            'type'                => 'kirtan',
            'division'            => 'kirtan',
            'default_monthly_fee' => 0,
        ]);

        $this->music = SchoolClass::create([
            'name'                => 'Music',
            'type'                => 'gurmukhi', // legacy classification
            'division'            => 'music',    // explicit seam — wins
            'default_monthly_fee' => 500,
        ]);
    }

    /* ───────────────────────────────────────────────────────────
       /admin/classes/options — actual data source for the
       Attendance + StudentProgression frontends (the Inertia-rendered
       `classes` prop on each page is shadowed by this fetch).
       ─────────────────────────────────────────────────────────── */

    public function test_class_options_endpoint_ships_division_for_every_row(): void
    {
        $response = $this->actingAs($this->admin)->get('/admin/classes/options');
        $response->assertOk();

        $rows = collect($response->json());

        // Every row must surface a `division` field. The frontend relies
        // on this to feed the 3-arg DivisionTypeResolver.
        foreach ($rows as $row) {
            $this->assertArrayHasKey(
                'division',
                $row,
                'class options endpoint must ship `division` for the '
                . 'frontend 3-arg resolver to work.'
            );
        }

        // Sanity: Music row must surface its explicit 'music' division,
        // not the legacy 'gurmukhi' it would otherwise fall back to.
        $musicRow = $rows->firstWhere('id', $this->music->id);
        $this->assertNotNull($musicRow, 'Music class missing from /admin/classes/options');
        $this->assertSame('music', $musicRow['division']);
    }

    /* ───────────────────────────────────────────────────────────
       GET /admin/attendance — Inertia `classes` prop ships
       `division` (consistency with the options endpoint, and for the
       SSR-only consumer path).
       ─────────────────────────────────────────────────────────── */

    public function test_attendance_page_inertia_props_ship_division(): void
    {
        $response = $this->actingAs($this->admin)->get('/admin/attendance');
        $response->assertOk();

        $response->assertInertia(fn ($page) =>
            $page->component('Admin/Attendance/Index')
                ->has('classes', 3) // Gurmukhi + Kirtan + Music
                ->where('classes.0.id', $this->gurmukhi->id)
                ->where('classes.0.division', 'gurmukhi')
                ->where('classes.2.id', $this->music->id)
                ->where('classes.2.division', 'music')
        );
    }

    /* ───────────────────────────────────────────────────────────
       /admin/utilities/student-progression/data — each enrollment
       ships `classDivision`, so PromoteFlow + the typeBadge helper
       can resolve a Music class correctly.
       ─────────────────────────────────────────────────────────── */

    public function test_student_progression_data_endpoint_ships_class_division(): void
    {
        // Seed an enrolled student so the endpoint has rows to render.
        $student = \App\Models\Student::create([
            'name'        => 'Progression Seam Test',
            'father_name' => 'Father',
            'status'      => \App\Models\Student::STATUS_ACTIVE,
        ]);

        $section = \App\Models\Section::create([
            'class_id'    => $this->music->id,
            'name'        => 'A',
            'monthly_fee' => 500,
        ]);

        \App\Models\StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $this->music->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => 'active',
            'started_at'   => '2026-07-01',
        ]);

        $response = $this->actingAs($this->admin)
            ->get('/admin/utilities/student-progression/data');

        $response->assertOk();

        $rows = collect($response->json());
        $studentRow = $rows->firstWhere('id', $student->id);

        $this->assertNotNull($studentRow, 'enrolled student missing from progression data');

        $enrollment = collect($studentRow['enrollments'] ?? [])
            ->firstWhere('classId', $this->music->id);

        $this->assertNotNull($enrollment, 'enrollment row missing from progression data');
        $this->assertArrayHasKey(
            'classDivision',
            $enrollment,
            'progression data endpoint must ship `classDivision` so the '
            . 'frontend can use the 3-arg resolver.'
        );
        $this->assertSame(
            'music',
            $enrollment['classDivision'],
            'Music enrollment should surface classDivision=music (explicit '
            . 'seam wins over type), not the legacy gurmukhi bucket.'
        );
    }
}
