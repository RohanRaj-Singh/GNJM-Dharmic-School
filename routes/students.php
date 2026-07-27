<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Carbon\Carbon;
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
            )->where('status', 'active')->whereNull('transferred_at');
        })
        ->with(['enrollments' => function ($q) {
            $q->where('status', 'active')->whereNull('transferred_at');
        }, 'enrollments.schoolClass', 'enrollments.section'])
        ->get()
        : Student::with([
            'enrollments' => function ($q) {
                $q->where('status', 'active')->whereNull('transferred_at');
            },
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
            ->where('status', 'active')
            ->whereNull('transferred_at')
            ->whereIn('section_id', $user->sections->pluck('id'))
            ->exists();

        abort_unless($allowed, 403);
    }

    $student->load([
        'enrollments' => function ($q) {
            $q->orderByDesc('started_at');
        },
        'enrollments.schoolClass',
        'enrollments.section',
        'enrollments.attendance' => fn ($q) => $q->orderByDesc('date'),
        'enrollments.fees.payments',
    ]);

    // Group enrollments by class type so a student with both Gurmukhi and
    // Kirtan appears once per type. Within each group we merge attendance
    // and fees from all enrollments (current + archived) so no data is lost
    // after a section change, but sections are NOT duplicated.
    $grouped = $student->enrollments->groupBy(function ($enrollment) {
        return $enrollment->schoolClass?->type ?? 'gurmukhi';
    });

    $summary = $grouped->map(function ($enrollments) {
        $currentEnrollment = $enrollments
            ->firstWhere(fn ($e) => $e->status === 'active' && $e->transferred_at === null);
        $displayEnrollment = $currentEnrollment ?? $enrollments->first();

        // Merge attendance from ALL enrollments in this group
        $allAttendance = $enrollments->flatMap(fn ($e) => $e->attendance);

        // Merge fees from ALL enrollments in this group
        $allFees = $enrollments->flatMap(fn ($e) => $e->fees);

        $paidFees = $allFees->filter(fn ($f) => $f->payments->isNotEmpty());
        $unpaidFees = $allFees->filter(fn ($f) => $f->payments->isEmpty());

        return [
            'class'       => $displayEnrollment->schoolClass->name,
            'section'     => $displayEnrollment->section->name,
            'attendance'  => [
                'present' => $allAttendance->where('status', 'present')->count(),
                'absent'  => $allAttendance->where('status', 'absent')->count(),
                'leave'   => $allAttendance->where('status', 'leave')->count(),
                'recent'  => $allAttendance->sortBy('date')->map(fn ($a) => [
                    'date'           => $a->date,
                    'status'         => $a->status,
                    'lesson_learned' => $a->lesson_learned ?? false,
                    'lesson_note'    => $a->lesson_note ?? null,
                ])->values(),
            ],
            'fees' => [
                'all_paid'      => $unpaidFees->isEmpty(),
                'total'         => $allFees->sum('amount'),
                'paid'          => $paidFees->sum('amount'),
                'pending'       => $unpaidFees->sum('amount'),
                'unpaid_months' => $unpaidFees
                    ->map(fn ($f) => $f->month ?? $f->title)
                    ->values(),
            ],
        ];
    })->values();

return Inertia::render('Students/Show', [
    'student' => $student,
    'summary' => $summary,
]);

})->name('students.show');


});
