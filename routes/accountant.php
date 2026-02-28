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
            'enrollments.schoolClass',
            'enrollments.section',
        ])->findOrFail(request('student_id'));

        // Flatten fees with class type info
        // Use class NAME to determine kirtan vs gurmukhi (not type field)
        $fees = $student->enrollments->flatMap(function ($enrollment) {
            $className = $enrollment->schoolClass?->name ?? '';
            $classTypeRaw = $enrollment->schoolClass?->type ?? '';

            // Determine kirtan vs gurmukhi based on class NAME (more reliable)
            // Class names typically contain "Kirtan" or "Gurmukhi"
            $isKirtan = stripos($className, 'kirtan') !== false;
            $classType = $isKirtan ? 'kirtan' : 'gurmukhi';

            // Debug logging
            \Log::info('[ReceiveFee] Enrollment:', [
                'enrollment_id' => $enrollment->id,
                'class_id' => $enrollment->class_id,
                'class_name' => $className,
                'class_type_field' => $classTypeRaw,
                'determined_type' => $classType,
            ]);

            return $enrollment->fees->map(function ($fee) use ($classType, $className) {
                return [
                    'id' => $fee->id,
                    'month' => $fee->month,
                    'amount' => $fee->amount,
                    'class_type' => $classType,
                    'section_name' => $enrollment->section?->name ?? '',
                    'class_name' => $className,
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
