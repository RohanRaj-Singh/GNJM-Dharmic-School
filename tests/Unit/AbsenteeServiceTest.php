<?php

namespace Tests\Unit;

use App\Models\Attendance;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\AbsenteeService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Pins the pure computation behind /attendance/absentees (Sprint 1.2): status
 * normalisation, the streak/category rules (absent_1/2/3+, leave_1/2+, clear),
 * the kirtan/gurmukhi valid-day rule, the today-absentee split, and the
 * total_days ascending sort.
 *
 * Built entirely from in-memory models — no DB. Complements the HTTP-level
 * coverage in tests/Feature/AttendanceAbsenteesTest.php.
 *
 * Sprint 6.1 — closes the missing service-test gap for AbsenteeService.
 */
class AbsenteeServiceTest extends TestCase
{
    private AbsenteeService $service;

    private const TODAY = '2026-08-13'; // Thursday

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new AbsenteeService();
    }

    /* ───────────────────────────────────────────────
       normalizeStatus
       ─────────────────────────────────────────────── */

    public function test_normalize_status_maps_legacy_codes(): void
    {
        $this->assertSame('absent', $this->service->normalizeStatus('a'));
        $this->assertSame('absent', $this->service->normalizeStatus('A'));
        $this->assertSame('absent', $this->service->normalizeStatus('absent'));
        $this->assertSame('leave', $this->service->normalizeStatus('l'));
        $this->assertSame('leave', $this->service->normalizeStatus(' leave '));
        $this->assertSame('present', $this->service->normalizeStatus('p'));
        $this->assertSame('present', $this->service->normalizeStatus('present'));
        $this->assertSame('unknown', $this->service->normalizeStatus('unknown'));
    }

    /* ───────────────────────────────────────────────
       Streak + category rules
       ─────────────────────────────────────────────── */

    public function test_absent_streak_categories(): void
    {
        $one = $this->rowsFor([['2026-08-12', 'absent']])['students'][0];
        $this->assertSame('absent_1', $one['category']);

        $two = $this->rowsFor([
            ['2026-08-12', 'absent'],
            ['2026-08-11', 'absent'],
        ])['students'][0];
        $this->assertSame('absent_2', $two['category']);

        $three = $this->rowsFor([
            ['2026-08-12', 'absent'],
            ['2026-08-11', 'absent'],
            ['2026-08-10', 'absent'],
        ])['students'][0];
        $this->assertSame('absent_3_plus', $three['category']);

        // Quirk pinned by the feature test (test_streak_days_is_always_one_for_existing_streak):
        // streak_days is the span between the latest streak record and itself + 1,
        // so it is always 1 for any streak. The category still uses the real streak length.
        // Single-record streak keeps the int $streak (1); multi-day streaks go through
        // diffInDays(), so they are float (1.0) — pin both precisions exactly.
        $this->assertSame(1, $one['streak_days']);
        $this->assertSame(1.0, $two['streak_days']);
        $this->assertSame(1.0, $three['streak_days']);
    }

    public function test_leave_streak_categories(): void
    {
        $this->assertSame('leave_1', $this->rowsFor([['2026-08-12', 'leave']])['students'][0]['category']);

        $this->assertSame('leave_2_plus', $this->rowsFor([
            ['2026-08-12', 'leave'],
            ['2026-08-11', 'leave'],
        ])['students'][0]['category']);
    }

    public function test_latest_present_record_is_clear(): void
    {
        $rows = $this->rowsFor([
            ['2026-08-12', 'present'],
            ['2026-08-11', 'absent'],
        ]);

        $this->assertSame('clear', $rows['students'][0]['category']);
        $this->assertSame(0, $rows['students'][0]['streak_days']);
    }

    public function test_a_leave_breaks_an_absent_streak(): void
    {
        $rows = $this->rowsFor([
            ['2026-08-12', 'leave'],
            ['2026-08-11', 'absent'],
        ]);

        $this->assertSame('leave_1', $rows['students'][0]['category']);
    }

    /* ───────────────────────────────────────────────
       Today absentees
       ─────────────────────────────────────────────── */

    public function test_today_absentee_is_split_out_of_the_streak(): void
    {
        $rows = $this->rowsFor([
            ['2026-08-13', 'absent'], // today
            ['2026-08-12', 'present'],
        ]);

        $this->assertCount(1, $rows['today_absentees']);
        $this->assertSame('absent_today', $rows['today_absentees'][0]['category']);
        $this->assertSame('2026-08-13', $rows['today_absentees'][0]['date']);

        // The today row is excluded from the streak → yesterday present → clear.
        $this->assertSame('clear', $rows['students'][0]['category']);
    }

    public function test_include_today_only_affects_the_streak_not_today_absentees(): void
    {
        // Today absent with includeToday=false: the streak drops today's row
        // (yesterday present → clear), but the today-absentees list still
        // reports the absence — it is computed independently of includeToday
        // (quirk preserved verbatim from the original route closure).
        $rows = $this->rowsFor(
            [
                ['2026-08-13', 'absent'],
                ['2026-08-12', 'present'],
            ],
            includeToday: false
        );

        $this->assertCount(1, $rows['today_absentees']);
        $this->assertSame('absent_today', $rows['today_absentees'][0]['category']);
        $this->assertSame('clear', $rows['students'][0]['category']);
    }

    /* ───────────────────────────────────────────────
       Valid-day rule (kirtan Sunday only / gurmukhi never Sunday)
       ─────────────────────────────────────────────── */

    public function test_kirtan_only_counts_sunday_records(): void
    {
        // 2026-08-09 is Sunday; 2026-08-13 (Thursday) is invalid for Kirtan.
        $rows = $this->rowsFor(
            [
                ['2026-08-13', 'absent'],
                ['2026-08-09', 'absent'],
            ],
            classType: 'kirtan'
        );

        $this->assertSame('absent_1', $rows['students'][0]['category']);
    }

    public function test_gurmukhi_ignores_sunday_records(): void
    {
        // 2026-08-09 is Sunday; invalid for Gurmukhi → only Wednesday counts.
        $rows = $this->rowsFor([
            ['2026-08-12', 'absent'],
            ['2026-08-09', 'absent'],
        ]);

        $this->assertSame('absent_1', $rows['students'][0]['category']);
    }

    /* ───────────────────────────────────────────────
       Filters + sorting
       ─────────────────────────────────────────────── */

    public function test_class_section_and_search_filters(): void
    {
        $gurmukhi = $this->enrollment('gurmukhi', 'Gurmukhi', [['2026-08-12', 'absent']]);
        $kirtan = $this->enrollment('kirtan', 'Kirtan', [['2026-08-09', 'absent']]);

        $all = $this->build([$gurmukhi, $kirtan], filters: []);
        $this->assertCount(2, $all['students']);

        // Class filter: only Gurmukhi.
        $classFiltered = $this->build([$gurmukhi, $kirtan], filters: ['class' => $gurmukhi->schoolClass->id]);
        $this->assertCount(1, $classFiltered['students']);
        $this->assertSame('Student Gurmukhi', $classFiltered['students'][0]['name']);

        // Section filter.
        $sectionFiltered = $this->build([$gurmukhi, $kirtan], filters: ['section' => $gurmukhi->section->id]);
        $this->assertCount(1, $sectionFiltered['students']);

        // Search: only the Kirtan student matches "kirtan".
        $searched = $this->build([$gurmukhi, $kirtan], filters: ['search' => 'kirtan']);
        $this->assertCount(1, $searched['students']);
        $this->assertSame('Student Kirtan', $searched['students'][0]['name']);
    }

    public function test_students_sorted_by_total_days_ascending(): void
    {
        $oneDay = $this->enrollment('gurmukhi', 'Gurmukhi One', [['2026-08-12', 'absent']]);
        $twoDays = $this->enrollment('gurmukhi', 'Gurmukhi Two', [
            ['2026-08-12', 'absent'],
            ['2026-08-11', 'absent'],
        ]);

        $rows = $this->build([$oneDay, $twoDays], filters: []);

        $this->assertCount(2, $rows['students']);
        $this->assertSame('Student Gurmukhi One', $rows['students'][0]['name']);
        $this->assertSame('Student Gurmukhi Two', $rows['students'][1]['name']);
    }

    /* ───────────────────────────────────────────────
       Helpers
       ─────────────────────────────────────────────── */

    /** Build rows for a single enrollment of the given class type. */
    private function rowsFor(
        array $attendance,
        string $classType = 'gurmukhi',
        bool $includeToday = true,
    ): array {
        return $this->build([$this->enrollment($classType, ucfirst($classType), $attendance)], [
            'include_today' => $includeToday,
        ]);
    }

    /** @param array<int, StudentSection> $enrollments */
    private function build(array $enrollments, array $filters): array
    {
        $today = Carbon::parse(self::TODAY);

        return $this->service->buildRows(
            new EloquentCollection($enrollments),
            $today,
            Carbon::parse('2026-08-01'),
            $today,
            $filters['include_today'] ?? true,
            $filters['class'] ?? null,
            $filters['section'] ?? null,
            $filters['search'] ?? null,
        );
    }

    /** @param array<int, array{0: string, 1: string}> $attendance date→status, latest first */
    private function enrollment(string $classType, string $className, array $attendance): StudentSection
    {
        $schoolClass = new SchoolClass();
        $schoolClass->id = 9000 + rand(1, 999);
        $schoolClass->name = $className;
        $schoolClass->type = $classType;

        $section = new Section();
        $section->id = 8000 + rand(1, 999);
        $section->class_id = $schoolClass->id;
        $section->name = $className . ' A';
        $section->setRelation('schoolClass', $schoolClass);

        $student = new Student();
        $student->id = 7000 + rand(1, 999);
        $student->name = 'Student ' . $className;
        $student->father_name = 'Father of ' . $className;

        $enrollment = new StudentSection();
        $enrollment->id = 6000 + rand(1, 999);
        $enrollment->student_id = $student->id;
        $enrollment->class_id = $schoolClass->id;
        $enrollment->section_id = $section->id;
        $enrollment->status = 'active';

        $enrollment->setRelation('student', $student);
        $enrollment->setRelation('section', $section);
        $enrollment->setRelation('schoolClass', $schoolClass);
        $enrollment->setRelation('attendance', new EloquentCollection(array_map(
            fn (array $row) => $this->attendance($row[0], $row[1]),
            $attendance
        )));

        return $enrollment;
    }

    private function attendance(string $date, string $status): Attendance
    {
        $model = new Attendance();
        $model->date = $date;
        $model->status = $status;

        return $model;
    }
}
