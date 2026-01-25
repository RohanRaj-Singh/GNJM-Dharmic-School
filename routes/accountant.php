<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\{
    Student,
    SchoolClass,
    Section,
    Fee,
    StudentSection
};
use App\Http\Controllers\{
    StudentController,
    FeePaymentController
};
use App\Http\Controllers\Accountant\LateFeeSummaryController;

/*
|--------------------------------------------------------------------------
| Accountant Area
|--------------------------------------------------------------------------
*/
Route::get('/', fn () =>
        Inertia::render('Accountant/Dashboard')
    );

    /* Students */
    // Route::get('/students', function () {
    //     return Inertia::render('Accountant/Students/Index', [
    //         'students' => Student::with([
    //             'enrollments.schoolClass',
    //             'enrollments.section',
    //         ])->get(),
    //     ]);
    // })->name('accountant.students.index');

    // Route::get('/students/create', function () {
    //     return Inertia::render('Accountant/Students/Create', [
    //         'classes' => SchoolClass::with('sections')->get(),
    //     ]);
    // })->name('accountant.students.create');

    // Route::post('/students', [StudentController::class, 'store'])
    //     ->name('accountant.students.store');

    // Route::get('/students/{student}', function (Student $student) {

    //     $student->load([
    //         'enrollments.schoolClass',
    //         'enrollments.section',
    //         'enrollments.attendance' => fn ($q) => $q->orderByDesc('date'),
    //         'enrollments.fees.payments',
    //     ]);

    //     $summary = $student->enrollments->map(function ($enrollment) {

    //         return [
    //             'class' => $enrollment->schoolClass->name,
    //             'section' => $enrollment->section->name,
    //             'attendance' => [
    //                 'present' => $enrollment->attendance->where('status', 'present')->count(),
    //                 'absent' => $enrollment->attendance->where('status', 'absent')->count(),
    //                 'leave' => $enrollment->attendance->where('status', 'leave')->count(),
    //                 'recent' => $enrollment->attendance->take(4)->map(fn ($a) => [
    //                     'date' => $a->date,
    //                     'status' => $a->status,
    //                 ]),
    //             ],
    //             'fees' => [
    //                 'all_paid' => $enrollment->fees->every(fn ($f) => $f->payments->isNotEmpty()),
    //                 'unpaid_months' => $enrollment->fees
    //                     ->filter(fn ($f) => $f->payments->isEmpty())
    //                     ->pluck('month')
    //                     ->values(),
    //             ],
    //         ];
    //     });

    //     return Inertia::render('Accountant/Students/Show', [
    //         'student' => $student,
    //         'summary' => $summary,
    //     ]);
    // })->name('accountant.students.show');

    /* Fees */
    Route::get('/receive-fee', function () {
        $student = Student::with([
            'enrollments.fees' => fn ($q) =>
                $q->whereDoesntHave('payments'),
        ])->findOrFail(request('student_id'));

        return Inertia::render('Accountant/ReceiveFee', [
            'student' => $student,
            'fees' => $student->enrollments->flatMap->fees,
        ]);
    })->name('accountant.receive-fee');

    Route::post('/receive-fee', [FeePaymentController::class, 'store'])
        ->name('accountant.receive-fee.store');

    /* Late Fees */
    Route::get('/late-fees', [LateFeeSummaryController::class, 'index']);


