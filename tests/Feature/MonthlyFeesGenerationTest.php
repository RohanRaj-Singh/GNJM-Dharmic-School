<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Pins the monthly-fee generation run (Sprint 5.1) so the consolidation behind
 * MonthlyFeeService / GenerateMonthlyFeeAction does not change its behavior:
 *   - paid, active, non-Kirtan students get a monthly fee for the current month
 *   - Kirtan students are skipped
 *   - free students are skipped and their unpaid monthly fees are cleared
 *   - an existing fee for the month (on any enrollment) is never duplicated
 */
class MonthlyFeesGenerationTest extends TestCase
{
    use RefreshDatabase;

    private function seedData(): array
    {
        $gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 100,
        ]);
        $kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 100,
        ]);

        $sectionG = Section::create([
            'class_id' => $gurmukhi->id,
            'name' => 'Gurmukhi A',
            'monthly_fee' => 100,
        ]);
        $sectionK = Section::create([
            'class_id' => $kirtan->id,
            'name' => 'Kirtan A',
            'monthly_fee' => 100,
        ]);

        $student = fn (string $name, string $type, SchoolClass $class, Section $section) => $this->makeEnrollment($name, $type, $class, $section);

        return [
            'gurmukhi' => $gurmukhi,
            'sectionG' => $sectionG,
            'paidGurmukhi' => $student('Paid Gurmukhi', 'paid', $gurmukhi, $sectionG),
            'freeGurmukhi' => $student('Free Gurmukhi', 'free', $gurmukhi, $sectionG),
            'paidKirtan' => $student('Paid Kirtan', 'paid', $kirtan, $sectionK),
        ];
    }

    private function makeEnrollment(string $name, string $type, SchoolClass $class, Section $section): array
    {
        $student = Student::create([
            'name' => $name,
            'father_name' => 'Father of ' . $name,
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => $type,
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        return ['student' => $student, 'enrollment' => $enrollment];
    }

    private function currentMonth(): string
    {
        return now(config('app.timezone'))->format('Y-m');
    }

    private function monthlyFeesFor(int $studentId): int
    {
        return Fee::where('student_id', $studentId)
            ->where('type', 'monthly')
            ->count();
    }

    public function test_generates_fees_for_eligible_students_and_skips_kirtan_and_free(): void
    {
        $data = $this->seedData();

        Artisan::call('fees:generate-monthly');

        // Paid Gurmukhi → fee created.
        $this->assertSame(1, $this->monthlyFeesFor($data['paidGurmukhi']['student']->id));
        $fee = Fee::where('student_id', $data['paidGurmukhi']['student']->id)
            ->where('type', 'monthly')
            ->where('month', $this->currentMonth())
            ->firstOrFail();
        $this->assertSame(100, $fee->amount);
        $this->assertSame('Monthly Fee', $fee->title);

        // Free Gurmukhi → no fee.
        $this->assertSame(0, $this->monthlyFeesFor($data['freeGurmukhi']['student']->id));

        // Paid Kirtan → skipped.
        $this->assertSame(0, $this->monthlyFeesFor($data['paidKirtan']['student']->id));
    }

    public function test_free_student_unpaid_monthly_fees_are_cleared(): void
    {
        $data = $this->seedData();
        $student = $data['freeGurmukhi']['student'];
        $enrollment = $data['freeGurmukhi']['enrollment'];

        Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => $this->currentMonth(),
            'amount' => 100,
        ]);
        $this->assertSame(1, $this->monthlyFeesFor($student->id));

        Artisan::call('fees:generate-monthly');

        $this->assertSame(0, $this->monthlyFeesFor($student->id));
    }

    public function test_existing_monthly_fee_is_not_duplicated(): void
    {
        $data = $this->seedData();
        $student = $data['paidGurmukhi']['student'];
        $enrollment = $data['paidGurmukhi']['enrollment'];

        Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => $this->currentMonth(),
            'amount' => 150,
        ]);
        $this->assertSame(1, $this->monthlyFeesFor($student->id));

        Artisan::call('fees:generate-monthly');

        // Still exactly one — the existing fee is preserved, not recreated.
        $this->assertSame(1, $this->monthlyFeesFor($student->id));
        $this->assertSame(150, Fee::where('student_id', $student->id)
            ->where('type', 'monthly')
            ->where('month', $this->currentMonth())
            ->value('amount'));
    }

    public function test_configured_class_fee_policy_controls_generation(): void
    {
        // A new class that opts INTO monthly fees → fee generated.
        $tabla = SchoolClass::create([
            'name' => 'Tabla',
            'type' => 'music',
            'division' => 'tabla',
            'charges_monthly_fee' => true,
            'default_monthly_fee' => 200,
        ]);
        $sectionT = Section::create([
            'class_id' => $tabla->id,
            'name' => 'Tabla A',
            'monthly_fee' => 200,
        ]);
        $paidTabla = $this->makeEnrollment('Paid Tabla', 'paid', $tabla, $sectionT);

        // A new class that opts OUT → skipped (no fee).
        $punjabi = SchoolClass::create([
            'name' => 'Punjabi',
            'type' => 'music',
            'division' => 'punjabi',
            'charges_monthly_fee' => false,
            'default_monthly_fee' => 300,
        ]);
        $sectionP = Section::create([
            'class_id' => $punjabi->id,
            'name' => 'Punjabi A',
            'monthly_fee' => 300,
        ]);
        $paidPunjabi = $this->makeEnrollment('Paid Punjabi', 'paid', $punjabi, $sectionP);

        Artisan::call('fees:generate-monthly');

        $this->assertSame(1, $this->monthlyFeesFor($paidTabla['student']->id));
        $this->assertSame(200, Fee::where('student_id', $paidTabla['student']->id)
            ->where('type', 'monthly')
            ->where('month', $this->currentMonth())
            ->value('amount'));

        $this->assertSame(0, $this->monthlyFeesFor($paidPunjabi['student']->id));
    }

    public function test_generate_button_route_generates_fees(): void
    {
        $data = $this->seedData();
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'gen_button_admin']);

        $this->actingAs($admin)
            ->post(route('admin.fees.generate-monthly'))
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertSame(1, $this->monthlyFeesFor($data['paidGurmukhi']['student']->id));
    }
}
