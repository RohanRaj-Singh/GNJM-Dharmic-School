<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fee extends Model
{
    protected $fillable = [
        'student_section_id',
        'type',
        'source',
        'batch_id',
        'title',
        'amount',
        'is_locked',
        'month',
    ];

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
