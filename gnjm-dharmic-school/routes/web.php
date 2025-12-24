<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Http\Controllers\StudentController;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::get('/attendance', function()
{
    return Inertia::render('Attendance/MarkAttendance');
});

Route::get('/admin/dashboard', function () {
    return Inertia::render('Admin/Dashboard');
});
Route::prefix('accountant')->group(function () {
    Route::get('/', fn () => Inertia::render('Accountant/Dashboard'));
    Route::get('/add-student', fn () => Inertia::render('Accountant/AddStudent'));
    Route::get('/receive-fee', fn () => Inertia::render('Accountant/ReceiveFee'));
    Route::get('/students', fn () => Inertia::render('Accountant/Students'));
    Route::get('/attendance', fn () => Inertia::render('Accountant/Attendance'));
    Route::get('/late-fees', fn () => Inertia::render('Accountant/LateFees'));
    Route::get('/reports', fn () => Inertia::render('Accountant/Reports'));
});
Route::get('/admin/utilities', function () {
    return Inertia::render('Admin/Utilities');
});

Route::get('/', fn () => Inertia::render('Splash'));
Route::get('/demo-login', fn () => Inertia::render('DemoLogin'));

Route::get('/students', function () {
    $students = Student::with([
        'enrollments.schoolClass',
        'enrollments.section',
    ])->get();

    return Inertia::render('Students/Index', [
        'students' => $students,
    ]);
});
Route::post('/students', [StudentController::class, 'store']);

Route::get('/students/show', function () {
    return Inertia::render('Students/Show');
});

Route::get('/students/create', function () {
    return Inertia::render('Students/Create', [
        'classes' => SchoolClass::with('sections')->get(),
    ]);
});

use App\Http\Controllers\AttendanceController;

Route::post('/attendance', [AttendanceController::class, 'store']);


require __DIR__.'/auth.php';
