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
        $request->validate([
            'report'       => 'required|string',
            'class_ids'    => 'required|array|min:1',
            'section_ids'  => 'array',
            'student_ids'  => 'array',
            'paid_status'  => 'array',
            'month' => 'nullable|string', // YYYY-MM
        ]);

        return match ($request->report) {
            'fees' => response()->json(
                $this->buildFeesReport($request)
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
            ->map(fn ($row) => [
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
            ->get();

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

    $report = $this->buildFeesReport($request);
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
        'class_ids'   => 'required|array|min:1',
        'section_ids' => 'array',
        'student_ids' => 'array',
        'paid_status' => 'array',
        'month'       => 'nullable|string',   // YYYY-MM
        'year'        => 'nullable|integer',
    ]);

    // Build report using the SAME engine as UI
    $report = $this->buildFeesReport($request);

    $rows = collect($report['tables']['rows']);

    // Prepare PDF
    $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('reports.fees', [
        'meta'       => $report['meta'],
        'summary'    => $report['summary'],
        'byClass'    => $report['breakdowns']['by_class'],
        'rows'       => $rows,
        'paidRows'   => $rows->where('is_paid', 1),
        'unpaidRows' => $rows->where('is_paid', 0),
        'filters'    => $request->all(),
    ])->setPaper('a4', 'portrait');

    /* -----------------------------------------
       SMART FILE NAME
    ------------------------------------------ */

    // Class part
    $classPart = 'All-Classes';

    if ($request->filled('class_ids')) {
        $classNames = DB::table('classes')
            ->whereIn('id', $request->class_ids)
            ->pluck('name');

        if ($classNames->isNotEmpty()) {
            $classPart = str_replace(' ', '-', $classNames->implode('-'));
        }
    }

    // Month / Year part
    if ($request->filled('month')) {
        $periodPart = \Carbon\Carbon::createFromFormat('Y-m', $request->month)
            ->format('F-Y'); // January-2026
    } elseif ($request->filled('year')) {
        $periodPart = $request->year;
    } else {
        $periodPart = 'All-Periods';
    }

    $filename = "fees-report-{$classPart}-{$periodPart}.pdf";

    // Stream = open in new tab + allow download
    return $pdf->stream($filename);
}

private function buildAttendanceReport(Request $request): array
{
    $baseQuery = DB::table('attendances')
        ->join('student_sections', 'attendances.student_section_id', '=', 'student_sections.id')
        ->join('students', 'student_sections.student_id', '=', 'students.id')
        ->join('classes', 'student_sections.class_id', '=', 'classes.id')
        ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
        ->whereIn('student_sections.class_id', $request->class_ids);

    /* ---------------- DATE FILTER ---------------- */
    if ($request->filled('month')) {
        $baseQuery->where('attendances.date', 'like', $request->month . '%');
    } else {
        $baseQuery->whereYear('attendances.date', $request->year);
    }

    /* ---------------- OPTIONAL FILTERS ---------------- */
    if (!empty($request->section_ids)) {
        $baseQuery->whereIn('student_sections.section_id', $request->section_ids);
    }

    if (!empty($request->student_ids)) {
        $baseQuery->whereIn('students.id', $request->student_ids);
    }

    if (!empty($request->status)) {
        $baseQuery->whereIn('attendances.status', $request->status);
    }

    /* ---------------- SUMMARY ---------------- */
    $summaryRaw = (clone $baseQuery)->selectRaw('
        COUNT(DISTINCT attendances.date) as total_days,
        COUNT(DISTINCT students.id) as total_students,
        SUM(attendances.status = "present") as present,
        SUM(attendances.status = "absent") as absent,
        SUM(attendances.status = "leave") as leaves,
        SUM(attendances.lesson_learned = 1) as lessons_learned,
        COUNT(attendances.id) as total_entries
    ')->first();

    $attendanceBase = $summaryRaw->present + $summaryRaw->absent;

    $summary = [
        'total_days' => (int) $summaryRaw->total_days,
        'total_students' => (int) $summaryRaw->total_students,
        'present' => (int) $summaryRaw->present,
        'absent' => (int) $summaryRaw->absent,
        'leave' => (int) $summaryRaw->leaves,
        'attendance_percentage' =>
            $attendanceBase > 0
                ? round(($summaryRaw->present / $attendanceBase) * 100, 2)
                : 0,
        'lesson_learned_percentage' =>
            $summaryRaw->total_entries > 0
                ? round(($summaryRaw->lessons_learned / $summaryRaw->total_entries) * 100, 2)
                : 0,
    ];

    /* ---------------- BY CLASS ---------------- */
    $byClass = (clone $baseQuery)
        ->selectRaw('
            classes.name as class_name,
            SUM(attendances.status = "present") as present,
            SUM(attendances.status = "absent") as absent,
            SUM(attendances.status = "leave") as leaves
        ')
        ->groupBy('classes.id', 'classes.name')
        ->orderBy('classes.name')
        ->get()
        ->map(fn ($r) => [
            'class' => $r->class_name,
            'present' => (int) $r->present,
            'absent' => (int) $r->absent,
            'leave' => (int) $r->leaves,
            'percentage' =>
                ($r->present + $r->absent) > 0
                    ? round(($r->present / ($r->present + $r->absent)) * 100, 2)
                    : 0,
        ]);

    /* ---------------- BY STUDENT ---------------- */
    $byStudent = (clone $baseQuery)
        ->selectRaw('
            students.name as student_name,
            students.father_name,
            SUM(attendances.status = "present") as present,
            SUM(attendances.status = "absent") as absent,
            SUM(attendances.status = "leave") as leaves
        ')
        ->groupBy('students.id', 'students.name', 'students.father_name')
        ->orderBy('students.name')
        ->get();

    /* ---------------- ROWS ---------------- */
    $rows = (clone $baseQuery)
        ->select(
            'attendances.date',
            'students.name as student_name',
            'students.father_name',
            'classes.name as class_name',
            'sections.name as section_name',
            'attendances.status',
            'attendances.lesson_learned'
        )
        ->orderBy('attendances.date')
        ->orderBy('students.name')
        ->get();

    return [
        'meta' => [
            'report' => 'attendance',
            'year' => $request->year,
            'month' => $request->month,
            'generated_at' => now()->toDateTimeString(),
        ],
        'summary' => $summary,
        'breakdowns' => [
            'by_class' => $byClass,
            'by_student' => $byStudent,
        ],
        'tables' => [
            'rows' => $rows,
        ],
    ];
}


}
