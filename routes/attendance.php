<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Http\Controllers\AttendanceController;

/*
|--------------------------------------------------------------------------
| Attendance Role (Marking Only)
|--------------------------------------------------------------------------
*/
Route::prefix('attendance')->group(function () {

    Route::get('/', fn () =>
        Inertia::render('Attendance/Dashboard')
    )->name('attendance.dashboard');

    Route::get('/sections', fn () =>
        Inertia::render('Attendance/Sections', [
            'sections' => Section::with('schoolClass')
                ->whereHas('schoolClass', fn ($q) =>
                    $q->where('name', 'Gurmukhi')
                )
                ->get(),
        ])
    )->name('attendance.sections');

    Route::get('/sections/{section}', function (Section $section) {

        $today = now()->toDateString();

        $section->load([
            'schoolClass',
            'studentSections.student',
            'studentSections.attendance' => fn ($q) =>
                $q->where('date', $today),
        ]);

        $records = $section->studentSections->map(function ($ss) {
            $attendance = $ss->attendance->first();

            return [
                'student_id' => $ss->student->id,
                'name' => $ss->student->name,
                'status' => $attendance?->status,
                'lesson_learned' => (bool) $attendance?->lesson_learned,
                'has_record' => (bool) $attendance,
            ];
        });

        return Inertia::render('Attendance/Mark', [
            'section' => $section,
            'existingAttendance' => $records,
            'hasAttendanceToday' => $records->every(fn ($r) => $r['has_record']),
        ]);
    })->name('attendance.mark');
});

/*
|--------------------------------------------------------------------------
| Attendance Store
|--------------------------------------------------------------------------
*/
Route::post('/attendance', [AttendanceController::class, 'store'])
    ->name('attendance.store');
