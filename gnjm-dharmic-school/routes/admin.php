<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Admin Area
|--------------------------------------------------------------------------
*/
Route::prefix('admin')->group(function () {

    Route::get('/dashboard', fn () =>
        Inertia::render('Admin/Dashboard')
    );

    Route::get('/utilities', fn () =>
        Inertia::render('Admin/Utilities')
    );

});
