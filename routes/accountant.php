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

    /* Students (fallback route for accountant-prefixed links) */
    Route::get('/students', function () {
        return Inertia::render('Accountant/Students', [
            'students' => Student::with([
                'enrollments.schoolClass:id,name,type',
                'enrollments.section:id,name,class_id',
            ])->orderBy('name')->get()->map(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'father_name' => $student->father_name,
                    'enrollments' => $student->enrollments->map(function ($e) {
                        return [
                            'id' => $e->id,
                            'student_type' => $e->student_type,
                            'school_class' => [
                                'id' => $e->schoolClass?->id,
                                'name' => $e->schoolClass?->name,
                                'type' => $e->schoolClass?->type,
                            ],
                            'section' => [
                                'id' => $e->section?->id,
                                'name' => $e->section?->name,
                            ],
                        ];
                    })->values(),
                ];
            }),
        ]);
    })->name('accountant.students.index');

    /* Attendance (fallback routes for accountant-prefixed links) */
    Route::get('/attendance', fn () =>
        Inertia::render('Attendance/Dashboard')
    )->name('accountant.attendance.dashboard');

    Route::get('/attendance/sections', function () {
        return Inertia::render('Accountant/AttendanceSections', [
            'sections' => Section::with('schoolClass:id,name,type')
                ->orderBy('name')
                ->get()
                ->map(fn ($section) => [
                    'id' => $section->id,
                    'name' => $section->name,
                    'school_class' => [
                        'id' => $section->schoolClass?->id,
                        'name' => $section->schoolClass?->name,
                        'type' => $section->schoolClass?->type,
                    ],
                ]),
        ]);
    })->name('accountant.attendance.sections');

    Route::get('/attendance/sections/{section}', function (Section $section) {
        return redirect()->route('attendance.mark', ['section' => $section->id]);
    })->name('accountant.attendance.mark');

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
