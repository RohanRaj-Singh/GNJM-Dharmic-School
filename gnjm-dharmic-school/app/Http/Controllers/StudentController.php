<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\StudentSection;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function store(Request $request)
    {
        // Basic validation (minimal & safe)
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'father_name' => 'nullable|string|max:255',
            'class_id' => 'required|exists:classes,id',
            'section_id' => 'required|exists:sections,id',
            'student_type' => 'required|in:paid,free',
        ]);

        // Create student
        $student = Student::create([
            'name' => $data['name'],
            'father_name' => $data['father_name'] ?? null,
            'status' => 'active',
        ]);

        // Create enrollment (snapshot)
        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $data['class_id'],
            'section_id' => $data['section_id'],
            'student_type' => $data['student_type'],
            'monthly_fee' => $request->input('monthly_fee', 0),
        ]);

        return redirect('/students')
            ->with('success', 'Student added successfully');
    }
}
