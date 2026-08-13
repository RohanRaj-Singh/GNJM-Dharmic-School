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
 * Smoke-guards the admin student list/options/history/delete endpoints so
 * that relocating their route closures into Admin\StudentController (P2)
 * cannot silently break the response contracts the roster UI depends on.
 */
class StudentAdminRoutesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_routes_test',
        ]);

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

        $this->student = Student::create([
            'name' => 'Roster Student',
            'father_name' => 'Roster Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        StudentSection::create([
            'student_id'   => $this->student->id,
            'class_id'     => $this->class->id,
            'section_id'   => $this->section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);
    }

    private function asAdmin()
    {
        return $this->actingAs($this->admin);
    }

    public function test_index_renders_roster(): void
    {
        $response = $this->asAdmin()->get(route('admin.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Students/Index')
            ->has('students', 1)
            ->has('classes'));
    }

    public function test_list_returns_students(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.students.list'));

        $response->assertOk();
        $response->assertJsonPath('0.name', 'Roster Student');
    }

    public function test_data_returns_students_with_filter(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.students.data', ['status' => 'active']));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.name', 'Roster Student');
    }

    public function test_options_empty_without_class_filter(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.students.options'));

        $response->assertOk();
        $response->assertJson([]);
    }

    public function test_options_returns_students_for_class(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.students.options', [
            'class_ids' => [$this->class->id],
        ]));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.name', 'Roster Student');
    }

    public function test_enrollment_history_returns_json(): void
    {
        $response = $this->asAdmin()->getJson(
            route('admin.students.enrollment-history', ['student' => $this->student->id])
        );

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.className', 'Gurmukhi');
        $response->assertJsonPath('0.sectionName', 'Section A');
    }

    public function test_delete_removes_student(): void
    {
        $response = $this->asAdmin()
            ->from('/admin/students')
            ->delete(route('admin.students.delete', ['student' => $this->student->id]));

        $response->assertRedirect('/admin/students');
        $this->assertNull(Student::find($this->student->id));
    }
}
