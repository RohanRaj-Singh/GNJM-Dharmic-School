<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Fee;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Multi-class fee correction — business condition:
 *
 *   Student
 *   ├── Gurmukhi → reference enrollment (must never be modified)
 *   └── Kirtan   → correction target (Admin confirms pending months)
 *
 * All mutations are keyed by the Kirtan student_section_id only.
 */
class MultiClassFeeCorrectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $accountant;
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

        // These tests assert fee-correction *business logic*, not CSRF
        // security (that is covered separately in SecurityTest). The test
        // environment cannot share a session token between csrf_token() and
        // the dispatched request, so CSRF verification is disabled here to
        // keep the logic tests runnable without weakening production security.
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_multiclass_fix',
        ]);
        $this->accountant = User::factory()->create([
            'role' => 'accountant',
            'username' => 'acct_multiclass_fix',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 400,
        ]);
        $this->kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            // Legacy row with configured fee → chargesMonthlyFee() true.
            'default_monthly_fee' => 300,
        ]);

        $this->sectionG = Section::create([
            'class_id' => $this->gurmukhi->id,
            'name' => 'G-A',
            'monthly_fee' => 400,
        ]);
        $this->sectionK = Section::create([
            'class_id' => $this->kirtan->id,
            'name' => 'K-A',
            'monthly_fee' => 300,
        ]);

        $this->student = Student::create([
            'name' => 'Harpreet Singh',
            'father_name' => 'Father Singh',
            'status' => Student::STATUS_ACTIVE,
        ]);

        $this->enrollmentG = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->gurmukhi->id,
            'section_id' => $this->sectionG->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now()->subMonths(10)->startOfMonth(),
        ]);
        $this->enrollmentK = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->kirtan->id,
            'section_id' => $this->sectionK->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now()->subMonths(10)->startOfMonth(),
        ]);
    }

    /** @param list<string> $months newest-first Y-m */
    private function createMonthlyFees(StudentSection $enrollment, array $months, int $amount): void
    {
        foreach ($months as $month) {
            Fee::create([
                'student_section_id' => $enrollment->id,
                'type' => 'monthly',
                'month' => $month,
                'amount' => $amount,
            ]);
        }
    }

    /** @return list<string> */
    private function monthsFor(StudentSection $enrollment): array
    {
        return Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->orderByDesc('month')
            ->pluck('month')
            ->values()
            ->all();
    }

    private function trailingMonths(int $n): array
    {
        $months = [];
        for ($i = 0; $i < $n; $i++) {
            $months[] = Carbon::now(config('app.timezone'))->subMonths($i)->format('Y-m');
        }
        return $months;
    }

    private function feeSnapshot(StudentSection $enrollment): array
    {
        return Fee::where('student_section_id', $enrollment->id)
            ->orderBy('id')
            ->get(['id', 'month', 'amount', 'type', 'student_section_id', 'title'])
            ->map(fn (Fee $f) => $f->toArray())
            ->all();
    }

    public function test_kirtan_correction_from_2_to_5_leaves_gurmukhi_untouched(): void
    {
        // Gurmukhi → 5 months (reference)
        $this->createMonthlyFees($this->enrollmentG, $this->trailingMonths(5), 400);
        // Kirtan → 2 months (affected)
        $this->createMonthlyFees($this->enrollmentK, $this->trailingMonths(2), 300);

        $gBefore = $this->feeSnapshot($this->enrollmentG);
        $this->assertCount(5, $this->monthsFor($this->enrollmentG));
        $this->assertCount(2, $this->monthsFor($this->enrollmentK));

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertOk();

        $this->assertSame(5, count($this->monthsFor($this->enrollmentG)));
        $this->assertCount(5, $this->monthsFor($this->enrollmentG));
        $this->assertCount(5, $this->monthsFor($this->enrollmentK));

        // Strict: no Gurmukhi fee row created, updated, deleted, or modified.
        $this->assertSame($gBefore, $this->feeSnapshot($this->enrollmentG));
        $this->assertSame(
            $this->trailingMonths(5),
            $this->monthsFor($this->enrollmentK)
        );
    }

    public function test_correct_kirtan_to_n_does_not_modify_any_gurmukhi_fee_rows(): void
    {
        $gMonths = $this->trailingMonths(4);
        $this->createMonthlyFees($this->enrollmentG, $gMonths, 400);
        $this->createMonthlyFees($this->enrollmentK, $this->trailingMonths(1), 300);

        $gIdsBefore = Fee::where('student_section_id', $this->enrollmentG->id)
            ->orderBy('id')
            ->pluck('id')
            ->all();
        $gSnapshot = $this->feeSnapshot($this->enrollmentG);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 3,
            ])
            ->assertOk()
            ->assertJsonPath('reference_unchanged', true);

        $gIdsAfter = Fee::where('student_section_id', $this->enrollmentG->id)
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $this->assertSame($gIdsBefore, $gIdsAfter);
        $this->assertSame($gSnapshot, $this->feeSnapshot($this->enrollmentG));
        $this->assertCount(3, $this->monthsFor($this->enrollmentK));

        // Zero fee rows exist for Gurmukhi with a wrong enrollment key from this call.
        $this->assertSame(
            0,
            Fee::where('student_section_id', $this->enrollmentK->id)
                ->where('month', '>', now()->format('Y-m'))
                ->count()
        );
    }

    public function test_apply_rejects_gurmukhi_enrollment_as_target(): void
    {
        $this->createMonthlyFees($this->enrollmentG, $this->trailingMonths(2), 400);
        $gBefore = $this->feeSnapshot($this->enrollmentG);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentG->id,
                'pending_months' => 5,
            ])
            ->assertStatus(422);

        $this->assertSame($gBefore, $this->feeSnapshot($this->enrollmentG));
        $this->assertCount(2, $this->monthsFor($this->enrollmentG));
    }

    public function test_apply_rejects_student_without_gurmukhi_reference(): void
    {
        $kirtanOnlyClass = SchoolClass::create([
            'name' => 'Kirtan Solo',
            'type' => 'kirtan',
            'default_monthly_fee' => 300,
        ]);
        $section = Section::create([
            'class_id' => $kirtanOnlyClass->id,
            'name' => 'KS',
            'monthly_fee' => 300,
        ]);
        $solo = Student::create([
            'name' => 'Kirtan Only',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $solo->id,
            'class_id' => $kirtanOnlyClass->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $enrollment->id,
                'pending_months' => 3,
            ])
            ->assertStatus(422);
    }

    public function test_candidates_lists_only_gurmukhi_kirtan_pairs(): void
    {
        $singleClass = SchoolClass::create([
            'name' => 'Gurmukhi Solo',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 400,
        ]);
        $singleSection = Section::create([
            'class_id' => $singleClass->id,
            'name' => 'GS',
            'monthly_fee' => 400,
        ]);
        $singleStudent = Student::create([
            'name' => 'Single Class Kid',
            'status' => Student::STATUS_ACTIVE,
        ]);
        StudentSection::create([
            'student_id' => $singleStudent->id,
            'class_id' => $singleClass->id,
            'section_id' => $singleSection->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $res = $this->actingAs($this->admin)
            ->getJson(route('admin.utilities.multi-class-fee-correction.candidates'))
            ->assertOk();

        $ids = collect($res->json('students'))->pluck('student_id')->all();
        $this->assertContains($this->student->id, $ids);
        $this->assertNotContains($singleStudent->id, $ids);

        $pair = collect($res->json('students'))
            ->firstWhere('student_id', $this->student->id);

        $this->assertSame('reference', $pair['reference']['role']);
        $this->assertSame('target', $pair['target']['role']);
        $this->assertSame($this->enrollmentG->id, $pair['reference']['id']);
        $this->assertSame($this->enrollmentK->id, $pair['target']['id']);
        $this->assertSame('Kirtan', $pair['target']['class_name']);
        $this->assertSame('Gurmukhi', $pair['reference']['class_name']);
    }

    public function test_paid_history_kirtan_is_editable_and_value_is_capped_to_unpaid_tail(): void
    {
        // Kirtan has 5 fee months; pay the fee from 3 months ago, so the unpaid
        // tail after the last paid month is 3 months.
        $this->createMonthlyFees($this->enrollmentK, $this->trailingMonths(5), 300);
        $paidMonth = $this->trailingMonths(5)[3]; // 3 months ago
        $paidFee = Fee::where('student_section_id', $this->enrollmentK->id)
            ->where('month', $paidMonth)
            ->first();
        Payment::create([
            'fee_id' => $paidFee->id,
            'amount_paid' => 300,
            'paid_at' => now(),
        ]);

        $gBefore = $this->feeSnapshot($this->enrollmentG);

        // A value greater than the unpaid tail (<= 3) is silently clamped to 3
        // instead of being rejected — the payment "lock" is intentionally gone.
        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 10,
            ])
            ->assertOk()
            ->assertJsonPath('reference_unchanged', true);

        $this->assertSame(3, (int) $this->enrollmentK->fresh()->assumed_pending_months);
        // Gurmukhi reference never modified.
        $this->assertSame($gBefore, $this->feeSnapshot($this->enrollmentG));

        // A value within the unpaid tail (<= 3) is applied as typed, not clamped.
        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 2,
            ])
            ->assertOk();

        $this->assertSame(2, (int) $this->enrollmentK->fresh()->assumed_pending_months);

        // A Gurmukhi payment history does not block Kirtan edits either.
        Payment::query()->delete();
        $this->createMonthlyFees($this->enrollmentG, $this->trailingMonths(3), 400);
        $gFee = Fee::where('student_section_id', $this->enrollmentG->id)->first();
        Payment::create([
            'fee_id' => $gFee->id,
            'amount_paid' => 400,
            'paid_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 4,
            ])
            ->assertOk()
            ->assertJsonPath('reference_unchanged', true);

        $this->assertSame(4, (int) $this->enrollmentK->fresh()->assumed_pending_months);
    }

    public function test_non_charging_kirtan_class_rejects_positive_pending_months(): void
    {
        $this->kirtan->update([
            'charges_monthly_fee' => false,
            'default_monthly_fee' => 0,
        ]);
        $this->sectionK->update(['monthly_fee' => 0]);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertStatus(422);

        $this->assertCount(0, $this->monthsFor($this->enrollmentK));
    }

    public function test_preview_reports_create_and_delete_without_writing(): void
    {
        $this->createMonthlyFees($this->enrollmentG, $this->trailingMonths(5), 400);
        $old = Carbon::now(config('app.timezone'))->subMonths(9)->format('Y-m');
        $this->createMonthlyFees($this->enrollmentK, array_merge([$old], $this->trailingMonths(2)), 300);

        $gBefore = $this->feeSnapshot($this->enrollmentG);
        $kCountBefore = $this->monthsFor($this->enrollmentK);

        $res = $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.preview'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertOk();

        $this->assertCount(3, $kCountBefore);
        $this->assertSame($gBefore, $this->feeSnapshot($this->enrollmentG));
        $this->assertCount(3, $this->monthsFor($this->enrollmentK));
        $this->assertNotEmpty($res->json('will_create'));
        $this->assertContains($old, $res->json('will_delete_unpaid'));

        // Apply matches preview outcome for target only.
        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertOk();

        $this->assertSame($this->trailingMonths(5), $this->monthsFor($this->enrollmentK));
        $this->assertSame($gBefore, $this->feeSnapshot($this->enrollmentG));
    }

    public function test_apply_writes_audit_log_with_target_enrollment(): void
    {
        $this->createMonthlyFees($this->enrollmentK, $this->trailingMonths(2), 300);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertOk();

        $log = AuditLog::where('action', AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED)
            ->latest('created_at')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame($this->enrollmentK->id, $log->auditable_id);
        $this->assertSame($this->enrollmentK->id, $log->payload['student_section_id']);
        $this->assertSame(5, $log->payload['pending_months']);
        $this->assertSame($this->student->id, $log->payload['student_id']);
    }

    public function test_single_apply_audit_has_no_bulk_flag_but_bulk_apply_does(): void
    {
        [$g, $k] = $this->makePair("Audit Flag Kid");
        $this->createMonthlyFees($g, $this->trailingMonths(5), 400);
        $this->createMonthlyFees($k, $this->trailingMonths(2), 300);

        // Single apply — payload must NOT carry a misleading `bulk` flag.
        $this->actingAs($this->admin)
            ->postJson(route("admin.utilities.multi-class-fee-correction.apply"), [
                "student_section_id" => $k->id,
                "pending_months" => 5,
            ])
            ->assertOk();

        $singleLog = AuditLog::where("action", AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED)
            ->where("auditable_id", $k->id)
            ->latest("id")
            ->first();
        $this->assertFalse(array_key_exists("bulk", $singleLog->payload));
        $this->assertSame(5, $singleLog->payload["pending_months"]);

        // Bulk apply — each row's payload MUST be tagged `bulk => true`.
        $this->actingAs($this->admin)
            ->postJson(route("admin.utilities.multi-class-fee-correction.bulk-apply"), [
                "corrections" => [
                    ["student_section_id" => $k->id, "pending_months" => 3],
                ],
            ])
            ->assertOk();

        $bulkLog = AuditLog::where("action", AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED)
            ->where("auditable_id", $k->id)
            ->latest("id")
            ->first();
        $this->assertTrue($bulkLog->payload["bulk"] ?? false);
        $this->assertSame(3, $bulkLog->payload["pending_months"]);
    }

    public function test_non_admin_cannot_apply_correction(): void
    {
        $this->createMonthlyFees($this->enrollmentK, $this->trailingMonths(2), 300);
        $before = $this->feeSnapshot($this->enrollmentK);

        // role:admin middleware redirects non-admins (302) before the controller runs.
        $this->actingAs($this->accountant)
            ->postJson(route('admin.utilities.multi-class-fee-correction.apply'), [
                'student_section_id' => $this->enrollmentK->id,
                'pending_months' => 5,
            ])
            ->assertRedirect();

        $this->assertSame($before, $this->feeSnapshot($this->enrollmentK));
        $this->assertSame(
            0,
            AuditLog::where('action', AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED)->count()
        );
    }

    public function test_index_renders_for_admin(): void
    {
        $this->actingAs($this->admin)
            ->get(route('admin.utilities.multi-class-fee-correction'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Utilities/MultiClassFeeCorrection'));
    }

    /** @return array{StudentSection,StudentSection} [gurmukhiEnrollment, kirtanEnrollment] */
    private function makePair(string $name = 'Bulk Kid'): array
    {
        $student = Student::create([
            'name' => $name,
            'father_name' => 'Patel',
            'status' => Student::STATUS_ACTIVE,
        ]);

        $g = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $this->gurmukhi->id,
            'section_id' => $this->sectionG->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now()->subMonths(10)->startOfMonth(),
        ]);
        $k = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $this->kirtan->id,
            'section_id' => $this->sectionK->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now()->subMonths(10)->startOfMonth(),
        ]);

        return [$g, $k];
    }

    public function test_bulk_apply_corrects_multiple_students_atomic(): void
    {
        [$g1, $k1] = $this->makePair('Bulk Kid One');
        [$g2, $k2] = $this->makePair('Bulk Kid Two');

        $this->createMonthlyFees($g1, $this->trailingMonths(5), 400);
        $this->createMonthlyFees($k1, $this->trailingMonths(2), 300);
        $this->createMonthlyFees($g2, $this->trailingMonths(5), 400);
        $this->createMonthlyFees($k2, $this->trailingMonths(1), 300);

        $g1Before = $this->feeSnapshot($g1);
        $g2Before = $this->feeSnapshot($g2);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.bulk-apply'), [
                'corrections' => [
                    ['student_section_id' => $k1->id, 'pending_months' => 5],
                    ['student_section_id' => $k2->id, 'pending_months' => 4],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('reference_unchanged', true);

        $this->assertSame(5, count($this->monthsFor($k1)));
        $this->assertSame(4, count($this->monthsFor($k2)));
        $this->assertSame($g1Before, $this->feeSnapshot($g1));
        $this->assertSame($g2Before, $this->feeSnapshot($g2));
    }

    public function test_bulk_apply_rejects_whole_batch_when_any_invalid(): void
    {
        [$g1, $k1] = $this->makePair('Valid Kid');
        $this->createMonthlyFees($k1, $this->trailingMonths(2), 300);

        // The second row targets the Gurmukhi enrollment → must be rejected,
        // and the valid first row must NOT be applied either (atomic).
        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.bulk-apply'), [
                'corrections' => [
                    ['student_section_id' => $k1->id, 'pending_months' => 5],
                    ['student_section_id' => $g1->id, 'pending_months' => 5],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('reference_unchanged', null);

        // Atomic: nothing changed.
        $this->assertCount(2, $this->monthsFor($k1));
    }

    public function test_bulk_apply_skips_unchanged_rows(): void
    {
        [$g1, $k1] = $this->makePair('Unchanged Kid');
        [$g2, $k2] = $this->makePair('Changed Kid');

        $this->createMonthlyFees($k1, $this->trailingMonths(2), 300);
        $this->createMonthlyFees($k2, $this->trailingMonths(2), 300);

        // k1 left at its current assumed_pending_months (2 → unchanged, skipped)
        // k2 changed 2 → 5.
        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.bulk-apply'), [
                'corrections' => [
                    ['student_section_id' => $k1->id, 'pending_months' => 2],
                    ['student_section_id' => $k2->id, 'pending_months' => 5],
                ],
            ])
            ->assertOk();

        $this->assertCount(2, $this->monthsFor($k1));
        $this->assertCount(5, $this->monthsFor($k2));
    }

    public function test_bulk_apply_writes_audit_log_for_each(): void
    {
        [$g1, $k1] = $this->makePair('Audit Kid One');
        [$g2, $k2] = $this->makePair('Audit Kid Two');
        $this->createMonthlyFees($k1, $this->trailingMonths(2), 300);
        $this->createMonthlyFees($k2, $this->trailingMonths(1), 300);

        $this->actingAs($this->admin)
            ->postJson(route('admin.utilities.multi-class-fee-correction.bulk-apply'), [
                'corrections' => [
                    ['student_section_id' => $k1->id, 'pending_months' => 4],
                    ['student_section_id' => $k2->id, 'pending_months' => 3],
                ],
            ])
            ->assertOk();

        $logs = AuditLog::where('action', AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED)
            ->where('auditable_id', $k1->id)
            ->orWhere('auditable_id', $k2->id)
            ->get();
        $this->assertSame(2, $logs->count());
    }

    public function test_bulk_apply_clamps_value_for_paid_history_student(): void
    {
        [$g, $k] = $this->makePair("Clamp Bulk Kid");
        $this->createMonthlyFees($g, $this->trailingMonths(5), 400);
        $this->createMonthlyFees($k, $this->trailingMonths(5), 300);

        // Pay the Kirtan fee from 3 months ago → unpaid tail = 3.
        $paidFee = Fee::where("student_section_id", $k->id)
            ->where("month", $this->trailingMonths(5)[3])
            ->first();
        Payment::create([
            "fee_id" => $paidFee->id,
            "amount_paid" => 300,
            "paid_at" => now(),
        ]);

        $this->actingAs($this->admin)
            ->postJson(route("admin.utilities.multi-class-fee-correction.bulk-apply"), [
                "corrections" => [
                    ["student_section_id" => $k->id, "pending_months" => 12],
                ],
            ])
            ->assertOk()
            ->assertJsonPath("applied.0.pending_months", 3);

        // Silently clamped to months-since-last-paid on the stored enrollment.
        $this->assertSame(3, (int) $k->fresh()->assumed_pending_months);
    }

    public function test_bulk_apply_non_admin_cannot_apply(): void
    {
        [$g1, $k1] = $this->makePair('No Access Kid');
        $this->createMonthlyFees($k1, $this->trailingMonths(2), 300);

        $this->actingAs($this->accountant)
            ->postJson(route('admin.utilities.multi-class-fee-correction.bulk-apply'), [
                'corrections' => [
                    ['student_section_id' => $k1->id, 'pending_months' => 5],
                ],
            ])
            ->assertRedirect();

        $this->assertCount(2, $this->monthsFor($k1));
    }
}
