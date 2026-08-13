<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeService;
use App\Services\StudentStatusMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class StudentController extends Controller
{
    public function __construct(
        private readonly StudentStatusMachine $statusMachine,
    ) {}

    /**
     * Admin student roster (Inertia page).
     *
     * Extracted verbatim from the former routes/admin.php closure (P2).
     */
    public function index(Request $request)
    {
        $statusFilter = $request->get('status', 'active');

        $query = Student::with([
            'enrollments' => fn($q) => $q->whereNull('transferred_at'),
            'enrollments.schoolClass',
            'enrollments.section',
        ])->orderBy('name');

        if ($statusFilter === 'active') {
            $query->whereHas('enrollments', fn($q) =>
                $q->where('status', 'active')->whereNull('transferred_at')
            );
        }

        $students = $query->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'father_name' => $s->father_name,
                'father_phone' => $s->father_phone,
                'mother_phone' => $s->mother_phone,
                'status' => $s->status,
                'enrollments' => $s->enrollments->map(fn($e) => [
                    'id' => $e->id,
                    'class_id' => (string) $e->class_id,
                    'section_id' => (string) $e->section_id,
                    'class_name' => $e->schoolClass->name,
                    'section_name' => $e->section->name,
                    'student_type' => $e->student_type,
                    'status' => $e->status,
                ]),
            ]);

        return Inertia::render('Admin/Students/Index', [
            'students' => $students,
            'classes' => SchoolClass::select('id', 'name')->orderBy('name')->get(),
            'filters' => $request->only(['status']),
        ]);
    }

    /**
     * Student options list for the teacher roster picker.
     */
    public function list(Request $request)
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
            : Student::with(['enrollments' => function ($q) {
                $q->where('status', 'active')->whereNull('transferred_at');
            }, 'enrollments.schoolClass', 'enrollments.section'])->get();

        return $students;
    }

    /**
     * JSON roster with status filter.
     */
    public function data(Request $request)
    {
        $statusFilter = $request->get('status', 'active');

        $query = Student::with([
            'enrollments' => fn ($q) => $q->whereNull('transferred_at'),
            'enrollments.schoolClass',
            'enrollments.section',
        ])->orderBy('name');

        if ($statusFilter === 'active') {
            $query->whereHas('enrollments', fn ($q) => $q->where('status', 'active')->whereNull('transferred_at'));
        }

        return $query->get()->map(fn($s) => [
            'id' => $s->id,
            'name' => $s->name,
            'father_name' => $s->father_name,
            'father_phone' => $s->father_phone,
            'mother_phone' => $s->mother_phone,
            'status' => $s->status,
            'enrollments' => $s->enrollments->map(fn($e) => [
                'id' => $e->id,
                'class_id' => (string) $e->class_id,
                'section_id' => (string) $e->section_id,
                'class_name' => $e->schoolClass->name,
                'section_name' => $e->section->name,
                'student_type' => $e->student_type,
                'status' => $e->status ?? 'active',
            ])->values(),
        ]);
    }

    /**
     * Filtered student options for report filters.
     */
    public function options(Request $request)
    {
        $classIds = (array) ($request->class_ids ?? []);
        $sectionIds = (array) ($request->section_ids ?? []);
        $classIds = array_filter($classIds);
        $sectionIds = array_filter($sectionIds);

        if (empty($classIds)) {
            return [];
        }

        $query = DB::table('students')
            ->join('student_sections', 'students.id', '=', 'student_sections.student_id')
            ->whereIn('student_sections.class_id', $classIds)
            ->where('student_sections.status', 'active')
            ->whereNull('student_sections.transferred_at')
            ->select('students.id', 'students.name', 'students.father_name');

        if (!empty($sectionIds)) {
            $query->whereIn('student_sections.section_id', $sectionIds);
        }

        return $query->distinct()->orderBy('students.name')->get();
    }

    /**
     * Bulk upsert students and their enrollments from the roster editor.
     *
     * Extracted verbatim from the former routes/admin.php closure. Protected by
     * tests/Feature/StudentBulkStatusSyncTest.
     */
    public function bulkUpdate(Request $request)
    {
        $this->authorize('update', Student::class);

        DB::transaction(function () use ($request) {

            // Preload all sections into a memory map (class_id by section_id).
            // This replaces N individual Section::find() calls (one per enrollment)
            // with a single bulk query. In PHP-FPM the static cache is per-request,
            // so it never goes stale across requests.
            static $sectionMap = [];

            if (empty($sectionMap)) {
                $sectionMap = Section::pluck('class_id', 'id')->all();
            }

            $formatName = function (?string $value): ?string {
                if ($value === null) return null;
                $normalized = Str::of($value)->squish()->lower()->title()->toString();
                return $normalized === '' ? null : $normalized;
            };

            $today = now(config('app.timezone'))->format('Y-m');
            $monthlyFeeService = app(MonthlyFeeService::class);

            foreach ($request->students as $row) {

                // ---- 1. Upsert student (name, father, phone, status) ----
                $existingStudent = empty($row['id']) ? null : Student::findOrFail($row['id']);
                $status = $row['status'] ?? Student::STATUS_ACTIVE;

                // Status-machine guard: the roster form only ever sends
                // active/inactive, but a terminal status (promoted/passed_out/
                // left) must never be silently changed back through this bulk
                // endpoint. Same-state submissions pass through as no-ops.
                if ($existingStudent
                    && $status !== $existingStudent->status
                    && !$this->statusMachine->canTransition($existingStudent->status, $status)) {
                    throw ValidationException::withMessages([
                        'students' => "Cannot change \"{$existingStudent->name}\" from "
                            . "\"{$existingStudent->status}\" to \"{$status}\".",
                    ]);
                }

                $student = $existingStudent
                    ? tap($existingStudent)->update([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $status,
                    ])
                    : Student::create([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $status,
                    ]);

                // ---- 2. Compute desired enrollments ----
                $incoming = collect($row['enrollments'] ?? [])
                    ->filter(fn($e) => !empty($e['section_id']))
                    ->unique('section_id')
                    ->keyBy('section_id');

                // ---- 3. Archive orphaned active enrollments (NOT delete — preserves fees + attendance) ----
                StudentSection::where('student_id', $student->id)
                    ->where('status', 'active')
                    ->whereNull('transferred_at')
                    ->whereNotIn('section_id', $incoming->keys())
                    ->update([
                        'status'         => StudentSection::STATUS_INACTIVE,
                        'transferred_at' => now(),
                    ]);

                // ---- 4. Upsert each incoming enrollment ----
                foreach ($incoming as $e) {
                    $sectionId = (int) $e['section_id'];
                    $classId   = $sectionMap[$sectionId] ?? null;
                    if (!$classId) continue;

                    $studentType = $e['student_type'] === 'free' ? 'free' : 'paid';
                    $enrollmentStatus = $e['status'] ?? 'active';

                    $enrollment = StudentSection::firstOrCreate(
                        [
                            'student_id' => $student->id,
                            'class_id'   => $classId,
                            'section_id' => $sectionId,
                        ],
                        ['student_type' => $studentType, 'status' => $enrollmentStatus]
                    );

                    if ($enrollment->status !== $enrollmentStatus) {
                        $enrollment->update(['status' => $enrollmentStatus]);
                    }

                    if ($enrollment->student_type !== $studentType) {
                        $enrollment->update(['student_type' => $studentType]);
                    }

                    // If this was an archived enrollment being re-activated, restore it
                    if ($enrollment->status === 'active' && $enrollment->transferred_at !== null) {
                        $enrollment->update(['transferred_at' => null, 'started_at' => now()]);
                    }

                    if ($enrollmentStatus !== 'active') continue;

                    if ($studentType === 'free') {
                        // Delete unpaid monthly fees for this student (may be on any enrollment)
                        DB::table('fees as f')
                            ->join('student_sections', 'f.student_section_id', '=', 'student_sections.id')
                            ->where('student_sections.student_id', $student->id)
                            ->where('f.type', 'monthly')
                            ->whereNotExists(function ($q) {
                                $q->selectRaw('1')
                                    ->from('payments')
                                    ->whereColumn('payments.fee_id', '=', 'f.id')
                                    ->whereNull('payments.deleted_at');
                            })
                            ->delete();
                        continue;
                    }

                    // ---- 5. Upsert monthly fee ----
                    // Keyed by (student_id, type, month) so changing section/class
                    // doesn't create a duplicate fee for the same month (F3).
                    $monthlyFeeService->upsertForMonth($enrollment, $today);
                }

                // ---- 6. Keep students.status in sync with enrollment reality (R3) ----
                // Archiving the last active enrollment above orphans the student:
                // they'd appear "active" everywhere while having no active
                // enrollment. Demote to inactive unless explicitly overridden.
                if ($student->status === Student::STATUS_ACTIVE && !$student->hasActiveEnrollment()) {
                    $student->update(['status' => Student::STATUS_INACTIVE]);
                }
            }
        });

        return back()->with('success', 'Students updated');
    }

    /**
     * JSON enrollment history for the student detail view.
     */
    public function enrollmentHistory(Student $student)
    {
        $this->authorize('view', $student);

        $enrollments = StudentSection::where('student_id', $student->id)
            ->with(['schoolClass', 'section', 'attendance', 'fees.payments'])
            ->orderBy('started_at')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'className' => $e->schoolClass->name,
                'sectionName' => $e->section->name,
                'startedAt' => $e->started_at?->toDateString(),
                'transferredAt' => $e->transferred_at?->toDateString(),
                'outcome' => $e->outcome,
                'status' => $e->status,
                'attendance' => [
                    'present' => $e->attendance->where('status', 'present')->count(),
                    'absent' => $e->attendance->where('status', 'absent')->count(),
                    'leave' => $e->attendance->where('status', 'leave')->count(),
                ],
                'fees' => [
                    'charged' => (int) $e->fees->sum('amount'),
                    'paid' => (int) $e->fees->filter(fn ($f) => $f->payments->whereNull('deleted_at')->isNotEmpty())->sum('amount'),
                ],
            ]);

        return response()->json($enrollments);
    }

    /**
     * Delete a single student (hard delete).
     */
    public function destroy(Student $student)
    {
        $this->authorize('delete', $student);

        DB::transaction(function () use ($student) {
            $student->delete();
        });
        return back(303);
    }

    /**
     * Delete multiple students in one transaction.
     */
    public function bulkDelete(Request $request)
    {
        $this->authorize('delete', Student::class);

        $request->validate([
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'integer|exists:students,id',
        ]);

        DB::transaction(function () use ($request) {
            Student::whereIn('id', $request->student_ids)->delete();
        });

        return response()->json([
            'success' => true,
            'deleted' => count($request->student_ids),
        ]);
    }
}
