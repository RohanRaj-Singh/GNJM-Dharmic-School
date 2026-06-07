<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\KirtanScore;

/**
 * Pure function: computes the Kirtan performance score.
 *
 * Math (kickoff §6.4):
 *   attendance_component = present / (present + absent + leave) * 100
 *   lesson_component     = lessons / present * 100   (NOT / total — fixes audit B-04)
 *   score                = attendance * 0.6 + lesson * 0.4
 *
 * Returns "Not enough data" rating when there is no attendance in range.
 */
final class KirtanScoreCalculator
{
    public const WEIGHT_ATTENDANCE = 0.6;
    public const WEIGHT_LESSON = 0.4;

    public const RATING_EXCELLENT_THRESHOLD = 85.0;
    public const RATING_GOOD_THRESHOLD = 70.0;
    public const RATING_AVERAGE_THRESHOLD = 50.0;

    public function compute(
        int $present,
        int $absent,
        int $leave,
        int $lessonsLearned,
    ): KirtanScore {
        $totalClasses = $present + $absent + $leave;

        if ($totalClasses === 0) {
            return new KirtanScore(
                score: 0.0,
                rating: 'Not enough data',
                attendanceComponent: 0.0,
                lessonComponent: 0.0,
                totalClasses: 0,
                lessonsLearned: $lessonsLearned,
                dataStatus: KirtanScore::DATA_NO_ATTENDANCE,
            );
        }

        $attendanceComponent = ($present / $totalClasses) * 100;
        $lessonComponent = $present > 0 ? ($lessonsLearned / $present) * 100 : 0.0;
        $score = ($attendanceComponent * self::WEIGHT_ATTENDANCE)
               + ($lessonComponent * self::WEIGHT_LESSON);
        $score = round($score, 2);

        $rating = match (true) {
            $score >= self::RATING_EXCELLENT_THRESHOLD => 'Excellent',
            $score >= self::RATING_GOOD_THRESHOLD => 'Good',
            $score >= self::RATING_AVERAGE_THRESHOLD => 'Average',
            default => 'Needs Improvement',
        };

        return new KirtanScore(
            score: $score,
            rating: $rating,
            attendanceComponent: round($attendanceComponent, 2),
            lessonComponent: round($lessonComponent, 2),
            totalClasses: $totalClasses,
            lessonsLearned: $lessonsLearned,
            dataStatus: KirtanScore::DATA_OK,
        );
    }
}
