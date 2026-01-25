<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Http\Controllers\AttendanceController;

Route::prefix('attendance')->group(function () {

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
            'studentSections.student',
        ]);

        /* ---------- Day rules ---------- */
        $today = now()->dayOfWeek; // 0 = Sunday
        $classType = $section->schoolClass->type;

        if ($today === 0 && $classType === 'gurmukhi') {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Gurmukhi attendance cannot be marked on Sunday.');
        }

        if ($today !== 0 && $classType === 'kirtan') {
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
                : [],
        ]);
    })->name('attendance.mark');

    /* ===============================
       SAVE ATTENDANCE
    ================================ */
    Route::post('/', [AttendanceController::class, 'store'])
        ->name('attendance.store');

    /* ===============================
       ABSENTEES
    ================================ */
    Route::get('/absentees', function () {
        $user = auth()->user();

        $sections = $user->isTeacher()
            ? Section::whereIn(
                'id',
                $user->sections->pluck('id')
              )->with('schoolClass')->get()
            : Section::with('schoolClass')->get();

        return Inertia::render('Attendance/Absentees', [
            'sections' => $sections,
        ]);
    })->name('attendance.absentees');
});
