<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $table = 'attendance';

    protected $fillable = [
        'student_section_id',
        'date',
        'present',
        'lesson_learned',
    ];

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(StudentSection::class, 'student_section_id');
    }
}
