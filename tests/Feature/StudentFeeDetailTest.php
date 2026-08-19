<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Pins the per-student fee-detail endpoint that backs the Fees redesign
 * Student Fee Sheet (Tier 2). The canonical HARPREET fixture is from the
 * §9.1 plan — a student with three current divisions and one historical
 * enrollment, so is_current_enrollment derivation (active + transferred_at IS NULL)
 * and per-row payment joining are exercised in one place.
 *
 * Routes exercised: GET admin.fees.student.fees → FeesController@studentFees.
 *
 * Audit defaults (Phase 3 §D / §E):
 *   - Admin/accountant only (FeePolicy::viewAny)
 *   - No caching (open-on-demand)
 *   - No pagination (most students have <24 rows)
 */
class StudentFeeDetailTest extends TestCase
{
    use RefreshDatabase;

    private function class(string $name, string $type, ?string $division = null): SchoolClass
    {
        return SchoolClass::create([
            'name' => $name,
            'type' => $type,
            'division' => $division,
            'default_monthly_fee' => 600,
        ]);
    }

    private function section(SchoolClass $class, string $name): Section
    {
        return Section::create([
            'class_id' => $class->id,
            'name' => $name,
            'monthly_fee' => 600,
        ]);
    }

    private function enroll(
        Student $student,
        SchoolClass $class,
        Section $section,
        string $status = StudentSection::STATUS_ACTIVE,
        ?Carbon $transferredAt = null,
    ): StudentSection {
        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => $status,
            'transferred_at' => $transferredAt,
            'started_at' => now()->subYear(),
        ]);
    }

    private function monthlyFee(StudentSection $enrollment, string $month, int $amount = 600): Fee
    {
        return Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => $month,
            'amount' => $amount,
        ]);
    }

    private function customFee(StudentSection $enrollment, string $title, int $amount): Fee
    {
        // Custom fees carry NULL on the month column — the F3 unique index
        // `(student_id, type, month)` lives on monthly rows only. Multiple
        // custom fees per student are allowed as long as their (student_id,
        // type='custom', title) tuples differ; the storeCustomFee action keys
        // off (student_section_id, type, title).
        return Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'custom',
            'title' => $title,
            'amount' => $amount,
            'month' => null,
        ]);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'username' => 'fee_detail_admin']);
    }

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'teacher', 'username' => 'fee_detail_teacher']);
    }

    public function test_admin_can_view_student_fee_detail(): void
    {
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $kirtan = $this->class('Kirtan', 'kirtan');
        $sectionG = $this->section($gurmukhi, 'Section A');
        $sectionK = $this->section($kirtan, 'Kirtan A');
        $student = Student::create(['name' => 'Harpreet', 'status' => Student::STATUS_ACTIVE]);

        $enrollG = $this->enroll($student, $gurmukhi, $sectionG);
        $enrollK = $this->enroll($student, $kirtan, $sectionK);
        // Different months — F3 invariant: only one monthly fee per
        // (student_id, type, month) regardless of how many enrollments exist.
        $this->monthlyFee($enrollG, '2026-07');
        $this->monthlyFee($enrollK, '2026-06');

        $response = $this->actingAs($this->admin())
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertOk();
        $response->assertJsonStructure([
            'student' => ['id', 'name'],
            'fees' => [
                '*' => [
                    'id',
                    'student_section_id',
                    'type',
                    'month',
                    'title',
                    'amount',
                    'is_current_enrollment',
                    'is_paid',
                    'division_key',
                    'class_name',
                    'section_name',
                ],
            ],
        ]);
        $response->assertJsonCount(2, 'fees');
    }

    public function test_canonical_harpreet_fixture_includes_three_current_divisions_and_one_historical(): void
    {
        // Canonical HARPREET fixture per planning §9.1:
        //   - 3 CURRENT enrollments (Gurmukhi, Kirtan, Music)
        //   - 1 HISTORICAL enrollment (Gurmukhi Section A — promoted out)
        //   - 7 fees total: 4 monthly (1 historical + 3 current, distinct months
        //     per F3 invariant) + 3 custom
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $kirtan = $this->class('Kirtan', 'kirtan');
        $music = $this->class('Music', 'music', 'music');
        $sectionG1 = $this->section($gurmukhi, 'Section A');
        $sectionG2 = $this->section($gurmukhi, 'Section B');
        $sectionK = $this->section($kirtan, 'Kirtan A');
        $sectionM = $this->section($music, 'Music A');

        $student = Student::create(['name' => 'Harpreet', 'status' => Student::STATUS_ACTIVE]);

        // Historical: Gurmukhi Section A, promoted out.
        $historical = $this->enroll(
            $student,
            $gurmukhi,
            $sectionG1,
            StudentSection::STATUS_INACTIVE,
            now()->subMonths(6),
        );

        // Current: Gurmukhi Section B, Kirtan, Music
        $currentG = $this->enroll($student, $gurmukhi, $sectionG2);
        $currentK = $this->enroll($student, $kirtan, $sectionK);
        $currentM = $this->enroll($student, $music, $sectionM);

        // F3 invariant: monthly fees keyed by (student_id, type, month) — a
        // student has at most one monthly fee per month regardless of how many
        // classes they attend. Each division's monthly fee therefore uses a
        // distinct month so the canonical 7-row surface still surfaces.
        $this->monthlyFee($historical, '2026-01');   // historical Gurmukhi
        $this->monthlyFee($currentG, '2026-05');     // current Gurmukhi
        $this->monthlyFee($currentK, '2026-06');     // current Kirtan
        $this->monthlyFee($currentM, '2026-07');     // current Music
        $tripFee = $this->customFee($currentG, 'Trip', 1500);
        $this->customFee($currentK, 'Uniform', 800);
        $this->customFee($currentM, 'Instrument', 1200);

        $response = $this->actingAs($this->admin())
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertOk();
        $response->assertJsonCount(7, 'fees');

        $payload = $response->json();
        $byId = collect($payload['fees'])->keyBy('id');

        // The historical Gurmukhi fee must be flagged is_current_enrollment=false.
        $historicalFee = $byId->first(fn ($f) => $f['student_section_id'] === $historical->id);
        $this->assertNotNull($historicalFee, 'Historical Gurmukhi fee must be present');
        $this->assertFalse($historicalFee['is_current_enrollment']);
        $this->assertSame('gurmukhi', $historicalFee['division_key']);
        $this->assertSame('Section A', $historicalFee['section_name']);
        $this->assertSame('2026-01', $historicalFee['month']);

        // Current Gurmukhi fee — same division as historical but different
        // student_section_id, is_current_enrollment=true.
        $currentGFee = $byId->first(fn ($f) =>
            $f['student_section_id'] === $currentG->id && $f['type'] === 'monthly');
        $this->assertTrue($currentGFee['is_current_enrollment']);
        $this->assertSame('Section B', $currentGFee['section_name']);
        $this->assertSame('gurmukhi', $currentGFee['division_key']);

        // Three distinct divisions surfaced: gurmukhi, kirtan, music — music
        // must appear as its own key (NOT collapse into gurmukhi default).
        $divisions = collect($payload['fees'])->pluck('division_key')->unique()->values()->all();
        sort($divisions);
        $this->assertSame(['gurmukhi', 'kirtan', 'music'], $divisions);

        // Custom fee type round-trip
        $trip = $byId[$tripFee->id];
        $this->assertSame('custom', $trip['type']);
        $this->assertSame('Trip', $trip['title']);
        $this->assertSame(1500, $trip['amount']);
    }

    public function test_paid_status_reflects_payment_join(): void
    {
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $section = $this->section($gurmukhi, 'Section A');
        $student = Student::create(['name' => 'Simran', 'status' => Student::STATUS_ACTIVE]);
        $enrollment = $this->enroll($student, $gurmukhi, $section);

        $admin = $this->admin();
        $paidFee = $this->monthlyFee($enrollment, '2026-06');
        Payment::create([
            'fee_id' => $paidFee->id,
            'amount_paid' => 600,
            'paid_at' => '2026-06-15',
            'collected_by' => $admin->id,
            'created_by' => $admin->id,
        ]);
        $unpaidFee = $this->monthlyFee($enrollment, '2026-07');

        $response = $this->actingAs($admin)
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertOk();
        $byId = collect($response->json('fees'))->keyBy('id');

        $this->assertTrue($byId[$paidFee->id]['is_paid']);
        $this->assertSame('2026-06-15', substr($byId[$paidFee->id]['paid_at'], 0, 10));
        $this->assertSame(600, (int) $byId[$paidFee->id]['payment_amount']);

        $this->assertFalse($byId[$unpaidFee->id]['is_paid']);
        $this->assertNull($byId[$unpaidFee->id]['paid_at']);
    }

    public function test_soft_deleted_payment_does_not_count_as_paid(): void
    {
        $gurmukhi = $this->class('Gurmukhi', 'gurmukhi');
        $section = $this->section($gurmukhi, 'Section A');
        $student = Student::create(['name' => 'Gurleen', 'status' => Student::STATUS_ACTIVE]);
        $enrollment = $this->enroll($student, $gurmukhi, $section);
        $fee = $this->monthlyFee($enrollment, '2026-07');

        $admin = $this->admin();
        $payment = Payment::create([
            'fee_id' => $fee->id,
            'amount_paid' => 600,
            'paid_at' => '2026-07-15',
            'collected_by' => $admin->id,
            'created_by' => $admin->id,
        ]);
        $payment->delete(); // soft delete — must NOT count as paid

        $response = $this->actingAs($admin)
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertOk();
        $byId = collect($response->json('fees'))->keyBy('id');
        $this->assertFalse($byId[$fee->id]['is_paid']);
    }

    public function test_student_with_no_fees_returns_empty_array(): void
    {
        $student = Student::create(['name' => 'Aman', 'status' => Student::STATUS_ACTIVE]);

        $response = $this->actingAs($this->admin())
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertOk();
        $response->assertJsonCount(0, 'fees');
        $response->assertJsonPath('student.id', $student->id);
        $response->assertJsonPath('student.name', 'Aman');
    }

    public function test_teacher_is_redirected_away_from_student_fee_detail(): void
    {
        $student = Student::create(['name' => 'Ravi', 'status' => Student::STATUS_ACTIVE]);

        // Teachers hit the role:admin middleware first (routes/web.php:41) which
        // redirects them to the teacher dashboard (302) BEFORE FeePolicy::viewAny
        // is consulted. This is the existing security boundary — verified here
        // so a future refactor that removes the role middleware still leaves the
        // FeePolicy gate intact as a second layer.
        $response = $this->actingAs($this->teacher())
            ->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertRedirect();
    }

    public function test_unauthenticated_request_is_redirected(): void
    {
        $student = Student::create(['name' => 'Noor', 'status' => Student::STATUS_ACTIVE]);

        $response = $this->get(route('admin.fees.student.fees', ['student' => $student->id]));

        $response->assertRedirect();
    }

    public function test_nonexistent_student_returns_404(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.fees.student.fees', ['student' => 999999]))
            ->assertNotFound();
    }
}