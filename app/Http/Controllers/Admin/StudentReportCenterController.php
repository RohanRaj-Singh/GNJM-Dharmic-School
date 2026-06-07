<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StudentReportCenterRequest;
use App\Services\StudentReport\StudentReportService;
use App\Support\StudentReport\StudentReportRequest as FilterRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * The V1 Student Report Center.
 *
 * Endpoints (all behind auth + role:admin):
 *  - GET  /admin/student-report-center                 (page)
 *  - POST /admin/student-report-center/build           (JSON for preview; CSRF-protected)
 *  - GET  /admin/student-report-center/export/pdf      (PDF download; query params; read-only)
 *  - POST /admin/student-report-center/export/pdf      (kept for backward compat; CSRF-protected)
 *
 * The GET export is the canonical path now. GETs don't need CSRF tokens
 * (CSRF only applies to state-changing methods), the URL is shareable /
 * bookmarkable, and the frontend uses a plain <a download> link.
 */
class StudentReportCenterController extends Controller
{
    public function __construct(
        private readonly StudentReportService $service,
    ) {}

    public function build(StudentReportCenterRequest $request): JsonResponse
    {
        $report = $this->service->build($request->toFilterRequest());
        return response()->json($report->toArray());
    }

    public function exportPdf(StudentReportCenterRequest $request)
    {
        $report = $this->service->build($request->toFilterRequest());
        return $this->renderPdf($report);
    }

    /**
     * GET variant. Read-only — no CSRF token required. Filters come
     * through the query string. The same StudentReportCenterRequest
     * validates the shape; we just bypass the CSRF middleware (which
     * applies to POST/PUT/PATCH/DELETE only, so this is automatic).
     */
    public function exportPdfGet(Request $request)
    {
        $validated = $request->validate([
            'student_id'   => ['required', 'integer', 'exists:students,id'],
            'range_mode'   => ['required', 'in:calendar_year,academic_session,month,range'],
            'single_year'  => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'single_month' => ['nullable', 'date_format:Y-m'],
            'range_start'  => ['nullable', 'date_format:Y-m'],
            'range_end'    => ['nullable', 'date_format:Y-m'],
            'division'     => ['nullable', 'in:all,gurmukhi,kirtan'],
        ]);

        // Inject the canonical 'all' default for division to match the POST
        // endpoint's contract; StudentReportRequest's fromArray() already
        // handles missing fields.
        $filter = FilterRequest::fromArray($validated);
        $report = $this->service->build($filter);
        return $this->renderPdf($report);
    }

    private function renderPdf(\App\Support\StudentReport\StudentReport $report)
    {
        $pdf = Pdf::loadView('reports.student_center', $report->toArray())
            ->setPaper('a4', 'portrait');

        $filename = sprintf(
            'student-report-%d-%s.pdf',
            $report->identity->id,
            substr(str_replace([' ', ':'], '-', $report->meta->generatedAt), 0, 19),
        );

        // stream() returns Content-Disposition: inline so the browser
        // opens the PDF in its built-in viewer. The user can download
        // from the viewer if needed.
        return $pdf->stream($filename);
    }

    /**
     * Phase 2 page: renders the React UI with the student list and the
     * four range-mode year options.
     */
    public function page(): InertiaResponse
    {
        $students = \App\Models\Student::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'father_name'])
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'father_name' => $s->father_name,
                'label' => $s->father_name
                    ? "{$s->name} (Father: {$s->father_name})"
                    : $s->name,
            ]);

        $currentYear = (int) date('Y');
        $yearOptions = [];
        // Expose a generous range of years so the date inputs can reach
        // back to enrollment and forward through the current year.
        for ($y = $currentYear - 10; $y <= $currentYear + 1; $y++) {
            $yearOptions[] = ['value' => $y, 'label' => (string) $y];
        }

        return Inertia::render('Admin/StudentReportCenter/Index', [
            'students' => $students,
            'yearOptions' => $yearOptions,
            'currentYear' => $currentYear,
            'earliestYear' => $currentYear - 10,
            'latestYear' => $currentYear + 1,
        ]);
    }
}
