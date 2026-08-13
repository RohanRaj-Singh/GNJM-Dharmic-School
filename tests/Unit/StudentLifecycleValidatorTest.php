<?php

namespace Tests\Unit;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\StudentLifecycleValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins StudentLifecycleValidator against the Sprint 2.2 transition matrix plus
 * the P4 safety gate (leave requires inactive first) and the
 * active-enrollment prerequisites on every lifecycle check.
 *
 * Sprint 6.1 — closes the missing service-test gap for the lifecycle validator.
 */
class StudentLifecycleValidatorTest extends TestCase
{
    use RefreshDatabase;

    private function validator(): StudentLifecycleValidator
    {
        return app(StudentLifecycleValidator::class);
    }

    private function makeStudent(string $status): Student
    {
        return Student::create(['name' => 'Lifecycle Student', 'status' => $status]);
    }

    private function makeEnrollment(Student $student, string $status): StudentSection
    {
        $class = SchoolClass::create(['name' => 'Gurmukhi', 'type' => 'gurmukhi', 'default_monthly_fee' => 0]);
        $section = Section::create(['class_id' => $class->id, 'name' => 'A', 'monthly_fee' => 0]);

        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => $status,
            'started_at' => now(),
        ]);
    }

    /* ───────────────────────────────────────────────
       canPromote
       ─────────────────────────────────────────────── */

    public function test_can_promote_allows_active_student_with_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);
        $this->makeEnrollment($student, StudentSection::STATUS_ACTIVE);

        $this->assertTrue($this->validator()->canPromote($student)->allowed);
    }

    public function test_can_promote_denies_terminal_and_inactive_statuses(): void
    {
        foreach ([Student::STATUS_PASSED_OUT, Student::STATUS_LEFT, Student::STATUS_INACTIVE] as $status) {
            $student = $this->makeStudent($status);
            $this->assertFalse(
                $this->validator()->canPromote($student)->allowed,
                "promote from {$status} should be denied"
            );
        }
    }

    public function test_can_promote_denies_active_student_without_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);

        $result = $this->validator()->canPromote($student);
        $this->assertFalse($result->allowed);
        $this->assertStringContainsString('no active enrollment', $result->warnings[0]);
    }

    /* ───────────────────────────────────────────────
       canPassOut
       ─────────────────────────────────────────────── */

    public function test_can_pass_out_allows_active_student_with_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);
        $this->makeEnrollment($student, StudentSection::STATUS_ACTIVE);

        $this->assertTrue($this->validator()->canPassOut($student)->allowed);
    }

    public function test_can_pass_out_denies_terminal_and_inactive_statuses(): void
    {
        foreach ([Student::STATUS_PASSED_OUT, Student::STATUS_LEFT, Student::STATUS_INACTIVE] as $status) {
            $student = $this->makeStudent($status);
            $this->assertFalse(
                $this->validator()->canPassOut($student)->allowed,
                "pass out from {$status} should be denied"
            );
        }
    }

    public function test_can_pass_out_denies_without_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);

        $this->assertFalse($this->validator()->canPassOut($student)->allowed);
    }

    /* ───────────────────────────────────────────────
       canLeaveSchool — P4 safety gate: inactive first
       ─────────────────────────────────────────────── */

    public function test_can_leave_school_allows_inactive_student(): void
    {
        $student = $this->makeStudent(Student::STATUS_INACTIVE);

        $this->assertTrue($this->validator()->canLeaveSchool($student)->allowed);
    }

    public function test_can_leave_school_denies_active_student_without_going_inactive_first(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);

        $result = $this->validator()->canLeaveSchool($student);
        $this->assertFalse($result->allowed);
        $this->assertStringContainsString('before leaving the school', $result->warnings[0]);
    }

    public function test_can_leave_school_denies_terminal_statuses(): void
    {
        foreach ([Student::STATUS_PASSED_OUT, Student::STATUS_LEFT] as $status) {
            $student = $this->makeStudent($status);
            $this->assertFalse(
                $this->validator()->canLeaveSchool($student)->allowed,
                "leave from {$status} should be denied"
            );
        }
    }

    /* ───────────────────────────────────────────────
       canMakeInactive
       ─────────────────────────────────────────────── */

    public function test_can_make_inactive_allows_active_student_with_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);
        $this->makeEnrollment($student, StudentSection::STATUS_ACTIVE);

        $this->assertTrue($this->validator()->canMakeInactive($student)->allowed);
    }

    public function test_can_make_inactive_denies_without_active_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_ACTIVE);

        $this->assertFalse($this->validator()->canMakeInactive($student)->allowed);
    }

    public function test_can_make_inactive_denies_terminal_statuses(): void
    {
        foreach ([Student::STATUS_PASSED_OUT, Student::STATUS_LEFT] as $status) {
            $student = $this->makeStudent($status);
            $this->assertFalse(
                $this->validator()->canMakeInactive($student)->allowed,
                "make inactive from {$status} should be denied"
            );
        }
    }

    /* ───────────────────────────────────────────────
       canReactivate
       ─────────────────────────────────────────────── */

    public function test_can_reactivate_allows_inactive_student_with_inactive_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_INACTIVE);
        $this->makeEnrollment($student, StudentSection::STATUS_INACTIVE);

        $this->assertTrue($this->validator()->canReactivate($student)->allowed);
    }

    public function test_can_reactivate_denies_without_inactive_enrollment(): void
    {
        $student = $this->makeStudent(Student::STATUS_INACTIVE);

        $this->assertFalse($this->validator()->canReactivate($student)->allowed);
    }

    public function test_can_reactivate_denies_active_and_terminal_statuses(): void
    {
        foreach ([Student::STATUS_ACTIVE, Student::STATUS_PASSED_OUT, Student::STATUS_LEFT] as $status) {
            $student = $this->makeStudent($status);
            $this->assertFalse(
                $this->validator()->canReactivate($student)->allowed,
                "reactivate from {$status} should be denied"
            );
        }
    }
}
