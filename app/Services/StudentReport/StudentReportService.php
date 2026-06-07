<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\AttendanceSummary;
use App\Support\StudentReport\DivisionReport;
use App\Support\StudentReport\Enums\Division;
use App\Support\StudentReport\FeeSummary;
use App\Support\StudentReport\KirtanScore;
use App\Support\StudentReport\MonthRange;
use App\Support\StudentReport\StudentReport;
use App\Support\StudentReport\StudentReportMeta;
use App\Support\StudentReport\StudentReportRequest;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Orchestrator for the Student Performance Report.
 *
 * Pure orchestrator: accepts a StudentReportRequest, returns a StudentReport
 * value object. All DB access is delegated to the resolver classes.
 *
 * V1 algorithm:
 *  1. Resolve identity (StudentIdentityResolver).
 *  2. Resolve month range from request (MonthRange::fromXxx).
 *  3. For each requested division:
 *     a. Determine section IDs for that division.
 *     b. Build attendance summary (AttendanceResolver).
 *     c. Build fee summary (FeeResolver).
 *     d. Build calendar (CalendarBuilder) using attendance rows for that division.
 *     e. If Kirtan: compute Kirtan score from attendance counts + lessons_learned.
 *  4. Return StudentReport.
 */
final class StudentReportService
{
    public function __construct(
        private readonly StudentIdentityResolver $identityResolver,
        private readonly AttendanceResolver $attendanceResolver,
        private readonly FeeResolver $feeResolver,
        private readonly CalendarBuilder $calendarBuilder,
        private readonly KirtanScoreCalculator $kirtanScoreCalculator,
        private readonly StudentReportCache $cache,
    ) {}

    public function build(StudentReportRequest $req): StudentReport
    {
        return $this->cache->remember($req, function () use ($req) {
            $identity = $this->identityResolver->resolve($req->studentId);
            $range = $req->resolveRange();

            // Determine range start/end as date strings for SQL.
            $startMonth = $range->startLabel;
            $endMonth = $range->endLabel;
            $startDate = $startMonth . '-01';
            $endDate = Carbon::createFromFormat('Y-m', $endMonth)->endOfMonth()->toDateString();

            // Group section IDs by division from the identity.
            $sectionsByDivision = [
                Division::Gurmukhi->value => [],
                Division::Kirtan->value => [],
            ];
            foreach ($identity->enrollments as $e) {
                $sectionsByDivision[$e->division->value][] = $e->studentSectionId;
            }

            $divisions = [];

            if ($req->wantsGurmukhi()) {
                $divisions['gurmukhi'] = $this->buildDivisionReport(
                    Division::Gurmukhi,
                    $sectionsByDivision[Division::Gurmukhi->value],
                    $startMonth, $endMonth, $startDate, $endDate,
                );
            }
            if ($req->wantsKirtan()) {
                $divisions['kirtan'] = $this->buildDivisionReport(
                    Division::Kirtan,
                    $sectionsByDivision[Division::Kirtan->value],
                    $startMonth, $endMonth, $startDate, $endDate,
                );
            }

            $meta = new StudentReportMeta(
                reportType: 'performance',
                generatedAt: now()->toDateTimeString(),
                rangeMode: $req->rangeMode,
                rangeLabel: $this->rangeLabel($req, $range),
            );

            return new StudentReport(
                identity: $identity,
                range: $range,
                divisions: $divisions,
                meta: $meta,
            );
        });
    }

    /**
     * @param  list<int>  $sectionIds
     */
    private function buildDivisionReport(
        Division $division,
        array $sectionIds,
        string $startMonth,
        string $endMonth,
        string $startDate,
        string $endDate,
    ): DivisionReport {
        $enrolled = !empty($sectionIds);

        if (!$enrolled) {
            return new DivisionReport(
                division: $division,
                enrolled: false,
                attendance: new AttendanceSummary(0, 0, 0, 0, 0.0, null, null),
                fees: new FeeSummary(0, 0, 0, 0, null, [], []),
                kirtanScore: null,
                months: [],
            );
        }

        $attendance = $this->attendanceResolver->resolve($sectionIds, $startDate, $endDate);
        $fees = $this->feeResolver->resolve($sectionIds, $startMonth, $endMonth);

        // Build the calendar: load attendance rows, hand to builder.
        $attendanceRows = DB::table('attendance')
            ->whereIn('student_section_id', $sectionIds)
            ->whereBetween('date', [$startDate, $endDate])
            ->get(['student_section_id', 'date', 'status', 'lesson_learned']);

        // We need a MonthRange here, but we only have start/end labels and
        // total months. Re-expand it.
        $range = \App\Support\StudentReport\MonthRange::forRange($startMonth, $endMonth);
        $months = $this->calendarBuilder->build(
            range: $range,
            attendanceRows: $attendanceRows->all(),
            division: $division,
            divisionSectionIds: $sectionIds,
        );

        $kirtanScore = null;
        if ($division === Division::Kirtan) {
            $lessonsLearned = $this->sumLessons($attendanceRows);
            $kirtanScore = $this->kirtanScoreCalculator->compute(
                present: $attendance->present,
                absent: $attendance->absent,
                leave: $attendance->leave,
                lessonsLearned: $lessonsLearned,
            );
        }

        return new DivisionReport(
            division: $division,
            enrolled: true,
            attendance: $attendance,
            fees: $fees,
            kirtanScore: $kirtanScore,
            months: $months,
        );
    }

    private function sumLessons(iterable $rows): int
    {
        $count = 0;
        $seen = []; // dedupe by date (per-day lesson counts once)
        foreach ($rows as $r) {
            $date = (string) $r->date;
            if (isset($seen[$date])) continue;
            if ((int) ($r->lesson_learned ?? 0) === 1) {
                $count++;
                $seen[$date] = true;
            }
        }
        return $count;
    }

    private function rangeLabel(StudentReportRequest $req, MonthRange $range): string
    {
        return match ($req->rangeMode) {
            StudentReportRequest::RANGE_ACADEMIC_SESSION
                => \App\Support\StudentReport\AcademicSession::label((int) $req->singleYear)
                   . ' (' . $range->startLabel . ' → ' . $range->endLabel . ')',
            StudentReportRequest::RANGE_CALENDAR_YEAR
                => 'Calendar Year ' . $req->singleYear,
            StudentReportRequest::RANGE_MONTH
                => $range->startLabel,
            StudentReportRequest::RANGE_RANGE
                => $range->startLabel . ' → ' . $range->endLabel,
        };
    }
}
