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
                'month'       => 'nullable|string', // YYYY-MM
                'year'        => 'nullable|integer',
            ]);
        }

        if ($request->report === 'student') {
            $request->validate([
                'student_id' => 'required|integer|exists:students,id',
                'year'       => 'required|integer',
                'month_from' => 'nullable|date_format:Y-m',
                'month_to'   => 'nullable|date_format:Y-m',

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

            /* ==============================
           STUDENT PERFORMA
        =============================== */
            'student' => response()->json(
                $this->buildStudentReport($request)
            ),

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
            ->whereIn('student_sections.class_id', $request->class_ids);
        // year filter

        if ($request->filled('year')) {
            $baseQuery->where(function ($q) use ($request) {
                $q->where(function ($q2) use ($request) {
                    $q2->where('fees.type', 'monthly')
                        ->where('fees.month', 'like', $request->year . '-%');
                })->orWhere('fees.type', 'custom');
            });
        }


        //month filter
        if ($request->filled('month')) {
            $baseQuery->where(function ($q) use ($request) {
                $q->where(function ($q2) use ($request) {
                    $q2->where('fees.type', 'monthly')
                        ->where('fees.month', $request->month);
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

        if ($request->report === 'student') {
            $request->validate([
                'student_id' => 'required|integer|exists:students,id',
                'year'       => 'required|integer',
                'month_from' => 'nullable|date_format:Y-m',
                'month_to'   => 'nullable|date_format:Y-m',
            ]);
        }

        if (in_array($request->report, ['fees', 'attendance'])) {
            $request->validate([
                'class_ids'   => 'required|array|min:1',
                'section_ids' => 'array',
                'student_ids' => 'array',
                'paid_status' => 'array',
                'status'      => 'array',
                'month'       => 'nullable|string',
                'year'        => 'nullable|integer',
            ]);
        }

        /* -------------------------------
       BUILD REPORT
    -------------------------------- */
        $report = match ($request->report) {
            'fees'       => $this->buildFeesReport($request),
            'attendance' => $this->buildAttendanceReport($request),
            'student'    => $this->buildStudentReport($request),
            default      => abort(400, 'Unsupported report type'),
        };

        /* -------------------------------
       VIEW SELECTION
    -------------------------------- */
        $view = match ($request->report) {
            'fees'       => 'reports.fees',
            'attendance' => 'reports.attendance',
            'student'    => 'reports.student',
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

        if ($request->filled('year')) {
            $query->whereYear('attendance.date', $request->year);
        }

        if ($request->filled('month')) {
            $query->whereMonth('attendance.date', substr($request->month, 5, 2));
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
       TABLE ROWS
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

    private function buildStudentReport(Request $request): array
{
    logger()->info('STUDENT REPORT REQUEST', [
        'student_id' => $request->student_id,
        'year'       => $request->year,
        'month_from' => $request->month_from,
        'month_to'   => $request->month_to,
    ]);

    /* ===============================
       VALIDATION
    ================================ */
    $request->validate([
        'student_id' => 'required|integer|exists:students,id',
        'year'       => 'required|integer',
        'month_from' => 'nullable|string',
        'month_to'   => 'nullable|string',
    ]);

    if ($request->month_from && $request->month_to && $request->month_from > $request->month_to) {
        abort(422, 'Invalid month range');
    }

    /* ===============================
       STUDENT
    ================================ */
    $student = DB::table('students')
        ->where('id', $request->student_id)
        ->first();

    /* ===============================
       STUDENT SECTIONS (CASE SAFE)
    ================================ */
    $sections = DB::table('student_sections')
        ->join('classes', 'classes.id', '=', 'student_sections.class_id')
        ->where('student_sections.student_id', $request->student_id)
        ->select(
            'student_sections.id as student_section_id',
            DB::raw('LOWER(classes.type) as class_type')
        )
        ->get();

    /* ===============================
       SPLIT BY TYPE
    ================================ */
    $gurmukhiSections = $sections
        ->where('class_type', '!=', 'kirtan')
        ->pluck('student_section_id')
        ->values();

    $kirtanSections = $sections
        ->where('class_type', 'kirtan')
        ->pluck('student_section_id')
        ->values();

    logger()->info('STUDENT SECTIONS DEBUG', [
        'student_id' => $student->id,
        'gurmukhi_section_ids' => $gurmukhiSections->all(),
        'kirtan_section_ids'   => $kirtanSections->all(),
    ]);

    /* ===============================
       YEAR RANGE (STRING BASED)
    ================================ */
    $year = (int) $request->year;
    $yearStart = "{$year}-01";
    $yearEnd   = "{$year}-12";

    /* ===============================
       FEES BUILDER (MATCHES FeesController)
    ================================ */
    $buildFees = function ($sectionIds) use ($year, $yearStart, $yearEnd, $request) {

        if ($sectionIds->isEmpty()) {
            return [
                'summary' => ['total' => 0, 'paid' => 0, 'pending' => 0],
                'rows' => collect(),
            ];
        }

        $query = DB::table('fees')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                     ->whereNull('payments.deleted_at');
            })
            ->whereIn('fees.student_section_id', $sectionIds)
            ->where(function ($q) use ($year) {
                $q->where(function ($qq) use ($year) {
                    $qq->where('fees.type', 'monthly')
                       ->where('fees.month', 'like', $year . '-%');
                })
                ->orWhere('fees.type', 'custom');
            });

        // OPTIONAL month range filters (non-breaking)
        if ($request->month_from) {
            $query->where('fees.month', '>=', $request->month_from);
        }
        if ($request->month_to) {
            $query->where('fees.month', '<=', $request->month_to);
        }

        $rows = $query
            ->select(
                'fees.id',
                'fees.title',
                'fees.type',
                'fees.month',
                'fees.amount',
                DB::raw('payments.id IS NOT NULL as is_paid')
            )
            ->orderByRaw('fees.month IS NULL')
            ->orderBy('fees.month')
            ->get();

        logger()->info('FEES QUERY RESULT', [
            'section_ids' => $sectionIds->values(),
            'count' => $rows->count(),
            'rows' => $rows->map(fn ($r) => [
                'type'   => $r->type,
                'month'  => $r->month,
                'amount'=> $r->amount,
                'paid'  => (bool) $r->is_paid,
            ]),
        ]);

        return [
            'summary' => [
                'total'   => (int) $rows->sum('amount'),
                'paid'    => (int) $rows->where('is_paid', true)->sum('amount'),
                'pending' => (int) $rows->where('is_paid', false)->sum('amount'),
            ],
            'rows' => $rows,
        ];
    };

    /* ===============================
       ATTENDANCE BUILDER
    ================================ */
    $attendanceStart = "{$year}-01-01";
    $attendanceEnd   = "{$year}-12-31";

    $buildAttendance = function ($studentSectionIds) use ($year, $attendanceStart, $attendanceEnd) {

        if ($studentSectionIds->isEmpty()) {
            return [
                'months' => [],
                'calendar' => [],
                'summary' => [
                    'present' => 0,
                    'absent' => 0,
                    'leave' => 0,
                    'percentage' => 0,
                ],
            ];
        }

        $records = DB::table('attendance')
            ->whereIn('student_section_id', $studentSectionIds)
            ->whereBetween('date', [$attendanceStart, $attendanceEnd])
            ->select('student_section_id', 'date', 'status', 'lesson_learned')
            ->get()
            ->groupBy(fn ($r) => "{$r->student_section_id}|{$r->date}");

        $calendar = [];
        $monthsSummary = [];

        for ($m = 1; $m <= 12; $m++) {
            $monthName = \Carbon\Carbon::create($year, $m, 1)->format('F');
            $daysInMonth = \Carbon\Carbon::create($year, $m, 1)->daysInMonth;

            $monthsSummary[$monthName] = [
                'present' => 0,
                'absent' => 0,
                'leave' => 0,
                'lessons_learned' => 0,
            ];

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $date = \Carbon\Carbon::create($year, $m, $d)->toDateString();
                $dayRecords = collect();

                foreach ($studentSectionIds as $sid) {
                    $key = "{$sid}|{$date}";
                    if (isset($records[$key])) {
                        $dayRecords = $dayRecords->merge($records[$key]);
                    }
                }

                $statuses = $dayRecords->pluck('status')->filter()->map(fn ($s) => strtolower($s));

                $status =
                    $statuses->contains('present') ? 'present'
                    : ($statuses->contains('leave') ? 'leave'
                    : ($statuses->contains('absent') ? 'absent' : null));

                $lessonLearned = $dayRecords->contains(
                    fn ($r) => (int) ($r->lesson_learned ?? 0) === 1
                );

                if ($status) $monthsSummary[$monthName][$status]++;
                if ($lessonLearned) $monthsSummary[$monthName]['lessons_learned']++;

                $calendar[$monthName][$d] = [
                    'status' => $status,
                    'lesson_learned' => $lessonLearned,
                ];
            }
        }

        $present = collect($monthsSummary)->sum('present');
        $absent  = collect($monthsSummary)->sum('absent');
        $leave   = collect($monthsSummary)->sum('leave');
        $total   = $present + $absent + $leave;

        return [
            'months' => $monthsSummary,
            'calendar' => $calendar,
            'summary' => [
                'present' => $present,
                'absent' => $absent,
                'leave' => $leave,
                'percentage' => $total > 0
                    ? round(($present / $total) * 100, 2)
                    : 0,
            ],
        ];
    };

    /* ===============================
       PERFORMANCE (KIRTAN)
    ================================ */
    $evaluatePerformance = function ($attendance) {
        $total = $attendance['summary']['present']
            + $attendance['summary']['absent']
            + $attendance['summary']['leave'];

        $lessons = collect($attendance['months'])->sum('lessons_learned');

        $percentage = $total > 0
            ? round(($lessons / $total) * 100, 2)
            : 0;

        return [
            'total_classes' => $total,
            'lessons_learned' => $lessons,
            'percentage' => $percentage,
            'rating' => match (true) {
                $percentage >= 85 => 'Excellent',
                $percentage >= 70 => 'Good',
                $percentage >= 50 => 'Average',
                default => 'Needs Improvement',
            },
        ];
    };

    /* ===============================
       FINAL RESPONSE
    ================================ */
    $gurmukhiAttendance = $buildAttendance($gurmukhiSections);
    $kirtanAttendance   = $buildAttendance($kirtanSections);

    return [
        'meta' => [
            'report' => 'student',
            'generated_at' => now()->toDateTimeString(),
        ],
        'student' => [
            'id' => $student->id,
            'name' => $student->name,
            'father_name' => $student->father_name,
        ],
        'gurmukhi' => [
            'fees' => $buildFees($gurmukhiSections),
            'attendance' => $gurmukhiAttendance,
        ],
        'kirtan' => [
            'fees' => $buildFees($kirtanSections),
            'attendance' => $kirtanAttendance,
            'performance' => $evaluatePerformance($kirtanAttendance),
        ],
    ];
}

}
