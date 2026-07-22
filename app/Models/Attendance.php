<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $table = 'attendance';

    protected $fillable = [
        'student_id',
        'student_section_id',
        'date',
        'status',
        'lesson_learned',
        'lesson_note',
    ];

    // ── Boot ──

    protected static function booted(): void
    {
        static::creating(function (Attendance $attendance) {
            if (!$attendance->student_id && $attendance->student_section_id) {
                $attendance->student_id = (int) StudentSection::where('id', $attendance->student_section_id)
                    ->value('student_id');
            }
        });
    }

    // ── Relationships ──

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(StudentSection::class, 'student_section_id');
    }
    public function studentSection()
    {
        return $this->belongsTo(StudentSection::class);
    }
}
