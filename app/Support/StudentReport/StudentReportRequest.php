<?php

namespace App\Support\StudentReport;

use InvalidArgumentException;

/**
 * The validated, immutable input to the Student Report engine.
 *
 * Constructed by the FormRequest after validation. The service never sees
 * a Laravel Request — only this value object. This makes the service
 * unit-testable without HTTP fakes.
 *
 * Four range modes are supported:
 *  - 'academic_session'  → uses singleYear; resolves to Apr year → Mar year+1
 *  - 'calendar_year'     → uses singleYear; resolves to Jan..Dec year
 *  - 'month'             → uses singleMonth ('YYYY-MM')
 *  - 'range'             → uses rangeStart + rangeEnd ('YYYY-MM')
 */
final class StudentReportRequest
{
    public const RANGE_ACADEMIC_SESSION = 'academic_session';
    public const RANGE_CALENDAR_YEAR = 'calendar_year';
    public const RANGE_MONTH = 'month';
    public const RANGE_RANGE = 'range';

    public const DIVISION_ALL = 'all';
    public const DIVISION_GURMUKHI = 'gurmukhi';
    public const DIVISION_KIRTAN = 'kirtan';

    public function __construct(
        public readonly int $studentId,
        public readonly string $rangeMode,
        public readonly ?int $singleYear,
        public readonly ?string $singleMonth,
        public readonly ?string $rangeStart,
        public readonly ?string $rangeEnd,
        public readonly string $division,
    ) {
        $this->validate();
    }

    public static function fromArray(array $data): self
    {
        return new self(
            studentId: (int) ($data['student_id'] ?? 0),
            rangeMode: (string) ($data['range_mode'] ?? ''),
            singleYear: isset($data['single_year']) ? (int) $data['single_year'] : null,
            singleMonth: isset($data['single_month']) ? (string) $data['single_month'] : null,
            rangeStart: isset($data['range_start']) ? (string) $data['range_start'] : null,
            rangeEnd: isset($data['range_end']) ? (string) $data['range_end'] : null,
            division: (string) ($data['division'] ?? self::DIVISION_ALL),
        );
    }

    public function resolveRange(): MonthRange
    {
        return match ($this->rangeMode) {
            self::RANGE_ACADEMIC_SESSION => MonthRange::forAcademicSession((int) $this->singleYear),
            self::RANGE_CALENDAR_YEAR => MonthRange::forCalendarYear((int) $this->singleYear),
            self::RANGE_MONTH => MonthRange::forMonth((string) $this->singleMonth),
            self::RANGE_RANGE => MonthRange::forRange((string) $this->rangeStart, (string) $this->rangeEnd),
        };
    }

    public function wantsGurmukhi(): bool
    {
        return $this->division === self::DIVISION_ALL || $this->division === self::DIVISION_GURMUKHI;
    }

    public function wantsKirtan(): bool
    {
        return $this->division === self::DIVISION_ALL || $this->division === self::DIVISION_KIRTAN;
    }

    public function filterPayload(): array
    {
        return [
            'student_id' => $this->studentId,
            'range_mode' => $this->rangeMode,
            'single_year' => $this->singleYear,
            'single_month' => $this->singleMonth,
            'range_start' => $this->rangeStart,
            'range_end' => $this->rangeEnd,
            'division' => $this->division,
        ];
    }

    private function validate(): void
    {
        if ($this->studentId <= 0) {
            throw new InvalidArgumentException('student_id is required.');
        }

        match ($this->rangeMode) {
            self::RANGE_ACADEMIC_SESSION, self::RANGE_CALENDAR_YEAR => (function () {
                if ($this->singleYear === null || $this->singleYear < 2000 || $this->singleYear > 2100) {
                    throw new InvalidArgumentException('single_year is required and must be 2000..2100.');
                }
            })(),
            self::RANGE_MONTH => (function () {
                if (!is_string($this->singleMonth) || !preg_match('/^\d{4}-\d{2}$/', $this->singleMonth)) {
                    throw new InvalidArgumentException('single_month must be YYYY-MM.');
                }
            })(),
            self::RANGE_RANGE => (function () {
                if (!is_string($this->rangeStart) || !is_string($this->rangeEnd)) {
                    throw new InvalidArgumentException('range_start and range_end are required.');
                }
            })(),
            default => throw new InvalidArgumentException("Unknown range_mode: {$this->rangeMode}"),
        };

        if (!in_array($this->division, [self::DIVISION_ALL, self::DIVISION_GURMUKHI, self::DIVISION_KIRTAN], true)) {
            throw new InvalidArgumentException("Unknown division: {$this->division}");
        }
    }
}
