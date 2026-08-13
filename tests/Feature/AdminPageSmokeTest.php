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
 * Sprint 6.3 — HTTP smoke tests: every admin Inertia page renders (200, no 500)
 * for an authenticated admin with the expected component.
 *
 * The fixture is the smallest representative shape (one Gurmukhi class, one
 * section, one enrolled student, one monthly fee) so the pages render with the
 * same data they see in production rather than only the empty-DB path.
 *
 * Deeper behaviour for specific pages lives in their own suites
 * (FeesIndexQueryTest, StudentAdminRoutesTest, StudentReport\SecurityTest,
 * RestoreSafetyTest) — this class only pins "the page comes up".
 */
class AdminPageSmokeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_page_smoke',
        ]);

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
        $student = Student::create([
            'name' => 'Smoke Student',
            'father_name' => 'Smoke Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
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

    /** @return array<string, array{0: string, 1: array<string, int|string>, 2: string}> */
    public static function adminPagesProvider(): array
    {
        return [
            'dashboard' => ['admin.dashboard', [], 'Admin/Dashboard'],
            'utilities' => ['admin.utilities', [], 'Admin/Utilities'],
            'utilities pending-fees' => ['admin.utilities.pending-fees', [], 'Admin/Utilities/PendingFeesSetup'],
            'utilities student-status' => ['admin.utilities.student-status', [], 'Admin/Utilities/StudentStatus'],
            'utilities student-progression' => ['admin.utilities.student-progression', [], 'Admin/Utilities/StudentProgression'],
            'utilities master-directory' => ['admin.utilities.master-directory', [], 'Admin/Utilities/MasterDirectory'],
            'utilities backup' => ['admin.utilities.backup.page', [], 'Admin/Utilities/Backup'],
            'classes' => ['admin.classes.index', [], 'Admin/Classes/Index'],
            'sections' => ['admin.sections.index', [], 'Admin/Sections/Index'],
            'attendance' => ['admin.attendance.index', [], 'Admin/Attendance/Index'],
            'fees custom' => ['admin.fees.custom.index', [], 'Admin/Fees/CustomFee'],
            'reports' => ['admin.reports.index', [], 'Admin/Reports/Index'],
            'reports attendance' => ['admin.reports.attendance', [], 'Admin/Reports/Attendance'],
            'student-report-center' => ['admin.student-report-center.page', [], 'Admin/StudentReportCenter/Index'],
            'users' => ['admin.users.index', [], 'Admin/Users/Index'],
        ];
    }

    /**
     * @dataProvider adminPagesProvider
     */
    public function test_admin_page_renders(string $route, array $params, string $component): void
    {
        $response = $this->actingAs($this->admin)->get(route($route, $params));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component($component));
    }
}
