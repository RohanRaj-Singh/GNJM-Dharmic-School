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
 * Guards the canonical monthly-fee identity (F3): one monthly fee per
 * (student_id, type, month), enforced by the idx_fees_unique_student_monthly
 * unique index. Section changes must reuse the existing fee, never create a
 * duplicate; different fee types and months must still be able to coexist.
 */
class FeeUniqueIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $sectionA;
    private Section $sectionB;
    private Student $student;
    private StudentSection $enrollmentA;
    private StudentSection $enrollmentB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_fee_index_test',
        ]);

        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 100,
        ]);
        $this->sectionA = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 100,
        ]);
        $this->sectionB = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section B',
            'monthly_fee' => 100,
        ]);

        $this->student = Student::create([
            'name' => 'Fee Student',
            'father_name' => 'Fee Father',
            'status' => Student::STATUS_ACTIVE,
        ]);

        // Two active enrollments for the same student — simulates a mid-month
        // section change where the fee must stay keyed to the student, not the
        // enrollment.
        $this->enrollmentA = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->class->id,
            'section_id' => $this->sectionA->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        $this->enrollmentB = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->class->id,
            'section_id' => $this->sectionB->id,
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

    public function test_unique_index_exists_on_student_type_month(): void
    {
        $indexes = Schema::getIndexes('fees');
        $cols = collect($indexes)->map(fn ($i) => implode(',', $i['columns']))->all();

        $this->assertContains('student_id,type,month', $cols);
    }

    public function test_same_student_cannot_receive_duplicate_monthly_fee_same_month(): void
    {
        $this->monthlyFee($this->enrollmentA, '2026-07');

        try {
            // Same student, same type, same month — only the enrollment differs.
            $this->monthlyFee($this->enrollmentB, '2026-07');
            $this->fail('Duplicate (student_id, type, month) should have been rejected.');
        } catch (QueryException $e) {
            // expected: unique index violation
        }

        $this->assertSame(1, Fee::where('student_id', $this->student->id)
            ->where('type', 'monthly')
            ->where('month', '2026-07')
            ->count());
    }

    public function test_different_fee_types_can_exist_for_same_student_month(): void
    {
        $this->monthlyFee($this->enrollmentA, '2026-07');

        Fee::create([
            'student_id' => $this->student->id,
            'student_section_id' => $this->enrollmentA->id,
            'type' => 'custom',
            'title' => 'Trip',
            'month' => '2026-07',
            'amount' => 50,
        ]);

        $this->assertSame(2, Fee::where('student_id', $this->student->id)
            ->where('month', '2026-07')
            ->count());
    }

    public function test_different_months_can_exist_for_same_student_type(): void
    {
        $this->monthlyFee($this->enrollmentA, '2026-07');
        $this->monthlyFee($this->enrollmentA, '2026-08');

        $this->assertSame(2, Fee::where('student_id', $this->student->id)
            ->where('type', 'monthly')
            ->count());
    }

    public function test_section_change_reuses_existing_fee_not_duplicate(): void
    {
        // Fee created while the student was on enrollment A.
        $this->monthlyFee($this->enrollmentA, '2026-07');

        // Mid-month section change: the same canonical key must resolve to the
        // existing fee on A rather than inserting a new one on B.
        $reused = Fee::firstOrCreate(
            [
                'student_id' => $this->student->id,
                'type' => 'monthly',
                'month' => '2026-07',
            ],
            [
                'student_section_id' => $this->enrollmentB->id,
                'amount' => 100,
            ]
        );

        $this->assertSame(1, Fee::where('student_id', $this->student->id)
            ->where('type', 'monthly')
            ->where('month', '2026-07')
            ->count());
        // The fee stays attached to the original enrollment (F7 — fees never
        // move between enrollments).
        $this->assertSame($this->enrollmentA->id, $reused->student_section_id);
    }

    public function test_existing_valid_fee_records_unaffected(): void
    {
        $existing = $this->monthlyFee($this->enrollmentA, '2026-07', 150);

        // Another valid fee for a different month/type must not touch it.
        $this->monthlyFee($this->enrollmentA, '2026-08', 100);

        $fresh = $existing->fresh();
        $this->assertSame(150, $fresh->amount);
        $this->assertSame($this->enrollmentA->id, $fresh->student_section_id);
        $this->assertSame(2, Fee::count());
    }

    public function test_store_creates_single_monthly_fee_keyed_to_student(): void
    {
        $response = $this->actingAs($this->admin)
            ->from(route('students.store'))
            ->post(route('students.store'), [
                'name' => 'Store Student',
                'father_name' => 'Store Father',
                'section_id' => $this->sectionA->id,
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

    public function test_pending_fees_update_does_not_duplicate_across_enrollments(): void
    {
        // Fee for the current month already lives on enrollment A.
        $month = now(config('app.timezone'))->format('Y-m');
        $this->monthlyFee($this->enrollmentA, $month);

        // Admin sets pending months on enrollment B; the same (student, type,
        // month) must not create a second fee — it is already collectible on A.
        $response = $this->actingAs($this->admin)
            ->from(route('admin.utilities.pending-fees'))
            ->patch(route('admin.utilities.pending-fees.update', $this->enrollmentB), [
                'assumed_pending_months' => 1,
            ]);

        $response->assertRedirect(route('admin.utilities.pending-fees'));

        $this->assertSame(1, Fee::where('student_id', $this->student->id)
            ->where('type', 'monthly')
            ->where('month', $month)
            ->count());
    }
}
