<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Section;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\SchoolClass;

class AdminAttendanceController extends Controller
{
    private function isKirtanClass(?string $type, ?string $name = null): bool
    {
        $normalized = strtolower(trim((string) ($type ?? '')));
        if (in_array($normalized, ['kirtan', 'kirtan class'], true)) {
            return true;
        }

        return str_contains(strtolower((string) ($name ?? '')), 'kirtan');
    }

    public function index()
    {
        return Inertia::render('Admin/Attendance/Index', [
            'classes' => SchoolClass::select('id', 'name', 'type')
                ->orderBy('name')
                ->get(),
        ]);
    }

    /* ---------------------------------------------
     | Build attendance grid
     --------------------------------------------- */
    public function grid(Request $request)
    {
        $request->validate([
            'section_id' => 'required|exists:sections,id',
            'year'       => 'required|integer',
            'month'      => 'required|integer|min:1|max:12',
        ]);

        $section = Section::with([
            'schoolClass',
            'studentSections.student',
        ])->findOrFail($request->section_id);

        $isKirtan = $this->isKirtanClass(
            $section->schoolClass->type ?? null,
            $section->schoolClass->name ?? null
        );

        $start = Carbon::create($request->year, $request->month, 1);
        $end   = $start->copy()->endOfMonth();

        /* ---------- Days ---------- */
        $days = [];
        for ($d = $start->copy(); $d <= $end; $d->addDay()) {
            $isSunday = $d->isSunday();

            $enabled = $isKirtan
                ? $isSunday
                : !$isSunday;

            $days[] = [
                'date'    => $d->toDateString(),
                'day'     => $d->format('d'),
                'enabled' => $enabled,
            ];
        }

        /* ---------- Students ---------- */
        $students = [];

        foreach ($section->studentSections as $enrollment) {
            $records = Attendance::where('student_section_id', $enrollment->id)
                ->whereBetween('date', [$start, $end])
                ->get()
                ->keyBy(fn ($r) => $enrollment->id . '-' . $r->date);

            $students[] = [
                'id'      => $enrollment->id,
                'name'    => $enrollment->student->name,
                'father_name' => $enrollment->student->father_name,
                'records' => $records->map(fn ($r) => [
                    'status'         => $r->status,
                    'lesson_learned' => $r->lesson_learned,
                ]),
            ];
        }

        return response()->json([
            'is_kirtan' => $isKirtan,
            'days'      => $days,
            'students'  => $students,
        ]);
    }

    /* ---------------------------------------------
     | Save attendance
     --------------------------------------------- */
public function save(Request $request)
{
    $request->validate([
        'section_id' => 'required|exists:sections,id',
        'year'       => 'required|integer',
        'month'      => 'required|integer',
        'records'    => 'array',
    ]);

    $section = Section::with('studentSections')->findOrFail($request->section_id);

    // Build lookup set
    $validIds = $section->studentSections
        ->pluck('id')
        ->map(fn ($id) => (string) $id)
        ->flip(); // FAST lookup

    foreach ($request->records as $key => $payload) {
        if (!is_array($payload) || !array_key_exists('status', $payload)) {
            continue;
        }

        // 🔥 Correct split
        [$studentSectionId, $date] = explode('-', $key, 2);

        // 🔐 HARD SAFETY
        if (!isset($validIds[$studentSectionId])) {
            continue; // ⛔ ignore instead of 403
        }

        $status = $payload['status'];
        $allowedStatuses = ['present', 'absent', 'leave'];

        if ($status === null) {
            Attendance::where([
                'student_section_id' => $studentSectionId,
                'date' => $date,
            ])->delete();
            continue;
        }

        if (!in_array($status, $allowedStatuses, true)) {
            continue;
        }

        Attendance::updateOrCreate(
            [
                'student_section_id' => $studentSectionId,
                'date'               => $date,
            ],
            [
                'status'         => $status,
                'lesson_learned' => $payload['lesson_learned'] ?? null,
            ]
        );
    }

    return response()->json(['success' => true]);
}

}
