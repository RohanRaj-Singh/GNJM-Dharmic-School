<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/
Route::get('/', fn () => Inertia::render('Splash'));
Route::get('/demo-login', fn () => Inertia::render('DemoLogin'));

/*
|--------------------------------------------------------------------------
| Dashboard (Auth)
|--------------------------------------------------------------------------
*/
Route::get('/dashboard', fn () => Inertia::render('Dashboard'))
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

/*
|--------------------------------------------------------------------------
| Route Includes
|--------------------------------------------------------------------------
*/
require __DIR__.'/auth.php';
require __DIR__.'/attendance.php';
require __DIR__.'/admin.php';
require __DIR__.'/accountant.php';
