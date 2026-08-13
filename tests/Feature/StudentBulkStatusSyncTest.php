<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Guards the R3 invariant: a student's status must stay in sync with their
 * enrollments. If the bulk-update archives the last active enrollment, the
 * student's own status must be demoted to inactive — otherwise the student
 * appears "active" everywhere while having no active enrollment (orphan).
 */
class StudentBulkStatusSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private Section $otherSection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_bulk_test',
        ]);

        // default_monthly_fee = 0 keeps the bulk flow from generating fees,
        // isolating the test to status sync only.
        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 0,
        ]);
        $this->section = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 0,
        ]);
        $this->otherSection = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section B',
            'monthly_fee' => 0,
        ]);
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    private function createStudent(string $status = 'active'): Student
    {
        return Student::create([
            'name' => 'Test Student',
            'father_name' => 'Test Father',
            'status' => $status,
        ]);
    }

    private function createEnrollment(
        Student $student,
        Section $section,
    ): StudentSection {
        return StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $section->class_id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);
    }

    private function postBulk(array $students)
    {
        return $this
            ->actingAs($this->admin)
            ->from('/admin/students')
            ->post(route('admin.students.bulk'), ['students' => $students]);
    }

    private function enrollmentRow(int $sectionId, string $status = 'active', string $studentType = 'paid'): array
    {
        return [
            'section_id'   => $sectionId,
            'status'       => $status,
            'student_type' => $studentType,
        ];
    }

    // ──────────────────────────────────────────────
    //  Tests
    // ──────────────────────────────────────────────

    public function test_student_stays_active_when_active_enrollment_remains(): void
    {
        $student = $this->createStudent();
        $this->createEnrollment($student, $this->section);

        $response = $this->postBulk([
            [
                'id' => $student->id,
                'name' => 'Test Student',
                'enrollments' => [
                    $this->enrollmentRow($this->section->id),
                ],
            ],
        ]);

        $response->assertSessionHas('success');

        $this->assertSame(Student::STATUS_ACTIVE, $student->fresh()->status);
    }

    public function test_student_demoted_to_inactive_when_last_enrollment_archived(): void
    {
        $student = $this->createStudent();
        $this->createEnrollment($student, $this->section);

        // Bulk-update submits NO enrollments → the only active enrollment is
        // archived. The student must not remain "active" with zero enrollment.
        $response = $this->postBulk([
            [
                'id' => $student->id,
                'name' => 'Test Student',
                'enrollments' => [],
            ],
        ]);

        $response->assertSessionHas('success');

        $this->assertSame(Student::STATUS_INACTIVE, $student->fresh()->status);

        $archived = StudentSection::where('student_id', $student->id)
            ->where('section_id', $this->section->id)
            ->firstOrFail();
        $this->assertSame(StudentSection::STATUS_INACTIVE, $archived->status);
        $this->assertNotNull($archived->transferred_at);
    }

    public function test_student_stays_active_when_at_least_one_enrollment_kept(): void
    {
        $student = $this->createStudent();
        $this->createEnrollment($student, $this->section);
        $this->createEnrollment($student, $this->otherSection);

        // Drop Section A but keep Section B → still one active enrollment.
        $response = $this->postBulk([
            [
                'id' => $student->id,
                'name' => 'Test Student',
                'enrollments' => [
                    $this->enrollmentRow($this->otherSection->id),
                ],
            ],
        ]);

        $response->assertSessionHas('success');

        $this->assertSame(Student::STATUS_ACTIVE, $student->fresh()->status);

        $archived = StudentSection::where('student_id', $student->id)
            ->where('section_id', $this->section->id)
            ->firstOrFail();
        $this->assertSame(StudentSection::STATUS_INACTIVE, $archived->status);
    }
}
