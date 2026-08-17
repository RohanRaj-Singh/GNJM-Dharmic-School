<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Module 11 / Gap #4 — three-division feature test for the admin
 * dashboard Inertia page (`GET /admin/dashboard`).
 *
 * Background:
 *   `docs/architecture/13-Module-By-Module-Business-Workflow-Audit.md`
 *   Module 11 called out: "No three-division feature test for dashboard
 *   API + frontend button rendering."
 *
 *   The API side is already pinned by `DashboardDivisionsTest` (3
 *   buckets) + `AdminDashboardCrossDivisionVisibilityTest` (per-row
 *   bucket + top absentees/fees). The "frontend button rendering"
 *   half is what this file covers — and specifically the gap that the
 *   existing `AdminPageSmokeTest` leaves open: it only exercises the
 *   dashboard with a SINGLE class fixture (line 42-49), so a
 *   regression that breaks the page when 2+ divisions exist would
 *   slip through.
 *
 *   The Inertia closure at `routes/admin.php:73-76` ships no props —
 *   the frontend drives the division toggle buttons off the JSON
 *   from `/admin/dashboard/summary`. We verify both halves in
 *   concert: the page itself renders, AND the summary endpoint it
 *   depends on returns the third+ bucket.
 *
 * Companion files:
 *   - routes/admin.php:73-76 (the Inertia render)
 *   - app/Http/Controllers/Admin/DashboardController.php::summary
 *   - resources/js/Pages/Admin/Dashboard.jsx:247-264 (division buttons)
 *   - tests/Feature/DashboardDivisionsTest.php (API bucketing)
 *   - tests/Feature/AdminDashboardCrossDivisionVisibilityTest.php
 *     (per-row division_type)
 *   - docs/architecture/13-Module-By-Module-Business-Workflow-Audit.md
 *     Module 11, gap #4
 */
class AdminDashboardThreeDivisionRenderTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $gurmukhi;
    private SchoolClass $kirtan;
    private SchoolClass $music;

    protected function setUp(): void
    {
        parent::setUp();

        // Pin the dashboard year the summary defaults to.
        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role'     => 'admin',
            'username' => 'admin_dashboard_three_division',
        ]);

        // Three-division fixture: the bucket-collapse bait is the Music
        // row (type='gurmukhi', division='music'). Pre-fix, this row was
        // filed under Gurmukhi and the third+ division button never
        // rendered on the dashboard.
        $this->gurmukhi = SchoolClass::create([
            'name'                => 'Gurmukhi',
            'type'                => 'gurmukhi',
            'division'            => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        Section::create([
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
        Section::create([
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
        Section::create([
            'class_id'    => $this->music->id,
            'name'        => 'C',
            'monthly_fee' => 500,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────────────────
       GET /admin/dashboard renders successfully in a three-division
       setup, AND the summary endpoint the frontend depends on exposes
       all three buckets — so the third+ toggle button will render.
       ─────────────────────────────────────────────────────────── */

    public function test_dashboard_page_renders_with_three_divisions_and_summary_exposes_all_buckets(): void
    {
        // 1. The Inertia page itself: 200, correct component, no stale
        //    server-side props that could hardcode a two-division shape.
        $page = $this->actingAs($this->admin)->get('/admin/dashboard');
        $page->assertOk();
        $page->assertInertia(fn ($inertia) => $inertia->component('Admin/Dashboard'));

        // 2. The JSON the frontend re-fetches on mount to render the
        //    division toggle buttons. All three buckets must surface,
        //    otherwise the third+ button never appears (the bug class
        //    the audit gap #4 calls out).
        $summary = $this->actingAs($this->admin)->getJson('/admin/dashboard/summary?year=2026');
        $summary->assertOk();
        $summary->assertJsonStructure([
            'fees',
            'attendance',
            'students',
            'divisions',
            'insights',
            'meta',
        ]);

        $divisionTypes = collect($summary->json('divisions'))->pluck('type')->all();
        $this->assertContains('gurmukhi', $divisionTypes, 'Gurmukhi bucket missing');
        $this->assertContains('kirtan',   $divisionTypes, 'Kirtan bucket missing');
        $this->assertContains('music',    $divisionTypes, 'Music bucket missing — division toggle button would not render on the frontend');
        $this->assertCount(3, $divisionTypes, 'exactly three division buckets expected, not a stale two-division shape');
    }
}