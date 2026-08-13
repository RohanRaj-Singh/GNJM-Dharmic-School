<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sprint 3.2 — Audit trail.
 *
 * Every fee collection/collect-and-reverse and custom-fee mutation records
 * who did it (payment.collected_by) and writes an AuditLog entry. Attendance
 * saves are recorded as aggregate audit entries. This is the R14 fix.
 */
class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $accountant;
    private User $teacher;

    private Student $student;
    private StudentSection $enrollment;
    private Fee $monthlyFee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->accountant = User::factory()->create(['role' => 'accountant']);
        $this->teacher = User::factory()->create(['role' => 'teacher']);

        $class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $section = Section::create([
            'class_id' => $class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);

        $this->student = Student::create([
            'name' => 'Test Student',
            'father_name' => 'Test Father',
            'status' => 'active',
        ]);

        $this->enrollment = StudentSection::create([
            'student_id'   => $this->student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);

        $this->monthlyFee = Fee::create([
            'student_id'         => $this->student->id,
            'student_section_id' => $this->enrollment->id,
            'type'               => 'monthly',
            'month'              => now()->format('Y-m'),
            'amount'             => 600,
        ]);
    }

    private function makeCustomFee(): Fee
    {
        return Fee::create([
            'student_id'         => $this->student->id,
            'student_section_id' => $this->enrollment->id,
            'type'               => 'custom',
            'title'              => 'Admission',
            'amount'             => 500,
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Payment.collected_by                                             */
    /* ---------------------------------------------------------------- */

    public function test_admin_collect_records_collected_by(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.fees.collect', ['fee' => $this->monthlyFee->id]), [
                'collection_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('payments', [
            'fee_id'       => $this->monthlyFee->id,
            'collected_by' => $this->admin->id,
            'created_by'   => $this->admin->id,
        ]);
    }

    public function test_accountant_collect_records_collected_by(): void
    {
        $this->actingAs($this->accountant)
            ->post(route('accountant.receive-fee.store'), [
                'fee_ids'         => [$this->monthlyFee->id],
                'collection_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('payments', [
            'fee_id'       => $this->monthlyFee->id,
            'collected_by' => $this->accountant->id,
            'created_by'   => $this->accountant->id,
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* AuditLog — fee collection lifecycle                              */
    /* ---------------------------------------------------------------- */

    public function test_collect_and_decollect_write_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.fees.collect', ['fee' => $this->monthlyFee->id]), [
                'collection_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('audit_logs', [
            'action'         => 'fee.collected',
            'user_id'        => $this->admin->id,
            'auditable_type' => Fee::class,
            'auditable_id'   => $this->monthlyFee->id,
        ]);

        $this->actingAs($this->admin)
            ->post(route('admin.fees.deCollect', ['fee' => $this->monthlyFee->id]));

        $this->assertDatabaseHas('audit_logs', [
            'action'         => 'fee.de_collected',
            'user_id'        => $this->admin->id,
            'auditable_type' => Fee::class,
            'auditable_id'   => $this->monthlyFee->id,
        ]);
    }

    public function test_custom_fee_lifecycle_writes_audit_log(): void
    {
        $sectionId = $this->enrollment->section_id;

        // Create
        $this->actingAs($this->admin)
            ->post(route('admin.fees.custom.store'), [
                'section_id' => $sectionId,
                'title'      => 'Activity',
                'amount'     => 300,
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('audit_logs', [
            'action'  => 'fee.custom_created',
            'user_id' => $this->admin->id,
        ]);

        // Update
        $this->actingAs($this->admin)
            ->put(route('admin.fees.custom.update'), [
                'section_id' => $sectionId,
                'old_title'  => 'Activity',
                'old_amount' => 300,
                'title'      => 'Activity 2026',
                'amount'     => 350,
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('audit_logs', [
            'action'  => 'fee.custom_updated',
            'user_id' => $this->admin->id,
        ]);

        // Delete (single student)
        $custom = Fee::where('title', 'Activity 2026')->firstOrFail();
        $this->actingAs($this->admin)
            ->delete(route('admin.fees.custom.destroy.student', ['fee' => $custom->id]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('audit_logs', [
            'action'         => 'fee.custom_deleted',
            'user_id'        => $this->admin->id,
            'auditable_type' => Fee::class,
            'auditable_id'   => $custom->id,
        ]);
    }

    public function test_monthly_generation_writes_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.fees.generate-monthly'))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('audit_logs', [
            'action'  => 'fee.monthly_generated',
            'user_id' => $this->admin->id,
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* AuditLog — attendance                                             */
    /* ---------------------------------------------------------------- */

    public function test_attendance_marking_writes_audit_log(): void
    {
        $this->actingAs($this->teacher)
            ->post(route('attendance.store'), [
                'section_id' => $this->enrollment->section_id,
                'attendance' => [
                    [
                        'student_id'     => $this->student->id,
                        'status'         => 'present',
                        'lesson_learned' => false,
                    ],
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action'  => 'attendance.marked',
            'user_id' => $this->teacher->id,
        ]);
    }

    public function test_audit_log_entries_are_records_with_payload(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.fees.collect', ['fee' => $this->monthlyFee->id]), [
                'collection_date' => now()->toDateString(),
            ]);

        $entry = AuditLog::query()
            ->where('action', 'fee.collected')
            ->where('auditable_id', $this->monthlyFee->id)
            ->firstOrFail();

        $this->assertSame($this->admin->id, (int) $entry->user_id);
        $this->assertSame('App\\Models\\Fee', $entry->auditable_type);
        $this->assertNotNull($entry->created_at);
    }
}
