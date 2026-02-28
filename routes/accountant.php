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
                $q->whereDoesntHave('payments', fn ($qq) => $qq->whereNull('deleted_at')),
            'enrollments.section.schoolClass',
        ])->findOrFail(request('student_id'));

        // Flatten fees with class type info
        $fees = $student->enrollments->flatMap(function ($enrollment) {
            $classType = $enrollment->section?->schoolClass?->type ?? 'gurmukhi';

            // Debug logging
            \Log::info('[ReceiveFee] Enrollment:', [
                'enrollment_id' => $enrollment->id,
                'section_name' => $enrollment->section?->name ?? 'null',
                'class_name' => $enrollment->section?->schoolClass?->name ?? 'null',
                'class_type_raw' => $enrollment->section?->schoolClass?->type ?? 'NULL (defaulting to gurmukhi)',
            ]);

            return $enrollment->fees->map(function ($fee) use ($classType) {
                return [
                    'id' => $fee->id,
                    'month' => $fee->month,
                    'amount' => $fee->amount,
                    'class_type' => $classType,
                    'section_name' => $enrollment->section?->name ?? '',
                ];
            });
        });

        // Debug: Log all fees before returning
        \Log::info('[ReceiveFee] Final fees array:', $fees->toArray());

        return Inertia::render('Accountant/ReceiveFee', [
            'student' => $student,
            'fees' => $fees,
        ]);
    })->name('accountant.receive-fee');

    Route::post('/receive-fee', [FeePaymentController::class, 'store'])
        ->name('accountant.receive-fee.store');

    /* Late Fees */
    Route::get('/late-fees', [LateFeeSummaryController::class, 'index']);
