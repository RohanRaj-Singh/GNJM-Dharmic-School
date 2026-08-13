<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StudentController;


/*
|--------------------------------------------------------------------------
| Students (GLOBAL – Accountant & Teacher)
|--------------------------------------------------------------------------
*/

Route::prefix('students')->group(function () {

    // List students
    Route::get('/', [StudentController::class, 'index'])
        ->name('students.index');

    // Create student
    Route::get('/create', [StudentController::class, 'create'])
        ->name('students.create');

    // Store student
    Route::post('/', [StudentController::class, 'store'])
        ->name('students.store');

    // Show student
    Route::get('/{student}', [StudentController::class, 'show'])
        ->name('students.show');

});
