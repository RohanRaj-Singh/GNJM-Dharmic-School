<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    protected $fillable = [
        'name',
        'father_name',
        'status',
    ];

    public function enrollments(): HasMany
    {
        return $this->hasMany(StudentSection::class, 'student_id');
    }
}
