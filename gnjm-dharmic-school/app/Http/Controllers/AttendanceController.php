<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\StudentSection;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'student_section_id' => 'required|exists:student_sections,id',
            'date' => 'required|date',
            'present' => 'required|boolean',
            'lesson_learned' => 'nullable|boolean',
        ]);

        Attendance::updateOrCreate(
            [
                'student_section_id' => $data['student_section_id'],
                'date' => $data['date'],
            ],
            [
                'present' => $data['present'],
                'lesson_learned' => $data['lesson_learned'] ?? null,
            ]
        );

        return response()->json(['success' => true]);
    }
}
