<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Section;
use App\Models\StudentSection;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly StudentReportCache $reportCache,
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
}
