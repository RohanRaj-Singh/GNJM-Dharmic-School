<?php

namespace App\Support\StudentReport;

use Carbon\Carbon;
use InvalidArgumentException;

/**
 * The expanded list of months covered by a Student Report request.
 *
 * Produced by one of the four factories; consumed by the calendar builder,
 * the PDF, and the React page. There is one source of truth for "how many
 * calendars should I render and in what order".
 *
 * Capped at 36 months (3 years) by design.
 */
final class MonthRange
{
    public const MAX_MONTHS = 120; // 10 years — covers a student's full enrollment

    /**
     * @param  list<MonthCell>  $months
     */
    public function __construct(
        public readonly string $startLabel,
        public readonly string $endLabel,
        public readonly array $months,
        public readonly int $totalMonths,
    ) {}

    public static function forAcademicSession(int $year): self
    {
        $session = AcademicSession::range($year);
        return self::forRange(
            substr($session['start'], 0, 7),
            substr($session['end'], 0, 7),
        );
    }

    public static function forCalendarYear(int $year): self
    {
        return self::forRange("{$year}-01", "{$year}-12");
    }

    public static function forMonth(string $yyyymm): self
    {
        self::assertMonthFormat($yyyymm);
        return self::forRange($yyyymm, $yyyymm);
    }

    public static function forRange(string $start, string $end): self
    {
        self::assertMonthFormat($start);
        self::assertMonthFormat($end);

        if ($start > $end) {
            throw new InvalidArgumentException("Range start ({$start}) must be ≤ end ({$end}).");
        }

        $startDt = Carbon::createFromFormat('Y-m', $start)->startOfMonth();
        $endDt = Carbon::createFromFormat('Y-m', $end)->startOfMonth();

        $months = [];
        for ($d = $startDt->copy(); $d->lte($endDt); $d->addMonth()) {
            $months[] = new MonthCell(
                year: (int) $d->year,
                month: (int) $d->month,
                label: $d->format('M Y'),
                days: [],
                presentCount: 0,
                absentCount: 0,
                leaveCount: 0,
            );
        }

        if (count($months) > self::MAX_MONTHS) {
            throw new InvalidArgumentException(
                "Range spans " . count($months) . " months; max allowed is " . self::MAX_MONTHS . "."
            );
        }

        return new self(
            startLabel: $start,
            endLabel: $end,
            months: $months,
            totalMonths: count($months),
        );
    }

    private static function assertMonthFormat(string $value): void
    {
        if (!preg_match('/^\d{4}-\d{2}$/', $value)) {
            throw new InvalidArgumentException("Expected YYYY-MM, got '{$value}'.");
        }
        $month = (int) substr($value, 5, 2);
        if ($month < 1 || $month > 12) {
            throw new InvalidArgumentException("Invalid month in '{$value}'.");
        }
    }

    public function toArray(): array
    {
        return \App\Support\StudentReport\MonthRangeArray::toArray($this);
    }
}
