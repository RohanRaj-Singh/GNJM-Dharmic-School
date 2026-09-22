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
 * Student hard-delete must remove dependents first (or via cascade FKs).
 * Regression for:
 *   SQLSTATE[23000] ... fees_student_id_foreign ... delete from students
 */
class StudentDeleteCascadeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private Student $student;
    private StudentSection $enrollment;
    private Fee $fee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_student_delete',
        ]);

        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 400,
        ]);
        $this->section = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 400,
        ]);

        $this->student = Student::create([
            'name' => 'Delete Me',
            'father_name' => 'Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $this->enrollment = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $this->fee = Fee::create([
            'student_id' => $this->student->id,
            'student_section_id' => $this->enrollment->id,
            'type' => 'monthly',
            'month' => now()->format('Y-m'),
            'amount' => 400,
        ]);
        Payment::create([
            'fee_id' => $this->fee->id,
            'amount_paid' => 400,
            'paid_at' => now(),
        ]);
        Attendance::create([
            'student_id' => $this->student->id,
            'student_section_id' => $this->enrollment->id,
            'date' => now()->toDateString(),
            'status' => 'present',
        ]);
    }

    public function test_single_delete_removes_fees_payments_attendance_and_enrollment(): void
    {
        $feeId = $this->fee->id;
        $enrollmentId = $this->enrollment->id;

        $response = $this->actingAs($this->admin)
            ->from('/admin/students')
            ->delete(route('admin.students.delete', ['student' => $this->student->id]));

        $response->assertRedirect('/admin/students');
        $this->assertDatabaseMissing('students', ['id' => $this->student->id]);
        $this->assertDatabaseMissing('fees', ['id' => $feeId]);
        $this->assertDatabaseMissing('payments', ['fee_id' => $feeId]);
        $this->assertDatabaseMissing('attendance', ['student_id' => $this->student->id]);
        $this->assertDatabaseMissing('student_sections', ['id' => $enrollmentId]);
    }

    public function test_bulk_delete_removes_student_with_fees(): void
    {
        $feeId = $this->fee->id;

        $response = $this->actingAs($this->admin)
            ->postJson(route('admin.students.bulk-delete'), [
                'student_ids' => [$this->student->id],
            ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseMissing('students', ['id' => $this->student->id]);
        $this->assertDatabaseMissing('fees', ['id' => $feeId]);
        $this->assertDatabaseMissing('payments', ['fee_id' => $feeId]);
        $this->assertDatabaseMissing('attendance', ['student_id' => $this->student->id]);
        $this->assertDatabaseMissing('student_sections', ['student_id' => $this->student->id]);
    }

    public function test_foreign_key_student_id_allows_delete(): void
    {
        // Previously threw SQLSTATE[23000] 1451 fees_student_id_foreign.
        \Illuminate\Support\Facades\DB::transaction(function () {
            $this->student->delete();
        });

        $this->assertNull(Student::find($this->student->id));
        $this->assertSame(
            0,
            Fee::where('student_id', $this->student->id)->count()
        );
    }
}
