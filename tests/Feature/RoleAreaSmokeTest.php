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
 * Sprint 6.3 — HTTP smoke tests: the accountant, teacher and global
 * attendance areas render (200) for the correct role.
 *
 * The test clock is fixed to 2026-08-13 (Thursday), a non-Sunday, so the
 * global /attendance/sections/{section} day-rule lets a Gurmukhi section
 * through (Kirtan-only-on-Sunday would redirect instead).
 *
 * Teacher-scoping (section assignment + the 403 guard on attendance.mark) is
 * pinned here at the HTTP level; the deeper lifecycle/absentee behaviour lives
 * in AttendanceLifecycleTest / AttendanceAbsenteesTest.
 */
class RoleAreaSmokeTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $accountant;
    private SchoolClass $gurmukhi;
    private Section $sectionA;
    private SchoolClass $kirtan;
    private Section $sectionB;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00');

        $this->teacher = User::factory()->create([
            'role' => 'teacher',
            'username' => 'teacher_role_smoke',
        ]);
        $this->accountant = User::factory()->create([
            'role' => 'accountant',
            'username' => 'accountant_role_smoke',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->sectionA = Section::create([
            'class_id' => $this->gurmukhi->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);

        $this->kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 400,
        ]);
        $this->sectionB = Section::create([
            'class_id' => $this->kirtan->id,
            'name' => 'Section B',
            'monthly_fee' => 400,
        ]);

        $this->teacher->sections()->attach($this->sectionA->id);

        $this->student = Student::create([
            'name' => 'Role Student',
            'father_name' => 'Role Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->gurmukhi->id,
            'section_id' => $this->sectionA->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────
       Accountant area
       ─────────────────────────────────────────────── */

    public function test_accountant_dashboard_renders(): void
    {
        $response = $this->actingAs($this->accountant)->get('/accountant');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Accountant/Dashboard'));
    }

    public function test_accountant_late_fees_renders(): void
    {
        $response = $this->actingAs($this->accountant)->get('/accountant/late-fees');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Accountant/LateFees'));
    }

    public function test_accountant_receive_fee_renders_for_student(): void
    {
        $response = $this->actingAs($this->accountant)->get(
            route('accountant.receive-fee', ['student_id' => $this->student->id])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/ReceiveFee')
            ->where('student.id', $this->student->id));
    }

    /* ───────────────────────────────────────────────
       Teacher area (static routes)
       ─────────────────────────────────────────────── */

    public function test_teacher_dashboard_renders(): void
    {
        $response = $this->actingAs($this->teacher)->get(route('teacher.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Teacher/Dashboard'));
    }

    public function test_teacher_attendance_dashboard_renders(): void
    {
        $response = $this->actingAs($this->teacher)->get(route('teacher.attendance.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Attendance/Dashboard'));
    }

    public function test_teacher_attendance_sections_renders(): void
    {
        $response = $this->actingAs($this->teacher)->get(route('teacher.attendance.sections'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Attendance/Sections'));
    }

    public function test_teacher_attendance_mark_renders(): void
    {
        $response = $this->actingAs($this->teacher)->get(
            route('teacher.attendance.mark', ['section' => $this->sectionA->id])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Attendance/Mark'));
    }

    /* ───────────────────────────────────────────────
       Global attendance area (teacher + accountant)
       ─────────────────────────────────────────────── */

    public function test_global_attendance_dashboard_renders_for_accountant(): void
    {
        $response = $this->actingAs($this->accountant)->get(route('attendance.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Attendance/Dashboard'));
    }

    public function test_global_attendance_sections_scopes_teacher_to_assigned_section(): void
    {
        $response = $this->actingAs($this->teacher)->get(route('attendance.sections'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Sections')
            ->has('sections', 1)
            ->where('sections.0.id', $this->sectionA->id));
    }

    public function test_global_attendance_mark_renders_gurmukhi_on_non_sunday_for_teacher(): void
    {
        $response = $this->actingAs($this->teacher)->get(
            route('attendance.mark', ['section' => $this->sectionA->id])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Mark')
            ->where('section.id', $this->sectionA->id));
    }

    public function test_global_attendance_mark_renders_for_accountant(): void
    {
        $response = $this->actingAs($this->accountant)->get(
            route('attendance.mark', ['section' => $this->sectionA->id])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Mark')
            ->where('section.id', $this->sectionA->id));
    }

    public function test_global_attendance_mark_denies_teacher_unassigned_section(): void
    {
        $response = $this->actingAs($this->teacher)->get(
            route('attendance.mark', ['section' => $this->sectionB->id])
        );

        $response->assertForbidden();
    }
}
