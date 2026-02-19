<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeResolver;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private readonly MonthlyFeeResolver $monthlyFeeResolver)
    {
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
                Fee::firstOrCreate(
                    [
                        'student_section_id' => $enrollment->id,
                        'type' => 'monthly',
                        'month' => $month,
                    ],
                    [
                        'source' => 'monthly',
                        'title' => null,
                        'amount' => $resolvedFee,
                    ]
                );
            }
        }

        return redirect()->route('students.index');
    }
}
