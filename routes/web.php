<?php

use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    if (auth()->check()) {
        return match (auth()->user()->role) {
            'admin'      => redirect()->route('admin.dashboard'),
            'accountant' => redirect('/accountant'),
            'teacher'    => redirect()->route('teacher.dashboard'),
            default      => redirect()->route('login'),
        };
    }

    return Inertia::render('Splash');
})->name('home');

require __DIR__.'/auth.php';

/*
|--------------------------------------------------------------------------
| Protected (All logged-in users)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {

    // Attendance routes - teacher and accountant only (NOT admin)
    Route::middleware('role:teacher,accountant')
        ->prefix('attendance')
        ->group(function () {
            require __DIR__.'/attendance.php';
        });

    Route::middleware('role:admin')
        ->prefix('admin')
        ->name('admin.')
        ->group(function () {
            require __DIR__.'/admin.php';
        });

    Route::middleware('role:accountant')
        ->prefix('accountant')
        ->group(function () {
            require __DIR__.'/accountant.php';
        });

    Route::middleware('role:teacher')
        ->prefix('teacher')
        ->group(function () {
            require __DIR__.'/teacher.php';
        });

    require __DIR__.'/students.php';

    // Student Lifecycle routes (admin only)
    Route::middleware('role:admin')
        ->prefix('students/{student}')
        ->name('students.lifecycle.')
        ->group(function () {
            Route::post('/promote', [\App\Http\Controllers\StudentLifecycleController::class, 'promote'])->name('promote');
            Route::post('/pass-out', [\App\Http\Controllers\StudentLifecycleController::class, 'passOut'])->name('pass-out');
            Route::post('/leave-school', [\App\Http\Controllers\StudentLifecycleController::class, 'leaveSchool'])->name('leave-school');
            Route::post('/make-inactive', [\App\Http\Controllers\StudentLifecycleController::class, 'makeInactive'])->name('make-inactive');
            Route::post('/reactivate', [\App\Http\Controllers\StudentLifecycleController::class, 'reactivate'])->name('reactivate');
        });
});
