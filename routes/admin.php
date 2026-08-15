<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Models\{
    Student,
    SchoolClass,
    StudentSection,
    Section,
    User
};

use App\Http\Controllers\Admin\{
    AdminAttendanceController,
    BackupController,
    FeesController,
    FeeRatePeriodController,
    ReportController,
    StudentController,
    StudentReportCenterController,
    UserController,
    DashboardController,
    PendingFeesController
};
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

// Master Directory
Route::get(
    '/utilities/master-directory',
    fn() => Inertia::render('Admin/Utilities/MasterDirectory')
)->name('utilities.master-directory');

// Database Backup & Restore
Route::prefix('utilities/backup')->name('utilities.backup.')->group(function () {
    Route::get('/', fn() => Inertia::render('Admin/Utilities/Backup'))->name('page');
    Route::get('/overview', [BackupController::class, 'overview'])->name('overview');
    Route::get('/history', [BackupController::class, 'history'])->name('history');
    Route::post('/create', [BackupController::class, 'create'])->name('create');
    Route::get('/{id}/download', [BackupController::class, 'download'])->name('download');
    Route::post('/{id}/restore', [BackupController::class, 'restore'])->name('restore');
    Route::delete('/{id}', [BackupController::class, 'destroy'])->name('destroy');
    Route::get('/{id}/compatibility', [BackupController::class, 'compatibility'])->name('compatibility');
});

// Student Progression data — active students with current enrollments + outstanding fees
Route::get('/utilities/student-progression/data', function (Request $request) {
    $query = Student::query()
        ->where('students.status', Student::STATUS_ACTIVE)
        ->whereHas('enrollments', fn ($q) =>
            $q->where('status', StudentSection::STATUS_ACTIVE)->whereNull('transferred_at')
        )
        ->orderBy('name');

    if ($search = $request->input('search')) {
        $query->where(function ($q) use ($search) {
            $q->where('students.name', 'like', "%{$search}%")
              ->orWhere('students.father_name', 'like', "%{$search}%");
        });
    }

    if ($classId = $request->input('class_id')) {
        $query->whereHas('enrollments', fn ($q) =>
            $q->where('class_id', $classId)->where('status', StudentSection::STATUS_ACTIVE)->whereNull('transferred_at')
        );
    }

    if ($sectionId = $request->input('section_id')) {
        $query->whereHas('enrollments', fn ($q) =>
            $q->where('section_id', $sectionId)->where('status', StudentSection::STATUS_ACTIVE)->whereNull('transferred_at')
        );
    }

    return $query->with(['enrollments' => fn ($q) =>
        $q->where('status', StudentSection::STATUS_ACTIVE)->whereNull('transferred_at'),
        'enrollments.schoolClass', 'enrollments.section',
    ])->get()->map(fn ($s) => [
        'id' => $s->id,
        'name' => $s->name,
        'fatherName' => $s->father_name,
        'status' => $s->status,
        'studentType' => $s->enrollments->first()?->student_type ?? 'paid',
        'enrollments' => $s->enrollments->map(fn ($e) => [
            'id' => $e->id,
            'classId' => $e->class_id,
            'className' => $e->schoolClass->name,
            'classType' => $e->schoolClass->type,
            'sectionId' => $e->section_id,
            'sectionName' => $e->section->name,
            'studentType' => $e->student_type,
            'startedAt' => $e->started_at?->toDateString(),
        ])->values(),
        'outstandings' => (int) DB::table('fees')
            ->whereIn('student_section_id', $s->enrollments->pluck('id'))
            ->where('type', 'monthly')
            ->whereNotExists(fn ($q) =>
                $q->selectRaw('1')->from('payments')
                  ->whereColumn('payments.fee_id', '=', 'fees.id')
                  ->whereNull('payments.deleted_at')
            )
            ->sum('fees.amount'),
    ]);
})->name('utilities.student-progression.data');

Route::get('/utilities/master-directory/data', function (Request $request) {
    $query = Student::with([
        'enrollments' => fn ($q) => $q->latest('started_at')->take(1),
        'enrollments.schoolClass',
        'enrollments.section',
    ])->orderBy('name');

    if ($search = $request->input('search')) {
        $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
              ->orWhere('father_name', 'like', "%{$search}%");
        });
    }

    if ($status = $request->input('status')) {
        $query->where('status', $status);
    }

    if ($classId = $request->input('class_id')) {
        $query->whereHas('enrollments', fn ($q) => $q->where('class_id', $classId));
    }

    return $query->get()->map(fn ($s) => [
        'id' => $s->id,
        'name' => $s->name,
        'fatherName' => $s->father_name,
        'status' => $s->status,
        'lastEnrollment' => $s->enrollments->first() ? [
            'className' => $s->enrollments->first()->schoolClass->name,
            'sectionName' => $s->enrollments->first()->section->name,
            'outcome' => $s->enrollments->first()->outcome,
        ] : null,
        'outstandings' => 0,
    ]);
})->name('utilities.master-directory.data');

Route::get('/dashboard/summary', [\App\Http\Controllers\Admin\DashboardController::class, 'summary'])
    ->name('dashboard.summary');


/* =========================================================
   | Sprint 6.4 / L-1 — Division settings (read-only diagnostic).
   |
   | Lists every division the resolver surfaces with its
   | business-rule summary (attendance days, charges-monthly-fee,
   | default monthly fee) and operational counts. No editing —
   | the audit frames this purely as "admins should be able to
   | verify which bucket Music actually sits in".
   ========================================================= */
Route::get('/divisions', [\App\Http\Controllers\Admin\DivisionController::class, 'index'])
    ->name('divisions.index');
Route::get('/divisions/data', [\App\Http\Controllers\Admin\DivisionController::class, 'data'])
    ->name('divisions.data');


/* =========================================================
     | Students
     ========================================================= */

Route::prefix('students')->name('students.')->group(function () {

    Route::get('/', [StudentController::class, 'index'])->name('index');
    Route::get('/list', [StudentController::class, 'list'])->name('list');
    Route::get('/data', [StudentController::class, 'data'])->name('data');

    // Filtered student options for report filters
    Route::get('/options', [StudentController::class, 'options'])->name('options');

    Route::post('/bulk-update', [StudentController::class, 'bulkUpdate'])
        ->name('bulk');

    Route::get('/{student}/enrollment-history', [StudentController::class, 'enrollmentHistory'])
        ->name('enrollment-history');

    Route::delete('/{student}', [StudentController::class, 'destroy'])->name('delete');

    Route::post('/bulk-delete', [StudentController::class, 'bulkDelete'])->name('bulk-delete');
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
                    // Rename ONLY updates `name`. The `type` and `division`
                    // columns (which determine which bucket the class sits
                    // in — Gurmukhi vs Kirtan vs Music vs Tabla vs anything
                    // else) stay frozen at their first-save values. We use
                    // `$existing->type` unconditional (not `$row['type']`)
                    // so a client cannot inject a different `type` on
                    // rename and accidentally drag a class out of its
                    // bucket mid-year. Pinned by
                    // `tests/Feature/AdminClassDeleteAndRenameTest.php`.
                    $existing->update([
                        'name' => $row['name'],
                        'type' => $existing->type,
                    ]);
                }
                continue;
            }

            // New row — accept Stage B config from the modal-driven path
            // (full create form) or fall back to sensible defaults for the
            // inline-row path. The division slug is always derived from the
            // name and stored explicitly so DivisionTypeResolver picks the
            // correct bucket regardless of what the legacy `type` heuristic
            // would otherwise produce.
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $slug = \Illuminate\Support\Str::slug($name);
            if ($slug === '') {
                $slug = 'class';
            }

            // Kirtan name preserves the real business rule (Sunday-only,
            // no monthly fees); any other name defaults to Mon-Sat with
            // the same "off by default" behaviour the inline-row path
            // historically had. The user can flip the toggle in the modal.
            if (strtolower($name) === 'kirtan') {
                $attendanceDays = $row['attendance_days'] ?? [0];
                $chargesMonthlyFee = array_key_exists('charges_monthly_fee', $row)
                    ? (bool) $row['charges_monthly_fee']
                    : false;
            } else {
                $attendanceDays = $row['attendance_days'] ?? [1, 2, 3, 4, 5, 6];
                $chargesMonthlyFee = array_key_exists('charges_monthly_fee', $row)
                    ? (bool) $row['charges_monthly_fee']
                    : false;
            }

            SchoolClass::create([
                'name' => $name,
                'type' => $slug,            // legacy compat with the
                                            //   type-based fallback rules
                'division' => $slug,        // Stage A2 explicit override —
                                            //   the seam that lets a third+
                                            //   class escape the Gurmukhi
                                            //   bucket
                'attendance_days' => $attendanceDays,
                'charges_monthly_fee' => $chargesMonthlyFee,
                'default_monthly_fee' => (int) ($row['default_monthly_fee'] ?? 0),
            ]);
        }
        return back();
    })->name('save');

    // Delete a class — refused if any student_sections row exists for it,
    // active OR historical. Mirrors the section.delete closure below:
    // protecting historical financial records (paid fees reference
    // class_id) is more important than a typo-fix workflow. If no
    // enrollments exist the class cascades cleanly to its sections and
    // fee rate periods via the existing FK cascadeOnDelete constraints.
    // Pinned by `tests/Feature/AdminClassDeleteAndRenameTest.php`.
    Route::delete(
        '/{class}',
        fn(SchoolClass $class) =>
            $class->studentSections()->exists()
                ? response()->json(
                    ['message' => 'Cannot delete: class has historical or active enrollments. Clean up enrollments first.'],
                    422
                )
                : tap($class)->delete()
    )->name('delete');

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

    // 🔑 RESET PASSWORD
    Route::post('/{user}/reset-password', [UserController::class, 'resetPassword'])
        ->name('reset-password');

    // ❌ DELETE (SAFE)
    Route::delete('/{user}', [UserController::class, 'destroy'])
        ->name('delete');
});
