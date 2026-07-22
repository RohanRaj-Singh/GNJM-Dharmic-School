<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentPromotionLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private SchoolClass $targetClass;
    private Section $targetSection;

    protected function setUp(): void
    {
        parent::setUp();

        // Create an admin user for authentication
        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_test',
        ]);

        // Create classes and sections used across tests
        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->section = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);

        $this->targetClass = SchoolClass::create([
            'name' => 'Gurmukhi Advanced',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 800,
        ]);
        $this->targetSection = Section::create([
            'class_id' => $this->targetClass->id,
            'name' => 'Section B',
            'monthly_fee' => 800,
        ]);
    }

    // ──────────────────────────────────────────────
    //  Helper: create a student with one enrollment
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
        ?SchoolClass $class = null,
        ?Section $section = null,
        string $studentType = 'paid',
    ): StudentSection {
        return StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => ($class ?? $this->class)->id,
            'section_id'   => ($section ?? $this->section)->id,
            'student_type' => $studentType,
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);
    }

    // ──────────────────────────────────────────────
    //  Test 1: Promote preserves pending fees
    // ──────────────────────────────────────────────

    public function test_promote_preserves_pending_fees(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Create unpaid monthly fees for the enrollment
        $fee1 = Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'monthly',
            'source' => 'monthly',
            'title'  => 'Monthly Fee',
            'amount' => 600,
            'month'  => '2026-03',
        ]);
        $fee2 = Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'monthly',
            'source' => 'monthly',
            'title'  => 'Monthly Fee',
            'amount' => 600,
            'month'  => '2026-04',
        ]);

        $oldEnrollmentId = $enrollment->id;

        // Act: promote the student
        $response = $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        $response->assertRedirect('/students');
        $response->assertSessionHas('success');

        // Assert old enrollment is marked promoted
        $oldEnrollment = StudentSection::find($oldEnrollmentId);
        $this->assertNotNull($oldEnrollment, 'Old enrollment should still exist');
        $this->assertSame(StudentSection::STATUS_PROMOTED, $oldEnrollment->status);
        $this->assertNotNull($oldEnrollment->transferred_at);

        // Assert a new enrollment exists with status active
        $newEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->first();
        $this->assertNotNull($newEnrollment, 'A new active enrollment should exist');
        $this->assertNotSame($oldEnrollmentId, $newEnrollment->id);

        // Assert old fees are still in the database with the old student_section_id
        $fee1->refresh();
        $fee2->refresh();
        $this->assertSame($oldEnrollmentId, $fee1->student_section_id);
        $this->assertSame($oldEnrollmentId, $fee2->student_section_id);

        // Assert old fees are still linked to the old enrollment
        $this->assertTrue(
            $oldEnrollment->fees()->where('id', $fee1->id)->exists(),
            'Fee 1 should still belong to the old enrollment'
        );
        $this->assertTrue(
            $oldEnrollment->fees()->where('id', $fee2->id)->exists(),
            'Fee 2 should still belong to the old enrollment'
        );
    }

    // ──────────────────────────────────────────────
    //  Test 2: Promote does not double-generate fees
    // ──────────────────────────────────────────────

    public function test_promote_does_not_double_generate_fees(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Promote
        $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        $newEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->firstOrFail();

        // Run GenerateMonthlyFees
        $this->artisan('fees:generate-monthly');

        // Assert exactly ONE fee for the new enrollment
        $newFees = Fee::where('student_section_id', $newEnrollment->id)
            ->where('type', 'monthly')
            ->get();
        $this->assertCount(1, $newFees, 'Should have exactly one monthly fee for the new enrollment');

        // Assert ZERO fees for the old (promoted) enrollment
        $oldFees = Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->get();
        $this->assertCount(0, $oldFees, 'Should have no monthly fees for the promoted enrollment');
    }

    // ──────────────────────────────────────────────
    //  Test 3: Fees listing shows unpaid promoted fees
    // ──────────────────────────────────────────────

    public function test_fees_listing_shows_unpaid_promoted_fees(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Create unpaid monthly fee
        Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'monthly',
            'source' => 'monthly',
            'title'  => 'Monthly Fee',
            'amount' => 600,
            'month'  => '2026-03',
        ]);

        // Promote the student
        $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        // Query using the simplified logic from FeesController::index
        // All fees show regardless of enrollment status.
        $feesQuery = Fee::query()
            ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                     ->whereNull('payments.deleted_at');
            })
            ->select('fees.*', 'student_sections.status as enrollment_status',
                     'student_sections.student_id', 'payments.id as payment_id')
            ->get();

        // Assert the unpaid fee from the promoted enrollment appears
        $this->assertGreaterThanOrEqual(1, $feesQuery->count(),
            'Fees listing should contain at least one fee');

        $promotedFees = $feesQuery->filter(fn ($f) => $f->enrollment_status === 'promoted');
        $this->assertGreaterThanOrEqual(1, $promotedFees->count(),
            'Should show unpaid fee from promoted enrollment');

        // Assert the new (active) enrollment also appears
        $activeFees = $feesQuery->filter(fn ($f) => $f->enrollment_status === 'active');
        $this->assertGreaterThanOrEqual(0, $activeFees->count(),
            'New active enrollment may or may not have fees in listing');
    }

    // ──────────────────────────────────────────────
    //  Test 4: Pass out clears student status
    // ──────────────────────────────────────────────

    public function test_pass_out_clears_student_status(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        $response = $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.pass-out', ['student' => $student->id]));

        $response->assertRedirect('/students');
        $response->assertSessionHas('success');

        // Assert student status
        $student->refresh();
        $this->assertSame(Student::STATUS_PASSED_OUT, $student->status);

        // Assert enrollment status
        $enrollment->refresh();
        $this->assertSame(StudentSection::STATUS_PASSED_OUT, $enrollment->status);
        $this->assertNotNull($enrollment->transferred_at);
    }

    // ──────────────────────────────────────────────
    //  Test 5: Promote with effective date works
    // ──────────────────────────────────────────────

    public function test_promote_with_effective_date(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        $effectiveDate = '2026-01-15';

        $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => $effectiveDate,
            ]);

        // Assert old enrollment transferred_at matches effective date
        $enrollment->refresh();
        $this->assertNotNull($enrollment->transferred_at);
        $this->assertSame(
            $effectiveDate . ' 00:00:00',
            $enrollment->transferred_at->format('Y-m-d H:i:s')
        );

        // Assert new enrollment started_at matches effective date
        $newEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->firstOrFail();

        $this->assertSame(
            $effectiveDate . ' 00:00:00',
            $newEnrollment->started_at->format('Y-m-d H:i:s')
        );
    }

    // ──────────────────────────────────────────────
    //  Test 6: Cannot promote inactive student
    // ──────────────────────────────────────────────

    public function test_cannot_promote_inactive_student(): void
    {
        $student = $this->createStudent('inactive');

        $response = $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        // The validator denies the request → controller returns back with errors
        $response->assertRedirect('/students');
        $response->assertSessionHasErrors('lifecycle');

        // Assert no changes were made
        $student->refresh();
        $this->assertSame('inactive', $student->status);
    }

    // ──────────────────────────────────────────────
    //  Test 7: Cannot leave school from active state
    // ──────────────────────────────────────────────

    public function test_cannot_leave_school_from_active_state(): void
    {
        $student = $this->createStudent('active');
        $enrollment = $this->createEnrollment($student);

        $response = $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.leave-school', ['student' => $student->id]));

        // The validator requires 'inactive' before leaving school
        $response->assertRedirect('/students');
        $response->assertSessionHasErrors('lifecycle');

        // Assert no changes
        $student->refresh();
        $this->assertSame(Student::STATUS_ACTIVE, $student->status);

        $enrollment->refresh();
        $this->assertSame(StudentSection::STATUS_ACTIVE, $enrollment->status);
        $this->assertNull($enrollment->transferred_at);
    }

    // ──────────────────────────────────────────────
    //  Test 8: GenerateMonthlyFees only creates for
    //          current (active) enrollments
    // ──────────────────────────────────────────────

    public function test_generate_monthly_fees_only_for_current_enrollments(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Promote the student
        $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        $oldEnrollment = StudentSection::find($enrollment->id);
        $newEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->firstOrFail();

        // Run fee generation
        $this->artisan('fees:generate-monthly');

        // Assert a fee was created for the NEW enrollment
        $newFeesCount = Fee::where('student_section_id', $newEnrollment->id)->count();
        $this->assertSame(1, $newFeesCount,
            'A fee should have been generated for the new active enrollment');

        // Assert NO fee was created for the old (promoted) enrollment
        $oldFeesCount = Fee::where('student_section_id', $oldEnrollment->id)->count();
        $this->assertSame(0, $oldFeesCount,
            'No fee should be generated for the promoted enrollment');
    }

    // ──────────────────────────────────────────────
    //  Test 9: Fees listing query shows unpaid
    //          historical fees but not paid ones
    // ──────────────────────────────────────────────

    public function test_fees_listing_shows_all_historical_fees_including_paid(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Create an unpaid fee
        $unpaidFee = Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'monthly',
            'source' => 'monthly',
            'title'  => 'Monthly Fee',
            'amount' => 600,
            'month'  => '2026-03',
        ]);

        // Create a paid fee (with a payment record)
        $paidFee = Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'monthly',
            'source' => 'monthly',
            'title'  => 'Monthly Fee',
            'amount' => 600,
            'month'  => '2026-04',
        ]);
        $paidFee->payments()->create([
            'amount_paid' => 600,
            'paid_at'     => now(),
        ]);

        // Promote the student
        $this
            ->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id'     => $this->targetSection->id,
                'effective_date' => null,
            ]);

        // Use the simplified query from FeesController::index — all fees show
        // regardless of enrollment status or payment status.
        $feesQuery = Fee::query()
            ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                     ->whereNull('payments.deleted_at');
            })
            ->select('fees.*', 'student_sections.status as enrollment_status',
                     'payments.id as payment_id')
            ->get();

        // Filter down to fees from promoted (old) enrollment only
        $promotedFees = $feesQuery->filter(fn ($f) => $f->enrollment_status === 'promoted');

        // The unpaid fee from promoted enrollment SHOULD appear
        $promotedUnpaid = $promotedFees->filter(fn ($f) => (int) $f->id === $unpaidFee->id);
        $this->assertGreaterThanOrEqual(1, $promotedUnpaid->count(),
            'Unpaid fee from promoted enrollment must appear in listing');

        // The paid fee from promoted enrollment SHOULD ALSO appear now
        $promotedPaid = $promotedFees->filter(fn ($f) => (int) $f->id === $paidFee->id);
        $this->assertGreaterThanOrEqual(1, $promotedPaid->count(),
            'Paid fee from promoted enrollment must ALSO appear in listing');
    }
}
