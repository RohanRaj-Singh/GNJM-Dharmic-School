<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\StudentSection;
use App\Services\AbsenteeService;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly StudentReportCache $reportCache,
        private readonly AbsenteeService $absenteeService,
    ) {}

    /**
     * Store or update attendance for a section (per day)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'section_id' => ['required', 'exists:sections,id'],
            'attendance' => ['required', 'array'],
            'attendance.*.student_id' => ['required', 'exists:students,id'],
            'attendance.*.status' => ['required', 'in:present,absent,leave'],
            'attendance.*.lesson_learned' => ['nullable', 'boolean'],
            'attendance.*.lesson_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $today = Carbon::today();
        $affectedStudentIds = [];

        foreach ($validated['attendance'] as $record) {

            // Find the student_section row
            $studentSection = StudentSection::where('section_id', $validated['section_id'])
                ->where('student_id', $record['student_id'])
                ->where('status', 'active')
                ->whereNull('transferred_at')
                ->firstOrFail();

            /**
             * updateOrCreate is CRITICAL:
             * - avoids duplicate key error
             * - allows re-saving same day
             */
            Attendance::updateOrCreate(
                [
                    'student_section_id' => $studentSection->id,
                    'date' => $today,
                ],
                [
                    'status' => $record['status'],
                    'lesson_learned' =>
                        $record['status'] === 'present'
                            ? ($record['lesson_learned'] ?? false)
                            : false,
                    'lesson_note' =>
                        !empty($record['lesson_note'])
                            ? $record['lesson_note']
                            : null,
                ]
            );

            $affectedStudentIds[(int) $record['student_id']] = true;
        }

        foreach (array_keys($affectedStudentIds) as $sid) {
            $this->reportCache->forget($sid);
        }

        /**
         * IMPORTANT:
         * Inertia requests must return a redirect or Inertia response
         */
        return redirect()->route('attendance.sections');
    }

    /**
     * Absent & leave register page (was a ~218-line route closure in
     * routes/attendance.php; the pure computation now lives in AbsenteeService).
     */
    public function absentees(Request $request)
    {
        $user = auth()->user();

        $allowedSectionIds = $user->isTeacher()
            ? $user->sections->pluck('id')->all()
            : Section::pluck('id')->all();

        // Get class and section filters
        $classFilter = $request->query('class_id');
        $sectionFilter = $request->query('section_id');
        $studentSearch = $request->query('search', '');

        // Get date range from request, default to yesterday and before
        $today = Carbon::today();
        $yesterday = $today->copy()->subDay();
        $endDate = $yesterday;
        $startDate = $endDate->copy()->subDays(30);

        $requestStart = $request->query('start_date');
        $requestEnd = $request->query('end_date');
        $hasCustomFilter = false;

        if ($requestStart) {
            $startDate = Carbon::parse($requestStart);
            $hasCustomFilter = true;
        }
        if ($requestEnd) {
            $endDate = Carbon::parse($requestEnd);
            $hasCustomFilter = true;
        }

        // Check if today is included in the filter
        $includeToday = $request->query('include_today', false);

        // Get available classes and sections for filters
        $classes = SchoolClass::select('id', 'name', 'type')->orderBy('name')->get();
        $sections = Section::with('schoolClass')
            ->whereIn('id', $allowedSectionIds)
            ->orderBy('name')
            ->get();

        $enrollments = StudentSection::with([
            'student',
            'section',
            'schoolClass',
            'attendance' => fn ($q) => $q->orderByDesc('date'),
        ])
            ->where('status', 'active')
            ->whereNull('transferred_at')
            ->whereIn('section_id', $allowedSectionIds)
            ->get();

        $rows = $this->absenteeService->buildRows(
            enrollments: $enrollments,
            today: $today,
            startDate: $startDate,
            endDate: $endDate,
            includeToday: (bool) $includeToday,
            classFilter: $classFilter ? (int) $classFilter : null,
            sectionFilter: $sectionFilter ? (int) $sectionFilter : null,
            search: $studentSearch !== '' ? $studentSearch : null,
        );

        return Inertia::render('Attendance/Absentees', [
            'students'       => $rows['students'],
            'today_absentees' => $rows['today_absentees'],
            'classes'        => $classes,
            'sections'       => $sections->map(fn ($s) => [
                'id'         => $s->id,
                'name'       => $s->name,
                'class_id'   => $s->schoolClass->id ?? null,
                'class_name' => $s->schoolClass->name ?? '',
            ]),
            'filters' => [
                'start_date'        => $startDate->toDateString(),
                'end_date'          => $endDate->toDateString(),
                'include_today'     => $includeToday,
                'has_custom_filter' => $hasCustomFilter,
                'class_id'          => $classFilter,
                'section_id'        => $sectionFilter,
                'search'            => $studentSearch,
            ],
        ]);
    }
}
