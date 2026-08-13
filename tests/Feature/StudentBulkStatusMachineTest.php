<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentBulkStatusMachineTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin']);
    }

    private function createStudent(string $status = 'active'): Student
    {
        $class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $section = Section::create([
            'class_id' => $class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);

        $student = Student::create([
            'name' => 'Test Student',
            'father_name' => 'Test Father',
            'status' => $status,
        ]);
        StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);

        return $student;
    }

    public function test_bulk_update_rejects_illegal_cross_status_transition(): void
    {
        // "left" is terminal — the roster must not be able to flip it back to active.
        $student = $this->createStudent(Student::STATUS_LEFT);

        $this->actingAs($this->admin)
            ->from('/admin/students')
            ->post(route('admin.students.bulk'), [
                'students' => [
                    [
                        'id'     => $student->id,
                        'name'   => 'Test Student',
                        'status' => Student::STATUS_ACTIVE,
                    ],
                ],
            ])
            ->assertRedirect('/admin/students')
            ->assertSessionHasErrors('students');

        $this->assertSame(Student::STATUS_LEFT, $student->fresh()->status);
    }

    public function test_bulk_update_allows_legal_active_to_inactive_transition(): void
    {
        $student = $this->createStudent(Student::STATUS_ACTIVE);

        $this->actingAs($this->admin)
            ->from('/admin/students')
            ->post(route('admin.students.bulk'), [
                'students' => [
                    [
                        'id'     => $student->id,
                        'name'   => 'Test Student',
                        'status' => Student::STATUS_INACTIVE,
                    ],
                ],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Student::STATUS_INACTIVE, $student->fresh()->status);
    }

    public function test_bulk_update_allows_same_status_submission_as_noop(): void
    {
        $student = $this->createStudent(Student::STATUS_LEFT);

        $this->actingAs($this->admin)
            ->from('/admin/students')
            ->post(route('admin.students.bulk'), [
                'students' => [
                    [
                        'id'     => $student->id,
                        'name'   => 'Test Student',
                        'status' => Student::STATUS_LEFT,
                    ],
                ],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Student::STATUS_LEFT, $student->fresh()->status);
    }
}
