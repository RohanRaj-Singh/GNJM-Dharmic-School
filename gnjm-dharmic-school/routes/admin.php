<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Illuminate\Http\Request;
use App\Models\Student;
use App\Models\SchoolClass;
use App\Models\StudentSection;
use App\Models\Section;
use App\Http\Controllers\Admin\AdminAttendanceController;
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
            'enrollments' => function ($q) {
                $q->latest()->limit(1); // take latest enrollment
            }
        ])
            ->orderBy('name')
            ->get()
            ->map(function ($student) {

                $enrollment = $student->enrollments->first();

                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'father_name' => $student->father_name,
                    'father_phone' => $student->father_phone,
                    'mother_phone' => $student->mother_phone,
                    'status' => $student->status,

                    // 🔥 IMPORTANT PART
                    'class_id' => $enrollment?->class_id,
                    'section_id' => $enrollment?->section_id,
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

        foreach ($request->students as $row) {

            // 1️⃣ CREATE OR UPDATE STUDENT
            if (empty($row['id'])) {
                $student = Student::create([
                    'name' => $row['name'],
                    'father_name' => $row['father_name'] ?? null,
                    'father_phone' => $row['father_phone'] ?? null,
                    'mother_phone' => $row['mother_phone'] ?? null,
                    'status' => $row['status'] ?? 'active',
                ]);
            } else {
                $student = Student::findOrFail($row['id']);

                $student->update([
                    'name' => $row['name'],
                    'father_name' => $row['father_name'] ?? null,
                    'father_phone' => $row['father_phone'] ?? null,
                    'mother_phone' => $row['mother_phone'] ?? null,
                    'status' => $row['status'] ?? 'active',
                ]);
            }

            // 2️⃣ HANDLE ENROLLMENT (ONLY IF CLASS + SECTION PROVIDED)
            if (!empty($row['class_id']) && !empty($row['section_id'])) {

                StudentSection::updateOrCreate(
                    [
                        'student_id' => $student->id,
                    ],
                    [
                        'class_id'     => $row['class_id'],
                        'section_id'   => $row['section_id'],
                        'student_type' => $row['student_type'] ?? 'paid',
                    ]
                );
            }
        }

        return redirect()->back()->with('success', 'Students updated successfully');
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

