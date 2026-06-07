<?php

namespace Tests\Unit\StudentReport;

use App\Services\StudentReport\CalendarBuilder;
use App\Support\StudentReport\Enums\AttendanceStatus;
use App\Support\StudentReport\Enums\Division;
use App\Support\StudentReport\MonthRange;
use PHPUnit\Framework\TestCase;

class CalendarBuilderTest extends TestCase
{
    public function test_empty_input_produces_empty_days(): void
    {
        $builder = new CalendarBuilder();
        $range = MonthRange::forMonth('2026-03');
        $months = $builder->build($range, [], Division::Gurmukhi, [1, 2]);

        $this->assertCount(1, $months);
        $this->assertSame(31, count($months[0]->days)); // March has 31 days
        $this->assertSame(0, $months[0]->presentCount);
    }

    public function test_present_count_increments(): void
    {
        $builder = new CalendarBuilder();
        $range = MonthRange::forMonth('2026-03');
        $rows = [
            (object)['student_section_id' => 1, 'date' => '2026-03-05', 'status' => 'present', 'lesson_learned' => 1],
            (object)['student_section_id' => 1, 'date' => '2026-03-12', 'status' => 'present', 'lesson_learned' => 0],
        ];
        $months = $builder->build($range, $rows, Division::Gurmukhi, [1]);

        $this->assertSame(2, $months[0]->presentCount);
        $this->assertSame(0, $months[0]->absentCount);
        $this->assertSame(AttendanceStatus::Present, $months[0]->days[5]->status);
        $this->assertTrue($months[0]->days[5]->lessonLearned);
        $this->assertFalse($months[0]->days[12]->lessonLearned);
    }

    public function test_rows_for_other_division_section_ids_are_ignored(): void
    {
        $builder = new CalendarBuilder();
        $range = MonthRange::forMonth('2026-03');
        $rows = [
            (object)['student_section_id' => 1, 'date' => '2026-03-05', 'status' => 'present', 'lesson_learned' => 0],
            (object)['student_section_id' => 99, 'date' => '2026-03-05', 'status' => 'absent',  'lesson_learned' => 0],
        ];
        // Only section id 1 belongs to the Gurmukhi division; 99 is Kirtan's.
        $months = $builder->build($range, $rows, Division::Gurmukhi, [1]);

        $this->assertSame(1, $months[0]->presentCount);
        $this->assertSame(0, $months[0]->absentCount);
    }

    public function test_merge_precedence_present_over_leave_over_absent(): void
    {
        $builder = new CalendarBuilder();
        $range = MonthRange::forMonth('2026-03');
        $rows = [
            (object)['student_section_id' => 1, 'date' => '2026-03-05', 'status' => 'absent', 'lesson_learned' => 0],
            (object)['student_section_id' => 2, 'date' => '2026-03-05', 'status' => 'leave',  'lesson_learned' => 0],
            (object)['student_section_id' => 3, 'date' => '2026-03-05', 'status' => 'present','lesson_learned' => 1],
        ];
        $months = $builder->build($range, $rows, Division::Gurmukhi, [1, 2, 3]);

        $cell = $months[0]->days[5];
        $this->assertSame(AttendanceStatus::Present, $cell->status);
        $this->assertTrue($cell->lessonLearned);
        $this->assertSame(1, $months[0]->presentCount);
    }

    public function test_absent_does_not_overwrite_leave(): void
    {
        $builder = new CalendarBuilder();
        $range = MonthRange::forMonth('2026-03');
        $rows = [
            (object)['student_section_id' => 1, 'date' => '2026-03-05', 'status' => 'leave',  'lesson_learned' => 0],
            (object)['student_section_id' => 2, 'date' => '2026-03-05', 'status' => 'absent', 'lesson_learned' => 0],
        ];
        $months = $builder->build($range, $rows, Division::Gurmukhi, [1, 2]);

        $this->assertSame(AttendanceStatus::Leave, $months[0]->days[5]->status);
        $this->assertSame(0, $months[0]->presentCount);
        $this->assertSame(0, $months[0]->absentCount);
        $this->assertSame(1, $months[0]->leaveCount);
    }
}
