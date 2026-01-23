<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Models\Student;
use App\Models\SchoolClass;
use App\Models\StudentSection;
use App\Models\Section;
use App\Models\Fee;

use App\Http\Controllers\Admin\AdminAttendanceController;
use App\Http\Controllers\Admin\FeesController;
use App\Http\Controllers\Admin\ReportController;

/*
|--------------------------------------------------------------------------
| Admin Area
|--------------------------------------------------------------------------
*/

Route::prefix('admin')->name('admin.')->group(function () {

    /* =========================================================
     | Dashboard
     ========================================================= */
    Route::get(
        '/dashboard',
        fn() =>
        Inertia::render('Admin/Dashboard')
    )->name('dashboard');

    /* =========================================================
     | Utilities
     ========================================================= */
    Route::get(
        '/utilities',
        fn() =>
        Inertia::render('Admin/Utilities')
    )->name('utilities');

    /* =========================================================
     | Students
     ========================================================= */
    Route::prefix('students')->name('students.')->group(function () {

        Route::get(
            '/',
            fn() =>
            Inertia::render('Admin/Students/Index')
        )->name('index');

        Route::get('/data', function () {
            return Student::with(['enrollments.section.schoolClass'])
                ->orderBy('name')
                ->get()
                ->map(fn($student) => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'father_name' => $student->father_name,
                    'father_phone' => $student->father_phone,
                    'mother_phone' => $student->mother_phone,
                    'status' => $student->status,
                    'enrollments' => $student->enrollments->map(fn($e) => [
                        'class_id' => (string) $e->class_id,
                        'section_id' => (string) $e->section_id,
                        'student_type' => $e->student_type,
                    ])->values(),
                ]);
        })->name('data');

        Route::post('/bulk-update', function (Request $request) {
            DB::transaction(function () use ($request) {

                foreach ($request->students as $row) {

                    $student = empty($row['id'])
                        ? Student::create([
                            'name' => $row['name'],
                            'father_name' => $row['father_name'] ?? null,
                            'father_phone' => $row['father_phone'] ?? null,
                            'mother_phone' => $row['mother_phone'] ?? null,
                            'status' => $row['status'] ?? 'active',
                        ])
                        : tap(Student::findOrFail($row['id']))->update([
                            'name' => $row['name'],
                            'father_name' => $row['father_name'] ?? null,
                            'father_phone' => $row['father_phone'] ?? null,
                            'mother_phone' => $row['mother_phone'] ?? null,
                            'status' => $row['status'] ?? 'active',
                        ]);

                    /*
     | Normalize incoming enrollments
     | Section is the SOURCE OF TRUTH
     */
                    $incoming = collect($row['enrollments'] ?? [])
                        ->filter(fn($e) => !empty($e['section_id']))
                        ->unique('section_id');

                    /*
     | Remove enrollments that no longer exist
     */
                    StudentSection::where('student_id', $student->id)
                        ->whereNotIn('section_id', $incoming->pluck('section_id'))
                        ->delete();

                    foreach ($incoming as $e) {

                        $studentType = $e['student_type'] ?? 'paid';

                        /*
         | Resolve section → class (SOURCE OF TRUTH)
         */
                        $section = Section::find($e['section_id']);
                        if (!$section) {
                            continue;
                        }

                        $classId = $section->class_id;

                        /*
         | Create or fetch enrollment
         */
                        $enrollment = StudentSection::firstOrCreate(
                            [
                                'student_id' => $student->id,
                                'class_id'   => $classId,
                                'section_id' => $section->id,
                            ],
                            [
                                'student_type' => $studentType,
                            ]
                        );

                        /*
         | RULE 1: Free students never get monthly fees
         */
                        if ($studentType === 'free') {
                            continue;
                        }

                        /*
         | Resolve monthly fee
         | Priority:
         | 1. student_sections.monthly_fee
         | 2. classes.default_monthly_fee
         */
                        $class = SchoolClass::find($classId);
                        if (!$class) {
                            continue;
                        }

                        $resolvedFee =
                            $enrollment->monthly_fee > 0
                            ? $enrollment->monthly_fee
                            : ($section->monthly_fee > 0
                                ? $section->monthly_fee
                                : $class->default_monthly_fee);


                        /*
         | RULE 2: If no fee exists → do NOT generate
         */
                        if ($resolvedFee <= 0) {
                            continue;
                        }

                        /*
         | Generate CURRENT month fee (idempotent)
         */
                        Fee::firstOrCreate(
                            [
                                'student_section_id' => $enrollment->id,
                                'type'  => 'monthly',
                                'month' => now()->format('Y-m'),
                            ],
                            [
                                'source' => 'monthly',
                                'title'  => null,
                                'amount' => $resolvedFee,
                            ]
                        );
                    }
                }
            });

            return back()->with('success', 'Students updated');
        })->name('bulk');

        Route::delete(
            '/{student}',
            fn(Student $student) =>
            tap($student)->delete() && back()
        )->name('delete');


        Route::get('/options', function (Request $request) {

            abort_if(
                !$request->filled('class_ids'),
                400,
                'class_ids[] required'
            );

            $classIds = (array) $request->input('class_ids');
            $sectionIds = (array) $request->input('section_ids', []);

            $query = Student::query()
                ->join('student_sections', 'students.id', '=', 'student_sections.student_id')
                ->whereIn('student_sections.class_id', $classIds);

            if (!empty($sectionIds)) {
                $query->whereIn('student_sections.section_id', $sectionIds);
            }

            return $query
                ->select('students.id', 'students.name')
                ->distinct()
                ->orderBy('students.name')
                ->get();
        })->name('options');
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
                ->get(['id', 'name', 'default_monthly_fee', 'status', 'created_at'])
        )->name('data');

        Route::post('/save', function (Request $request) {
            foreach ($request->classes as $row) {
                empty($row['id'])
                    ? SchoolClass::create([
                        'name' => $row['name'],
                        'type' => $row['type'],
                        'default_monthly_fee' => $row['default_monthly_fee'] ?? 0,
                    ])
                    : SchoolClass::where('id', $row['id'])->update([
                        'name' => $row['name'],
                        'type' => $row['type'],
                        'default_monthly_fee' => $row['default_monthly_fee'] ?? 0,
                    ]);
            }
            return back();
        })->name('save');

        // Route::get(
        //     '/options',
        //     fn() =>
        //     SchoolClass::select('id', 'name')->orderBy('name')->get()
        // )->name('options');

        Route::get('/options', function () {
            return SchoolClass::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
        })->name('options');
    });

    /* =========================================================
     | Sections
     ========================================================= */
    Route::prefix('sections')->name('sections.')->group(function () {

        // UI
        Route::get(
            '/',
            fn() =>
            Inertia::render('Admin/Sections/Index')
        )->name('index');

        // Table data
        Route::get(
            '/data',
            fn() =>
            Section::query()
                ->with('schoolClass')
                ->withCount('studentSections')
                ->orderBy('name')
                ->get()
        )->name('data');

        // Save (create + update)
        Route::post('/save', function (Request $request) {
            $request->validate([
                'sections' => 'required|array',
                'sections.*.name' => 'required|string|max:255',
                'sections.*.class_id' => 'required|exists:classes,id',
                'sections.*.monthly_fee' => 'nullable|integer|min:0',
            ]);

            foreach ($request->sections as $row) {
                Section::updateOrCreate(
                    ['id' => $row['id'] ?? null],
                    [
                        'name' => $row['name'],
                        'class_id' => $row['class_id'],
                        'monthly_fee' => $row['monthly_fee'] ?? 0,
                    ]
                );
            }

            return back()->with('success', 'Sections saved');
        })->name('save');

        // Delete
        Route::delete('/{section}', function (Section $section) {

            if ($section->studentSections()->exists()) {
                return response()->json([
                    'message' => 'Cannot delete section with students'
                ], 422);
            }

            $section->delete();

            return response()->noContent();
        })->name('delete');

        // Select options
        // Route::get('/options', function (Request $request) {
        //     abort_if(!$request->class_id, 400);

        //     return Section::where('class_id', $request->class_id)
        //         ->select('id', 'name')
        //         ->orderBy('name')
        //         ->get();
        // })->name('options');

        Route::get('/options', function (Request $request) {

            // Accept both formats (BACKWARD SAFE)
            $classIds = [];

            if ($request->filled('class_ids')) {
                $classIds = (array) $request->input('class_ids');
            } elseif ($request->filled('class_id')) {
                $classIds = [$request->input('class_id')];
            }

            abort_if(empty($classIds), 400, 'class_ids[] or class_id required');

            return Section::query()
                ->whereIn('class_id', $classIds)
                ->select('id', 'name', 'class_id')
                ->orderBy('name')
                ->get();
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
     | Fees (FINAL, CLEAN)
     ========================================================= */
    Route::prefix('fees')->name('fees.')->group(function () {

        // Fees Index
        Route::get('/', [FeesController::class, 'index'])
            ->name('index');

        // Collect / De-collect
        Route::post('/{fee}/collect', [FeesController::class, 'collect'])
            ->name('collect');

        Route::post('/{fee}/de-collect', [FeesController::class, 'deCollect'])
            ->name('deCollect');

        /* ------------------ Custom Fees ------------------ */
        Route::prefix('custom')->name('custom.')->group(function () {

            Route::get('/', [FeesController::class, 'customIndex'])
                ->name('index');

            Route::post('/', [FeesController::class, 'storeCustomFee'])
                ->name('store');

            Route::put('/', [FeesController::class, 'updateCustomFee'])
                ->name('update');

            Route::delete('/student/{fee}', [FeesController::class, 'destroyCustomFeeForStudent'])
                ->name('destroy.student');

            Route::delete('/section', [FeesController::class, 'destroyCustomFeeForSection'])
                ->name('destroy.section');
        });
    });

    Route::prefix('reports')
        ->middleware(['web'])
        ->group(function () {

            Route::get(
                '/',
                fn() =>
                Inertia::render('Admin/Reports/Index')
            )->name('index');

            Route::post('/build', [ReportController::class, 'build'])
                ->name('build');

            Route::post('/export/csv', [ReportController::class, 'exportCsv'])
                ->name('export.csv');

            Route::post('/export/pdf', [ReportController::class, 'exportPdf'])
                ->name('export.pdf');

            Route::get('/presets', [ReportController::class, 'presets'])
                ->name('presets');

            Route::post('/presets', [ReportController::class, 'storePreset'])
                ->name('presets.store');

            Route::delete('/presets/{preset}', [ReportController::class, 'destroyPreset'])
                ->name('presets.destroy');


            Route::get(
                '/attendance',
                fn() =>
                Inertia::render('Admin/Reports/Attendance')
            )->name('attendance');


            Route::get(
                '/student',
                fn() => Inertia::render('Admin/Reports/Student')
            )->name('student');
        });

        Route::get('/students/list', function () {
    return Student::orderBy('name')
        ->get(['id', 'name', 'father_name']);
});


    // Route::prefix('reports')->name('reports.')->group(function () {


    // });
});
