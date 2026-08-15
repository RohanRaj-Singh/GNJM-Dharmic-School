<?php

namespace Tests\Feature;

use App\Models\Attendance;
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
 * Sprint 6.4 / L-2 — Pin the cross-division report flows the audit
 * §6 L-2 + §5 gap #3 call out. A "cross-division report" means the
 * report runs over the union of every division the school has —
 * Gurmukhi + Kirtan + Music + anything else — in a single fetch.
 *
 * This file pins the four surfaces where cross-division matters:
 *
 *  1. Fees Report (`POST /admin/reports/build` report=fees) accepts an
 *     arbitrary class_ids[] list and returns rows from every division
 *     included — no per-division string gates anywhere in the query.
 *
 *  2. Attendance Report (`POST /admin/reports/build` report=attendance)
 *     likewise accepts a multi-division class_ids[] list and returns
 *     per-student summary rows from every included division.
 *
 *  3. Student Report Center (`POST /admin/student-report-center/build`
 *     with division='all') surfaces every division the student is
 *     actually enrolled in. The deeper "explicit-third-division"
 *     contract is pinned by `MultiClassDivisionReportTest`; this file
 *     pins the *cross* side (all divisions in one report).
 *
 *  4. Accountant Students index (`GET /accountant/students`) lists every
 *     active student with all enrollments, regardless of division. The
 *     division-filter bar drives per-row filtering on the frontend; the
 *     cross-division contract here is that no enrollments are dropped
 *     before they reach the page. (Pinned for regression only — see
 *     `AccountantStudentsFilterTest` for the full division-button suite.)
 *
 * Note: `AttendanceSummaryController` exists but is not currently routed.
 * Its cross-division-by-default behavior is exercised indirectly: the
 * controller drops the legacy `where('type','gurmukhi')` and uses the
 * per-class `attendance_days` config instead, which `SchoolClass::
 * isAttendanceDay()` enforces. Pinning that contract here would require
 * adding a route — out of scope for L-2. The relevant cross-division
 * surface for the accountant is `accountant.students.index`.
 */
class CrossDivisionReportsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $accountant;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'cross_division_reports',
        ]);

        $this->accountant = User::factory()->create([
            'role' => 'accountant',
            'username' => 'cross_division_accountant',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * Create a class + section + student + monthly fee in one call.
     * Returns the IDs so the test can pass class_ids[] back into the report.
     */
    private function seedDivision(
        string $className,
        string $studentName,
        array $attendanceDays = [1, 2, 3, 4, 5, 6],
        int $fee = 500,
    ): array {
        $slug = \Illuminate\Support\Str::slug($className) ?: 'class';

        $class = SchoolClass::create([
            'name' => $className,
            'type' => $slug,
            'division' => $slug,
            'attendance_days' => $attendanceDays,
            'charges_monthly_fee' => true,
            'default_monthly_fee' => $fee,
        ]);

        $section = Section::create([
            'class_id' => $class->id,
            'name' => $className . ' A',
            'monthly_fee' => $fee,
        ]);

        $student = Student::create([
            'name' => $studentName,
            'father_name' => 'Father of ' . $studentName,
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
            'amount' => $fee,
        ]);

        return [
            'class_id' => (int) $class->id,
            'section_id' => (int) $section->id,
            'student_id' => (int) $student->id,
            'enrollment_id' => (int) $enrollment->id,
        ];
    }

    public function test_fees_report_returns_rows_for_every_division_in_class_ids(): void
    {
        $gurmukhi = $this->seedDivision('Gurmukhi', 'Gurmukhi Kid', fee: 600);
        $kirtan = $this->seedDivision('Kirtan', 'Kirtan Kid', attendanceDays: [0], fee: 0);
        $music = $this->seedDivision('Music', 'Music Kid', attendanceDays: [2, 4], fee: 800);

        $response = $this->actingAs($this->admin)->post(route('admin.reports.build'), [
            'report' => 'fees',
            'class_ids' => [$gurmukhi['class_id'], $kirtan['class_id'], $music['class_id']],
            'year_from' => 2026,
            'year_to' => 2026,
        ]);

        $response->assertOk();
        $body = $response->json();

        // Three distinct enrollments → three rows in the breakdown.
        $this->assertSame(3, $body['summary']['total_students']);
        $this->assertCount(3, $body['tables']['rows']);

        // Every division's student surfaces.
        $names = array_column($body['tables']['rows'], 'student_name');
        $this->assertContains('Gurmukhi Kid', $names);
        $this->assertContains('Kirtan Kid', $names);
        $this->assertContains('Music Kid', $names);

        // Class names are not hardcoded "Gurmukhi / Kirtan" — they derive
        // from the data. The cross-division check is: each row carries the
        // class_name it was enrolled in, and the row's student_name matches
        // the student placed in that division.
        $byClass = collect($body['tables']['rows'])->keyBy('class_name');
        $this->assertSame('Gurmukhi Kid', $byClass['Gurmukhi']['student_name']);
        $this->assertSame('Kirtan Kid', $byClass['Kirtan']['student_name']);
        $this->assertSame('Music Kid', $byClass['Music']['student_name']);
    }

    public function test_attendance_report_returns_rows_for_every_division_in_class_ids(): void
    {
        $gurmukhi = $this->seedDivision('Gurmukhi', 'Gurmukhi Kid', fee: 600);
        $kirtan = $this->seedDivision('Kirtan', 'Kirtan Kid', attendanceDays: [0], fee: 0);
        $music = $this->seedDivision('Music', 'Music Kid', attendanceDays: [2, 4], fee: 800);

        // The attendance report runs an inner join on attendance records
        // grouped by student — so a student with no attendance rows is
        // invisible. Seed one present-day record per enrollment on the
        // same day so all three surface in the per-student summary.
        $day = Carbon::parse('2026-08-13'); // Thursday
        Attendance::create([
            'student_section_id' => $gurmukhi['enrollment_id'],
            'date' => $day->toDateString(),
            'status' => 'present',
        ]);
        Attendance::create([
            'student_section_id' => $kirtan['enrollment_id'],
            'date' => $day->toDateString(),
            'status' => 'present',
        ]);
        Attendance::create([
            'student_section_id' => $music['enrollment_id'],
            'date' => $day->toDateString(),
            'status' => 'present',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.reports.build'), [
            'report' => 'attendance',
            'class_ids' => [$gurmukhi['class_id'], $kirtan['class_id'], $music['class_id']],
            'year_from' => 2026,
            'year_to' => 2026,
        ]);

        $response->assertOk();
        $body = $response->json();
        // The attendance report exposes per-student summary rows at the
        // top level (not under tables.rows — that's the calendar view).
        // See ReportController::buildAttendanceReport().
        $rows = $body['students'] ?? [];

        $names = array_column($rows, 'student_name');
        $this->assertContains('Gurmukhi Kid', $names);
        $this->assertContains('Kirtan Kid', $names);
        $this->assertContains('Music Kid', $names);
    }

    public function test_student_report_center_all_division_includes_every_enrollment(): void
    {
        // Student enrolled in two divisions (the multi-class student
        // shape). With division='all' both enrollments must surface in
        // a single report.
        $gurmukhi = $this->seedDivision('Gurmukhi', 'Multi Kid A', fee: 600);
        $music = $this->seedDivision('Music', 'Multi Kid B', fee: 800);

        $student = Student::create([
            'name' => 'Two Division Student',
            'father_name' => 'Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $gurmukhi['class_id'],
            'section_id' => $gurmukhi['section_id'],
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $music['class_id'],
            'section_id' => $music['section_id'],
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)->post(
            route('admin.student-report-center.build'),
            [
                'student_id' => $student->id,
                'range_mode' => 'calendar_year',
                'single_year' => 2026,
                'division' => 'all',
            ]
        );

        $response->assertOk();
        $body = $response->json();

        // 'all' must produce a block per division the student is actually
        // enrolled in. Both Gurmukhi and Music divisions surface; nothing
        // gets forced into a "kirtan" bucket the student isn't in.
        $divisions = array_keys($body['divisions'] ?? []);
        $this->assertContains('gurmukhi', $divisions);
        $this->assertContains('music', $divisions);
        $this->assertNotContains('kirtan', $divisions);
    }

    public function test_accountant_students_index_surfaces_every_division(): void
    {
        // Three students, one per division. Hitting the index without
        // any filter must return all three — proving the index is not
        // hardcoded to a single division. (Per-row division filtering
        // is the frontend's job; the contract here is "no enrollments
        // get silently dropped server-side".)
        $this->seedDivision('Gurmukhi', 'Gurmukhi Kid', fee: 600);
        $this->seedDivision('Kirtan', 'Kirtan Kid', attendanceDays: [0], fee: 0);
        $this->seedDivision('Music', 'Music Kid', attendanceDays: [2, 4], fee: 800);

        $response = $this->actingAs($this->accountant)
            ->get(route('accountant.students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Accountant/Students')
            // Three distinct division buckets render in the filter bar.
            ->has('divisions', 3)
            // Three distinct students, regardless of division.
            ->has('students', 3)
            // Every division's student surfaces in the payload.
            ->where('students.0.name', 'Gurmukhi Kid')
            ->where('students.1.name', 'Kirtan Kid')
            ->where('students.2.name', 'Music Kid')
        );
    }
}
