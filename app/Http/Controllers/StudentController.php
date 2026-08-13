<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeResolver;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(
        private readonly MonthlyFeeResolver $monthlyFeeResolver,
        private readonly StudentReportCache $reportCache,
    ) {
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
