<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Teacher Area
|--------------------------------------------------------------------------
| Attendance-only role (Phase 1)
*/

Route::get('/', fn () =>
    Inertia::render('Teacher/Dashboard')
)->name('teacher.dashboard');

/*
|--------------------------------------------------------------------------
| Attendance (Teacher uses GLOBAL Attendance)
|--------------------------------------------------------------------------
*/
Route::prefix('attendance')->group(function () {

    Route::get('/', fn () =>
        Inertia::render('Attendance/Dashboard')
    )->name('teacher.attendance.dashboard');

    Route::get('/sections', fn () =>
        Inertia::render('Attendance/Sections')
    )->name('teacher.attendance.sections');

    Route::get('/sections/{section}', fn () =>
        Inertia::render('Attendance/Mark')
    )->name('teacher.attendance.mark');

});
