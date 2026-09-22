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
 * Pins the monthly-fee generation run so each class generates its own fee
 * independently:
 *   - paid, active students get a monthly fee per enrollment
 *   - Kirtan students get their own fees (not skipped)
 *   - free students are skipped and their unpaid monthly fees are cleared
 *   - an existing fee for the same enrollment+month is never duplicated
 *   - multi-class students get multiple fees (one per class)
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
            'kirtan' => $kirtan,
            'sectionG' => $sectionG,
            'sectionK' => $sectionK,
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

    public function test_generates_fees_for_all_eligible_enrollments(): void
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

        // Paid Kirtan → fee created (not skipped anymore).
        $this->assertSame(1, $this->monthlyFeesFor($data['paidKirtan']['student']->id));
        $kFee = Fee::where('student_id', $data['paidKirtan']['student']->id)
            ->where('type', 'monthly')
            ->where('month', $this->currentMonth())
            ->firstOrFail();
        $this->assertSame(100, $kFee->amount);
    }

    public function test_multi_class_student_gets_two_fees(): void
    {
        $data = $this->seedData();

        // Create a student enrolled in both Gurmukhi and Kirtan
        $multiStudent = Student::create([
            'name' => 'Multi Class',
            'father_name' => 'Father of Multi',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollG = StudentSection::create([
            'student_id' => $multiStudent->id,
            'class_id' => $data['gurmukhi']->id,
            'section_id' => $data['sectionG']->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        $enrollK = StudentSection::create([
            'student_id' => $multiStudent->id,
            'class_id' => $data['kirtan']->id,
            'section_id' => $data['sectionK']->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        Artisan::call('fees:generate-monthly');

        // Multi-class student gets TWO fees — one per enrollment.
        $this->assertSame(2, $this->monthlyFeesFor($multiStudent->id));

        $gFee = Fee::where('student_section_id', $enrollG->id)
            ->where('month', $this->currentMonth())->first();
        $kFee = Fee::where('student_section_id', $enrollK->id)
            ->where('month', $this->currentMonth())->first();

        $this->assertNotNull($gFee);
        $this->assertNotNull($kFee);
        $this->assertSame(100, $gFee->amount);
        $this->assertSame(100, $kFee->amount);
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

    public function test_existing_enrollment_fee_is_not_duplicated(): void
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
