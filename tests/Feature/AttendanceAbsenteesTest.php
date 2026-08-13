<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Pins the behaviour of the /attendance/absentees page (currently a ~218-line
 * route closure in routes/attendance.php) so that extracting it into an
 * AttendanceController method + AbsenteeService (Phase-2 Sprint 1.2) cannot
 * silently change the computed categories, streaks, date filtering, or the
 * teacher-scoping rules the UI depends on.
 *
 * Test clock is fixed to 2026-08-13 (Thursday). Default date range therefore
 * becomes 2026-07-13 .. 2026-08-12 (30 days ending yesterday, today excluded).
 * For a Gurmukhi class only non-Sunday attendance is valid; for a Kirtan class
 * only Sunday attendance is valid.
 */
class AttendanceAbsenteesTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $accountant;
    private SchoolClass $gurmukhi;
    private Section $sectionA;
    private SchoolClass $kirtan;
    private Section $sectionB;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00');

        $this->teacher = User::factory()->create([
            'role'     => 'teacher',
            'username' => 'teacher_absentees_test',
        ]);
        $this->accountant = User::factory()->create([
            'role'     => 'accountant',
            'username' => 'accountant_absentees_test',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name'               => 'Gurmukhi',
            'type'               => 'gurmukhi',
            'default_monthly_fee' => 0,
        ]);
        $this->sectionA = Section::create([
            'class_id'    => $this->gurmukhi->id,
            'name'        => 'Section A',
            'monthly_fee' => 0,
        ]);

        $this->kirtan = SchoolClass::create([
            'name'               => 'Kirtan',
            'type'               => 'kirtan',
            'default_monthly_fee' => 0,
        ]);
        $this->sectionB = Section::create([
            'class_id'    => $this->kirtan->id,
            'name'        => 'Section B',
            'monthly_fee' => 0,
        ]);

        $this->teacher->sections()->attach($this->sectionA->id);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────────────────
       Helpers
       ─────────────────────────────────────────────────────────── */

    private function student(string $name): Student
    {
        return Student::create([
            'name'        => $name,
            'father_name' => 'Test Father',
            'status'      => Student::STATUS_ACTIVE,
        ]);
    }

    private function enroll(Student $student, SchoolClass $class, Section $section): StudentSection
    {
        return StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => Carbon::parse('2026-07-01'),
        ]);
    }

    private function attendance(StudentSection $enrollment, string $date, string $status): void
    {
        Attendance::create([
            'student_section_id' => $enrollment->id,
            'date'               => $date,
            'status'             => $status,
        ]);
    }

    private function asTeacher()
    {
        return $this->actingAs($this->teacher);
    }

    private function asAccountant()
    {
        return $this->actingAs($this->accountant);
    }

    /* ───────────────────────────────────────────────────────────
       Categories & streak calculation
       ─────────────────────────────────────────────────────────── */

    public function test_absent_streak_of_two_is_categorized_absent_2(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-11', 'absent');
        $this->attendance($enrollment, '2026-08-12', 'absent');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_2')
            ->where('students.0.total_days', 2)
            ->where('students.0.date', '2026-08-12')
            ->where('students.0.all_absent_dates', ['2026-08-12', '2026-08-11'])
            ->where('students.0.all_leave_dates', []));
    }

    public function test_absent_streak_of_three_plus_is_categorized_absent_3_plus(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-10', 'absent');
        $this->attendance($enrollment, '2026-08-11', 'absent');
        $this->attendance($enrollment, '2026-08-12', 'absent');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_3_plus')
            ->where('students.0.total_days', 3));
    }

    public function test_leave_streak_of_two_is_categorized_leave_2_plus(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-11', 'leave');
        $this->attendance($enrollment, '2026-08-12', 'leave');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'leave_2_plus')
            ->where('students.0.all_leave_dates', ['2026-08-12', '2026-08-11']));
    }

    /**
     * Pins the existing (quirky) streak_days computation: the loop sets
     * $streakStartDate to the FIRST (latest) matching record, and $lastDayRecord
     * is that same latest record, so diffInDays(...) + 1 always equals 1 once a
     * streak exists. The category still reflects the true streak length, but
     * streak_days does not. Preserved verbatim by the extraction.
     */
    public function test_streak_days_is_always_one_for_existing_streak(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-11', 'absent');
        $this->attendance($enrollment, '2026-08-12', 'absent');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_2')
            ->where('students.0.streak_days', 1));
    }

    public function test_present_only_student_is_categorized_clear(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-12', 'present');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'clear')
            ->where('students.0.streak_days', 0)
            ->where('students.0.total_days', 0));
    }

    public function test_mixed_status_breaks_streak_at_latest_record(): void
    {
        // Latest record is leave, older records are absent -> streak is leave_1
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-10', 'absent');
        $this->attendance($enrollment, '2026-08-11', 'absent');
        $this->attendance($enrollment, '2026-08-12', 'leave');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'leave_1')
            ->where('students.0.streak_days', 1)
            ->where('students.0.total_days', 3));
    }

    public function test_streak_ignores_sunday_gap_and_days_count_spans_calendar(): void
    {
        // 2026-08-09 is a Sunday (invalid day for Gurmukhi), so the two absences
        // on Saturday 08-08 and Monday 08-10 form a streak of 2 (category) while
        // total_days counts 2 attendance records. streak_days stays 1 due to the
        // quirk pinned by test_streak_days_is_always_one_for_existing_streak.
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-08', 'absent');
        $this->attendance($enrollment, '2026-08-10', 'absent');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_2')
            ->where('students.0.streak_days', 1)
            ->where('students.0.total_days', 2));
    }

    /* ───────────────────────────────────────────────────────────
       Today absentees
       ─────────────────────────────────────────────────────────── */

    public function test_student_absent_today_appears_in_today_absentees_and_streak(): void
    {
        // 2026-08-13 is today. An absence today lands in today_absentees AND is
        // excluded from the default range, so the streak row keeps yesterday's run.
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-11', 'absent');
        $this->attendance($enrollment, '2026-08-13', 'absent');

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('today_absentees.0.name', 'Rohan')
            ->where('today_absentees.0.category', 'absent_today')
            ->where('today_absentees.0.date', '2026-08-13')
            ->where('students.0.category', 'absent_1')
            ->where('students.0.streak_days', 1)
            ->where('students.0.date', '2026-08-11'));
    }

    /* ───────────────────────────────────────────────────────────
       Role scoping
       ─────────────────────────────────────────────────────────── */

    public function test_teacher_only_sees_assigned_section_students(): void
    {
        $seen = $this->student('Seen');
        $this->enroll($seen, $this->gurmukhi, $this->sectionA);

        $hidden = $this->student('Hidden');
        $this->enroll($hidden, $this->kirtan, $this->sectionB); // not assigned to teacher

        $response = $this->asTeacher()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->has('students', 1)
            ->where('students.0.name', 'Seen')
            ->has('sections', 1));
    }

    public function test_accountant_sees_all_sections(): void
    {
        $a = $this->student('Alpha');
        $this->enroll($a, $this->gurmukhi, $this->sectionA);
        $b = $this->student('Beta');
        $this->enroll($b, $this->kirtan, $this->sectionB);

        $response = $this->asAccountant()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->has('students', 2)
            ->has('sections', 2));
    }

    /* ───────────────────────────────────────────────────────────
       Kirtan / Gurmukhi day rules
       ─────────────────────────────────────────────────────────── */

    public function test_kirtan_class_only_counts_sunday_attendance(): void
    {
        // 2026-08-09 is Sunday (valid for Kirtan), 2026-08-10 is Monday (ignored).
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->kirtan, $this->sectionB);
        $this->attendance($enrollment, '2026-08-09', 'absent');
        $this->attendance($enrollment, '2026-08-10', 'absent');

        $response = $this->asAccountant()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_1')
            ->where('students.0.total_days', 1)
            ->where('students.0.date', '2026-08-09')
            ->where('students.0.all_absent_dates', ['2026-08-09']));
    }

    /**
     * Sprint 1.3 canonicalisation: a legacy class with a NULL/blank `type`
     * but a Kirtan class *name* must still honour the Kirtan Sunday-only
     * day-rule (DivisionTypeResolver name fallback). Previously the
     * type-only check treated it as "not kirtan" and accepted every day.
     */
    public function test_null_type_kirtan_named_class_only_counts_sunday_attendance(): void
    {
        $untagged = SchoolClass::create([
            'name'                => 'Kirtan Legacy',
            'type'                => '',
            'default_monthly_fee' => 0,
        ]);
        $sectionC = Section::create([
            'class_id'    => $untagged->id,
            'name'        => 'Section C',
            'monthly_fee' => 0,
        ]);

        $student = $this->student('Legacy Kid');
        $enrollment = $this->enroll($student, $untagged, $sectionC);
        // 2026-08-09 is Sunday (valid for Kirtan), 2026-08-10 is Monday (ignored).
        $this->attendance($enrollment, '2026-08-09', 'absent');
        $this->attendance($enrollment, '2026-08-10', 'absent');

        $response = $this->asAccountant()->get(route('attendance.absentees'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'absent_1')
            ->where('students.0.total_days', 1)
            ->where('students.0.date', '2026-08-09')
            ->where('students.0.all_absent_dates', ['2026-08-09']));
    }

    /* ───────────────────────────────────────────────────────────
       Filters
       ─────────────────────────────────────────────────────────── */

    public function test_search_filters_by_student_name(): void
    {
        $this->enroll($this->student('Amar'), $this->gurmukhi, $this->sectionA);
        $this->enroll($this->student('Bikram'), $this->gurmukhi, $this->sectionA);

        $response = $this->asTeacher()->get(route('attendance.absentees', ['search' => 'bik']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->has('students', 1)
            ->where('students.0.name', 'Bikram'));
    }

    public function test_class_filter_restricts_to_requested_class(): void
    {
        $a = $this->student('Gurmukhi Kid');
        $this->enroll($a, $this->gurmukhi, $this->sectionA);
        $b = $this->student('Kirtan Kid');
        $this->enroll($b, $this->kirtan, $this->sectionB);

        $response = $this->asAccountant()->get(route('attendance.absentees', [
            'class_id' => $this->gurmukhi->id,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->has('students', 1)
            ->where('students.0.name', 'Gurmukhi Kid'));
    }

    public function test_custom_date_range_excludes_today_without_include_today(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-12', 'absent');
        $this->attendance($enrollment, '2026-08-13', 'present'); // today

        // End date is today but include_today is not set -> today's record is dropped.
        $response = $this->asTeacher()->get(route('attendance.absentees', [
            'start_date' => '2026-08-12',
            'end_date'   => '2026-08-13',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('filters.has_custom_filter', true)
            ->where('students.0.category', 'absent_1')
            ->where('students.0.date', '2026-08-12'));
    }

    public function test_custom_date_range_with_include_today_keeps_today(): void
    {
        $student = $this->student('Rohan');
        $enrollment = $this->enroll($student, $this->gurmukhi, $this->sectionA);
        $this->attendance($enrollment, '2026-08-12', 'absent');
        $this->attendance($enrollment, '2026-08-13', 'present'); // today

        $response = $this->asTeacher()->get(route('attendance.absentees', [
            'start_date'    => '2026-08-12',
            'end_date'      => '2026-08-13',
            'include_today' => '1',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Attendance/Absentees')
            ->where('students.0.category', 'clear')
            ->where('students.0.date', '2026-08-13'));
    }
}
