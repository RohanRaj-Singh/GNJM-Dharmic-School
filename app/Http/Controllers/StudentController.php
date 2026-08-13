<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeResolver;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StudentController extends Controller
{
    public function __construct(
        private readonly MonthlyFeeResolver $monthlyFeeResolver,
        private readonly StudentReportCache $reportCache,
    ) {
    }

    public function index()
    {
        $user = auth()->user();

        $students = $user->isTeacher()
            ? Student::whereHas('enrollments', function ($q) use ($user) {
                $q->whereIn(
                    'section_id',
                    $user->sections->pluck('id')
                )->where('status', 'active')->whereNull('transferred_at');
            })
            ->with(['enrollments' => function ($q) {
                $q->where('status', 'active')->whereNull('transferred_at');
            }, 'enrollments.schoolClass', 'enrollments.section'])
            ->get()
            : Student::with([
                'enrollments' => function ($q) {
                    $q->where('status', 'active')->whereNull('transferred_at');
                },
                'enrollments.schoolClass',
                'enrollments.section',
            ])->get();

        return Inertia::render('Students/Index', [
            'students' => $students,
        ]);
    }

    public function create()
    {
        return Inertia::render('Students/Create', [
            'classes' => SchoolClass::with('sections')->get(),
        ]);
    }

    public function show(Student $student)
    {
        $user = auth()->user();

        if ($user->isTeacher()) {
            $allowed = $student->enrollments()
                ->where('status', 'active')
                ->whereNull('transferred_at')
                ->whereIn('section_id', $user->sections->pluck('id'))
                ->exists();

            abort_unless($allowed, 403);
        }

        $student->load([
            'enrollments' => function ($q) {
                $q->orderByDesc('started_at');
            },
            'enrollments.schoolClass',
            'enrollments.section',
            'enrollments.attendance' => fn ($q) => $q->orderByDesc('date'),
            'enrollments.fees.payments',
        ]);

        // Group enrollments by class type so a student with both Gurmukhi and
        // Kirtan appears once per type. Within each group we merge attendance
        // and fees from all enrollments (current + archived) so no data is lost
        // after a section change, but sections are NOT duplicated.
        $grouped = collect();
        foreach ($student->enrollments as $enrollment) {
            // Resolve the type from the school class, falling back to the class
            // name so that a Kirtan class with a missing type field is still
            // recognised correctly.
            $class  = $enrollment->schoolClass;
            $type   = $class?->type;
            if (!$type || trim($type) === '') {
                $name = $class?->name ?? '';
                $type = str_contains(strtolower($name), 'kirtan') ? 'kirtan' : 'gurmukhi';
            }
            $type = strtolower(trim($type));

            if (!isset($grouped[$type])) $grouped[$type] = collect();
            $grouped[$type]->push($enrollment);
        }

        $summary = $grouped->map(function ($enrollments, $type) {
            $currentEnrollment = $enrollments
                ->firstWhere(fn ($e) => $e->status === 'active' && $e->transferred_at === null);
            $displayEnrollment = $currentEnrollment ?? $enrollments->first();

            // Merge attendance from ALL enrollments in this group
            $allAttendance = $enrollments->flatMap(fn ($e) => $e->attendance);

            // Merge fees from ALL enrollments in this group
            $allFees = $enrollments->flatMap(fn ($e) => $e->fees);

            $paidFees = $allFees->filter(fn ($f) => $f->payments->isNotEmpty());
            $unpaidFees = $allFees->filter(fn ($f) => $f->payments->isEmpty());

            return [
                'class_type_key' => $type,   // guaranteed 'gurmukhi' or 'kirtan'
                'class'          => $displayEnrollment->schoolClass->name,
                'class_type'     => $displayEnrollment->schoolClass->type,
                'section'        => $displayEnrollment->section->name,
                'attendance'  => [
                    'present' => $allAttendance->where('status', 'present')->count(),
                    'absent'  => $allAttendance->where('status', 'absent')->count(),
                    'leave'   => $allAttendance->where('status', 'leave')->count(),
                    'recent'  => $allAttendance->sortBy('date')->map(fn ($a) => [
                        'date'           => $a->date,
                        'status'         => $a->status,
                        'lesson_learned' => $a->lesson_learned ?? false,
                        'lesson_note'    => $a->lesson_note ?? null,
                    ])->values(),
                ],
                'fees' => [
                    'all_paid'      => $unpaidFees->isEmpty(),
                    'total'         => $allFees->sum('amount'),
                    'paid'          => $paidFees->sum('amount'),
                    'pending'       => $unpaidFees->sum('amount'),
                    'unpaid_months' => $unpaidFees
                        ->map(fn ($f) => $f->month ?? $f->title)
                        ->values(),
                ],
            ];
        })->values();

        return Inertia::render('Students/Show', [
            'student' => $student,
            'summary' => $summary,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'father_name' => 'nullable|string|max:255',
            'father_phone' => 'nullable|string|max:20',
            'mother_phone' => 'nullable|string|max:20',
            'section_id' => 'required|exists:sections,id',
            'student_type' => 'required|in:paid,free',
        ]);

        $student = Student::create([
            'name' => $validated['name'],
            'father_name' => $validated['father_name'] ?? null,
            'father_phone' => $validated['father_phone'] ?? null,
            'mother_phone' => $validated['mother_phone'] ?? null,
            'status' => 'active',
        ]);

        $section = Section::with('schoolClass')->findOrFail($validated['section_id']);

        $enrollment = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $section->schoolClass->id,
            'section_id' => $section->id,
            'student_type' => $validated['student_type'],
        ]);

        if ($validated['student_type'] === 'paid') {
            $month = now(config('app.timezone'))->format('Y-m');
            $resolvedFee = $this->monthlyFeeResolver->resolveForMonth($enrollment, $month);

            if ($resolvedFee > 0) {
                // Canonical identity: fees belong to the student, not the enrollment (F3).
                // Keying by student_id (not student_section_id) means a mid-month section
                // change reuses the existing monthly fee instead of creating a duplicate
                // that the unique index (student_id, type, month) would reject.
                Fee::firstOrCreate(
                    [
                        'student_id' => $student->id,
                        'type' => 'monthly',
                        'month' => $month,
                    ],
                    [
                        'student_section_id' => $enrollment->id,
                        'source' => 'monthly',
                        'title' => null,
                        'amount' => $resolvedFee,
                    ]
                );
            }
        }

        $this->reportCache->forget($student->id);

        return redirect()->route('students.index');
    }
}
