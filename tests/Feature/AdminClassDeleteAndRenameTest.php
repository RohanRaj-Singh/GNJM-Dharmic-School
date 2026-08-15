<?php

namespace Tests\Feature;

use App\Models\FeeRatePeriod;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * B17 — Pin the admin delete + rename class workflows the audit's §6 M-2 +
 * §4 C3 + C4 call out. The two operational escape hatches sit on the same
 * `/admin/classes` page; the rename policy is "lock the bucket on first save"
 * and the delete policy is "refuse if any student_sections row exists (active
 * OR historical)".
 *
 * Companion tests already pin related rules:
 *  - `AdminClassCreateTest`        — happy paths for create (Music/Kirtan/Tabla)
 *  - `AdminClassSlugAndKirtanSnapTest` — slug derivation + Kirtan snap edges
 *  - `AdminClassesSidebarLinkTest` — discoverability via AdminLayout
 *
 * This file pins the B17-specific edges:
 *
 *  1. Delete refuses when an ACTIVE student_section row exists.
 *  2. Delete refuses when only a HISTORICAL (transferred-out) row exists —
 *     the audit's "protect historical financial records" intent. A typo
 *     on a never-used class can be fixed; a class with paid fees cannot.
 *  3. Delete allowed when NO enrollments exist — cascades sections +
 *     fee periods via the existing FK cascadeOnDelete.
 *  4. Rename preserves `type` AND `division` columns (bucket-lock policy).
 *  5. Rename does not touch fee rate periods on the class.
 *  6. Rename REJECTS `type` injection — the route handler always reads
 *     `$existing->type` regardless of what the row payload claims.
 *  7. Cascade sanity: when delete IS allowed, sections for that class
 *     are gone afterwards.
 */
class AdminClassDeleteAndRenameTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'class_delete_rename',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeClass(string $name, ?string $overrideType = null): SchoolClass
    {
        // Create directly so we can stamp both `type` and `division` to the
        // exact same value (matching what the save handler does for "Music").
        $slug = \Illuminate\Support\Str::slug($name) ?: 'class';
        return SchoolClass::create([
            'name' => $name,
            'type' => $overrideType ?? $slug,
            'division' => $overrideType ?? $slug,
            'attendance_days' => [1, 2, 3, 4, 5, 6],
            'charges_monthly_fee' => true,
            'default_monthly_fee' => 500,
        ]);
    }

    private function enrollStudent(SchoolClass $class): StudentSection
    {
        $section = Section::firstOrCreate(
            ['class_id' => $class->id, 'name' => $class->name . ' A'],
            ['monthly_fee' => $class->default_monthly_fee]
        );

        $student = Student::firstOrCreate(
            ['name' => 'Student of ' . $class->name],
            [
                'father_name' => 'Father of ' . $class->name,
                'status' => Student::STATUS_ACTIVE,
            ]
        );

        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE — refuses on any student_sections row
    // ─────────────────────────────────────────────────────────────────────

    public function test_delete_refused_when_active_enrollment_exists(): void
    {
        $class = $this->makeClass('Music');
        $this->enrollStudent($class);

        $response = $this->actingAs($this->admin)->delete(
            route('admin.classes.delete', $class)
        );

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'Cannot delete: class has historical or active enrollments. Clean up enrollments first.',
        ]);

        // Class is still there.
        $this->assertNotNull(SchoolClass::find($class->id));
    }

    public function test_delete_refused_when_only_historical_enrollment_exists(): void
    {
        // CRITICAL edge case the audit calls out — "historical" must gate
        // too. A class with paid fees from last year cannot be deleted even
        // if every student has since transferred out.
        $class = $this->makeClass('Tabla');
        $enrollment = $this->enrollStudent($class);

        // Mark the enrollment as transferred-out (historical). The row still
        // exists, but the student is no longer "current" in this class.
        $enrollment->update([
            'status' => StudentSection::STATUS_LEFT,
            'transferred_at' => Carbon::now()->subMonth(),
        ]);

        $response = $this->actingAs($this->admin)->delete(
            route('admin.classes.delete', $class)
        );

        $response->assertStatus(422);
        $this->assertNotNull(SchoolClass::find($class->id));
        // The historical row is preserved (no cascade triggered).
        $this->assertNotNull(StudentSection::find($enrollment->id));
    }

    public function test_delete_allowed_when_no_enrollments(): void
    {
        $class = $this->makeClass('Piano');

        $response = $this->actingAs($this->admin)->delete(
            route('admin.classes.delete', $class)
        );

        $response->assertOk();
        $this->assertNull(SchoolClass::find($class->id));
    }

    public function test_cascade_deletes_sections_when_class_deleted(): void
    {
        $class = $this->makeClass('Sitar');
        // Two sections, no enrollments — eligible for cascade.
        Section::create([
            'class_id' => $class->id,
            'name' => 'Sitar A',
            'monthly_fee' => 0,
        ]);
        Section::create([
            'class_id' => $class->id,
            'name' => 'Sitar B',
            'monthly_fee' => 0,
        ]);

        $this->actingAs($this->admin)
            ->delete(route('admin.classes.delete', $class))
            ->assertOk();

        $this->assertSame(0, Section::where('class_id', $class->id)->count());
    }

    // ─────────────────────────────────────────────────────────────────────
    // RENAME — lock-the-bucket policy
    // ─────────────────────────────────────────────────────────────────────

    public function test_rename_preserves_type_and_division(): void
    {
        // "Music" lands in the music bucket on first save.
        $class = $this->makeClass('Music');
        $this->assertSame('music', $class->type);
        $this->assertSame('music', $class->division);

        // Admin renames "Music" → "Tabla" through the inline editor.
        // The row payload echoes back the existing type from the data
        // endpoint, but the route handler pins type to $existing->type
        // unconditionally — so the bucket stays "music".
        $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'id' => $class->id,
                'name' => 'Tabla',
                'type' => 'music',     // what the row payload would carry
            ]],
        ])->assertRedirect();

        $fresh = $class->fresh();
        $this->assertSame('Tabla', $fresh->name);
        $this->assertSame('music', $fresh->type);
        $this->assertSame('music', $fresh->division);
    }

    public function test_rename_does_not_touch_fee_periods(): void
    {
        $class = $this->makeClass('Harmonium');

        // One fee rate period at class scope.
        $period = FeeRatePeriod::create([
            'scope_type' => 'class',
            'scope_id' => $class->id,
            'amount' => 800,
            'effective_from' => '2026-01-01',
            'effective_to' => null,
        ]);

        $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'id' => $class->id,
                'name' => 'Harmonium 2',
                'type' => 'harmonium',
            ]],
        ])->assertRedirect();

        $fresh = $period->fresh();
        $this->assertSame($class->id, $fresh->scope_id);
        $this->assertSame(800, (int) $fresh->amount);
        $this->assertSame('class', $fresh->scope_type);
    }

    public function test_rename_rejects_type_injection(): void
    {
        // Audit scenario: a hostile or buggy client tries to rename a
        // Music class and slip in type='kirtan' — hoping to drag the
        // class out of its bucket mid-year. The route handler ignores
        // the row payload's `type` field on rename; it always reads
        // $existing->type. This test pins that defense.
        $class = $this->makeClass('Music');
        $this->assertSame('music', $class->type);

        $this->actingAs($this->admin)->post('/admin/classes/save', [
            'classes' => [[
                'id' => $class->id,
                'name' => 'Music Renamed',
                'type' => 'kirtan',  // attempted injection — must be ignored
            ]],
        ])->assertRedirect();

        $fresh = $class->fresh();
        $this->assertSame('music', $fresh->type);
        $this->assertSame('music', $fresh->division);
        $this->assertSame('Music Renamed', $fresh->name);
    }
}
