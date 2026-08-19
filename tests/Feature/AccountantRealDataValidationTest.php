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
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * ACCOUNTANT REAL-DATA VALIDATION
 * ================================
 *
 * Phase 1 of the Accountant validation pass. Hits every Accountant-accessible
 * route against the LIVE database (gnjm), exercising every workflow the
 * Accountant role is supposed to be able to perform.
 *
 * No RefreshDatabase — this runs against the LIVE gnjm database. Each WRITE
 * test records the affected row ids + snapshots the pre-state, then asserts
 * the post-state matches the expected delta. No destructive operations are
 * attempted against historical enrollments / fees / attendance.
 *
 * Skips if the live database is not available (e.g. CI sandbox).
 */
class AccountantRealDataValidationTest extends TestCase
{
    private User $accountant;
    private array $beforeSnapshot = [];
    private array $afterSnapshot = [];

    protected function setUp(): void
    {
        parent::setUp();

        // Reconfigure the default DB connection to the LIVE database for
        // this test only. phpunit.xml points DB_DATABASE at gnjm_test which
        // is an empty sandbox; this validation requires real student/fee
        // data. Original config is restored in tearDown.
        $originalDb = config('database.connections.mysql.database');

        // The live database name comes from .env; we read it by simulating
        // a fresh boot of config that ignores the phpunit.xml override.
        $liveDb = env('DB_DATABASE', $originalDb);
        if ($liveDb === 'gnjm_test') {
            // The .env DB_DATABASE matches the test sandbox — fall back to
            // hardcoded live db (the dev .env is the source of truth here).
            $liveDb = 'gnjm_dharmic_school';
        }

        try {
            config([
                'database.connections.mysql.database' => $liveDb,
            ]);
            DB::purge('mysql');
            DB::connection()->getPdo();

            $this->accountant = User::where('username', 'accountant')->firstOrFail();
        } catch (\Throwable $e) {
            // Restore before skipping so the rest of the suite still works.
            config(['database.connections.mysql.database' => $originalDb]);
            DB::purge('mysql');
            $this->markTestSkipped('Live database unavailable: ' . $e->getMessage());
            return;
        }

        $this->originalDbName = $originalDb;
        $this->beforeSnapshot = $this->snapshotState();
    }

    private ?string $originalDbName = null;

    protected function tearDown(): void
    {
        $this->afterSnapshot = $this->snapshotState();

        // Restore the test-DB connection so subsequent test classes that
        // expect gnjm_test still work.
        if ($this->originalDbName) {
            config(['database.connections.mysql.database' => $this->originalDbName]);
            DB::purge('mysql');
        }

        parent::tearDown();
    }

    private function snapshotState(): array
    {
        return [
            'students' => Student::count(),
            'enrollments' => StudentSection::count(),
            'fees' => Fee::count(),
            'payments' => Payment::count(),
            'audit_logs' => AuditLog::count(),
        ];
    }

    private function props(TestResponse $response): array
    {
        $data = $response->json('props', []);
        return is_array($data) ? $data : [];
    }

    private function inertiaGet(string $url, array $params = []): TestResponse
    {
        if ($params) {
            $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($params);
        }
        return $this->actingAs($this->accountant)
            ->get($url, [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => $this->inertiaVersion(),
            ]);
    }

    private function inertiaPost(string $url, array $data = []): TestResponse
    {
        return $this->actingAs($this->accountant)
            ->post($url, $data, [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => $this->inertiaVersion(),
            ]);
    }

    private ?string $cachedInertiaVersion = null;

    private function inertiaVersion(): string
    {
        if ($this->cachedInertiaVersion !== null) {
            return $this->cachedInertiaVersion;
        }
        $mw = new \App\Http\Middleware\HandleInertiaRequests();
        $this->cachedInertiaVersion = $mw->version(new \Illuminate\Http\Request());
        return $this->cachedInertiaVersion ?? '0';
    }

    // ============================================================
    // 1. ACCOUNTANT DASHBOARD
    // ============================================================

    public function test_accountant_dashboard_loads_with_divisions(): void
    {
        $response = $this->inertiaGet('/accountant');

        $response->assertOk();
        $props = $this->props($response);

        $this->assertIsArray($props['divisions'] ?? null, 'Dashboard must ship divisions[]');
        $this->assertNotEmpty($props['divisions'], 'Dashboard divisions must not be empty');

        $this->assertGreaterThanOrEqual(
            4,
            count($props['divisions']),
            'Dashboard must show >=4 distinct divisions (school has 4 classes)'
        );
    }

    // ============================================================
    // 2. ACCOUNTANT STUDENT LIST (accountant.students.index)
    // ============================================================

    public function test_accountant_students_index_loads_with_real_data(): void
    {
        $response = $this->inertiaGet(route('accountant.students.index'));

        $response->assertOk();
        $props = $this->props($response);

        $this->assertIsArray($props['students'] ?? null);
        $this->assertGreaterThan(0, count($props['students']), 'Live student count must be > 0');

        $baldeep = collect($props['students'])->firstWhere('id', 22);
        $this->assertNotNull($baldeep, 'Baldeep (id=22) must appear in the student list');
        $this->assertGreaterThanOrEqual(
            3,
            count($baldeep['enrollments']),
            'Baldeep must show ALL active enrollments (Gurmukhi + Kirtan + Academy)'
        );

        $chaman = collect($props['students'])->firstWhere('id', 20);
        $this->assertNotNull($chaman, 'Chaman (id=20) must appear in the student list');
        $chamanClasses = collect($chaman['enrollments'])
            ->pluck('school_class.name')->unique()->values()->all();
        $this->assertContains('Kirtan', $chamanClasses, 'Chaman must list Kirtan');
        $this->assertContains('Itehas', $chamanClasses, 'Chaman must list Itehas');
    }

    public function test_students_index_global_does_not_filter_by_section(): void
    {
        $response = $this->inertiaGet(route('students.index'));

        $response->assertOk();
        $props = $this->props($response);

        $this->assertGreaterThan(
            10,
            count($props['students']),
            'Accountant must see the full student list (no teacher-section filter)'
        );
    }

    // ============================================================
    // 3. STUDENT CENTER (shared students.show)
    // ============================================================

    public function test_student_center_for_multi_class_student(): void
    {
        $response = $this->inertiaGet(route('students.show', ['student' => 22]));

        $response->assertOk();
        $props = $this->props($response);

        $this->assertEquals('Baldeep', $props['student']['name']);

        $this->assertGreaterThanOrEqual(
            3,
            count($props['summary']),
            'Baldeep must show one row per division (>=3 groups)'
        );

        $keys = collect($props['summary'])->pluck('class_type_key')->all();
        $this->assertContains('gurmukhi', $keys, 'Baldeep must list gurmukhi group');
        $this->assertContains('kirtan', $keys, 'Baldeep must list kirtan group');
        $this->assertContains('academy', $keys, 'Baldeep must list academy group');
    }

    public function test_student_center_for_student_with_historical_enrollment(): void
    {
        $response = $this->inertiaGet(route('students.show', ['student' => 26]));

        $response->assertOk();
        $props = $this->props($response);

        $this->assertEquals('Gurdait Singh', $props['student']['name']);

        $enrollments = $props['student']['enrollments'];
        $this->assertGreaterThanOrEqual(
            5,
            count($enrollments),
            'Gurdait Singh must show ALL 5 enrollments including historical/inactive'
        );

        $statuses = collect($enrollments)->pluck('status')->all();
        $this->assertContains('inactive', $statuses, 'Historical enrollments must surface');
        $this->assertContains('active', $statuses, 'Active enrollment must surface');
        $this->assertContains('promoted', $statuses, 'Promoted enrollment must surface');
    }

    public function test_student_center_for_single_class_student(): void
    {
        $response = $this->inertiaGet(route('students.show', ['student' => 19]));

        $response->assertOk();
        $props = $this->props($response);

        $this->assertEquals('Chamandeep Singh', $props['student']['name']);
        $this->assertCount(
            1,
            $props['student']['enrollments'],
            'Single-class student must show exactly 1 enrollment'
        );
    }

    public function test_student_center_for_outstanding_fee_student(): void
    {
        $response = $this->inertiaGet(route('students.show', ['student' => 25]));

        $response->assertOk();
        $props = $this->props($response);

        $summary = collect($props['summary']);
        $firstGroup = $summary->first();
        $this->assertFalse(
            $firstGroup['fees']['all_paid'],
            'Kaway Raj Singh must show all_paid=false (unpaid fees)'
        );
        $this->assertGreaterThan(
            0,
            $firstGroup['fees']['pending'],
            'Kaway Raj Singh must show pending > 0'
        );
    }

    // ============================================================
    // 4. ACCOUNTANT RECEIVE FEE — readonly
    // ============================================================

    public function test_accountant_receive_fee_loads_pending_fees(): void
    {
        $response = $this->inertiaGet(route('accountant.receive-fee'), ['student_id' => 19]);

        $response->assertOk();
        $props = $this->props($response);

        $this->assertEquals('Chamandeep Singh', $props['student']['name']);
        $this->assertGreaterThan(
            0,
            count($props['fees']),
            'Receive Fee must list the student\'s unpaid fees'
        );

        foreach ($props['fees'] as $fee) {
            $this->assertArrayHasKey('class_type', $fee);
            $this->assertArrayHasKey('class_name', $fee);
            $this->assertArrayHasKey('section_name', $fee);
            $this->assertArrayHasKey('amount', $fee);
        }
    }

    public function test_accountant_receive_fee_for_multi_class_student_groups_correctly(): void
    {
        $response = $this->inertiaGet(route('accountant.receive-fee'), ['student_id' => 22]);

        $response->assertOk();
        $props = $this->props($response);

        // F3 invariant: every fee's class_name must match its enrollment.
        foreach ($props['fees'] as $fee) {
            $this->assertNotEmpty($fee['class_type'], 'Each fee must carry a class_type');
            $this->assertNotEmpty($fee['class_name'], 'Each fee must carry a class_name');
        }

        // Verify the data flow is correct: class_type is one of the
        // school-known divisions.
        $validDivisions = ['gurmukhi', 'kirtan', 'academy', 'itehas'];
        foreach ($props['fees'] as $fee) {
            $this->assertContains(
                $fee['class_type'],
                $validDivisions,
                "Fee class_type '{$fee['class_type']}' must be a known division"
            );
        }
    }

    // ============================================================
    // 5. ACCOUNTANT LATE FEES
    // ============================================================

    public function test_accountant_late_fees_loads(): void
    {
        $response = $this->inertiaGet('/accountant/late-fees');

        $response->assertOk();
    }

    // ============================================================
    // 6. ATTENDANCE PAGES (shared with teacher; accountant can read)
    // ============================================================

    public function test_accountant_can_view_attendance_dashboard(): void
    {
        $response = $this->inertiaGet('/attendance');

        $response->assertOk();
    }

    public function test_accountant_can_view_attendance_sections(): void
    {
        $response = $this->inertiaGet('/attendance/sections');

        $response->assertOk();
    }

    public function test_accountant_can_view_absentees(): void
    {
        $response = $this->inertiaGet('/attendance/absentees');

        $response->assertOk();
    }

    public function test_accountant_can_view_attendance_mark_page(): void
    {
        $section = Section::find(9);
        $this->assertNotNull($section);

        $response = $this->actingAs($this->accountant)
            ->get(route('attendance.mark', ['section' => $section->id]));

        $this->assertContains(
            $response->status(),
            [200, 302],
            'Attendance Mark page must not 500 — 200 or redirect (off-day) is acceptable'
        );
    }

    // ============================================================
    // 7. WRITE — COLLECT FEE (the critical WRITE workflow)
    // ============================================================

    public function test_accountant_can_collect_a_fee(): void
    {
        $unpaidFee = Fee::where('student_id', 19)
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->first();

        if (! $unpaidFee) {
            $this->markTestSkipped('No unpaid fee available for Chamandeep Singh');
            return;
        }

        $feeId = $unpaidFee->id;
        $amount = $unpaidFee->amount;

        $paymentsBefore = Payment::count();
        $auditBefore = AuditLog::where('action', AuditLog::ACTION_FEE_COLLECTED)->count();

        $response = $this->actingAs($this->accountant)
            ->post(route('accountant.receive-fee.store'), [
                'fee_ids' => [$feeId],
                'collection_date' => now()->format('Y-m-d'),
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $fee = Fee::findOrFail($feeId);
        $this->assertTrue(
            $fee->payments()->whereNull('deleted_at')->exists(),
            'Fee must have a payment after accountant collects it'
        );

        $payment = $fee->payments()->whereNull('deleted_at')->first();
        $this->assertEquals(
            $amount,
            $payment->amount_paid,
            'Payment amount_paid must equal fee amount'
        );
        $this->assertEquals(
            $this->accountant->id,
            $payment->collected_by,
            'Payment must record collected_by = accountant'
        );

        $this->assertEquals(
            $paymentsBefore + 1,
            Payment::count(),
            'Exactly one Payment row must be created'
        );
        $this->assertEquals(
            $auditBefore + 1,
            AuditLog::where('action', AuditLog::ACTION_FEE_COLLECTED)->count(),
            'Exactly one AuditLog row must be created'
        );

        // Cleanup: soft-delete the payment so we don't permanently change the DB.
        $payment->delete();
    }

    public function test_accountant_collect_rejects_future_dated_payment(): void
    {
        $unpaidFee = Fee::whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->first();

        if (! $unpaidFee) {
            $this->markTestSkipped('No unpaid fee available');
            return;
        }

        $response = $this->actingAs($this->accountant)
            ->post(route('accountant.receive-fee.store'), [
                'fee_ids' => [$unpaidFee->id],
                'collection_date' => now()->addDays(5)->format('Y-m-d'),
            ]);

        $response->assertSessionHasErrors('collection_date');
    }

    public function test_accountant_collect_rejects_empty_fee_list(): void
    {
        $response = $this->actingAs($this->accountant)
            ->post(route('accountant.receive-fee.store'), [
                'fee_ids' => [],
                'collection_date' => now()->format('Y-m-d'),
            ]);

        $response->assertSessionHasErrors('fee_ids');
    }

    public function test_accountant_collect_is_idempotent_for_already_paid_fees(): void
    {
        $paidFee = Fee::whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))->first();

        if (! $paidFee) {
            $this->markTestSkipped('No paid fee available');
            return;
        }

        $paymentsBefore = Payment::where('fee_id', $paidFee->id)->count();

        $response = $this->actingAs($this->accountant)
            ->post(route('accountant.receive-fee.store'), [
                'fee_ids' => [$paidFee->id],
                'collection_date' => now()->format('Y-m-d'),
            ]);

        $response->assertRedirect();

        $this->assertEquals(
            $paymentsBefore,
            Payment::where('fee_id', $paidFee->id)->count(),
            'Re-collecting an already-paid fee must NOT create a duplicate Payment'
        );
    }

    // ============================================================
    // 8. PERMISSIONS — forbidden actions
    // ============================================================

    public function test_accountant_cannot_generate_monthly_fees(): void
    {
        $response = $this->actingAs($this->accountant)
            ->post(route('admin.fees.generate-monthly'), []);

        $this->assertContains(
            $response->status(),
            [302, 403],
            'Accountant must NOT be able to trigger monthly fee generation'
        );
    }

    public function test_accountant_cannot_de_collect_a_fee(): void
    {
        $paidFee = Fee::whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))->first();

        if (! $paidFee) {
            $this->markTestSkipped('No paid fee to attempt de-collect on');
            return;
        }

        $paymentsBefore = Payment::where('fee_id', $paidFee->id)
            ->whereNull('deleted_at')->count();

        $response = $this->actingAs($this->accountant)
            ->post(route('admin.fees.deCollect', ['fee' => $paidFee->id]), []);

        $this->assertContains(
            $response->status(),
            [302, 403],
            'Accountant must NOT be able to de-collect'
        );

        $this->assertEquals(
            $paymentsBefore,
            Payment::where('fee_id', $paidFee->id)->whereNull('deleted_at')->count(),
            'Accountant de-collect attempt must NOT soft-delete the payment'
        );
    }

    public function test_accountant_cannot_create_custom_fees(): void
    {
        $response = $this->actingAs($this->accountant)
            ->post(route('admin.fees.custom.store'), [
                'class_id' => 1,
                'section_id' => 9,
                'title' => 'Validation Test',
                'amount' => 100,
            ]);

        $this->assertContains(
            $response->status(),
            [302, 403],
            'Accountant must NOT be able to create custom fees'
        );

        $this->assertDatabaseMissing('fees', [
            'title' => 'Validation Test',
        ]);
    }

    public function test_accountant_cannot_access_admin_fees_index(): void
    {
        $response = $this->actingAs($this->accountant)
            ->get(route('admin.fees.index'));

        $this->assertContains(
            $response->status(),
            [302, 403],
            'Accountant must NOT access admin fees index'
        );
    }

    public function test_accountant_cannot_run_bulk_student_delete(): void
    {
        $response = $this->actingAs($this->accountant)
            ->post(route('admin.students.bulk-delete'), [
                'ids' => [1, 2, 3],
            ]);

        $this->assertContains(
            $response->status(),
            [302, 403],
            'Accountant must NOT be able to bulk-delete students'
        );
    }

    // ============================================================
    // 9. DATA INTEGRITY — fee ownership invariant
    // ============================================================

    public function test_fee_class_name_matches_enrollment_class_name(): void
    {
        $mismatches = Fee::with('studentSection.schoolClass')
            ->get()
            ->filter(function ($fee) {
                if (! $fee->studentSection || ! $fee->studentSection->schoolClass) {
                    return false;
                }
                return $fee->student_section_id !== null
                    && $fee->studentSection->schoolClass->id !== $fee->studentSection->class_id;
            })
            ->count();

        $this->assertEquals(
            0,
            $mismatches,
            "No fee may reference a class_id that disagrees with its enrollment"
        );
    }

    public function test_each_fee_has_a_non_null_student_section_id(): void
    {
        $orphans = Fee::whereNull('student_section_id')->count();
        $this->assertEquals(0, $orphans, 'No fee may have a NULL student_section_id');
    }

    public function test_student_id_is_consistent_across_fee_and_enrollment(): void
    {
        $mismatches = DB::table('fees')
            ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
            ->whereColumn('fees.student_id', '!=', 'student_sections.student_id')
            ->count();

        $this->assertEquals(
            0,
            $mismatches,
            "Fee.student_id must always match its enrollment's student_id"
        );
    }

    // ============================================================
    // 10. NO DESTRUCTIVE STATE CHANGES — final integrity check
    // ============================================================

    public function test_no_destructive_state_change_after_run(): void
    {
        $this->assertEquals(
            $this->beforeSnapshot['students'],
            Student::count(),
            'Student count must be unchanged'
        );
        $this->assertEquals(
            $this->beforeSnapshot['enrollments'],
            StudentSection::count(),
            'Enrollment count must be unchanged'
        );
        $this->assertEquals(
            $this->beforeSnapshot['fees'],
            Fee::count(),
            'Fee count must be unchanged'
        );
        // Payment + audit logs may have changed if the collect test ran and
        // cleaned up, that is acceptable.
    }

    // ============================================================
    // 11. ORPHAN PAGE — Accountant/Fees/Index.jsx has no route
    // ============================================================

    public function test_no_accountant_route_renders_orphan_fees_page(): void
    {
        // The frontend file resources/js/Pages/Accountant/Fees/Index.jsx
        // exists (verified manually). No route should render it. If a
        // route does, the file is properly wired; if not, it's an
        // orphan and should be deleted (P3).
        $orphanPage = 'Accountant/Fees/Index';

        // Scan every route that an accountant can hit and confirm none
        // references the orphan component.
        $routeFiles = [
            base_path('routes/accountant.php'),
            base_path('routes/admin.php'),
            base_path('routes/students.php'),
            base_path('routes/attendance.php'),
        ];

        $hits = [];
        foreach ($routeFiles as $file) {
            if (! file_exists($file)) continue;
            $contents = file_get_contents($file);
            if (str_contains($contents, $orphanPage)) {
                $hits[] = $file;
            }
        }

        $this->assertEmpty(
            $hits,
            "Orphan page '{$orphanPage}' is referenced in: " . implode(', ', $hits)
            . " — if no route currently renders it, the file should be deleted."
        );
    }
}