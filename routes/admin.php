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
    StudentReportCenterController,
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

// Student Status Management (enrollment-level)
Route::get(
    '/utilities/student-status',
    fn() => Inertia::render('Admin/Utilities/StudentStatus')
)->name('utilities.student-status');

Route::get(
    '/utilities/student-status/data',
    function (Request $request) {
        $classId = $request->query('class_id');
        $sectionId = $request->query('section_id');

        $query = DB::table('student_sections')
            ->join('students', 'students.id', '=', 'student_sections.student_id')
            ->join('classes', 'classes.id', '=', 'student_sections.class_id')
            ->join('sections', 'sections.id', '=', 'student_sections.section_id')
            ->select(
                'student_sections.id as enrollment_id',
                'students.id as student_id',
                'students.name as student_name',
                'students.father_name',
                'student_sections.status as enrollment_status',
                'classes.id as class_id',
                'classes.name as class_name',
                'sections.id as section_id',
                'sections.name as section_name',
                'student_sections.student_type',
            )
            ->where('student_sections.status', '!=', null); // always true, just for structure

        if ($classId) {
            $query->where('student_sections.class_id', (int) $classId);
        }
        if ($sectionId) {
            $query->where('student_sections.section_id', (int) $sectionId);
        }

        return $query->orderBy('classes.name')->orderBy('sections.name')->orderBy('students.name')->get();
    }
)->name('utilities.student-status.data');

Route::post(
    '/utilities/student-status/bulk-update',
    function (Request $request) {
        $request->validate([
            'enrollment_ids' => 'required|array|min:1',
            'enrollment_ids.*' => 'integer|exists:student_sections,id',
            'status' => 'required|in:active,inactive',
        ]);

        $count = DB::table('student_sections')
            ->whereIn('id', $request->enrollment_ids)
            ->update(['status' => $request->status]);

        return back()->with('success', "$count enrollment(s) set to {$request->status}.");
    }
)->name('utilities.student-status.bulk-update');

// Student Progression (prototype)
Route::get(
    '/utilities/student-progression',
    fn() => Inertia::render('Admin/Utilities/StudentProgression')
)->name('utilities.student-progression');

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
                )->where('status', 'active');
            })
            ->with(['enrollments' => function ($q) {
                $q->where('status', 'active');
            }, 'enrollments.schoolClass', 'enrollments.section'])
            ->get()
            : Student::with(['enrollments' => function ($q) {
                $q->where('status', 'active');
            }, 'enrollments.schoolClass', 'enrollments.section'])->get();

        return $students;
    })->name('list');

    Route::get('/data', function (Request $request) {
        $includeInactive = $request->boolean('include_inactive');

        $query = Student::with([
            'enrollments' => function ($q) use ($includeInactive) {
                if (!$includeInactive) {
                    $q->where('status', 'active');
                }
            },
            'enrollments.section.schoolClass',
        ])->orderBy('name');

        // When not including inactive enrollments, also filter out students
        // who have no active enrollments at all.
        if (!$includeInactive) {
            $query->whereHas('enrollments', fn ($q) => $q->where('status', 'active'));
        }

        return $query->get()->map(fn($s) => [
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
                'status' => $e->status ?? 'active',
            ])->values(),
        ]);
    })->name('data');

    // Filtered student options for report filters
    Route::get('/options', function (Request $request) {
        $classIds = (array) ($request->class_ids ?? []);
        $sectionIds = (array) ($request->section_ids ?? []);
        $classIds = array_filter($classIds);
        $sectionIds = array_filter($sectionIds);

        if (empty($classIds)) {
            return [];
        }

        $query = DB::table('students')
            ->join('student_sections', 'students.id', '=', 'student_sections.student_id')
            ->whereIn('student_sections.class_id', $classIds)
            ->where('student_sections.status', 'active')
            ->select('students.id', 'students.name', 'students.father_name');

        if (!empty($sectionIds)) {
            $query->whereIn('student_sections.section_id', $sectionIds);
        }

        return $query->distinct()->orderBy('students.name')->get();
    })->name('options');

    Route::post('/bulk-update', function (Request $request) {

        DB::transaction(function () use ($request) {

            // Preload all sections into a memory map (class_id by section_id).
            // This replaces N individual Section::find() calls (one per enrollment)
            // with a single bulk query. In PHP-FPM the static cache is per-request,
            // so it never goes stale across requests.
            static $sectionMap = [];

            if (empty($sectionMap)) {
                $sectionMap = Section::pluck('class_id', 'id')->all();
            }

            $formatName = function (?string $value): ?string {
                if ($value === null) return null;
                $normalized = Str::of($value)->squish()->lower()->title()->toString();
                return $normalized === '' ? null : $normalized;
            };

            $today = now(config('app.timezone'))->format('Y-m');
            $resolver = app(MonthlyFeeResolver::class);

            foreach ($request->students as $row) {

                // ---- 1. Upsert student (name, father, phone, status) ----
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

                // ---- 2. Compute desired enrollments ----
                $incoming = collect($row['enrollments'] ?? [])
                    ->filter(fn($e) => !empty($e['section_id']))
                    ->unique('section_id')
                    ->keyBy('section_id');

                // ---- 3. Remove orphaned active enrollments (single DELETE) ----
                StudentSection::where('student_id', $student->id)
                    ->where('status', 'active')
                    ->whereNotIn('section_id', $incoming->keys())
                    ->delete();

                // ---- 4. Upsert each incoming enrollment ----
                foreach ($incoming as $e) {
                    $sectionId = (int) $e['section_id'];
                    $classId   = $sectionMap[$sectionId] ?? null;
                    if (!$classId) continue;

                    $studentType = $e['student_type'] === 'free' ? 'free' : 'paid';

                    $enrollment = StudentSection::firstOrCreate(
                        [
                            'student_id' => $student->id,
                            'class_id'   => $classId,
                            'section_id' => $sectionId,
                        ],
                        ['student_type' => $studentType, 'status' => 'active']
                    );

                    if ($enrollment->status === 'inactive') continue;

                    if ($enrollment->student_type !== $studentType) {
                        $enrollment->update(['student_type' => $studentType]);
                    }

                    if ($studentType === 'free') {
                        // Bulk delete unpaid monthly fees (subquery instead of Eloquent whereDoesntHave)
                        DB::table('fees as f')
                            ->where('f.student_section_id', $enrollment->id)
                            ->where('f.type', 'monthly')
                            ->whereNotExists(function ($q) {
                                $q->selectRaw('1')
                                    ->from('payments')
                                    ->whereColumn('payments.fee_id', '=', 'f.id')
                                    ->whereNull('payments.deleted_at');
                            })
                            ->delete();
                        continue;
                    }

                    // ---- 5. Resolve and upsert monthly fee ----
                    $fee = $resolver->resolveForMonth($enrollment, $today);
                    if ($fee <= 0) continue;

                    Fee::firstOrCreate(
                        [
                            'student_section_id' => $enrollment->id,
                            'type' => 'monthly',
                            'month' => $today,
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
        '/options',
        fn() =>
        SchoolClass::select('id', 'name')
            ->orderBy('name')
            ->get()
            // Defend against duplicate names (no DB unique constraint exists)
            ->unique('name')
            ->values()
    )->name('options');

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
    Route::post('/generate-monthly', [FeesController::class, 'generateMonthlyFees'])->name('generate-monthly');
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
    // /admin/reports/student was removed in V1 of the Student Report Center.
    // The new path is /admin/student-report-center.
});

/* =========================================================
     | Student Report Center (V1)
     ========================================================= */

Route::prefix('student-report-center')->name('student-report-center.')->group(function () {
    Route::get('/', [StudentReportCenterController::class, 'page'])->name('page');
    Route::post('/build', [StudentReportCenterController::class, 'build'])->name('build');
    // PDF export is GET-based: read-only, no CSRF needed, the URL is
    // shareable / bookmarkable. The frontend uses a plain <a download>.
    Route::get('/export/pdf', [StudentReportCenterController::class, 'exportPdfGet'])->name('export.pdf.get');
    // POST kept for backward compat with any external scripts that already
    // POST. The route name is suffixed .post to disambiguate.
    Route::post('/export/pdf', [StudentReportCenterController::class, 'exportPdf'])->name('export.pdf.post');
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
