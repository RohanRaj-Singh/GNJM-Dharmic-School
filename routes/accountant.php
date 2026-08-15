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
use App\Support\DivisionTypeResolver;

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

    /* Students index (B12 — data-driven division filter).
     *
     * Resolves every active class through DivisionTypeResolver and hands
     * the page a `divisions` array so the filter bar can render one button
     * per division the school actually has. A third+ class (Music, Tabla,
     * …) is visible by construction — no hardcoded two-button bug.
     */
    Route::get('/students', function () {
        $classes = SchoolClass::orderBy('name')->get();

        // One entry per distinct division the resolver returns. Order is
        // stable so the filter bar always renders in the same sequence.
        $divisions = $classes
            ->map(fn ($c) => DivisionTypeResolver::division(
                $c->type ?? null,
                $c->name ?? null,
                $c->division ?? null
            ))
            ->unique()
            ->values()
            ->map(fn ($key) => ['key' => $key, 'title' => ucfirst($key)])
            ->all();

        $students = Student::with([
            'enrollments' => fn ($q) => $q,
            'enrollments.schoolClass',
            'enrollments.section',
        ])
            ->where('status', 'active')
            ->orderBy('name')
            ->get()
            ->map(fn ($student) => [
                'id' => $student->id,
                'name' => $student->name,
                'father_name' => $student->father_name,
                'enrollments' => $student->enrollments->map(fn ($e) => [
                    'id' => $e->id,
                    'student_type' => $e->student_type,
                    'school_class' => $e->schoolClass ? [
                        'id' => $e->schoolClass->id,
                        'name' => $e->schoolClass->name,
                        'type' => $e->schoolClass->type,
                        'division' => $e->schoolClass->division,
                    ] : null,
                    'section' => $e->section ? [
                        'id' => $e->section->id,
                        'name' => $e->section->name,
                    ] : null,
                ])->all(),
            ])
            ->all();

        return Inertia::render('Accountant/Students', [
            'students' => $students,
            'divisions' => $divisions,
        ]);
    })->name('accountant.students.index');

    /* Fees */
    Route::get('/receive-fee', function () {
        $student = Student::with([
            'enrollments' => fn ($q) => $q,  // Load all enrollments regardless of status
            'enrollments.fees' => fn ($q) =>
                $q->whereDoesntHave('payments', fn ($qq) => $qq->whereNull('deleted_at')),
            'enrollments.schoolClass',
            'enrollments.section',
        ])->findOrFail(request('student_id'));

        // Flatten fees with class type info — the division resolved through the
        // canonical seam (explicit division first, then type/name). A third
        // class keeps its own division key instead of the gurmukhi default.
        $fees = $student->enrollments->flatMap(function ($enrollment) {
            $class = $enrollment->schoolClass;
            $className = $class?->name ?? '';
            $classType = DivisionTypeResolver::division(
                $class?->type ?? null,
                $className,
                $class?->division ?? null,
            );

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

        return Inertia::render('Accountant/ReceiveFee', [
            'student' => $student,
            'fees' => $fees,
        ]);
    })->name('accountant.receive-fee');

    Route::post('/receive-fee', [FeePaymentController::class, 'store'])
        ->name('accountant.receive-fee.store');

    /* Late Fees */
    Route::get('/late-fees', [LateFeeSummaryController::class, 'index']);
