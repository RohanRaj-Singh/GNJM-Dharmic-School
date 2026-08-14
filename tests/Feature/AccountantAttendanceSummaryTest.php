<?php

namespace Tests\Feature;

use App\Http\Controllers\Accountant\AttendanceSummaryController;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Pins the per-class day rules + open class filter on the accountant
 * attendance summary (Stage B9). The controller used to:
 *   - hard-filter `where('type', 'gurmukhi')` — a third class was excluded
 *   - hard-skip Sundays in attendance + last-working-day — a class with
 *     Mon-Sat config would still surface Sunday-marked records, and a
 *     Kirtan class would not anchor on Sunday
 *
 * Now:
 *   - class_ids[] narrows scope (omitted = all active enrollments)
 *   - per-class attendance day filtering via SchoolClass::isAttendanceDay()
 *   - per-class last-working-day walk
 *
 * Route is registered locally in the test to keep the orphan controller
 * testable without exposing a production route.
 */
class AccountantAttendanceSummaryTest extends TestCase
{
    use RefreshDatabase;

    private User $accountant;
    private Carbon $today; // a Thursday so all default Mon-Sat classes have a last working day = yesterday

    protected function setUp(): void
    {
        parent::setUp();

        // Register a temporary route just for this test.
        Route::middleware('web')->get('/_test/attendance-summary', [AttendanceSummaryController::class, 'index']);

        $this->today = Carbon::create(2026, 8, 13); // Thursday
        Carbon::setTestNow($this->today);

        $this->accountant = User::factory()->create([
            'role' => 'accountant',
            'username' => 'accountant_summary',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_third_class_appears_alongside_gurmukhi_when_no_class_filter_is_passed(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', [1, 2, 3, 4, 5, 6]);
        $gSection = $this->makeSection($gurmukhi, 'Gurmukhi A');
        $gStudent = $this->enrollStudent('Gurmukhi Kid', $gurmukhi, $gSection);

        $music = $this->makeClass('Music', 'music', [1, 2, 3, 4, 5, 6]);
        $mSection = $this->makeSection($music, 'Music A');
        $mStudent = $this->enrollStudent('Music Kid', $music, $mSection);

        // Yesterday (Wed) — both classes mark absent.
        $yesterday = $this->today->copy()->subDay()->toDateString();
        StudentSection::where('student_id', $gStudent->id)->update(['status' => 'active', 'transferred_at' => null]);

        $this->markAbsent($gStudent, $gSection, $yesterday);
        $this->markAbsent($mStudent, $mSection, $yesterday);

        $response = $this->actingAs($this->accountant)->getJson('/_test/attendance-summary');
        $response->assertOk();

        $names = collect($response->json('absent_yesterday'))->pluck('name')->all();
        sort($names);
        $this->assertSame(['Gurmukhi Kid', 'Music Kid'], $names);
    }

    public function test_class_ids_filter_scopes_to_selected_class(): void
    {
        $gurmukhi = $this->makeClass('Gurmukhi', 'gurmukhi', [1, 2, 3, 4, 5, 6]);
        $gSection = $this->makeSection($gurmukhi, 'Gurmukhi A');
        $gStudent = $this->enrollStudent('Gurmukhi Kid', $gurmukhi, $gSection);

        $music = $this->makeClass('Music', 'music', [1, 2, 3, 4, 5, 6]);
        $mSection = $this->makeSection($music, 'Music A');
        $mStudent = $this->enrollStudent('Music Kid', $music, $mSection);

        $yesterday = $this->today->copy()->subDay()->toDateString();
        $this->markAbsent($gStudent, $gSection, $yesterday);
        $this->markAbsent($mStudent, $mSection, $yesterday);

        $response = $this->actingAs($this->accountant)
            ->getJson('/_test/attendance-summary?class_ids[]=' . $music->id);
        $response->assertOk();

        $names = collect($response->json('absent_yesterday'))->pluck('name')->all();
        $this->assertSame(['Music Kid'], $names);
    }

    public function test_kirtan_class_anchors_on_sunday_even_when_query_runs_on_thursday(): void
    {
        // Anchor the test on Sunday so Kirtan's Sunday-only fallback applies.
        $sunday = Carbon::create(2026, 8, 16); // Sunday
        Carbon::setTestNow($sunday);

        $kirtan = $this->makeClass('Kirtan', 'kirtan'); // no attendance_days override → fallback
        $kSection = $this->makeSection($kirtan, 'Kirtan A');
        $student = $this->enrollStudent('Kirtan Kid', $kirtan, $kSection);

        // Friday (off-day for Kirtan) marked present — must be filtered out.
        $this->markPresent($student, $kSection, Carbon::create(2026, 8, 14)->toDateString());
        // Yesterday (Saturday, also off-day) absent — must be filtered out.
        $this->markAbsent($student, $kSection, Carbon::create(2026, 8, 15)->toDateString());

        $response = $this->actingAs($this->accountant)->getJson('/_test/attendance-summary');
        $response->assertOk();

        // No attendance on valid days → nothing classified.
        $this->assertSame([], $response->json('absent_yesterday'));
        $this->assertSame([], $response->json('absent_2_days'));
        $this->assertSame([], $response->json('absent_3_plus'));
        $this->assertSame([], $response->json('on_leave'));
    }

    /* ── Fixture helpers ── */

    private function makeClass(string $name, string $type, ?array $attendanceDays = null): SchoolClass
    {
        $class = SchoolClass::create([
            'name' => $name,
            'type' => $type,
            'default_monthly_fee' => 500,
        ]);
        if ($attendanceDays !== null) {
            $class->attendance_days = $attendanceDays;
            $class->save();
        }
        return $class;
    }

    private function makeSection(SchoolClass $class, string $name): Section
    {
        return Section::create([
            'class_id' => $class->id,
            'name' => $name,
            'monthly_fee' => 500,
        ]);
    }

    private function enrollStudent(string $name, SchoolClass $class, Section $section): Student
    {
        $student = Student::create([
            'name' => $name,
            'father_name' => 'Father of ' . $name,
            'status' => Student::STATUS_ACTIVE,
        ]);
        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => $this->today->copy()->subMonths(2),
        ]);
        return $student;
    }

    private function markAbsent(Student $student, Section $section, string $date): void
    {
        $this->markAttendance($student, $section, $date, 'absent');
    }

    private function markPresent(Student $student, Section $section, string $date): void
    {
        $this->markAttendance($student, $section, $date, 'present');
    }

    private function markAttendance(Student $student, Section $section, string $date, string $status): void
    {
        $enrollment = StudentSection::where('student_id', $student->id)
            ->where('section_id', $section->id)
            ->whereNull('transferred_at')
            ->firstOrFail();

        \App\Models\Attendance::create([
            'student_id' => $student->id,
            'student_section_id' => $enrollment->id,
            'date' => $date,
            'status' => $status,
        ]);
    }
}