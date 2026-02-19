<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Section;
use App\Models\StudentSection;
use App\Http\Controllers\AttendanceController;
use Carbon\Carbon;

Route::prefix('attendance')->group(function () {
    $isClassType = function (?string $type, string $needle): bool {
        $normalized = strtolower(trim((string) $type));
        if ($normalized === '') {
            return false;
        }

        return $normalized === $needle || str_contains($normalized, $needle);
    };

    Route::get('/', fn () =>
        Inertia::render('Attendance/Dashboard')
    )->name('attendance.dashboard');

    /* ===============================
       SECTIONS LIST
    ================================ */
    Route::get('/sections', function () {
        $user = auth()->user();

        $sections = $user->isTeacher()
            ? Section::whereIn(
                'id',
                $user->sections->pluck('id')
              )->with('schoolClass')->get()
            : Section::with('schoolClass')->get();

        return Inertia::render('Attendance/Sections', [
            'sections' => $sections,
        ]);
    })->name('attendance.sections');

    /* ===============================
       MARK ATTENDANCE
    ================================ */
    Route::get('/sections/{section}', function (Section $section) use ($isClassType) {

        $user = auth()->user();

        /* ---------- Teacher access ---------- */
        if ($user->isTeacher()) {
            abort_unless(
                $user->sections->pluck('id')->contains($section->id),
                403
            );
        }

        /* ---------- Load relations ---------- */
        $section->load([
            'schoolClass',
            'studentSections.student',
        ]);

        /* ---------- Day rules ---------- */
        $today = now()->dayOfWeek; // 0 = Sunday
        $classType = $section->schoolClass->type;

        if ($today === 0 && $isClassType($classType, 'gurmukhi')) {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Gurmukhi attendance cannot be marked on Sunday.');
        }

        if ($today !== 0 && $isClassType($classType, 'kirtan')) {
            return redirect()
                ->route('attendance.sections')
                ->with('error', '📅 Kirtan attendance can only be marked on Sunday.');
        }

        /* ---------- Attendance ---------- */
        $hasAttendanceToday = $section->attendance()
            ->whereDate('date', today())
            ->exists();

        return Inertia::render('Attendance/Mark', [
            'section' => $section,
            'hasAttendanceToday' => $hasAttendanceToday,
            'existingAttendance' => $hasAttendanceToday
                ? $section->attendance()
                    ->with('studentSection.student')
                    ->whereDate('date', today())
                    ->get()
                : [],
        ]);
    })->name('attendance.mark');

    /* ===============================
       SAVE ATTENDANCE
    ================================ */
    Route::post('/', [AttendanceController::class, 'store'])
        ->name('attendance.store');

    /* ===============================
       ABSENTEES
    ================================ */
    Route::get('/absentees', function () use ($isClassType) {
        $user = auth()->user();
        $normalizeStatus = function ($raw) {
            $value = strtolower(trim((string) $raw));
            return match ($value) {
                'a', 'absent' => 'absent',
                'l', 'leave' => 'leave',
                'p', 'present' => 'present',
                default => $value,
            };
        };

        $allowedSectionIds = $user->isTeacher()
            ? $user->sections->pluck('id')->all()
            : Section::pluck('id')->all();

        $enrollments = StudentSection::with([
            'student',
            'section',
            'schoolClass',
            'attendance' => fn ($q) => $q->orderByDesc('date'),
        ])
            ->whereIn('section_id', $allowedSectionIds)
            ->get();

        $students = [];
        foreach ($enrollments as $enrollment) {
            if (!$isClassType($enrollment->schoolClass->type ?? null, 'gurmukhi')) {
                continue;
            }

            $attendance = $enrollment->attendance
                ->filter(fn ($a) => Carbon::parse($a->date)->dayOfWeek !== Carbon::SUNDAY)
                ->values();

            if ($attendance->isEmpty()) {
                continue;
            }

            // Use latest available non-Sunday record, not a fixed calendar day.
            $lastDayRecord = $attendance->first();

            $status = $normalizeStatus($lastDayRecord->status);
            if (!in_array($status, ['absent', 'leave'], true)) {
                continue;
            }

            $streak = 0;
            foreach ($attendance as $record) {
                if ($normalizeStatus($record->status) === $status) {
                    $streak++;
                } else {
                    break;
                }
            }

            if ($status === 'absent') {
                $category = $streak >= 3 ? 'absent_3_plus' : ($streak === 2 ? 'absent_2' : 'absent_1');
            } else {
                $category = $streak >= 2 ? 'leave_2_plus' : 'leave_1';
            }

            $students[] = [
                'id' => $enrollment->student->id,
                'name' => $enrollment->student->name,
                'father_name' => $enrollment->student->father_name,
                'section' => $enrollment->schoolClass->name . ' - ' . $enrollment->section->name,
                'date' => $lastDayRecord->date,
                'category' => $category,
            ];
        }

        return Inertia::render('Attendance/Absentees', [
            'students' => $students,
        ]);
    })->name('attendance.absentees');
});
