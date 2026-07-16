<?php

namespace App\Http\Controllers;

use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\StudentLifecycleValidator;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentLifecycleController extends Controller
{
    public function __construct(
        private readonly StudentLifecycleValidator $validator,
        private readonly StudentReportCache $reportCache,
    ) {}

    /**
     * Promote a student to the next class.
     *
     * Validates, closes the current active enrollment (status=promoted,
     * transferred_at=now, outcome=promoted), and creates a new enrollment
     * in the target section.
     */
    public function promote(Request $request, Student $student)
    {
        $data = $request->validate([
            'section_id'     => 'required|exists:sections,id',
            'effective_date' => 'nullable|date',
        ]);

        // Validate the transition
        $result = $this->validator->canPromote($student);
        if (!$result->allowed) {
            return back()->withErrors(['lifecycle' => implode(' ', $result->warnings)]);
        }

        $targetSection = Section::findOrFail($data['section_id']);

        DB::transaction(function () use ($student, $targetSection, $data) {
            $effectiveDate = !empty($data['effective_date'])
                ? now()->parse($data['effective_date'])
                : now();

            // Close all active enrollments
            $activeEnrollments = StudentSection::where('student_id', $student->id)
                ->where('status', StudentSection::STATUS_ACTIVE)
                ->whereNull('transferred_at')
                ->get();

            foreach ($activeEnrollments as $enrollment) {
                $enrollment->update([
                    'status'         => StudentSection::STATUS_PROMOTED,
                    'transferred_at' => $effectiveDate,
                    'outcome'        => 'promoted',
                ]);
            }

            // Create new enrollment in the target section
            StudentSection::create([
                'student_id'  => $student->id,
                'class_id'    => $targetSection->class_id,
                'section_id'  => $targetSection->id,
                'status'      => StudentSection::STATUS_ACTIVE,
                'started_at'  => $effectiveDate,
                'student_type' => $activeEnrollments->first()?->student_type ?? 'paid',
            ]);

            // Student stays active (they have a new active enrollment)
            // No change to student.status
        });

        $this->reportCache->forget($student->id);

        return back()->with('success', 'Student promoted successfully.');
    }

    /**
     * Pass out a student (complete all studies).
     *
     * Closes all active enrollments and sets student status to passed_out.
     */
    public function passOut(Request $request, Student $student)
    {
        $result = $this->validator->canPassOut($student);
        if (!$result->allowed) {
            return back()->withErrors(['lifecycle' => implode(' ', $result->warnings)]);
        }

        DB::transaction(function () use ($student) {
            $activeEnrollments = StudentSection::where('student_id', $student->id)
                ->where('status', StudentSection::STATUS_ACTIVE)
                ->whereNull('transferred_at')
                ->get();

            foreach ($activeEnrollments as $enrollment) {
                $enrollment->update([
                    'status'         => StudentSection::STATUS_PASSED_OUT,
                    'transferred_at' => now(),
                    'outcome'        => 'passed_out',
                ]);
            }

            $student->update([
                'status' => Student::STATUS_PASSED_OUT,
            ]);
        });

        $this->reportCache->forget($student->id);

        return back()->with('success', 'Student passed out successfully.');
    }

    /**
     * Mark a student as left the school permanently.
     *
     * Only allowed if student is already inactive (safety gate).
     * Closes ALL enrollments regardless of their current status.
     */
    public function leaveSchool(Request $request, Student $student)
    {
        $result = $this->validator->canLeaveSchool($student);
        if (!$result->allowed) {
            return back()->withErrors(['lifecycle' => implode(' ', $result->warnings)]);
        }

        DB::transaction(function () use ($student) {
            // Close all enrollments (regardless of current status)
            $enrollments = StudentSection::where('student_id', $student->id)
                ->whereNull('transferred_at')
                ->get();

            foreach ($enrollments as $enrollment) {
                $enrollment->update([
                    'status'         => StudentSection::STATUS_LEFT,
                    'transferred_at' => now(),
                    'outcome'        => 'left',
                ]);
            }

            $student->update([
                'status' => Student::STATUS_LEFT,
            ]);
        });

        $this->reportCache->forget($student->id);

        return back()->with('success', 'Student marked as left the school.');
    }

    /**
     * Make a student inactive (temporary break).
     *
     * Sets all active enrollments to inactive. Does NOT set transferred_at
     * because the student may return.
     */
    public function makeInactive(Request $request, Student $student)
    {
        $result = $this->validator->canMakeInactive($student);
        if (!$result->allowed) {
            return back()->withErrors(['lifecycle' => implode(' ', $result->warnings)]);
        }

        DB::transaction(function () use ($student) {
            StudentSection::where('student_id', $student->id)
                ->where('status', StudentSection::STATUS_ACTIVE)
                ->whereNull('transferred_at')
                ->update([
                    'status' => StudentSection::STATUS_INACTIVE,
                    // transferred_at stays NULL — they may return
                ]);

            $student->update([
                'status' => Student::STATUS_INACTIVE,
            ]);
        });

        $this->reportCache->forget($student->id);

        return back()->with('success', 'Student marked as inactive.');
    }

    /**
     * Reactivate a student (return from temporary break).
     *
     * Sets all inactive enrollments back to active.
     */
    public function reactivate(Request $request, Student $student)
    {
        $result = $this->validator->canReactivate($student);
        if (!$result->allowed) {
            return back()->withErrors(['lifecycle' => implode(' ', $result->warnings)]);
        }

        DB::transaction(function () use ($student) {
            StudentSection::where('student_id', $student->id)
                ->where('status', StudentSection::STATUS_INACTIVE)
                ->update([
                    'status' => StudentSection::STATUS_ACTIVE,
                ]);

            $student->update([
                'status' => Student::STATUS_ACTIVE,
            ]);
        });

        $this->reportCache->forget($student->id);

        return back()->with('success', 'Student reactivated successfully.');
    }
}
