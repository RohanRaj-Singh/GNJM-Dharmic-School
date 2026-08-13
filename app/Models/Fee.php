<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fee extends Model
{
    protected $fillable = [
        'student_id',
        'student_section_id',
        'type',
        'batch_id',
        'title',
        'amount',
        'is_locked',
        'month',
    ];

    // ── Boot ──

    protected static function booted(): void
    {
        static::creating(function (Fee $fee) {
            if (!$fee->student_id && $fee->student_section_id) {
                $fee->student_id = (int) StudentSection::where('id', $fee->student_section_id)
                    ->value('student_id');
            }
        });
    }

    // ── Relationships ──

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function studentSection(): BelongsTo
    {
        return $this->belongsTo(StudentSection::class, 'student_section_id');
    }

    public function enrollment(): BelongsTo
    {
        return $this->studentSection();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
