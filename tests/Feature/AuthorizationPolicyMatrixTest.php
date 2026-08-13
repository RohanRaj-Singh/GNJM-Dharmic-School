<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\BackupEntry;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

/**
 * Sprint 3.1 — Authorization matrix.
 *
 * Encodes the CURRENT role-based behavior as explicit policy abilities:
 *  - admin is a super-user (Gate::before) — everything allowed
 *  - accountant: student view/create, fee collect/view, attendance mark
 *  - teacher: student view/create, attendance mark
 *  - fee de-collect, fee custom-fee management, monthly generation, and all
 *    backup operations are admin-only
 *
 * Run against the live wiring (Gate::forUser → policies + Gate::before), so
 * this also proves policy auto-discovery and the super-admin rule.
 */
class AuthorizationPolicyMatrixTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $accountant;
    private User $teacher;

    private Student $student;
    private Fee $fee;
    private Attendance $attendance;
    private BackupEntry $backup;

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

        $enrollment = StudentSection::create([
            'student_id'   => $this->student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);

        $this->fee = Fee::create([
            'student_id'         => $this->student->id,
            'student_section_id' => $enrollment->id,
            'type'               => 'monthly',
            'month'              => now()->format('Y-m'),
            'amount'             => 600,
        ]);

        $this->attendance = Attendance::create([
            'student_section_id' => $enrollment->id,
            'student_id'         => $this->student->id,
            'date'               => now()->toDateString(),
            'status'             => 'present',
        ]);

        $this->backup = BackupEntry::create([
            'filename'   => 'test.sql.gz',
            'file_path'  => 'backups/test.sql.gz',
            'file_size'  => 0,
            'db_size'    => 0,
            'checksum'   => str_repeat('a', 64),
            'status'     => 'created',
            'created_by' => $this->admin->id,
        ]);
    }

    private function allows(User $user, string $ability, mixed $arguments = null): bool
    {
        return Gate::forUser($user)->allows($ability, $arguments ?? Student::class);
    }

    /* ---------------------------------------------------------------- */
    /* Admin — super-user (Gate::before)                                */
    /* ---------------------------------------------------------------- */

    public function test_admin_is_super_user_across_all_policies(): void
    {
        foreach ($this->allAbilities() as [$ability, $args]) {
            $this->assertTrue(
                $this->allows($this->admin, $ability, $args),
                "Admin should be allowed: {$ability}"
            );
        }
    }

    /* ---------------------------------------------------------------- */
    /* StudentPolicy                                                     */
    /* ---------------------------------------------------------------- */

    public function test_accountant_can_view_and_create_students_but_not_update_or_delete(): void
    {
        $this->assertTrue($this->allows($this->accountant, 'viewAny', Student::class));
        $this->assertTrue($this->allows($this->accountant, 'view', $this->student));
        $this->assertTrue($this->allows($this->accountant, 'create', Student::class));

        $this->assertFalse($this->allows($this->accountant, 'update', $this->student));
        $this->assertFalse($this->allows($this->accountant, 'delete', $this->student));
    }

    public function test_teacher_can_view_and_create_students_but_not_update_or_delete(): void
    {
        $this->assertTrue($this->allows($this->teacher, 'viewAny', Student::class));
        $this->assertTrue($this->allows($this->teacher, 'view', $this->student));
        $this->assertTrue($this->allows($this->teacher, 'create', Student::class));

        $this->assertFalse($this->allows($this->teacher, 'update', $this->student));
        $this->assertFalse($this->allows($this->teacher, 'delete', $this->student));
    }

    /* ---------------------------------------------------------------- */
    /* FeePolicy                                                         */
    /* ---------------------------------------------------------------- */

    public function test_accountant_can_collect_and_view_fees_but_not_admin_fee_operations(): void
    {
        $this->assertTrue($this->allows($this->accountant, 'viewAny', Fee::class));
        $this->assertTrue($this->allows($this->accountant, 'collect', $this->fee));

        $this->assertFalse($this->allows($this->accountant, 'deCollect', $this->fee));
        $this->assertFalse($this->allows($this->accountant, 'generateMonthly', Fee::class));
        $this->assertFalse($this->allows($this->accountant, 'createCustom', Fee::class));
        $this->assertFalse($this->allows($this->accountant, 'updateCustom', $this->fee));
        $this->assertFalse($this->allows($this->accountant, 'deleteCustom', $this->fee));
    }

    public function test_teacher_cannot_collect_fees(): void
    {
        $this->assertFalse($this->allows($this->teacher, 'collect', $this->fee));
        $this->assertFalse($this->allows($this->teacher, 'deCollect', $this->fee));
        $this->assertFalse($this->allows($this->teacher, 'viewAny', Fee::class));
    }

    /* ---------------------------------------------------------------- */
    /* AttendancePolicy                                                  */
    /* ---------------------------------------------------------------- */

    public function test_teacher_and_accountant_can_mark_attendance(): void
    {
        $this->assertTrue($this->allows($this->teacher, 'mark', Attendance::class));
        $this->assertTrue($this->allows($this->teacher, 'viewAny', Attendance::class));

        $this->assertTrue($this->allows($this->accountant, 'mark', Attendance::class));
        $this->assertTrue($this->allows($this->accountant, 'viewAny', Attendance::class));
    }

    /* ---------------------------------------------------------------- */
    /* BackupEntryPolicy                                                 */
    /* ---------------------------------------------------------------- */

    public function test_backup_operations_are_admin_only(): void
    {
        foreach ([$this->accountant, $this->teacher] as $user) {
            $this->assertFalse($this->allows($user, 'viewAny', BackupEntry::class), 'viewAny');
            $this->assertFalse($this->allows($user, 'view', $this->backup), 'view');
            $this->assertFalse($this->allows($user, 'create', BackupEntry::class), 'create');
            $this->assertFalse($this->allows($user, 'restore', $this->backup), 'restore');
            $this->assertFalse($this->allows($user, 'download', $this->backup), 'download');
            $this->assertFalse($this->allows($user, 'delete', $this->backup), 'delete');
        }
    }

    /* ---------------------------------------------------------------- */
    /* Helpers                                                           */
    /* ---------------------------------------------------------------- */

    private function allAbilities(): array
    {
        return [
            ['viewAny', Student::class],
            ['view', $this->student],
            ['create', Student::class],
            ['update', $this->student],
            ['delete', $this->student],
            ['viewAny', Fee::class],
            ['collect', $this->fee],
            ['deCollect', $this->fee],
            ['generateMonthly', Fee::class],
            ['createCustom', Fee::class],
            ['updateCustom', $this->fee],
            ['deleteCustom', $this->fee],
            ['mark', Attendance::class],
            ['viewAny', Attendance::class],
            ['viewAny', BackupEntry::class],
            ['view', $this->backup],
            ['create', BackupEntry::class],
            ['restore', $this->backup],
            ['download', $this->backup],
            ['delete', $this->backup],
        ];
    }
}
