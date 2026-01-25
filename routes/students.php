<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\{
    Student,
    SchoolClass
};
use App\Http\Controllers\StudentController;


/*
|--------------------------------------------------------------------------
| Students (GLOBAL – Accountant & Teacher)
|--------------------------------------------------------------------------
*/

Route::prefix('students')->group(function () {

    // List students
    Route::get('/', function () {

    $user = auth()->user();

    $students = $user->isTeacher()
        ? Student::whereHas('enrollments', function ($q) use ($user) {
            $q->whereIn(
                'section_id',
                $user->sections->pluck('id')
            );
        })
        ->with(['enrollments.schoolClass', 'enrollments.section'])
        ->get()
        : Student::with([
            'enrollments.schoolClass',
            'enrollments.section',
        ])->get();

    return Inertia::render('Students/Index', [
        'students' => $students,
    ]);
})->name('students.index');

    // Create student
    Route::get('/create', function () {
        return Inertia::render('Students/Create', [
            'classes' => SchoolClass::with('sections')->get(),
        ]);
    })->name('students.create');

    // Store student
    Route::post('/', [StudentController::class, 'store'])
        ->name('students.store');

    // Show student
    Route::get('/{student}', function (Student $student) {

    $user = auth()->user();

    if ($user->isTeacher()) {
        $allowed = $student->enrollments()
            ->whereIn('section_id', $user->sections->pluck('id'))
            ->exists();

        abort_unless($allowed, 403);
    }

    $student->load([
        'enrollments.schoolClass',
        'enrollments.section',
        'enrollments.attendance' => fn ($q) => $q->orderByDesc('date'),
        'enrollments.fees.payments',
    ]);

    // summary logic (unchanged)

    $summary = $student->enrollments->map(function ($enrollment) {

    // Attendance counts
    $present = $enrollment->attendance->where('status', 'present')->count();
    $absent  = $enrollment->attendance->where('status', 'absent')->count();
    $leave   = $enrollment->attendance->where('status', 'leave')->count();

    // Fees
    $fees = $enrollment->fees;

$paidFees = $fees->filter(fn ($f) => $f->payments->isNotEmpty());
$unpaidFees = $fees->filter(fn ($f) => $f->payments->isEmpty());

return [
    'class'   => $enrollment->schoolClass->name,
    'section' => $enrollment->section->name,

    'attendance' => [
        'present' => $present,
        'absent'  => $absent,
        'leave'   => $leave,
        'recent'  => $enrollment->attendance
            ->take(5)
            ->map(fn ($a) => [
                'date'   => $a->date,
                'status' => $a->status,
            ]),
    ],

    'fees' => [
        'all_paid' => $unpaidFees->isEmpty(),
        'total'    => $fees->sum('amount'),
        'paid'     => $paidFees->sum('amount'),
        'pending'  => $unpaidFees->sum('amount'),

        // 👇 THIS FIXES YOUR ERROR
        'unpaid_months' => $unpaidFees
            ->map(fn ($f) => $f->month ?? $f->title)
            ->values(),
    ],
];

});

return Inertia::render('Students/Show', [
    'student' => $student,
    'summary' => $summary,
]);

})->name('students.show');


});
