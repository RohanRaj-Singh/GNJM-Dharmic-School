<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Http\Request;
use App\Models\Student;
use App\Models\SchoolClass;
use App\Models\StudentSection;
use App\Models\Section;
use App\Http\Controllers\Admin\AdminAttendanceController;
use Illuminate\Support\Facades\DB;
/*
|--------------------------------------------------------------------------|
| Admin Area
|--------------------------------------------------------------------------|
*/

Route::prefix('admin')->name('admin.')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Dashboard
    |--------------------------------------------------------------------------
    */
    Route::get(
        '/dashboard',
        fn() =>
        Inertia::render('Admin/Dashboard')
    )->name('dashboard');

    /*
    |--------------------------------------------------------------------------
    | Utilities
    |--------------------------------------------------------------------------
    */
    Route::get(
        '/utilities',
        fn() =>
        Inertia::render('Admin/Utilities')
    )->name('utilities');

    /*
    |--------------------------------------------------------------------------
    | Students – UI Page
    |--------------------------------------------------------------------------
    */
    Route::get(
        '/students',
        fn() =>
        Inertia::render('Admin/Students/Index')
    )->name('students.index');

    /*
    |--------------------------------------------------------------------------
    | Students – Data (JSON for table)
    |--------------------------------------------------------------------------
    */
    Route::get('/students/data', function () {
    return Student::with([
        'enrollments.section.schoolClass' // eager load safely
    ])
        ->orderBy('name')
        ->get()
        ->map(function ($student) {

            return [
                'id' => $student->id,
                'name' => $student->name,
                'father_name' => $student->father_name,
                'father_phone' => $student->father_phone,
                'mother_phone' => $student->mother_phone,
                'status' => $student->status,

                // ✅ CORRECT SHAPE
                'enrollments' => $student->enrollments->map(fn ($e) => [
                    'class_id'   => (string) $e->class_id,   // STRING for React
                    'section_id' => (string) $e->section_id // STRING for React
                ])->values(),
            ];
        });
})->name('admin.students.data');


    Route::get('/classes/options', function () {
        return SchoolClass::select('id', 'name')
            ->orderBy('name')
            ->get();
    })->name('admin.classes.options');

    Route::get('/sections/options', function (Request $request) {
        $classId = $request->query('class_id');

        abort_if(!$classId, 400, 'class_id required');

        return Section::where('class_id', $classId) // ✅ FIXED
            ->select('id', 'name')
            ->orderBy('name')
            ->get();
    });




    /*
    |--------------------------------------------------------------------------
    | Students – Bulk Create / Update
    |--------------------------------------------------------------------------
    */
    Route::post('/students/bulk-update', function (Request $request) {

    DB::transaction(function () use ($request) {

        foreach ($request->students as $row) {

            /* ----------------------------
             | 1️⃣ CREATE / UPDATE STUDENT
             ---------------------------- */
            if (empty($row['id'])) {
                $student = Student::create([
                    'name'          => $row['name'],
                    'father_name'   => $row['father_name'] ?? null,
                    'father_phone'  => $row['father_phone'] ?? null,
                    'mother_phone'  => $row['mother_phone'] ?? null,
                    'status'        => $row['status'] ?? 'active',
                ]);
            } else {
                $student = Student::findOrFail($row['id']);

                $student->update([
                    'name'          => $row['name'],
                    'father_name'   => $row['father_name'] ?? null,
                    'father_phone'  => $row['father_phone'] ?? null,
                    'mother_phone'  => $row['mother_phone'] ?? null,
                    'status'        => $row['status'] ?? 'active',
                ]);
            }

            /* ----------------------------
             | 2️⃣ SYNC ENROLLMENTS
             ---------------------------- */
            $incoming = collect($row['enrollments'] ?? [])
                ->filter(fn ($e) => !empty($e['class_id']) && !empty($e['section_id']))
                ->map(fn ($e) => [
                    'class_id'     => (int) $e['class_id'],
                    'section_id'   => (int) $e['section_id'],
                    'student_type'=> $e['student_type'] ?? 'paid',
                ])
                ->unique(fn ($e) => $e['class_id'].'-'.$e['section_id'])
                ->values();

            // Delete removed enrollments
            StudentSection::where('student_id', $student->id)
                ->whereNotIn(
                    DB::raw("CONCAT(class_id, '-', section_id)"),
                    $incoming->map(fn ($e) => $e['class_id'].'-'.$e['section_id'])
                )
                ->delete();

            // Upsert enrollments
            foreach ($incoming as $enrollment) {
                StudentSection::updateOrCreate(
                    [
                        'student_id' => $student->id,
                        'class_id'   => $enrollment['class_id'],
                        'section_id' => $enrollment['section_id'],
                    ],
                    [
                        'student_type' => $enrollment['student_type'],
                    ]
                );
            }
        }
    });

    return back()->with('success', 'Students updated successfully');
});
    /* ===============================
     | Classes – Index Page
     =============================== */
    Route::get('/classes', function () {
        return Inertia::render('Admin/Classes/Index');
    })->name('admin.classes.index');

    /* ===============================
     | Classes – Data (JSON)
     =============================== */
    Route::get('/classes/data', function () {
        return SchoolClass::withCount('sections')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'default_monthly_fee',
                'status',
                'created_at',
            ]);
    })->name('admin.classes.data');

    /* ===============================
     | Classes – Store / Update
     =============================== */
    Route::post('/classes/save', function (Request $request) {

        foreach ($request->classes as $row) {

            // CREATE
            if (empty($row['id'])) {
                \App\Models\SchoolClass::create([
                    'name' => $row['name'],
                    'type' => $row['type'],
                    'default_monthly_fee' => $row['default_monthly_fee'] ?? 0,
                ]);
                continue;
            }

            // UPDATE (ONLY VALID COLUMNS)
            \App\Models\SchoolClass::where('id', $row['id'])->update([
                'name' => $row['name'],
                'type' => $row['type'],
                'default_monthly_fee' => $row['default_monthly_fee'] ?? 0,
            ]);
        }

        return redirect()->back();
    })->name('admin.classes.save');

    /*
    |--------------------------------------------------------------------------
    | Students – Delete
    |--------------------------------------------------------------------------
    */
    Route::delete('/students/{student}', function (Student $student) {
        $student->delete();

        return redirect()->back()->with('success', 'Student deleted');
    })->name('students.delete');

     Route::prefix('sections')->group(function () {

        /*
    | Sections – Page
    */
        Route::get(
            '/',
            fn() =>
            Inertia::render('Admin/Sections/Index')
        )->name('admin.sections.index');

        /*
    | Sections – Data (for table)
    */
        Route::get('/data', function () {
            return Section::with('schoolClass')
                ->withCount('studentSections')
                ->orderBy('name')
                ->get()
                ->map(fn($section) => [
                    'id' => $section->id,
                    'name' => $section->name,
                    'class_id' => $section->schoolClass?->id,
                    'class_name' => $section->schoolClass?->name,
                    'status' => $section->status ?? 'active',
                    'students_count' => $section->student_sections_count,
                ]);
        })->name('admin.sections.data');

        /*
    | Sections – Save (Bulk Create / Update)
    */
        Route::post('/save', function (Request $request) {

            foreach ($request->sections as $row) {

                // CREATE
                if (empty($row['id'])) {
                    Section::create([
                        'name'       => $row['name'],
                        'class_id'   => $row['class_id'],
                    ]);
                    continue;
                }

                // UPDATE
                Section::where('id', $row['id'])->update([
                    'name'       => $row['name'],
                    'class_id'   => $row['class_id'],
                ]);
            }

            return redirect()->back()->with('success', 'Sections saved successfully');
        })->name('admin.sections.save');

        Route::delete('/{section}', function (Section $section) {

            $hasStudents = StudentSection::where('section_id', $section->id)->exists();

            if ($hasStudents) {
                return redirect()->back()->withErrors([
                    'error' => 'Cannot delete section with enrolled students.',
                ]);
            }

            $section->delete();

            return redirect()->back()->with([
                'success' => 'Section deleted successfully.',
            ]);
        })->name('admin.sections.delete');

        return redirect()->back()->with('success','Attendance saved');
    });


      /* ================= Attendance (Admin) ================= */

    // PAGE (Inertia)

Route::get('/attendance',
    [AdminAttendanceController::class, 'index']
)->name('attendance.index');

    // DATA (JSON)
    Route::get('/attendance/grid',
        [AdminAttendanceController::class, 'grid']
    )->name('attendance.grid');

    // SAVE (JSON)
    Route::post('/attendance/save',
        [AdminAttendanceController::class, 'save']
    )->name('attendance.save');
});

