<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Models\StudentSection;
use App\Http\Controllers\AttendanceController;
use App\Models\Attendance;

// Note: prefix 'attendance' is already added in web.php
// Don't add prefix here to avoid duplicate /attendance/attendance

$isClassType = function (?string $type, string $needle): bool {
    $normalized = strtolower(trim((string) $type));
    if ($normalized === '') {
        return false;
    }

    return $normalized === $needle || str_contains($normalized, $needle);
};

Route::get('/', fn () =>
    Inertia::render('Attendance/Dashboard')
)->name('attendance.dashboard');

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

        return Inertia::render('Attendance/Sections', [
            'sections' => $sections,
        ]);
    })->name('attendance.sections');

    /* ===============================
       MARK ATTENDANCE
    ================================ */
    Route::get('/sections/{section}', function (Section $section) use ($isClassType) {

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

        /* ---------- Day rules ---------- */
        $today = now()->dayOfWeek; // 0 = Sunday
        $classType = $section->schoolClass->type;

        if ($today === 0 && $isClassType($classType, 'gurmukhi')) {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Gurmukhi attendance cannot be marked on Sunday.');
        }

        if ($today !== 0 && $isClassType($classType, 'kirtan')) {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Kirtan attendance can only be marked on Sunday.');
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
