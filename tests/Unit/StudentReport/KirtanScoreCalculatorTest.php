<?php

namespace Tests\Unit\StudentReport;

use App\Services\StudentReport\KirtanScoreCalculator;
use App\Support\StudentReport\KirtanScore;
use PHPUnit\Framework\TestCase;

class KirtanScoreCalculatorTest extends TestCase
{
    public function test_no_attendance_returns_no_data(): void
    {
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 0, absent: 0, leave: 0, lessonsLearned: 0);

        $this->assertSame(KirtanScore::DATA_NO_ATTENDANCE, $score->dataStatus);
        $this->assertSame('Not enough data', $score->rating);
        $this->assertSame(0.0, $score->score);
    }

    public function test_perfect_attendance_no_lessons_yields_60(): void
    {
        // 10 present, 0 absent, 0 leave, 0 lessons:
        // attendance = 10/10 * 100 = 100
        // lesson     = 0/10  * 100 = 0
        // score      = 100 * 0.6 + 0 * 0.4 = 60
        // 60 >= 50 → "Average"
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 10, absent: 0, leave: 0, lessonsLearned: 0);

        $this->assertSame(KirtanScore::DATA_OK, $score->dataStatus);
        $this->assertSame(60.0, $score->score);
        $this->assertSame('Average', $score->rating);
    }

    public function test_perfect_attendance_and_lessons_yields_excellent(): void
    {
        // 10 present, 0 absent, 0 leave, 10 lessons:
        // attendance = 100, lesson = 100
        // score = 100
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 10, absent: 0, leave: 0, lessonsLearned: 10);

        $this->assertSame(100.0, $score->score);
        $this->assertSame('Excellent', $score->rating);
    }

    public function test_low_attendance_with_full_lessons_yields_below_50(): void
    {
        // 1 present, 9 absent, 0 leave, 1 lesson:
        // attendance = 1/10 * 100 = 10
        // lesson     = 1/1  * 100 = 100
        // score      = 10 * 0.6 + 100 * 0.4 = 6 + 40 = 46
        // 46 < 50 → "Needs Improvement"
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 1, absent: 9, leave: 0, lessonsLearned: 1);

        $this->assertSame(46.0, $score->score);
        $this->assertSame('Needs Improvement', $score->rating);
    }

    public function test_audit_b04_repro_fixed(): void
    {
        // Audit B-04: Kirtan student attends every Sunday, teacher forgets
        // to tick lesson_learned. The V1 math gives 60% (not 0%).
        // 30 present, 0 absent, 0 leave, 0 lessons:
        // attendance = 100, lesson = 0
        // score      = 60 → "Average"
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 30, absent: 0, leave: 0, lessonsLearned: 0);

        $this->assertSame(60.0, $score->score);
        $this->assertSame('Average', $score->rating);
        $this->assertSame(100.0, $score->attendanceComponent);
        $this->assertSame(0.0, $score->lessonComponent);
    }

    public function test_rating_buckets_excellent(): void
    {
        // 17 present, 3 absent, 0 leave, 17 lessons:
        // attendance = 17/20 * 100 = 85
        // lesson     = 17/17 * 100 = 100
        // score      = 85 * 0.6 + 100 * 0.4 = 51 + 40 = 91
        // 91 >= 85 → "Excellent"
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 17, absent: 3, leave: 0, lessonsLearned: 17);

        $this->assertSame(85.0, $score->attendanceComponent);
        $this->assertSame(100.0, $score->lessonComponent);
        $this->assertSame(91.0, $score->score);
        $this->assertSame('Excellent', $score->rating);
    }

    public function test_rating_buckets_good(): void
    {
        // 14 present, 6 absent, 0 leave, 14 lessons:
        // attendance = 14/20 = 70, lesson = 100
        // score = 70*0.6 + 100*0.4 = 42 + 40 = 82
        // 82 >= 70 → "Good"
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 14, absent: 6, leave: 0, lessonsLearned: 14);

        $this->assertSame(82.0, $score->score);
        $this->assertSame('Good', $score->rating);
    }

    public function test_rating_buckets_average_lower_bound(): void
    {
        // 10 present, 10 absent, 0 leave, 5 lessons:
        // attendance = 10/20 = 50, lesson = 5/10 = 50
        // score = 50*0.6 + 50*0.4 = 30 + 20 = 50
        // 50 >= 50 → "Average" (boundary inclusive)
        $calc = new KirtanScoreCalculator();
        $score = $calc->compute(present: 10, absent: 10, leave: 0, lessonsLearned: 5);

        $this->assertSame(50.0, $score->score);
        $this->assertSame('Average', $score->rating);
    }
}
