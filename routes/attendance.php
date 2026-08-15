<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Models\StudentSection;
use App\Http\Controllers\AttendanceController;
use App\Models\Attendance;
use App\Support\DivisionTypeResolver;

// Note: prefix 'attendance' is already added in web.php
// Don't add prefix here to avoid duplicate /attendance/attendance

Route::get('/', function () {
    $user = auth()->user();

    // Ship the divisions the current user can act on, so the dashboard can
    // branch by role + render per-division tiles. Teachers get their owned
    // divisions only; accountants + admins get every division.
    $sections = $user->isTeacher()
        ? Section::whereIn('id', $user->sections->pluck('id'))->with('schoolClass')->get()
        : Section::with('schoolClass')->get();

    $divisions = $sections
        ->map(fn ($s) => DivisionTypeResolver::division(
            $s->schoolClass->type ?? null,
            $s->schoolClass->name ?? null,
            $s->schoolClass->division ?? null,
        ))
        ->unique()
        ->values()
        ->all();

    return Inertia::render('Attendance/Dashboard', [
        'divisions' => $divisions,
    ]);
})->name('attendance.dashboard');

    /* ===============================
       SECTIONS LIST
    ================================ */
    Route::get('/sections', function () {
        $user = auth()->user();

        $sections = $user->isTeacher()
            ? Section::whereIn(
                'id',
                $user->sections->pluck('id')
              )->with('schoolClass')->get()
            : Section::with('schoolClass')->get();

        // Cross-division pill source: collect every distinct division
        // key the resolver returns across the user's accessible sections.
        // The frontend maps each key through divisionMeta() for label+color
        // — no hardcoded 2-division contract, no JSX change needed to add
        // a third+ class. See docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §4.1.
        $divisionKeys = $sections
            ->map(fn ($s) => DivisionTypeResolver::division(
                $s->schoolClass->type ?? null,
                $s->schoolClass->name ?? null,
                $s->schoolClass->division ?? null,
            ))
            ->unique()
            ->values()
            ->all();

        return Inertia::render('Attendance/Sections', [
            'sections' => $sections,
            'divisions' => $divisionKeys,
        ]);
    })->name('attendance.sections');

    /* ===============================
       MARK ATTENDANCE
    ================================ */
    Route::get('/sections/{section}', function (Section $section) {

        $user = auth()->user();

        /* ---------- Teacher access ---------- */
        if ($user->isTeacher()) {
            abort_unless(
                $user->sections->pluck('id')->contains($section->id),
                403
            );
        }

        /* ---------- Load relations ---------- */
        $section->load([
            'schoolClass',
            'studentSections' => fn ($q) => $q->where('status', 'active')->whereNull('transferred_at'),
            'studentSections.student',
        ]);

        /* ---------- Day rules (config-driven, Stage B) ---------- */
        $class = $section->schoolClass;
        if (!$class->isAttendanceDay(now())) {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Attendance for '.$class->name.' can only be marked on '.$class->attendanceDaysLabel().'.');
        }

        /* ---------- Attendance ---------- */
        $hasAttendanceToday = $section->attendance()
            ->whereDate('date', today())
            ->exists();

        return Inertia::render('Attendance/Mark', [
            'section' => $section,
            'hasAttendanceToday' => $hasAttendanceToday,
            'existingAttendance' => $hasAttendanceToday
                ? $section->attendance()
                    ->with('studentSection.student')
                    ->whereDate('date', today())
                    ->get()
                    ->map(function ($attendance) {
                        // Ensure lesson_learned is explicitly included
                        return [
                            'id' => $attendance->id,
                            'student_section_id' => $attendance->student_section_id,
                            'date' => $attendance->date,
                            'status' => $attendance->status,
                            'lesson_learned' => $attendance->lesson_learned,
                            'student_section' => $attendance->studentSection ? [
                                'id' => $attendance->studentSection->id,
                                'student' => $attendance->studentSection->student ? [
                                    'id' => $attendance->studentSection->student->id,
                                    'name' => $attendance->studentSection->student->name,
                                    'father_name' => $attendance->studentSection->student->father_name,
                                ] : null,
                            ] : null,
                        ];
                    })
                : [],
        ]);
    })->name('attendance.mark');

    /* ===============================
       SAVE ATTENDANCE
    ================================ */
    Route::post('/', [AttendanceController::class, 'store'])
        ->name('attendance.store');

    /* ===============================
       LESSON NOTES
    ================================ */
    Route::get('/lesson-notes/{studentSection}', function (StudentSection $studentSection) {
        return Attendance::where('student_section_id', $studentSection->id)
            ->whereNotNull('lesson_note')
            ->where('lesson_note', '!=', '')
            ->orderByDesc('date')
            ->limit(3)
            ->get(['date', 'lesson_note', 'lesson_learned']);
    })->name('attendance.lesson-notes');

    /* ===============================
       ABSENTEES
    ================================ */
    Route::get('/absentees', [AttendanceController::class, 'absentees'])
        ->name('attendance.absentees');
