<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\StudentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Admin student roster, history, and bulk-edit endpoints.
 *
 * Business logic lives in `App\Services\StudentService` (Sprint 1.1
 * extraction). This controller owns the HTTP shape only:
 *   - authz via Policy methods (`authorize('update', ...)` etc.)
 *   - request validation + filter extraction
 *   - DB::transaction wrap (so service-defined exceptions roll back
 *     the unit of work)
 *   - Inertia render / JSON response wrapping
 *
 * Behaviour is pinned by the same five feature tests that pin the
 * service — the HTTP contract is unchanged.
 */
class StudentController extends Controller
{
    public function __construct(
        private readonly StudentService $studentService,
    ) {}

    /**
     * Admin student roster (Inertia page).
     */
    public function index(Request $request)
    {
        $statusFilter = $request->get('status', 'active');

        return Inertia::render('Admin/Students/Index', [
            'students' => $this->studentService->rosterRows($statusFilter),
            'classes'  => SchoolClass::select('id', 'name')->orderBy('name')->get(),
            'filters'  => $request->only(['status']),
        ]);
    }

    /**
     * Student options list for the teacher roster picker.
     *
     * Kept in the controller on purpose: it's teacher-scoped (uses
     * `$user->sections`) and teacher-only — not a shared admin
     * shape. Extracting it into the service would add a User-shaped
     * dependency without a corresponding consumer.
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
        return $this->studentService->rosterRows($statusFilter);
    }

    /**
     * Filtered student options for report filters.
     */
    public function options(Request $request)
    {
        $classIds = (array) ($request->class_ids ?? []);
        $sectionIds = (array) ($request->section_ids ?? []);
        return $this->studentService->filterOptions($classIds, $sectionIds);
    }

    /**
     * Bulk upsert students and their enrollments from the roster editor.
     *
     * The transaction wraps the service call so a status-machine
     * ValidationException (or any DB error) rolls back the entire bulk
     * operation — the roster editor's "all or nothing" contract.
     */
    public function bulkUpdate(Request $request)
    {
        $this->authorize('update', Student::class);

        $today = now(config('app.timezone'))->format('Y-m');

        DB::transaction(function () use ($request, $today) {
            $this->studentService->bulkUpsert($request->students ?? [], $today);
        });

        return back()->with('success', 'Students updated');
    }

    /**
     * JSON enrollment history for the student detail view.
     */
    public function enrollmentHistory(Student $student)
    {
        $this->authorize('view', $student);

        return response()->json(
            $this->studentService->buildEnrollmentHistory($student)
        );
    }

    /**
     * Delete a single student (hard delete).
     */
    public function destroy(Student $student)
    {
        $this->authorize('delete', $student);

        DB::transaction(fn () => $student->delete());
        return back(303);
    }

    /**
     * Delete multiple students in one transaction.
     */
    public function bulkDelete(Request $request)
    {
        $this->authorize('delete', Student::class);

        $request->validate([
            'student_ids'   => 'required|array|min:1',
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
