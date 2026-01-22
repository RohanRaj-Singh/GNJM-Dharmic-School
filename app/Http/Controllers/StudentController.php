<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use Illuminate\Http\Request;

class StudentController extends Controller
{
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

        // 1️⃣ Create student
        $student = Student::create([
            'name' => $validated['name'],
            'father_name' => $validated['father_name'] ?? null,
            'father_phone' => $validated['father_phone'] ?? null,
            'mother_phone' => $validated['mother_phone'] ?? null,
            'status' => 'active',
        ]);

        // 2️⃣ Get section + class
        $section = Section::with('schoolClass')->findOrFail($validated['section_id']);

        // 3️⃣ Create enrollment
        $enrollment = StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $section->schoolClass->id,
            'section_id'   => $section->id,
            'student_type' => $validated['student_type'],
        ]);

        // 4️⃣ Auto-generate CURRENT month fee (PAID students only)
        if ($validated['student_type'] === 'paid') {

            $resolvedFee =
                $enrollment->monthly_fee > 0
                    ? $enrollment->monthly_fee
                    : $section->schoolClass->default_monthly_fee;

            if ($resolvedFee > 0) {
                Fee::firstOrCreate(
                    [
                        'student_section_id' => $enrollment->id,
                        'type' => 'monthly',
                        'month' => now()->format('Y-m'),
                    ],
                    [
                        'source' => 'monthly',
                        'title' => null,
                        'amount' => $resolvedFee,
                    ]
                );
            }
        }

        return redirect()->route('accountant.students.index');
    }
}
