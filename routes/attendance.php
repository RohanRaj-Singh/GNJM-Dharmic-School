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

        // Get date range from request, default to yesterday and before
        $today = Carbon::today();
        $yesterday = $today->copy()->subDay();
        $endDate = $yesterday; // By default, only show up to yesterday
        $startDate = $endDate->copy()->subDays(30); // Last 30 days by default

        $requestStart = request('start_date');
        $requestEnd = request('end_date');
        $hasCustomFilter = false;

        if ($requestStart) {
            $startDate = Carbon::parse($requestStart);
            $hasCustomFilter = true;
        }
        if ($requestEnd) {
            $endDate = Carbon::parse($requestEnd);
            $hasCustomFilter = true;
        }

        // Check if today is included in the filter
        $includeToday = request('include_today', false);

        $enrollments = StudentSection::with([
            'student',
            'section',
            'schoolClass',
            'attendance' => fn ($q) => $q->orderByDesc('date'),
        ])
            ->whereIn('section_id', $allowedSectionIds)
            ->get();

        $students = [];
        $todayAbsentees = []; // Track absent today separately

        foreach ($enrollments as $enrollment) {
            $isKirtanClass = $isClassType($enrollment->schoolClass->type ?? null, 'kirtan');

            $attendance = $enrollment->attendance
                // Filter by date range
                ->filter(function ($a) use ($startDate, $endDate, $includeToday, $today, $isKirtanClass) {
                    $date = Carbon::parse($a->date);
                    $isSunday = $date->dayOfWeek === Carbon::SUNDAY;
                    $validDay = $isKirtanClass ? $isSunday : !$isSunday;

                    if (!$validDay) return false;

                    // If not including today, exclude today
                    if (!$includeToday && $date->isSameDay($today)) {
                        return false;
                    }

                    return $date->gte($startDate) && $date->lte($endDate);
                })
                ->values();

            if ($attendance->isEmpty()) {
                continue;
            }

            // Check if absent TODAY (separate category)
            $todayAttendance = $enrollment->attendance
                ->filter(function ($a) use ($today, $isKirtanClass) {
                    $date = Carbon::parse($a->date);
                    $isSunday = $date->dayOfWeek === Carbon::SUNDAY;
                    $validDay = $isKirtanClass ? $isSunday : !$isSunday;
                    return $validDay && $date->isSameDay($today);
                })
                ->first();

            $todayStatus = $todayAttendance ? $normalizeStatus($todayAttendance->status) : null;

            // If absent today, add to today category
            if ($todayStatus === 'absent') {
                $todayAbsentees[] = [
                    'id' => $enrollment->student->id,
                    'name' => $enrollment->student->name,
                    'father_name' => $enrollment->student->father_name,
                    'section' => $enrollment->schoolClass->name . ' - ' . $enrollment->section->name,
                    'date' => $todayAttendance->date,
                    'category' => 'absent_today',
                ];
                // Don't include in streak calculation
                $attendance = $attendance->filter(fn($a) => $a->date !== $todayAttendance->date)->values();
            }

            if ($attendance->isEmpty()) {
                continue;
            }

            // Get all absent/leave dates for filtered view
            $absentDates = [];
            $leaveDates = [];

            foreach ($attendance as $record) {
                $status = $normalizeStatus($record->status);
                if ($status === 'absent') {
                    $absentDates[] = $record->date;
                } elseif ($status === 'leave') {
                    $leaveDates[] = $record->date;
                }
            }

            // Use latest available record within date range (up to yesterday when not including today)
            $lastDayRecord = $attendance->first();

            $status = $normalizeStatus($lastDayRecord->status);
            if (!in_array($status, ['absent', 'leave'], true)) {
                continue;
            }

            // Calculate streak - count consecutive absent/leave days
            // Start from the last day and go backwards
            $streak = 0;
            $streakStartDate = null;

            foreach ($attendance as $record) {
                if ($normalizeStatus($record->status) === $status) {
                    if ($streak === 0) {
                        $streakStartDate = Carbon::parse($record->date);
                    }
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

            // Calculate days count for display
            $daysCount = $streak;
            if ($streakStartDate && $streak > 1) {
                $daysCount = $streakStartDate->diffInDays(Carbon::parse($lastDayRecord->date)) + 1;
            }

            $students[] = [
                'id' => $enrollment->student->id,
                'name' => $enrollment->student->name,
                'father_name' => $enrollment->student->father_name,
                'section' => $enrollment->schoolClass->name . ' - ' . $enrollment->section->name,
                'date' => $lastDayRecord->date,
                'category' => $category,
                'streak_days' => $daysCount,
                'all_absent_dates' => $hasCustomFilter ? $absentDates : [],
                'all_leave_dates' => $hasCustomFilter ? $leaveDates : [],
            ];
        }

        return Inertia::render('Attendance/Absentees', [
            'students' => $students,
            'today_absentees' => $todayAbsentees,
            'filters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'include_today' => $includeToday,
                'has_custom_filter' => $hasCustomFilter,
            ],
        ]);
    })->name('attendance.absentees');
});
