<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentSection extends Model
{
    protected $fillable = [
        'student_id',
        'class_id',
        'section_id',
        'student_type',
        'monthly_fee',
        'assumed_pending_months',
        'status',
        'transferred_at',
        'started_at',
        'outcome',
        'academic_session_id',
    ];

    protected $casts = [
        'transferred_at' => 'datetime',
        'started_at'     => 'datetime',
    ];

    // ── Scopes ──

    /**
     * Scope to current (active, not transferred out) enrollments.
     */
    public function scopeCurrent($query)
    {
        return $query->whereNull('transferred_at');
    }

    /**
     * Scope to historical (transferred out / ended) enrollments.
     */
    public function scopeHistorical($query)
    {
        return $query->whereNotNull('transferred_at');
    }

    // ── Relationships ──

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function academicSession(): BelongsTo
    {
        return $this->belongsTo(AcademicSession::class);
    }

    public function fees()
    {
        return $this->hasMany(Fee::class);
    }

    public function attendance()
    {
        return $this->hasMany(Attendance::class);
    }
}
