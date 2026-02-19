<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/


Route::get('/', function () {
    if (auth()->check()) {
        return match (auth()->user()->role) {
            'admin' => redirect()->route('admin.dashboard'),
            'accountant' => redirect('/accountant'),
            'teacher' => redirect()->route('teacher.dashboard'),
            default => redirect()->route('login'),
        };
    }

    return Inertia::render('Splash');
});

//Route::get('/demo-login', fn () => Inertia::render('DemoLogin'));

require __DIR__.'/auth.php';

/*
|--------------------------------------------------------------------------
| Protected (All logged-in users)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth', 'session.cache_guard'])->group(function () {

    require __DIR__.'/attendance.php';

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
});

