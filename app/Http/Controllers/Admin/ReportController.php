<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Barryvdh\DomPDF\Facade\Pdf;


class ReportController extends Controller
{
    /* =========================================================
     | ENTRY POINT
     ========================================================= */
    public function build(Request $request)
    {

        $request->headers->set('Accept', 'application/json');

        /* ===============================
       BASE VALIDATION
    ================================ */
        $request->validate([
            'report' => 'required|string',
        ]);

        /* ===============================
       REPORT-SPECIFIC VALIDATION
    ================================ */
        if (in_array($request->report, ['fees', 'attendance'])) {
            $request->validate([
                'class_ids'   => 'required|array|min:1',
                'section_ids' => 'array',
                'student_ids' => 'array',
                'paid_status' => 'array',

                // attendance specific
                'status'      => 'array',

                // Legacy single value filters
                'month'       => 'nullable|string', // YYYY-MM
                'year'        => 'nullable|integer',

                // New date range filters
                'year_from'   => 'nullable|integer',
                'year_to'     => 'nullable|integer',
                'month_from'  => 'nullable|string|date_format:Y-m',
                'month_to'    => 'nullable|string|date_format:Y-m',
            ]);
        }

        /* ===============================
       DISPATCH REPORT
    ================================ */
        return match ($request->report) {

            /* ==============================
           FEES REPORT
        =============================== */
            'fees' => response()->json(
                $this->buildFeesReport($request)
            ),

            /* ==============================
           ATTENDANCE REPORT
        =============================== */
            'attendance' => response()->json(
                $request->view === 'calendar'
                    ? $this->buildAttendanceCalendar($request)
                    : $this->buildAttendanceReport($request)
            ),

            // 'student' was removed in V1 of the Student Report Center.
            // The new path is POST /admin/student-report-center/build.

            default => abort(400, 'Unsupported report type'),
        };
    }





    /* =========================================================
     | FEES REPORT ENGINE (SINGLE SOURCE OF TRUTH)
     ========================================================= */
    private function buildFeesReport(Request $request): array
    {
        /* -------------------------------------------------
           BASE QUERY
        ------------------------------------------------- */
        $baseQuery = DB::table('fees')
            ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->where('student_sections.status', 'active')
            ->whereNull('student_sections.transferred_at')
            ->whereIn('student_sections.class_id', $request->class_ids);

        /* -------------------------------------------------
           DATE RANGE FILTER
           Supports:
             - Legacy: year (int) + month (YYYY-MM)
             - New:    year_from / year_to (int)
             - New:    month_from / month_to (YYYY-MM)

           The month_from/month_to range is the most granular
           filter and takes precedence. If only year_from/year_to
           are set, we filter all monthly fees whose month falls
           within the year range. Custom fees are always included.
        ------------------------------------------------- */
        $monthFrom = $request->input('month_from');
        $monthTo   = $request->input('month_to');
        $yearFrom  = $request->input('year_from');
        $yearTo    = $request->input('year_to');

        // Build the actual month range boundaries.
        // Priority: explicit month > year fallback > legacy year param.
        $start = null;
        $end   = null;

        if (!empty($monthFrom) || !empty($monthTo)) {
            // Explicit month_from / month_to takes precedence.
            $start = $monthFrom ?: ($yearFrom ? "{$yearFrom}-01" : null);
            $end   = $monthTo   ?: ($yearTo   ? "{$yearTo}-12"   : null);
        } elseif (!empty($yearFrom) || !empty($yearTo)) {
            // Only year_from / year_to: cover full year range.
            $start = $yearFrom ? "{$yearFrom}-01" : null;
            $end   = $yearTo   ? "{$yearTo}-12"   : null;
        } elseif ($request->filled('year')) {
            // Legacy single year.
            $start = "{$request->year}-01";
            $end   = "{$request->year}-12";
        }

        if ($request->filled('month')) {
            // Legacy single month overrides everything.
            $start = $request->month;
            $end   = $request->month;
        }

        // Apply the filter if we have any boundaries.
        if (!empty($start) || !empty($end)) {
            $baseQuery->where(function ($q) use ($start, $end) {
                $q->where(function ($q2) use ($start, $end) {
                    $q2->where('fees.type', 'monthly');
                    if (!empty($start)) {
                        $q2->where('fees.month', '>=', $start);
                    }
                    if (!empty($end)) {
                        $q2->where('fees.month', '<=', $end);
                    }
                })->orWhere('fees.type', 'custom');
            });
        }


        /* -------------------------------------------------
           OPTIONAL FILTERS
        ------------------------------------------------- */
        if (!empty($request->section_ids)) {
            $baseQuery->whereIn('student_sections.section_id', $request->section_ids);
        }

        if (!empty($request->student_ids)) {
            $baseQuery->whereIn('students.id', $request->student_ids);
        }

        if (!empty($request->paid_status) && count($request->paid_status) === 1) {
            $request->paid_status[0] === 'paid'
                ? $baseQuery->whereNotNull('payments.id')
                : $baseQuery->whereNull('payments.id');
        }

        /* -------------------------------------------------
           SUMMARY (KPIs)
        ------------------------------------------------- */
        $summaryRaw = (clone $baseQuery)
            ->selectRaw('
                COUNT(DISTINCT students.id) as total_students,
                COUNT(DISTINCT CASE WHEN payments.id IS NOT NULL THEN students.id END) as paid_students,
                COUNT(DISTINCT CASE WHEN payments.id IS NULL THEN students.id END) as unpaid_students,
                SUM(fees.amount) as total_fees,
                SUM(CASE WHEN payments.id IS NOT NULL THEN fees.amount ELSE 0 END) as total_collected
            ')
            ->first();

        $summary = [
            'total_students'        => (int) $summaryRaw->total_students,
            'paid_students'         => (int) $summaryRaw->paid_students,
            'unpaid_students'       => (int) $summaryRaw->unpaid_students,
            'total_fees'            => (int) $summaryRaw->total_fees,
            'total_collected'       => (int) $summaryRaw->total_collected,
            'total_pending'         => (int) ($summaryRaw->total_fees - $summaryRaw->total_collected),
            'collection_percentage' => $summaryRaw->total_fees > 0
                ? round(($summaryRaw->total_collected / $summaryRaw->total_fees) * 100, 2)
                : 0,
        ];

        /* -------------------------------------------------
           BREAKDOWN — BY CLASS
        ------------------------------------------------- */
        $byClass = (clone $baseQuery)
            ->selectRaw('
                classes.name as class_name,
                SUM(fees.amount) as total,
                SUM(CASE WHEN payments.id IS NOT NULL THEN fees.amount ELSE 0 END) as collected
            ')
            ->groupBy('classes.id', 'classes.name')
            ->orderBy('classes.name')
            ->get()
            ->map(fn($row) => [
                'class'      => $row->class_name,
                'total'      => (int) $row->total,
                'collected'  => (int) $row->collected,
                'pending'    => (int) ($row->total - $row->collected),
                'percentage' => $row->total > 0
                    ? round(($row->collected / $row->total) * 100, 2)
                    : 0,
            ]);

        $paidStudents = (clone $baseQuery)
            ->whereNotNull('payments.id')
            ->select(
                'students.name as student_name',
                'fees.title as fee_title',
                'fees.amount'
            )
            ->get();

        $unpaidStudents = (clone $baseQuery)
            ->whereNull('payments.id')
            ->select(
                'students.name as student_name',
                'fees.title as fee_title',
                'fees.amount'
            )
            ->get();

        /* -------------------------------------------------
           TABLE DATA (DETAILED ROWS)
        ------------------------------------------------- */
        $rows = (clone $baseQuery)
            ->select(
                'students.name as student_name',
                'students.father_name as father_name',
                'classes.name as class_name',
                'sections.name as section_name',
                'fees.title as fee_title',
                'fees.type as fee_type',
                'fees.month',
                'fees.amount',
                DB::raw('payments.id IS NOT NULL as is_paid')
            )
            ->orderBy('students.name')
            ->get()
            ->map(function ($row) {
                // Normalize to boolean for JS (avoid "0" string truthiness)
                $row->is_paid = (bool) $row->is_paid;
                return $row;
            });

        return [
            'meta' => [
                'report'       => 'fees',
                'generated_at' => now()->toDateTimeString(),
            ],

            'summary' => $summary,

            'breakdowns' => [
                'by_class' => $byClass,
            ],

            'tables' => [
                'rows' => $rows,
                'paid_students' => $paidStudents,
                'unpaid_students' => $unpaidStudents,
            ],
        ];
    }

    /* =========================================================
     | CSV EXPORT (USES SAME REPORT ENGINE)
     ========================================================= */
    public function exportCsv(Request $request)
    {
        $request->validate([
            'class_ids'   => 'required|array|min:1',
            'section_ids' => 'array',
            'student_ids' => 'array',
            'paid_status' => 'array',
            'month'       => 'nullable|string',
            'year'        => 'nullable|integer',
            'year_from'   => 'nullable|integer',
            'year_to'     => 'nullable|integer',
            'month_from'  => 'nullable|string',
            'month_to'    => 'nullable|string',
        ]);

        $report = match ($request->report) {
            'fees' => $this->buildFeesReport($request),
            'attendance' => $this->buildAttendanceReport($request),
            default => abort(400),
        };
        $rows   = collect($report['tables']['rows']);

        return new StreamedResponse(function () use ($rows) {
            $handle = fopen('php://output', 'w');

            if ($rows->isEmpty()) {
                fclose($handle);
                return;
            }

            /* ------------------------------------
           CSV HEADERS (HUMAN FRIENDLY)
        ------------------------------------ */
            fputcsv($handle, [
                'Student Name',
                'Father Name',
                'Class',
                'Section',
                'Fee Title',
                'Month',
                'Amount (PKR)',
                'Paid Status',
            ]);

            /* ------------------------------------
           CSV ROWS (FORMATTED)
        ------------------------------------ */
            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->student_name,
                    $row->father_name,
                    $row->class_name,
                    $row->section_name,
                    $row->fee_title,
                    $row->month
                        ? \Carbon\Carbon::createFromFormat('Y-m', $row->month)->format('F Y')
                        : '',
                    $row->amount,
                    $row->is_paid ? 'Paid' : 'Unpaid',
                ]);
            }

            fclose($handle);
        }, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename=fees-report.csv',
        ]);
    }

    public function exportPdf(Request $request)
    {
        $request->validate([
            'report' => 'required|string',
        ]);

        if (in_array($request->report, ['fees', 'attendance'])) {
            $request->validate([
                'class_ids'   => 'required|array|min:1',
                'section_ids' => 'array',
                'student_ids' => 'array',
                'paid_status' => 'array',
                'status'      => 'array',
                'month'       => 'nullable|string',
                'year'        => 'nullable|integer',
                'year_from'   => 'nullable|integer',
                'year_to'     => 'nullable|integer',
                'month_from'  => 'nullable|string',
                'month_to'    => 'nullable|string',
            ]);
        }

        /* -------------------------------
       BUILD REPORT
    -------------------------------- */
        $report = match ($request->report) {
            'fees'       => $this->buildFeesReport($request),
            'attendance' => $this->buildAttendanceReport($request),
            // 'student' was removed in V1 of the Student Report Center.
            // The new path is POST /admin/student-report-center/export/pdf.
            default      => abort(400, 'Unsupported report type'),
        };

        /* -------------------------------
       VIEW SELECTION
    -------------------------------- */
        $view = match ($request->report) {
            'fees'       => 'reports.fees',
            'attendance' => 'reports.attendance',
        };

        if (isset($report['tables']['rows'])) {
            $report['rows'] = $report['tables']['rows'];
        }

        $pdf = Pdf::loadView($view, $report)
            ->setPaper('a4', 'portrait');

        return $pdf->stream("{$request->report}-report.pdf");
    }



    private function buildAttendanceReport(Request $request): array
    {
        /* -------------------------------
       BASE QUERY (CORRECT TABLE)
    -------------------------------- */
        $query = DB::table('attendance')
            ->join('student_sections', 'attendance.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->where('student_sections.status', 'active')
            ->whereNull('student_sections.transferred_at')
            ->whereIn('student_sections.class_id', $request->class_ids);

        /* -------------------------------
       OPTIONAL FILTERS
    -------------------------------- */
        if (!empty($request->section_ids)) {
            $query->whereIn('student_sections.section_id', $request->section_ids);
        }

        if (!empty($request->student_ids)) {
            $query->whereIn('students.id', $request->student_ids);
        }

        if (!empty($request->status)) {
            $query->whereIn('attendance.status', $request->status);
        }

        /* -------------------------------------------------
           DATE RANGE FILTER (matches fees report pattern)
        ------------------------------------------------- */
        $monthFrom = $request->input('month_from');
        $monthTo   = $request->input('month_to');
        $yearFrom  = $request->input('year_from');
        $yearTo    = $request->input('year_to');

        $dateStart = null;
        $dateEnd   = null;

        if (!empty($monthFrom) || !empty($monthTo)) {
            // month_from and month_to are YYYY-MM. Append day so MySQL can compare.
            $dateStart = $monthFrom ? "{$monthFrom}-01" : ($yearFrom ? "{$yearFrom}-01-01" : null);
            $dateEnd   = $monthTo   ? "{$monthTo}-01"   : ($yearTo   ? "{$yearTo}-12-31"   : null);
            // Shift to end-of-month for the "to" date so the full month is included.
            if ($monthTo) {
                $dateEnd = \Carbon\Carbon::createFromFormat('Y-m-d', $dateEnd)->endOfMonth()->toDateString();
            }
        } elseif (!empty($yearFrom) || !empty($yearTo)) {
            $dateStart = $yearFrom ? "{$yearFrom}-01-01" : null;
            $dateEnd   = $yearTo   ? "{$yearTo}-12-31"   : null;
        } elseif ($request->filled('year')) {
            $dateStart = "{$request->year}-01-01";
            $dateEnd   = "{$request->year}-12-31";
        }

        if (!empty($dateStart)) {
            $query->where('attendance.date', '>=', $dateStart);
        }
        if (!empty($dateEnd)) {
            $query->where('attendance.date', '<=', $dateEnd);
        }

        if ($request->filled('month')) {
            $query->whereMonth('attendance.date', substr($request->month, 5, 2));
        }

        /* -------------------------------
           COMPUTE CALENDAR STATS
        -------------------------------- */
        $totalDays = 0;
        $workingDays = 0;

        if (!empty($dateStart) && !empty($dateEnd)) {
            $startDt = \Carbon\Carbon::parse($dateStart);
            $endDt   = \Carbon\Carbon::parse($dateEnd);
            $totalDays = (int) $startDt->diffInDays($endDt) + 1;

            // Working days = Mon-Sat (school default). Kirtan-only reports
            // would use Sunday-only, but since a report can span multiple
            // classes we default to the Gurmukhi (majority) calendar.
            for ($d = $startDt->copy(); $d->lte($endDt); $d->addDay()) {
                if ($d->dayOfWeek !== \Carbon\Carbon::SUNDAY) {
                    $workingDays++;
                }
            }
        }

        // Compute month count for the range label
        $monthCount = 0;
        if (!empty($dateStart) && !empty($dateEnd)) {
            $sd = \Carbon\Carbon::parse($dateStart);
            $ed = \Carbon\Carbon::parse($dateEnd);
            $monthCount = ((int) $ed->year - (int) $sd->year) * 12
                        + ((int) $ed->month - (int) $sd->month)
                        + 1;
        }

        /* -------------------------------
       SUMMARY (MYSQL SAFE)
    -------------------------------- */
        $summaryRaw = (clone $query)
            ->selectRaw('
            COUNT(*) as total_records,
            SUM(CASE WHEN attendance.status = "present" THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN attendance.status = "absent" THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN attendance.status = "leave" THEN 1 ELSE 0 END) as `leave`
        ')
            ->first();

        $total = (int) $summaryRaw->total_records;

        $summary = [
            'total_records' => $total,
            'present'       => (int) $summaryRaw->present,
            'absent'        => (int) $summaryRaw->absent,
            'leave'         => (int) $summaryRaw->leave,
            'attendance_percentage' => $total > 0
                ? round(($summaryRaw->present / $total) * 100, 2)
                : 0,
            'student_count'  => 0,
            'total_days'     => $totalDays,
            'working_days'   => $workingDays,
            'total_months'   => $monthCount,
        ];

        /* -------------------------------
       BREAKDOWN — BY CLASS
    -------------------------------- */
        $byClass = (clone $query)
            ->selectRaw('
            classes.name as class_name,
            COUNT(*) as total,
            SUM(CASE WHEN attendance.status = "present" THEN 1 ELSE 0 END) as present
        ')
            ->groupBy('classes.id', 'classes.name')
            ->orderBy('classes.name')
            ->get()
            ->map(fn($row) => [
                'class'       => $row->class_name,
                'total'       => (int) $row->total,
                'present'     => (int) $row->present,
                'percentage'  => $row->total > 0
                    ? round(($row->present / $row->total) * 100, 2)
                    : 0,
            ]);

        /* -------------------------------
       PER-STUDENT SUMMARY
    -------------------------------- */
        $studentsSummary = (clone $query)
            ->select(
                'students.id as student_id',
                'students.name as student_name',
                'students.father_name',
                'classes.name as class_name',
                'sections.name as section_name',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) as present"),
                DB::raw("SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) as absent"),
                DB::raw("SUM(CASE WHEN attendance.status = 'leave' THEN 1 ELSE 0 END) as `leave`"),
            )
            ->groupBy('students.id', 'students.name', 'students.father_name', 'classes.name', 'sections.name')
            ->orderBy('students.name')
            ->get()
            ->map(fn($row) => [
                'student_id'   => (int) $row->student_id,
                'student_name' => $row->student_name,
                'father_name'  => $row->father_name,
                'class_name'   => $row->class_name,
                'section_name' => $row->section_name,
                'present'      => (int) $row->present,
                'absent'       => (int) $row->absent,
                'leave'        => (int) $row->leave,
                'total'        => (int) $row->total,
                'percentage'   => $row->total > 0
                    ? round(((int) $row->present / (int) $row->total) * 100, 2)
                    : 0,
            ]);

        $summary['student_count'] = $studentsSummary->count();

        /* -------------------------------
       TOP ABSENTEES (WORST 20)
    -------------------------------- */
        $topAbsentees = $studentsSummary
            ->sortByDesc('absent')
            ->take(20)
            ->values()
            ->all();

        /* -------------------------------
       TABLE ROWS (RAW DETAIL)
    -------------------------------- */
        $rows = (clone $query)
            ->select(
                'students.name as student_name',
                'students.father_name',
                'classes.name as class_name',
                'sections.name as section_name',
                'attendance.date',
                'attendance.status',
                'attendance.lesson_learned'
            )
            ->orderBy('attendance.date')
            ->orderBy('students.name')
            ->get();

        return [
            'meta' => [
                'report'       => 'attendance',
                'generated_at' => now()->toDateTimeString(),
            ],

            'summary' => $summary,

            'breakdowns' => [
                'by_class' => $byClass,
            ],

            'tables' => [
                'rows' => $rows,
            ],

            'students' => $studentsSummary->all(),
            'top_absentees' => $topAbsentees,
        ];
    }


    private function buildAttendanceCalendar(Request $request): array
    {
        $year  = (int) ($request->year ?? now()->year);
        $month = (int) ($request->month ?? now()->month);

        $start = \Carbon\Carbon::create($year, $month, 1);
        $end   = $start->copy()->endOfMonth();

        /* ----------------------------
       DAYS
    ----------------------------- */
        $days = [];
        for ($d = $start->copy(); $d <= $end; $d->addDay()) {
            $days[] = [
                'date' => $d->toDateString(),
                'day'  => $d->format('d'),
            ];
        }

        /* ----------------------------
       STUDENTS
    ----------------------------- */
        $students = DB::table('student_sections')
            ->join('students', 'students.id', '=', 'student_sections.student_id')
            ->whereIn('student_sections.class_id', $request->class_ids)
            ->when(
                $request->section_ids,
                fn($q) =>
                $q->whereIn('student_sections.section_id', $request->section_ids)
            )
            ->select(
                'students.id',
                'students.name',
                'students.father_name',
                'student_sections.id as student_section_id'
            )
            ->orderBy('students.name')
            ->get();


        /* ----------------------------
       ATTENDANCE RECORDS
    ----------------------------- */
        $records = DB::table('attendance')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->whereIn(
                'student_section_id',
                DB::table('student_sections')
                    ->whereIn('class_id', $request->class_ids)
                    ->pluck('id')
            )
            ->get()
            ->groupBy(fn($r) => "{$r->student_section_id}-{$r->date}");

        /* ----------------------------
       MAP STUDENTS
    ----------------------------- */
        $students = $students->map(function ($s) use ($days, $records) {
            $studentDays = [];

            foreach ($days as $day) {
                $key = "{$s->student_section_id}-{$day['date']}";
                $studentDays[$day['date']] = [
                    'status' => $records[$key][0]->status ?? null,
                    'lesson_learned' => $records[$key][0]->lesson_learned ?? null,
                ];
            }

            return [
                'id'        => $s->id,
                'name'      => $s->name,
                'father_name' => $s->father_name,
                'records'   => $studentDays,
            ];
        });

        return [
            'meta' => [
                'view' => 'calendar',
                'month' => $start->format('F Y'),
            ],
            'calendar' => [
                'days'     => $days,
                'students' => $students,
            ],
        ];
    }
}
