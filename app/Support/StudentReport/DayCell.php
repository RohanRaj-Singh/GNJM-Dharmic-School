<?php

namespace App\Support\StudentReport;

use App\Support\StudentReport\Enums\AttendanceStatus;

/**
 * A single day in the calendar grid.
 *
 * `status` is null when the day was not marked. `lessonLearned` is only
 * meaningful for Kirtan; the React page and PDF still receive the value
 * for Gurmukhi but do not display it.
 */
final class DayCell
{
    public function __construct(
        public readonly ?AttendanceStatus $status,
        public readonly bool $lessonLearned = false,
    ) {}
}
