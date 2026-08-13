<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Fee;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the behaviour of the front-facing /students routes (list, create, show)
 * so that extracting the index/create/show closures from routes/students.php
 * into the front-facing App\Http\Controllers\StudentController (Phase-2 Sprint 1.2)
 * cannot silently change:
 *   - teacher scoping on the index (assigned sections only) and show (403 for
 *     unassigned students)
 *   - the class-type grouping (one summary item per type, Kirtan name fallback)
 *   - the merged attendance/fees across enrollments within a type group
 *   - the paid-vs-unpaid fee computation
 */
class StudentFrontRoutesTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $accountant;
    private SchoolClass $gurmukhi;
    private Section $sectionA;
    private SchoolClass $kirtan;
    private Section $sectionB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::factory()->create([
            'role'     => 'teacher',
            'username' => 'teacher_front_routes_test',
        ]);
        $this->accountant = User::factory()->create([
            'role'     => 'accountant',
            'username' => 'accountant_front_routes_test',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name'                => 'Gurmukhi',
            'type'                => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->sectionA = Section::create([
            'class_id'    => $this->gurmukhi->id,
            'name'        => 'Section A',
            'monthly_fee' => 600,
        ]);

        $this->kirtan = SchoolClass::create([
            'name'                => 'Kirtan',
            'type'                => 'kirtan',
            'default_monthly_fee' => 0,
        ]);
        $this->sectionB = Section::create([
            'class_id'    => $this->kirtan->id,
            'name'        => 'Section B',
            'monthly_fee' => 0,
        ]);

        $this->teacher->sections()->attach($this->sectionA->id);
    }

    /* ───────────────────────────────────────────────────────────
       Helpers
       ─────────────────────────────────────────────────────────── */

    private function student(string $name): Student
    {
        return Student::create([
            'name'        => $name,
            'father_name' => 'Test Father',
            'status'      => Student::STATUS_ACTIVE,
        ]);
    }

    private function enroll(
        Student $student,
        SchoolClass $class,
        Section $section,
        string $startedAt,
        string $status = StudentSection::STATUS_ACTIVE,
        ?string $transferredAt = null,
    ): StudentSection {
        return StudentSection::create([
            'student_id'     => $student->id,
            'class_id'       => $class->id,
            'section_id'     => $section->id,
            'student_type'   => 'paid',
            'status'         => $status,
            'started_at'     => $startedAt,
            'transferred_at' => $transferredAt,
        ]);
    }

    private function attendance(StudentSection $enrollment, string $date, string $status): void
    {
        Attendance::create([
            'student_section_id' => $enrollment->id,
            'date'               => $date,
            'status'             => $status,
        ]);
    }

    private function fee(StudentSection $enrollment, string $month, int $amount): Fee
    {
        return Fee::create([
            'student_section_id' => $enrollment->id,
            'type'               => 'monthly',
            'source'             => 'monthly',
            'title'              => null,
            'amount'             => $amount,
            'month'              => $month,
        ]);
    }

    private function pay(Fee $fee, int $amount): void
    {
        Payment::create([
            'fee_id'      => $fee->id,
            'amount_paid' => $amount,
            'paid_at'     => now(),
        ]);
    }

    private function asTeacher()
    {
        return $this->actingAs($this->teacher);
    }

    private function asAccountant()
    {
        return $this->actingAs($this->accountant);
    }

    /* ───────────────────────────────────────────────────────────
       Index
       ─────────────────────────────────────────────────────────── */

    public function test_teacher_index_only_lists_students_in_assigned_sections(): void
    {
        $seen = $this->student('Seen');
        $this->enroll($seen, $this->gurmukhi, $this->sectionA, '2026-07-01');

        $hidden = $this->student('Hidden');
        $this->enroll($hidden, $this->kirtan, $this->sectionB, '2026-07-01');

        $response = $this->asTeacher()->get(route('students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Index')
            ->has('students', 1)
            ->where('students.0.name', 'Seen'));
    }

    public function test_accountant_index_lists_all_students(): void
    {
        $a = $this->student('Alpha');
        $this->enroll($a, $this->gurmukhi, $this->sectionA, '2026-07-01');
        $b = $this->student('Beta');
        $this->enroll($b, $this->kirtan, $this->sectionB, '2026-07-01');

        $response = $this->asAccountant()->get(route('students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Index')
            ->has('students', 2));
    }

    /* ───────────────────────────────────────────────────────────
       Create
       ─────────────────────────────────────────────────────────── */

    public function test_create_renders_classes_with_sections(): void
    {
        $response = $this->asAccountant()->get(route('students.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Create')
            ->has('classes', 2)
            ->where('classes.0.name', 'Gurmukhi')
            ->where('classes.0.sections.0.name', 'Section A')
            ->where('classes.1.name', 'Kirtan')
            ->where('classes.1.sections.0.name', 'Section B'));
    }

    /* ───────────────────────────────────────────────────────────
       Show — access control
       ─────────────────────────────────────────────────────────── */

    public function test_teacher_is_forbidden_from_unassigned_student_show(): void
    {
        $student = $this->student('Hidden');
        $this->enroll($student, $this->kirtan, $this->sectionB, '2026-07-01');

        $this->asTeacher()->get(route('students.show', $student->id))->assertForbidden();
    }

    public function test_teacher_can_view_assigned_student_show(): void
    {
        $student = $this->student('Seen');
        $this->enroll($student, $this->gurmukhi, $this->sectionA, '2026-07-01');

        $response = $this->asTeacher()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->has('summary', 1)
            ->where('summary.0.class_type_key', 'gurmukhi')
            ->where('summary.0.class', 'Gurmukhi')
            ->where('summary.0.section', 'Section A'));
    }

    /* ───────────────────────────────────────────────────────────
       Show — class-type grouping
       ─────────────────────────────────────────────────────────── */

    public function test_show_groups_enrollments_once_per_class_type(): void
    {
        $student = $this->student('Both');
        $this->enroll($student, $this->gurmukhi, $this->sectionA, '2026-07-01');
        $this->enroll($student, $this->kirtan, $this->sectionB, '2026-08-01');

        $response = $this->asAccountant()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->has('summary', 2)
            // Most-recently-started enrollment drives group order
            ->where('summary.0.class_type_key', 'kirtan')
            ->where('summary.0.class', 'Kirtan')
            ->where('summary.1.class_type_key', 'gurmukhi')
            ->where('summary.1.class', 'Gurmukhi'));
    }

    public function test_show_falls_back_to_class_name_for_missing_type(): void
    {
        $untagged = SchoolClass::create([
            'name'                => 'Kirtan Evening',
            'type'                => '',
            'default_monthly_fee' => 0,
        ]);
        $section = Section::create([
            'class_id'    => $untagged->id,
            'name'        => 'Section C',
            'monthly_fee' => 0,
        ]);

        $student = $this->student('Kirtan Kid');
        $this->enroll($student, $untagged, $section, '2026-07-01');

        $response = $this->asAccountant()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->has('summary', 1)
            ->where('summary.0.class_type_key', 'kirtan'));
    }

    /* ───────────────────────────────────────────────────────────
       Show — merged attendance across same-type enrollments
       ─────────────────────────────────────────────────────────── */

    public function test_show_merges_attendance_across_same_type_enrollments(): void
    {
        $student = $this->student('Merged');
        $current = $this->enroll($student, $this->gurmukhi, $this->sectionA, '2026-08-01');
        $archived = $this->enroll(
            $student,
            $this->gurmukhi,
            $this->sectionA,
            '2026-07-01',
            StudentSection::STATUS_PROMOTED,
            '2026-07-31',
        );

        $this->attendance($current, '2026-08-02', 'present');
        $this->attendance($current, '2026-08-03', 'absent');
        $this->attendance($archived, '2026-07-05', 'present');

        $response = $this->asAccountant()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->has('summary', 1)
            // Display enrollment prefers the active, non-transferred one
            ->where('summary.0.section', 'Section A')
            ->where('summary.0.attendance.present', 2)
            ->where('summary.0.attendance.absent', 1)
            ->where('summary.0.attendance.leave', 0)
            // recent is sorted ascending by date
            ->where('summary.0.attendance.recent.0.date', '2026-07-05')
            ->where('summary.0.attendance.recent.1.date', '2026-08-02')
            ->where('summary.0.attendance.recent.2.date', '2026-08-03'));
    }

    /* ───────────────────────────────────────────────────────────
       Show — fee computation
       ─────────────────────────────────────────────────────────── */

    public function test_show_computes_paid_vs_unpaid_fees(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA, '2026-07-01');

        $this->pay($this->fee($enrollment, '2026-01', 600), 600);
        $this->fee($enrollment, '2026-02', 600); // unpaid

        $response = $this->asAccountant()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->where('summary.0.fees.all_paid', false)
            ->where('summary.0.fees.total', 1200)
            ->where('summary.0.fees.paid', 600)
            ->where('summary.0.fees.pending', 600)
            ->where('summary.0.fees.unpaid_months', ['2026-02']));
    }

    public function test_show_marks_all_fees_paid_when_every_fee_has_payment(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA, '2026-07-01');

        $this->pay($this->fee($enrollment, '2026-01', 600), 600);

        $response = $this->asAccountant()->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->where('summary.0.fees.all_paid', true)
            ->where('summary.0.fees.pending', 0));
    }
}
