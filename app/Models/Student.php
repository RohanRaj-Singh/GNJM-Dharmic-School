<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_PROMOTED = 'promoted';
    public const STATUS_PASSED_OUT = 'passed_out';
    public const STATUS_LEFT = 'left';

    protected $fillable = [
        'name',
        'father_name',
        'father_phone',
        'mother_phone',
        'status',
        'batch_id',
    ];

    public function enrollments(): HasMany
    {
        return $this->hasMany(StudentSection::class, 'student_id');
    }

    public function fees(): HasMany
    {
        return $this->hasMany(Fee::class, 'student_id');
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(Attendance::class, 'student_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
