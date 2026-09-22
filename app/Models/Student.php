<?php

namespace App\Models;

use App\Services\StudentReport\StudentReportCache;
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

    /**
     * Hard-delete order for FK safety: fees (payments cascade from fees),
     * attendance, enrollments, then the student row. Mirrors the
     * cascadeOnDelete FKs so single and bulk deletes behave the same.
     */
    protected static function booted(): void
    {
        static::deleting(function (Student $student) {
            Fee::where('student_id', $student->id)->delete();
            Attendance::where('student_id', $student->id)->delete();
            $student->enrollments()->delete();

            app(StudentReportCache::class)->forget((int) $student->id);
        });
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(StudentSection::class, 'student_id');
    }

    /**
     * Whether this student has at least one current, active enrollment.
     * An "active" student with no active enrollment is an orphan (R3).
     */
    public function hasActiveEnrollment(): bool
    {
        return $this->enrollments()
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->exists();
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
