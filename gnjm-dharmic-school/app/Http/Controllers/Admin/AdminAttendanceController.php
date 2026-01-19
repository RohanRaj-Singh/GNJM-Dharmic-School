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
            'studentSections.student',
        ])->findOrFail($request->section_id);

        $start = Carbon::create($request->year, $request->month, 1);
        $end   = $start->copy()->endOfMonth();

        /* ---------- Build days ---------- */
        $days = [];
        for ($d = $start->copy(); $d <= $end; $d->addDay()) {
            $isSunday = $d->isSunday();

            // Business rule
            $enabled =
                $section->schoolClass->type === 'kirtan'
                ? $isSunday
                : !$isSunday;

            $days[] = [
                'date'    => $d->toDateString(),
                'day'     => $d->format('d'),
                'enabled' => $enabled,
            ];
        }

        /* ---------- Build students ---------- */
        $students = [];
        foreach ($section->studentSections as $enrollment) {
            $student = $enrollment->student;

            $records = Attendance::where('student_section_id', $enrollment->id)
                ->whereBetween('date', [$start, $end])
                ->get()
                ->keyBy(fn($r) => $enrollment->id . '-' . $r->date);


            $students[] = [
                'id'      => $enrollment->id,
                'name'    => $student->name,
                'records' => $records->map(fn($r) => [
                    'status' => $r->status,
                ]),
            ];
        }

        return response()->json([
            'days'     => $days,
            'students' => $students,
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

        $section = Section::findOrFail($request->section_id);

        foreach ($request->records as $key => $status) {
            if (!$status) continue;

            [$studentSectionId, $date] = explode('-', $key);
            $section->studentSections()
    ->where('id', $studentSectionId)
    ->exists() || abort(403);

            Attendance::updateOrCreate(
                [
                    'student_section_id' => $studentSectionId,
                    'date' => $date,
                ],
                [
                    'status' => $status,
                ]
            );
        }

        return response()->json(['success' => true]);
    }
}
