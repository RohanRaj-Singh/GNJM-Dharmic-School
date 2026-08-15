<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use App\Support\DivisionTypeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * B12 — Accountant Students filter bar is data-driven.
 *
 * The audit's single critical finding: the filter bar hardcoded two buttons
 * (Gurmukhi, Kirtan) and silently dropped a third+ class. The fix routes the
 * division list through the resolver, so adding a Music class surfaces a
 * Music button without any code change.
 *
 * These tests pin three things:
 *  1. The Inertia page receives `divisions` with one entry per distinct
 *     division the resolver returns, in stable order.
 *  2. `divisions` survives the explicit-division seam (classes.division set
 *     to 'music' on a row with type='music' resolves to 'music' — not the
 *     legacy gurmukhi fallback).
 *  3. The student payload includes every enrollment with school_class loaded
 *     so the frontend `classMatchesFilter` utility can compute division
 *     keys per-row without a second round-trip.
 */
class AccountantStudentsFilterTest extends TestCase
{
    use RefreshDatabase;

    private User $accountant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountant = User::factory()->create([
            'role' => 'accountant',
            'username' => 'accountant_students_filter',
        ]);
    }

    public function test_page_renders_with_three_division_buttons_for_three_classes(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $kirtan   = $this->makeClass('Kirtan', 'kirtan', 'kirtan');
        $music    = $this->makeClass('Music', 'music', 'music');

        $this->enrollStudent('Gurmukhi Kid', $gurmukhi);
        $this->enrollStudent('Kirtan Kid', $kirtan);
        $this->enrollStudent('Music Kid', $music);

        $response = $this->actingAs($this->accountant)
            ->get(route('accountant.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/Students')
            ->has('divisions', 3)
            ->where('divisions.0.key', 'gurmukhi')
            ->where('divisions.0.title', 'Gurmukhi')
            ->where('divisions.1.key', 'kirtan')
            ->where('divisions.1.title', 'Kirtan')
            ->where('divisions.2.key', 'music')
            ->where('divisions.2.title', 'Music')
            ->has('students', 3));
    }

    public function test_explicit_division_seam_drives_the_filter_list(): void
    {
        // A class with type='misc' but division='music' must resolve to 'music'
        // (Stage A2 seam). The page should expose 'music' as a filter, not
        // collapse it into the gurmukhi bucket.
        $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Special Music', 'misc', 'music');

        $this->assertSame('music', DivisionTypeResolver::division('misc', 'Special Music', 'music'));

        $response = $this->actingAs($this->accountant)
            ->get(route('accountant.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/Students')
            ->has('divisions', 2)
            ->where('divisions.0.key', 'gurmukhi')
            ->where('divisions.1.key', 'music'));
    }

    public function test_divisions_are_unique_even_when_multiple_classes_share_one(): void
    {
        // Two Gurmukhi classes must not produce two "gurmukhi" buttons.
        $this->makeClass('Gurmukhi Beginners', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Gurmukhi Advanced', 'gurmukhi', 'gurmukhi');
        $this->makeClass('Kirtan', 'kirtan', 'kirtan');

        $response = $this->actingAs($this->accountant)
            ->get(route('accountant.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/Students')
            ->has('divisions', 2)
            ->where('divisions.0.key', 'gurmukhi')
            ->where('divisions.1.key', 'kirtan'));
    }

    public function test_student_payload_carries_school_class_for_per_row_division_filter(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', 'gurmukhi');
        $music    = $this->makeClass('Music', 'music', 'music');

        $this->enrollStudent('Multi Kid', $gurmukhi);
        $this->enrollStudent('Multi Kid', $music);

        $response = $this->actingAs($this->accountant)
            ->get(route('accountant.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/Students')
            ->has('students', 1)
            ->where('students.0.name', 'Multi Kid')
            ->has('students.0.enrollments', 2)
            ->where('students.0.enrollments.0.school_class.division', 'gurmukhi')
            ->where('students.0.enrollments.1.school_class.division', 'music'));
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

    /**
     * Enroll a student with the given name in $class. If a student with that
     * name already exists (multi-class test), add a second enrollment row.
     */
    private function enrollStudent(string $name, SchoolClass $class): Student
    {
        $student = Student::firstOrCreate(
            ['name' => $name],
            [
                'father_name' => 'Father of ' . $name,
                'status' => Student::STATUS_ACTIVE,
            ]
        );

        $section = Section::firstOrCreate(
            ['class_id' => $class->id, 'name' => $class->name . ' A'],
            ['monthly_fee' => $class->default_monthly_fee]
        );

        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        return $student;
    }
}
