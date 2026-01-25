<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    protected $fillable = [
        'class_id',
        'name',
        'monthly_fee',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function studentSections(): HasMany
    {
        return $this->hasMany(StudentSection::class, 'section_id');
    }
    // App\Models\Section.php

public function teachers()
{
    return $this->belongsToMany(User::class);
}
public function users()
{
    return $this->belongsToMany(User::class);
}

public function attendance()
    {
        return $this->hasManyThrough(
            Attendance::class,
            StudentSection::class,
            'section_id',          // FK on student_sections
            'student_section_id',  // FK on attendance
            'id',                  // PK on sections
            'id'                   // PK on student_sections
        );
    }

}
