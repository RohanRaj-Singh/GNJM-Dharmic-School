<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Sprint 6.3 — HTTP smoke tests: the admin data/filter endpoints (JSON).
 *
 * Each endpoint is called with representative filters and must return 200 with
 * the expected payload shape. The fixture is the smallest representative shape
 * (one Gurmukhi class, one section, one enrolled student, one monthly fee) so
 * the JSON has real rows to return.
 *
 * The fee-listing query itself is pinned in FeesIndexQueryTest; here we only
 * verify the index page accepts the filter query-string and echoes it back.
 */
class AdminDataEndpointSmokeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_data_smoke',
        ]);

        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->section = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);
        $this->student = Student::create([
            'name' => 'Data Student',
            'father_name' => 'Data Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => now(config('app.timezone'))->format('Y-m'),
            'amount' => 600,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function asAdmin()
    {
        return $this->actingAs($this->admin);
    }

    /* ───────────────────────────────────────────────
       Attendance grid
       ─────────────────────────────────────────────── */

    public function test_admin_attendance_grid_returns_days_and_students(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.attendance.grid', [
            'section_id' => $this->section->id,
            'year' => 2026,
            'month' => 8,
        ]));

        $response->assertOk();
        $response->assertJsonStructure(['is_kirtan', 'days', 'students']);
        $response->assertJsonCount(31, 'days');
        $response->assertJsonCount(1, 'students');
        $response->assertJsonPath('students.0.name', 'Data Student');
        $response->assertJsonPath('is_kirtan', false);
    }

    /* ───────────────────────────────────────────────
       Classes / Sections lookups
       ─────────────────────────────────────────────── */

    public function test_classes_lookup_endpoints(): void
    {
        $this->asAdmin()->getJson(route('admin.classes.data'))->assertOk();
        $this->asAdmin()->getJson(route('admin.classes.options'))->assertOk();
        $this->asAdmin()->getJson(route('admin.sections.data'))->assertOk();

        $sections = $this->asAdmin()->getJson(route('admin.sections.options', [
            'class_id' => $this->class->id,
        ]));

        $sections->assertOk();
        $sections->assertJsonCount(1);
        $sections->assertJsonPath('0.id', $this->section->id);
    }

    /* ───────────────────────────────────────────────
       Utility data endpoints + filters
       ─────────────────────────────────────────────── */

    public function test_student_status_data_filters_by_class_and_section(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.utilities.student-status.data', [
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
        ]));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.student_name', 'Data Student');
        $response->assertJsonPath('0.class_name', 'Gurmukhi');
        $response->assertJsonPath('0.section_name', 'Section A');
    }

    public function test_student_progression_data_filters(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.utilities.student-progression.data', [
            'search' => 'Data',
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
        ]));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.name', 'Data Student');
        $response->assertJsonPath('0.enrollments.0.className', 'Gurmukhi');
    }

    public function test_master_directory_data_filters(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.utilities.master-directory.data', [
            'search' => 'Data',
            'status' => 'active',
            'class_id' => $this->class->id,
        ]));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.name', 'Data Student');
        $response->assertJsonPath('0.lastEnrollment.className', 'Gurmukhi');
    }

    /* ───────────────────────────────────────────────
       Backup overview + history (empty-db safe)
       ─────────────────────────────────────────────── */

    public function test_backup_overview_and_history_are_ok_on_empty_db(): void
    {
        $overview = $this->asAdmin()->getJson(route('admin.utilities.backup.overview'));
        $overview->assertOk();
        $overview->assertJsonStructure([
            'db_size',
            'db_size_formatted',
            'last_backup',
            'backup_count',
            'estimated_restore_time',
        ]);

        $this->asAdmin()->getJson(route('admin.utilities.backup.history'))->assertOk();
    }

    /* ───────────────────────────────────────────────
       Dashboard summary + users data
       ─────────────────────────────────────────────── */

    public function test_dashboard_summary_returns_overall_payload(): void
    {
        $response = $this->asAdmin()->getJson('/admin/dashboard/summary?year=2026');

        $response->assertOk();
        $response->assertJsonStructure([
            'fees' => ['total', 'collected', 'pending', 'percentage'],
            'attendance' => ['percentage', 'present', 'absent', 'leave'],
            'students' => ['total', 'active', 'enrollments'],
            'divisions',
            'insights',
            'meta',
        ]);
    }

    public function test_users_data_returns_seeded_admin(): void
    {
        $response = $this->asAdmin()->getJson(route('admin.users.data'));

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.username', 'admin_data_smoke');
        $response->assertJsonPath('0.role', 'admin');
    }

    /* ───────────────────────────────────────────────
       Fees index — filter query-string is accepted
       ─────────────────────────────────────────────── */

    public function test_fees_index_accepts_filter_params(): void
    {
        $response = $this->asAdmin()->get(route('admin.fees.index', [
            'year' => 2026,
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
            'status' => 'unpaid',
            'month' => now(config('app.timezone'))->format('Y-m'),
            'search' => 'Data',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Fees/Index')
            ->has('fees', 1)
            ->where('filters.class_id', (string) $this->class->id)
            ->where('filters.section_id', (string) $this->section->id)
            ->where('filters.status', 'unpaid'));
    }
}
