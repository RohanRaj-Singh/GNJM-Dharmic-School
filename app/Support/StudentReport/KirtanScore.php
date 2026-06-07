<?php

namespace App\Support\StudentReport;

/**
 * Kirtan performance score, with components broken out.
 *
 * V1 math (kickoff §6.4):
 *   attendance_component = present / (present + absent + leave) * 100
 *   lesson_component     = lessons_learned / present * 100   (not / total)
 *   score                = attendance_component * 0.6 + lesson_component * 0.4
 *
 * Rating buckets (unchanged from V1):
 *   ≥85 Excellent · ≥70 Good · ≥50 Average · <50 Needs Improvement
 *
 * `dataStatus` is "ok" when there is attendance, or "no_data" when the
 * student has no attendance in range (so the UI shows "Not enough data"
 * instead of a misleading 0%).
 */
final class KirtanScore
{
    public const DATA_OK = 'ok';
    public const DATA_NO_ATTENDANCE = 'no_data';

    public function __construct(
        public readonly float $score,
        public readonly string $rating,
        public readonly float $attendanceComponent,
        public readonly float $lessonComponent,
        public readonly int $totalClasses,
        public readonly int $lessonsLearned,
        public readonly string $dataStatus,
    ) {}

    public function toArray(): array
    {
        return [
            'score' => $this->score,
            'rating' => $this->rating,
            'components' => [
                'attendance' => $this->attendanceComponent,
                'lesson' => $this->lessonComponent,
            ],
            'total_classes' => $this->totalClasses,
            'lessons_learned' => $this->lessonsLearned,
            'data_status' => $this->dataStatus,
        ];
    }
}
