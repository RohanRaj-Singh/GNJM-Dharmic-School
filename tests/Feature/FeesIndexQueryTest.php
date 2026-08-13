<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the fee-listing query in Admin\FeesController::index() (Sprint 5.2) so
 * replacing the four correlated COALESCE subqueries with a single derived-table
 * join cannot change what the page renders:
 *   - a fee shows the student's CURRENT section within the same class
 *     (a mid-month section change is reflected)
 *   - a fee whose class the student no longer attends falls back to the
 *     ORIGINAL enrollment's section
 *   - each fee keeps the class type of its ORIGINAL enrollment, so a student
 *     with both Kirtan and Gurmukhi fees keeps them correctly separated
 */
class FeesIndexQueryTest extends TestCase
{
    use RefreshDatabase;

    private function class(string $name, string $type): SchoolClass
    {
        return SchoolClass::create([
            'name' => $name,
            'type' => $type,
            'default_monthly_fee' => 100,
        ]);
    }

    private function section(SchoolClass $class, string $name): Section
    {
        return Section::create([
            'class_id' => $class->id,
            'name' => $name,
            'monthly_fee' => 100,
        ]);
    }

    private function enroll(
        Student $student,
        SchoolClass $class,
        Section $section,
        string $type = 'paid',
        string $status = StudentSection::STATUS_ACTIVE,
    ): StudentSection {
        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => $type,
            'status' => $status,
            'started_at' => now(),
        ]);
    }

    private function addMonthlyFee(StudentSection $enrollment, string $month, int $amount = 100): Fee
    {
        return Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => $month,
            'amount' => $amount,
        ]);
    }

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'username' => 'fees_query_admin',
        ]);
    }

    private function currentMonth(): string
    {
        return now(config('app.timezone'))->format('Y-m');
    }

    public function test_fee_shows_current_section_within_same_class(): void
    {
        $class = $this->class('Gurmukhi', 'gurmukhi');
        $sectionA = $this->section($class, 'Section A');
        $sectionB = $this->section($class, 'Section B');
        $student = Student::create(['name' => 'Seema', 'status' => Student::STATUS_ACTIVE]);

        $original = $this->enroll($student, $class, $sectionA);
        $this->addMonthlyFee($original, $this->currentMonth());

        // Mid-month section change within the same class: the fee was created
        // for Section A but should now display Section B.
        $original->update(['status' => StudentSection::STATUS_INACTIVE, 'transferred_at' => now()]);
        $this->enroll($student, $class, $sectionB);

        $response = $this->actingAs($this->admin())->get(route('admin.fees.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Fees/Index')
            ->has('fees', 1)
            ->where('fees.0.student_name', 'Seema')
            ->where('fees.0.section_name', 'Section B')
            ->where('fees.0.class_name', 'Gurmukhi')
            ->where('fees.0.class_type', 'gurmukhi')
            ->where('fees.0.fees.0.class_type', 'gurmukhi')
            ->where('fees.0.fees.0.month', $this->currentMonth()));
    }

    public function test_fee_falls_back_to_original_section_after_promotion(): void
    {
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $sectionA = $this->section($gurmukhi, 'Section A');
        $kirtan = $this->class('Kirtan', 'kirtan');
        $sectionK = $this->section($kirtan, 'Kirtan A');
        $student = Student::create(['name' => 'Ravi', 'status' => Student::STATUS_ACTIVE]);

        $original = $this->enroll($student, $gurmukhi, $sectionA);
        $this->addMonthlyFee($original, $this->currentMonth());

        // Promoted to Kirtan — no active enrollment remains in the Gurmukhi
        // class, so the fee must fall back to the original section.
        $original->update(['status' => StudentSection::STATUS_INACTIVE, 'transferred_at' => now()]);
        $this->enroll($student, $kirtan, $sectionK);

        $response = $this->actingAs($this->admin())->get(route('admin.fees.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Fees/Index')
            ->has('fees', 1)
            ->where('fees.0.student_name', 'Ravi')
            ->where('fees.0.section_name', 'Section A')
            ->where('fees.0.class_name', 'Gurmukhi')
            ->where('fees.0.class_type', 'gurmukhi'));
    }

    public function test_kirtan_and_gurmukhi_fees_keep_their_own_class_type(): void
    {
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $sectionG = $this->section($gurmukhi, 'Gurmukhi A');
        $kirtan = $this->class('Kirtan', 'kirtan');
        $sectionK = $this->section($kirtan, 'Kirtan A');
        $student = Student::create(['name' => 'Simran', 'status' => Student::STATUS_ACTIVE]);

        $gEnrollment = $this->enroll($student, $gurmukhi, $sectionG);
        $kEnrollment = $this->enroll($student, $kirtan, $sectionK);

        // Monthly fees are keyed on (student_id, type, month), so two fees for
        // one student need two distinct months.
        $this->addMonthlyFee($gEnrollment, '2026-01');
        $this->addMonthlyFee($kEnrollment, '2026-02');

        $response = $this->actingAs($this->admin())->get(route('admin.fees.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Fees/Index')
            ->has('fees', 1)
            ->where('fees.0.student_name', 'Simran'));

        $row = $response->inertiaPage()['props']['fees'][0];
        // Any Kirtan fee makes the student row Kirtan; both class names appear.
        $this->assertSame('kirtan', $row['class_type']);
        $this->assertStringContainsString('Gurmukhi', $row['class_name']);
        $this->assertStringContainsString('Kirtan', $row['class_name']);

        // Each fee keeps the class type of its ORIGINAL enrollment.
        $feeClassTypes = array_map(fn ($f) => $f['class_type'], $row['fees']);
        sort($feeClassTypes);
        $this->assertSame(['gurmukhi', 'kirtan'], $feeClassTypes);
    }
}
