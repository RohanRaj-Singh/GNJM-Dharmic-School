<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Support\DivisionTypeResolver;

/*
|--------------------------------------------------------------------------
| Teacher Area
|--------------------------------------------------------------------------
| Attendance-only role (Phase 1)
*/

Route::get('/', function () {
    $user = auth()->user();

    // myDivisions: every distinct division key the teacher owns sections in,
    // computed via the resolver (3-arg, explicit-first). Drives the dashboard's
    // division legend and per-division action-card hints. See
    // docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §3.1.
    $sections = $user->isTeacher()
        ? $user->sections()->with('schoolClass')->get()
        : Section::query()->with('schoolClass')->get();

    $myDivisions = $sections
        ->map(fn (Section $s) => DivisionTypeResolver::division(
            $s->schoolClass->type ?? null,
            $s->schoolClass->name ?? null,
            $s->schoolClass->division ?? null,
        ))
        ->unique()
        ->values()
        ->all();

    return Inertia::render('Teacher/Dashboard', [
        'myDivisions' => $myDivisions,
    ]);
})->name('teacher.dashboard');

/*
|--------------------------------------------------------------------------
| Attendance (Teacher uses GLOBAL Attendance)
|--------------------------------------------------------------------------
*/
Route::prefix('attendance')->group(function () {

    Route::get('/', function () {
        $user = auth()->user();

        // Teacher dashboard: only divisions the teacher owns sections in.
        $sections = $user->isTeacher()
            ? $user->sections()->with('schoolClass')->get()
            : collect();

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
    })->name('teacher.attendance.dashboard');

    Route::get('/sections', fn () =>
        Inertia::render('Attendance/Sections')
    )->name('teacher.attendance.sections');

    Route::get('/sections/{section}', fn () =>
        Inertia::render('Attendance/Mark')
    )->name('teacher.attendance.mark');

});
