<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\AttendanceSummary;
use App\Support\StudentReport\DivisionReport;
use App\Support\StudentReport\EnrollmentHistory;
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
 * Algorithm:
 *  1. Resolve identity (StudentIdentityResolver) — loads ALL enrollments.
 *  2. Resolve month range from request (MonthRange::fromXxx).
 *  3. Group CLASS IDs (not section IDs) by division from ALL enrollments.
 *  4. For each requested division:
 *     a. Build attendance summary via AttendanceResolver (student_id + class_ids).
 *     b. Build fee summary via FeeResolver (student_id + class_ids).
 *     c. Build calendar (CalendarBuilder) using pre-filtered attendance rows.
 *     d. If Kirtan: compute Kirtan score from attendance + lessons.
 *  5. Load history timeline (all enrollments with rolled-up stats).
 *  6. Return StudentReport.
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

            // Group CLASS IDs (not student_section_ids) by division from
            // ALL enrollments — this captures fees/attendance even from
            // archived (section-changed) enrollments.
            $classIdsByDivision = [
                'gurmukhi' => [],
                'kirtan' => [],
            ];
            foreach ($identity->enrollments as $e) {
                // Division is an open string (Stage A3). A third+ division key
                // auto-creates and is simply never built for today's two-key
                // request, until a stage wires it in.
                $classIdsByDivision[$e->division][] = $e->classId;
            }
            // Deduplicate — many enrollments may share the same class_id.
            $classIdsByDivision = array_map(fn ($ids) => array_values(array_unique($ids)), $classIdsByDivision);

            $divisions = [];

            if ($req->wantsGurmukhi()) {
                $divisions['gurmukhi'] = $this->buildDivisionReport(
                    'gurmukhi',
                    $identity->id,
                    $classIdsByDivision['gurmukhi'],
                    $startMonth, $endMonth, $startDate, $endDate,
                );
            }
            if ($req->wantsKirtan()) {
                $divisions['kirtan'] = $this->buildDivisionReport(
                    'kirtan',
                    $identity->id,
                    $classIdsByDivision['kirtan'],
                    $startMonth, $endMonth, $startDate, $endDate,
                );
            }

            // Load history timeline — all enrollments with rolled-up stats,
            // independent of the selected date range.
            $history = $this->loadHistory($req->studentId);

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
                history: $history,
            );
        });
    }

    /**
     * @param  list<int>  $classIds  class_ids for this division
     */
    private function buildDivisionReport(
        string $division, // open division key (Stage A3)
        int $studentId,
        array $classIds,
        string $startMonth,
        string $endMonth,
        string $startDate,
        string $endDate,
    ): DivisionReport {
        $enrolled = !empty($classIds);

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

        $attendance = $this->attendanceResolver->resolve($studentId, $classIds, $startDate, $endDate);
        $fees = $this->feeResolver->resolve($studentId, $classIds, $startMonth, $endMonth);

        // Load attendance rows pre-filtered to this division's class_ids.
        $attendanceRows = DB::table('attendance')
            ->join('student_sections', 'attendance.student_section_id', '=', 'student_sections.id')
            ->where('attendance.student_id', $studentId)
            ->whereIn('student_sections.class_id', $classIds)
            ->whereBetween('attendance.date', [$startDate, $endDate])
            ->get(['attendance.student_section_id', 'attendance.date', 'attendance.status', 'attendance.lesson_learned']);

        $range = \App\Support\StudentReport\MonthRange::forRange($startMonth, $endMonth);
        $months = $this->calendarBuilder->build(
            range: $range,
            attendanceRows: $attendanceRows->all(),
            division: $division,
        );

        $kirtanScore = null;
        if ($division === 'kirtan') {
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

    /**
     * Load all enrollments with rolled-up attendance and fee stats for the
     * history timeline (shown regardless of the selected date range).
     *
     * @return list<EnrollmentHistory>
     */
    private function loadHistory(int $studentId): array
    {
        $enrollments = \App\Models\StudentSection::where('student_id', $studentId)
            ->with(['schoolClass', 'section', 'attendance', 'fees.payments'])
            ->orderBy('started_at')
            ->get();

        return $enrollments->map(fn ($e) => new EnrollmentHistory(
            id: $e->id,
            className: $e->schoolClass->name,
            sectionName: $e->section->name,
            startedAt: $e->started_at?->toDateString(),
            transferredAt: $e->transferred_at?->toDateString(),
            outcome: $e->outcome,
            status: $e->status,
            present: $e->attendance->where('status', 'present')->count(),
            absent: $e->attendance->where('status', 'absent')->count(),
            leave: $e->attendance->where('status', 'leave')->count(),
            feesCharged: (int) $e->fees->sum('amount'),
            feesPaid: (int) $e->fees->filter(fn ($f) => $f->payments->whereNull('deleted_at')->isNotEmpty())->sum('amount'),
        ))->all();
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
