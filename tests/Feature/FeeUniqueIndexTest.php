<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Guards the per-enrollment monthly-fee identity: one monthly fee per
 * (student_section_id, type, month), enforced by the
 * idx_fees_unique_enrollment_monthly unique index. Each class generates its
 * own fee independently — a student in both Gurmukhi and Kirtan gets two
 * separate fees per month.
 */
class FeeUniqueIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $gurmukhi;
    private SchoolClass $kirtan;
    private Section $sectionG;
    private Section $sectionK;
    private Student $student;
    private StudentSection $enrollmentG;
    private StudentSection $enrollmentK;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_fee_index_test',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 400,
        ]);
        $this->kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 300,
        ]);
        $this->sectionG = Section::create([
            'class_id' => $this->gurmukhi->id,
            'name' => 'Section A',
            'monthly_fee' => 400,
        ]);
        $this->sectionK = Section::create([
            'class_id' => $this->kirtan->id,
            'name' => 'Kirtan A',
            'monthly_fee' => 300,
        ]);

        $this->student = Student::create([
            'name' => 'Fee Student',
            'father_name' => 'Fee Father',
            'status' => Student::STATUS_ACTIVE,
        ]);

        // Two active enrollments for different classes — simulates a student
        // in both Gurmukhi and Kirtan.
        $this->enrollmentG = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->gurmukhi->id,
            'section_id' => $this->sectionG->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        $this->enrollmentK = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->kirtan->id,
            'section_id' => $this->sectionK->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
    }

    private function monthlyFee(StudentSection $enrollment, string $month, int $amount = 100): Fee
    {
        return Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => $month,
            'amount' => $amount,
        ]);
    }

    public function test_unique_index_exists_on_enrollment_type_month(): void
    {
        $indexes = Schema::getIndexes('fees');
        $cols = collect($indexes)->map(fn ($i) => implode(',', $i['columns']))->all();

        $this->assertContains('student_section_id,type,month', $cols);
    }

    public function test_same_enrollment_cannot_receive_duplicate_monthly_fee(): void
    {
        $this->monthlyFee($this->enrollmentG, '2026-07');

        try {
            // Same enrollment, same type, same month — duplicate.
            $this->monthlyFee($this->enrollmentG, '2026-07');
            $this->fail('Duplicate (student_section_id, type, month) should have been rejected.');
        } catch (QueryException $e) {
            // expected: unique index violation
        }

        $this->assertSame(1, Fee::where('student_section_id', $this->enrollmentG->id)
            ->where('type', 'monthly')
            ->where('month', '2026-07')
            ->count());
    }

    public function test_different_enrollments_can_both_have_fees_same_month(): void
    {
        $this->monthlyFee($this->enrollmentG, '2026-07', 400);
        $this->monthlyFee($this->enrollmentK, '2026-07', 300);

        $this->assertSame(2, Fee::where('student_id', $this->student->id)
            ->where('type', 'monthly')
            ->where('month', '2026-07')
            ->count());

        $gFee = Fee::where('student_section_id', $this->enrollmentG->id)
            ->where('month', '2026-07')->first();
        $kFee = Fee::where('student_section_id', $this->enrollmentK->id)
            ->where('month', '2026-07')->first();

        $this->assertSame(400, $gFee->amount);
        $this->assertSame(300, $kFee->amount);
    }

    public function test_different_months_can_exist_for_same_enrollment(): void
    {
        $this->monthlyFee($this->enrollmentG, '2026-07');
        $this->monthlyFee($this->enrollmentG, '2026-08');

        $this->assertSame(2, Fee::where('student_section_id', $this->enrollmentG->id)
            ->where('type', 'monthly')
            ->count());
    }

    public function test_different_fee_types_can_exist_for_same_enrollment_month(): void
    {
        $this->monthlyFee($this->enrollmentG, '2026-07');

        Fee::create([
            'student_id' => $this->student->id,
            'student_section_id' => $this->enrollmentG->id,
            'type' => 'custom',
            'title' => 'Trip',
            'month' => '2026-07',
            'amount' => 50,
        ]);

        $this->assertSame(2, Fee::where('student_section_id', $this->enrollmentG->id)
            ->where('month', '2026-07')
            ->count());
    }

    public function test_store_creates_fee_for_enrollment(): void
    {
        $response = $this->actingAs($this->admin)
            ->from(route('students.store'))
            ->post(route('students.store'), [
                'name' => 'Store Student',
                'father_name' => 'Store Father',
                'section_id' => $this->sectionG->id,
                'student_type' => 'paid',
            ]);

        $response->assertRedirect(route('students.index'));

        $created = Student::where('name', 'Store Student')->firstOrFail();
        $month = now(config('app.timezone'))->format('Y-m');

        $this->assertSame(1, Fee::where('student_id', $created->id)
            ->where('type', 'monthly')
            ->where('month', $month)
            ->count());
    }

    public function test_pending_fees_update_creates_per_enrollment(): void
    {
        $month = now(config('app.timezone'))->format('Y-m');

        // Admin sets pending months on enrollment G.
        $response = $this->actingAs($this->admin)
            ->from(route('admin.utilities.pending-fees'))
            ->patch(route('admin.utilities.pending-fees.update', $this->enrollmentG), [
                'assumed_pending_months' => 1,
            ]);

        $response->assertRedirect(route('admin.utilities.pending-fees'));

        // Fee created for enrollment G.
        $this->assertSame(1, Fee::where('student_section_id', $this->enrollmentG->id)
            ->where('type', 'monthly')
            ->where('month', $month)
            ->count());

        // No fee created for enrollment K (not requested).
        $this->assertSame(0, Fee::where('student_section_id', $this->enrollmentK->id)
            ->where('type', 'monthly')
            ->where('month', $month)
            ->count());
    }
}
