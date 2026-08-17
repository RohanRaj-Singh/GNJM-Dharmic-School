<?php

namespace App\Services;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Business logic behind the admin Student roster (Sprint 1.1).
 *
 * Owns:
 *   - bulkUpsert — the roster editor's transactional write path. Owns
 *     the (student + enrollments + monthly fee) cascade, the status-
 *     machine guard (R3), and the (student_id, type, month) canonical
 *     fee identity (F3).
 *   - rosterRows — the shared query + JSON-shape used by admin/Index
 *     and admin/data. Single mapping function so the two consumers
 *     can never drift.
 *   - buildEnrollmentHistory — the per-student history JSON endpoint.
 *   - filterOptions — the class/section-filtered options query.
 *   - normalizeName — the title-cased name normaliser (shared utility).
 *
 * Thin CRUD (list / destroy / bulkDelete) stays in the controller — a
 * service with single-line wrappers would just be ceremony.
 *
 * Behaviour is pinned by:
 *   - tests/Feature/StudentBulkStatusSyncTest.php (R3 — student status
 *     stays in sync with enrollment reality across bulk updates).
 *   - tests/Feature/StudentBulkStatusMachineTest.php (status-machine
 *     guard — terminal statuses cannot be silently rolled back).
 *   - tests/Feature/StudentPromotionLifecycleTest.php (the promote flow
 *     drives the same status-machine + bulk-update paths).
 *   - tests/Feature/StudentAdminRoutesTest.php (admin/Index, admin/data,
 *     admin/options, admin/enrollment-history HTTP shape).
 *   - tests/Feature/StudentCrossDivisionVisibilityTest.php (cross-
 *     division visibility — students export picks up third+ divisions).
 */
class StudentService
{
    public function __construct(
        private readonly StudentStatusMachine $statusMachine,
        private readonly MonthlyFeeService $monthlyFeeService,
    ) {}

    /* ───────────────────────────────────────────────────────────
       Bulk upsert — roster editor write path (the workhorse)
       ─────────────────────────────────────────────────────────── */

    /**
     * Apply a roster bulk-update row set in one transaction. Each row
     * may upsert a Student + its enrollments + its monthly fees.
     *
     * Throws ValidationException if the status-machine guard refuses
     * a terminal-status flip — the caller wraps this in
     * DB::transaction(...) so the exception rolls back the entire
     * bulk operation.
     *
     * @param array<int, array<string, mixed>> $students
     */
    public function bulkUpsert(array $students, string $today): void
    {
        // Preload sections once per call so the inner loop doesn't N+1.
        // (The prior implementation used a `static $sectionMap` cache
        // inside the route closure for per-PHP-FPM-worker reuse; we
        // make it per-call here — the pluck is cheap and it removes
        // the Octane static-leak footgun where the same worker could
        // serve multiple requests after a section row has been
        // added/deleted.)
        $sectionMap = Section::pluck('class_id', 'id')->all();

        foreach ($students as $row) {

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
                    'name'         => $this->normalizeName($row['name']) ?? $row['name'],
                    'father_name'  => $this->normalizeName($row['father_name'] ?? null),
                    'father_phone' => $row['father_phone'] ?? null,
                    'mother_phone' => $row['mother_phone'] ?? null,
                    'status'       => $status,
                ])
                : Student::create([
                    'name'         => $this->normalizeName($row['name']) ?? $row['name'],
                    'father_name'  => $this->normalizeName($row['father_name'] ?? null),
                    'father_phone' => $row['father_phone'] ?? null,
                    'mother_phone' => $row['mother_phone'] ?? null,
                    'status'       => $status,
                ]);

            // ---- 2. Compute desired enrollments ----
            $incoming = collect($row['enrollments'] ?? [])
                ->filter(fn ($e) => !empty($e['section_id']))
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
                $this->monthlyFeeService->upsertForMonth($enrollment, $today);
            }

            // ---- 6. Keep students.status in sync with enrollment reality (R3) ----
            // Archiving the last active enrollment above orphans the student:
            // they'd appear "active" everywhere while having no active
            // enrollment. Demote to inactive unless explicitly overridden.
            if ($student->status === Student::STATUS_ACTIVE && !$student->hasActiveEnrollment()) {
                $student->update(['status' => Student::STATUS_INACTIVE]);
            }
        }
    }

    /* ───────────────────────────────────────────────────────────
       Shared roster query + JSON shape (admin/Index + admin/data)
       ─────────────────────────────────────────────────────────── */

    /**
     * Build the roster rows shared by `Admin/Students/Index` (Inertia)
     * and `/admin/students/data` (JSON). Single source of truth — the
     * two consumers can never drift.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function rosterRows(string $statusFilter = 'active'): Collection
    {
        $query = Student::with([
            'enrollments' => fn ($q) => $q->whereNull('transferred_at'),
            'enrollments.schoolClass',
            'enrollments.section',
        ])->orderBy('name');

        if ($statusFilter === 'active') {
            $query->whereHas('enrollments', fn ($q) =>
                $q->where('status', 'active')->whereNull('transferred_at')
            );
        }

        return $query->get()->map(fn (Student $s) => $this->mapStudentRow($s));
    }

    /**
     * Map a hydrated Student model into the JSON row shape consumed
     * by the admin roster pages. Public so a future cross-cutting
     * caller (CSV export, Accountant students page) can reuse the
     * shape without duplicating the field list.
     *
     * @return array<string, mixed>
     */
    public function mapStudentRow(Student $s): array
    {
        return [
            'id'           => $s->id,
            'name'         => $s->name,
            'father_name'  => $s->father_name,
            'father_phone' => $s->father_phone,
            'mother_phone' => $s->mother_phone,
            'status'       => $s->status,
            'enrollments'  => $s->enrollments->map(fn ($e) => [
                'id'           => $e->id,
                'class_id'     => (string) $e->class_id,
                'section_id'   => (string) $e->section_id,
                'class_name'   => $e->schoolClass->name,
                'section_name' => $e->section->name,
                'student_type' => $e->student_type,
                'status'       => $e->status,
            ])->values(),
        ];
    }

    /* ───────────────────────────────────────────────────────────
       Per-student enrollment history (admin/enrollment-history)
       ─────────────────────────────────────────────────────────── */

    /**
     * Build the per-enrollment history rows for the student detail
     * JSON endpoint. Caller wraps in `authorize('view', $student)`.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function buildEnrollmentHistory(Student $student): Collection
    {
        return StudentSection::where('student_id', $student->id)
            ->with(['schoolClass', 'section', 'attendance', 'fees.payments'])
            ->orderBy('started_at')
            ->get()
            ->map(fn (StudentSection $e) => $this->mapEnrollmentHistoryRow($e));
    }

    /**
     * @return array<string, mixed>
     */
    private function mapEnrollmentHistoryRow(StudentSection $e): array
    {
        return [
            'id'            => $e->id,
            'className'     => $e->schoolClass->name,
            'sectionName'   => $e->section->name,
            'startedAt'     => $e->started_at?->toDateString(),
            'transferredAt' => $e->transferred_at?->toDateString(),
            'outcome'       => $e->outcome,
            'status'        => $e->status,
            'attendance'    => [
                'present' => $e->attendance->where('status', 'present')->count(),
                'absent'  => $e->attendance->where('status', 'absent')->count(),
                'leave'   => $e->attendance->where('status', 'leave')->count(),
            ],
            'fees' => [
                'charged' => (int) $e->fees->sum('amount'),
                'paid'    => (int) $e->fees->filter(
                    fn ($f) => $f->payments->whereNull('deleted_at')->isNotEmpty()
                )->sum('amount'),
            ],
        ];
    }

    /* ───────────────────────────────────────────────────────────
       Options query (admin/options — report filter dropdowns)
       ─────────────────────────────────────────────────────────── */

    /**
     * Filtered student options for report filters. Returns a raw
     * stdClass collection (id, name, father_name) — Laravel's
     * response layer auto-serialises the rows to JSON.
     *
     * Empty classIds returns an empty collection immediately
     * (no DB hit) — protects against unfiltered queries that would
     * scan the whole students table.
     */
    public function filterOptions(array $classIds, array $sectionIds): Collection
    {
        $classIds = array_filter($classIds);
        $sectionIds = array_filter($sectionIds);

        if (empty($classIds)) {
            return collect();
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

    /* ───────────────────────────────────────────────────────────
       Name normalisation utility (shared by bulk-upsert + any future
       write path that takes user input)
       ─────────────────────────────────────────────────────────── */

    /**
     * Normalise an incoming name: trim, collapse whitespace,
     * lowercase, then Title-case. Returns null for null / empty-
     * after-trim input.
     */
    public function normalizeName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $normalized = Str::of($value)->squish()->lower()->title()->toString();
        return $normalized === '' ? null : $normalized;
    }
}
