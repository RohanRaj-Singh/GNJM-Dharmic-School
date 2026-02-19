<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use App\Models\{
    Student,
    SchoolClass,
    StudentSection,
    Section,
    Fee,
    User
};

use App\Http\Controllers\Admin\{
    AdminAttendanceController,
    FeesController,
    FeeRatePeriodController,
    ReportController,
    UserController,
    DashboardController,
    PendingFeesController
};
use App\Services\MonthlyFeeResolver;

/*
|--------------------------------------------------------------------------
| Admin Area (AUTH + ADMIN ONLY)
|--------------------------------------------------------------------------
*/

// Route::middleware(['auth', 'role:admin'])
//     ->prefix('admin')
//     ->name('admin.')
//     ->group(function () {



// });

Route::get('/sections/data', fn () =>
    Section::select('id', 'name')->orderBy('name')->get()
);

/*
|--------------------------------------------------------------------------
| Admin lookup: Classes + Sections (for Users UI)
|--------------------------------------------------------------------------
*/

Route::get('/sections/with-classes', function () {
    return SchoolClass::with('sections:id,class_id,name')
        ->orderBy('name')
        ->get()
        ->map(fn ($class) => [
            'id' => $class->id,
            'name' => $class->name,
            'sections' => $class->sections->map(fn ($section) => [
                'id' => $section->id,
                'label' => $class->name . ' - ' . $section->name,
            ]),
        ]);
});


/* =========================================================
     | Dashboard & Utilities
     ========================================================= */

Route::get(
    '/dashboard',
    fn() =>
    Inertia::render('Admin/Dashboard')
)->name('dashboard');

Route::get(
    '/utilities',
    fn() =>
    Inertia::render('Admin/Utilities')
)->name('utilities');

Route::get(
    '/utilities/pending-fees',
    [PendingFeesController::class, 'index']
)->name('utilities.pending-fees');

Route::patch(
    '/utilities/pending-fees/{studentSection}',
    [PendingFeesController::class, 'update']
)->name('utilities.pending-fees.update');

Route::patch(
    '/utilities/pending-fees',
    [PendingFeesController::class, 'bulkUpdate']
)->name('utilities.pending-fees.bulk');

Route::get('/dashboard/summary', [\App\Http\Controllers\Admin\DashboardController::class, 'summary'])
    ->name('admin.dashboard.summary');


/* =========================================================
     | Students
     ========================================================= */

Route::prefix('students')->name('students.')->group(function () {

    Route::get(
        '/',
        fn() =>
        Inertia::render('Admin/Students/Index')
    )->name('index');
    Route::get('/list', function (Request $request) {
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

        return $students;
    })->name('list');

    Route::get('/data', function () {
        return Student::with(['enrollments.section.schoolClass'])
            ->orderBy('name')
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'father_name' => $s->father_name,
                'father_phone' => $s->father_phone,
                'mother_phone' => $s->mother_phone,
                'status' => $s->status,
                'enrollments' => $s->enrollments->map(fn($e) => [
                    'class_id' => (string) $e->class_id,
                    'section_id' => (string) $e->section_id,
                    'student_type' => $e->student_type,
                ])->values(),
            ]);
    })->name('data');

    Route::post('/bulk-update', function (Request $request) {

        DB::transaction(function () use ($request) {
            $formatName = function (?string $value): ?string {
                if ($value === null) {
                    return null;
                }

                $normalized = Str::of($value)->squish()->lower()->title()->toString();
                return $normalized === '' ? null : $normalized;
            };

            foreach ($request->students as $row) {

                $student = empty($row['id'])
                    ? Student::create([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $row['status'] ?? 'active',
                    ])
                    : tap(Student::findOrFail($row['id']))->update([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $row['status'] ?? 'active',
                    ]);

                $incoming = collect($row['enrollments'] ?? [])
                    ->filter(fn($e) => !empty($e['section_id']))
                    ->unique('section_id');

                StudentSection::where('student_id', $student->id)
                    ->whereNotIn('section_id', $incoming->pluck('section_id'))
                    ->delete();

                foreach ($incoming as $e) {

                    $section = Section::find($e['section_id']);
                    if (!$section) continue;

                    $studentType = $e['student_type'] === 'free' ? 'free' : 'paid';

                    $enrollment = StudentSection::firstOrCreate(
                        [
                            'student_id' => $student->id,
                            'class_id' => $section->class_id,
                            'section_id' => $section->id,
                        ],
                        ['student_type' => $studentType]
                    );

                    $previousType = $enrollment->student_type;

                    if ($enrollment->student_type !== $studentType) {
                        $enrollment->update(['student_type' => $studentType]);
                    }

                    if ($studentType === 'free') {
                        if ($previousType === 'paid') {
                            $currentMonth = now(config('app.timezone'))->format('Y-m');
                            Fee::where('student_section_id', $enrollment->id)
                                ->where('type', 'monthly')
                                ->where('month', '>', $currentMonth)
                                ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
                                ->delete();
                        }
                        continue;
                    }

                    $class = SchoolClass::find($section->class_id);
                    if (!$class) continue;

                    $fee = app(MonthlyFeeResolver::class)
                        ->resolveForMonth($enrollment, now(config('app.timezone'))->format('Y-m'));

                    if ($fee <= 0) continue;

                    Fee::firstOrCreate(
                        [
                            'student_section_id' => $enrollment->id,
                            'type' => 'monthly',
                            'month' => now()->format('Y-m'),
                        ],
                        [
                            'source' => 'monthly',
                            'amount' => $fee,
                        ]
                    );
                }
            }
        });

        return back()->with('success', 'Students updated');
    })->name('bulk');

    Route::delete('/{student}', function (Student $student) {
        $student->delete();
        return back(303);
    })->name('delete');
});

/* =========================================================
     | Classes
     ========================================================= */

Route::prefix('classes')->name('classes.')->group(function () {

    Route::get(
        '/',
        fn() =>
        Inertia::render('Admin/Classes/Index')
    )->name('index');

    Route::get(
        '/data',
        fn() =>
        SchoolClass::withCount('sections')
            ->orderBy('name')
            ->get()
    )->name('data');

    Route::post('/save', function (Request $request) {
        foreach ($request->classes as $row) {
            if (!empty($row['id'])) {
                $existing = SchoolClass::find($row['id']);
                if ($existing) {
                    $existing->update([
                        'name' => $row['name'],
                        'type' => $row['type'] ?? $existing->type,
                    ]);
                }
                continue;
            }

            SchoolClass::create([
                'name' => $row['name'],
                'type' => $row['type'],
                'default_monthly_fee' => 0,
            ]);
        }
        return back();
    })->name('save');

    Route::get('/{class}/fee-periods', [FeeRatePeriodController::class, 'classPeriods'])
        ->name('fee-periods.index');
    Route::post('/{class}/fee-periods', [FeeRatePeriodController::class, 'storeForClass'])
        ->name('fee-periods.store');
    Route::put('/{class}/fee-periods/{period}', [FeeRatePeriodController::class, 'updateForClass'])
        ->name('fee-periods.update');
    Route::delete('/{class}/fee-periods/{period}', [FeeRatePeriodController::class, 'destroyForClass'])
        ->name('fee-periods.destroy');

    Route::get(
        '/options',
        fn() =>
        SchoolClass::select('id', 'name', 'type')->orderBy('name')->get()
    )->name('options');
});

/* =========================================================
     | Sections
     ========================================================= */

Route::prefix('sections')->name('sections.')->group(function () {

    Route::get(
        '/',
        fn() =>
        Inertia::render('Admin/Sections/Index')
    )->name('index');

    Route::get(
        '/data',
        fn() =>
        Section::with('schoolClass')
            ->withCount('studentSections')
            ->orderBy('name')
            ->get()
    )->name('data');

    Route::post('/save', function (Request $request) {
        foreach ($request->sections as $row) {
            if (!empty($row['id'])) {
                $existing = Section::find($row['id']);
                if ($existing) {
                    $existing->update([
                        'name' => $row['name'],
                        'class_id' => $row['class_id'],
                    ]);
                }
                continue;
            }

            Section::create([
                'name' => $row['name'],
                'class_id' => $row['class_id'],
                'monthly_fee' => 0,
            ]);
        }
        return back();
    })->name('save');

    Route::get('/{section}/fee-periods', [FeeRatePeriodController::class, 'sectionPeriods'])
        ->name('fee-periods.index');
    Route::post('/{section}/fee-periods', [FeeRatePeriodController::class, 'storeForSection'])
        ->name('fee-periods.store');
    Route::put('/{section}/fee-periods/{period}', [FeeRatePeriodController::class, 'updateForSection'])
        ->name('fee-periods.update');
    Route::delete('/{section}/fee-periods/{period}', [FeeRatePeriodController::class, 'destroyForSection'])
        ->name('fee-periods.destroy');

    Route::delete(
        '/{section}',
        fn(Section $section) =>
        $section->studentSections()->exists()
            ? response()->json(['message' => 'Cannot delete'], 422)
            : tap($section)->delete()
    )->name('delete');

    Route::get('/options', function (Request $request) {
        $classIds = (array) ($request->class_ids ?? [$request->class_id]);
        $query = Section::query()->whereIn('class_id', $classIds);

        if ((int) $request->query('include_meta', 0) === 1) {
            return $query
                ->select(['id', 'name', 'class_id', 'monthly_fee'])
                ->selectSub(
                    function ($q) {
                        $q->from('fee_rate_periods')
                            ->whereColumn('fee_rate_periods.scope_id', 'sections.id')
                            ->where('fee_rate_periods.scope_type', 'section')
                            ->selectRaw('COUNT(*) > 0');
                    },
                    'has_timeline'
                )
                ->orderBy('name')
                ->get();
        }

        return $query->get(['id', 'name', 'class_id']);
    })->name('options');
});

/* =========================================================
     | Attendance
     ========================================================= */

Route::prefix('attendance')->name('attendance.')->group(function () {
    Route::get('/', [AdminAttendanceController::class, 'index'])->name('index');
    Route::get('/grid', [AdminAttendanceController::class, 'grid'])->name('grid');
    Route::post('/save', [AdminAttendanceController::class, 'save'])->name('save');
});

/* =========================================================
     | Fees
     ========================================================= */

Route::prefix('fees')->name('fees.')->group(function () {

    Route::get('/', [FeesController::class, 'index'])->name('index');
    Route::post('/{fee}/collect', [FeesController::class, 'collect'])->name('collect');
    Route::post('/{fee}/de-collect', [FeesController::class, 'deCollect'])->name('deCollect');

    Route::prefix('custom')->name('custom.')->group(function () {
        Route::get('/', [FeesController::class, 'customIndex'])->name('index');
        Route::post('/', [FeesController::class, 'storeCustomFee'])->name('store');
        Route::put('/', [FeesController::class, 'updateCustomFee'])->name('update');
        Route::delete('/student/{fee}', [FeesController::class, 'destroyCustomFeeForStudent'])->name('destroy.student');
        Route::delete('/section', [FeesController::class, 'destroyCustomFeeForSection'])->name('destroy.section');
    });
});

/* =========================================================
     | Reports
     ========================================================= */

Route::prefix('reports')->name('reports.')->group(function () {
    Route::get('/', fn() => Inertia::render('Admin/Reports/Index'))->name('index');
    Route::post('/build', [ReportController::class, 'build'])->name('build');
    Route::post('/export/csv', [ReportController::class, 'exportCsv'])->name('export.csv');
    Route::post('/export/pdf', [ReportController::class, 'exportPdf'])->name('export.pdf');
    Route::get('/attendance', fn() => Inertia::render('Admin/Reports/Attendance'))->name('attendance');
    Route::get('/student', fn() => Inertia::render('Admin/Reports/Student'))->name('student');
});

/* =========================================================
     | Users (ADMIN ONLY)
     ========================================================= */

/* =========================================================
 | Users (ADMIN ONLY)
 ========================================================= */

Route::prefix('users')->name('users.')->group(function () {

    // UI
    Route::get(
        '/',
        fn() =>
        Inertia::render('Admin/Users/Index')
    )->name('index');

    // Data
    Route::get(
        '/data',
        fn() =>
        User::with('sections:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'email' => $u->email,
                'role' => $u->role,
                'is_active' => $u->is_active,
                'sections' => $u->sections->pluck('id'),
            ])
    )->name('data');

    // 🔥 BULK UPDATE (FIXED)
    Route::post('/save', [UserController::class, 'bulkUpdate'])
        ->name('save');

    // ➕ CREATE USER
    Route::post('/', [UserController::class, 'store'])
        ->name('store');

    // // 🔑 RESET PASSWORD
    // Route::post('/{user}/reset-password', [UserController::class, 'resetPassword'])
    //     ->name('reset-password');

    // ❌ DELETE (SAFE)
    Route::delete('/{user}', [UserController::class, 'destroy'])
        ->name('delete');
});
