<?php

namespace App\Models;

use App\Support\ClassSchedule;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolClass extends Model
{
    protected $table = 'classes';

    protected $fillable = [
        'name',
        'type',
        'division', // nullable explicit division override (Stage A2)
        'attendance_days', // nullable json int[] (Stage B); NULL = legacy rule
        'charges_monthly_fee', // nullable bool (Stage B); NULL = legacy rule
        'default_monthly_fee',
    ];

    protected $casts = [
        'attendance_days' => 'array',
        'charges_monthly_fee' => 'boolean',
    ];

    public function sections(): HasMany
    {
        return $this->hasMany(Section::class, 'class_id');
    }

    public function studentSections(): HasMany
    {
        return $this->hasMany(StudentSection::class, 'class_id');
    }

    public function feeRatePeriods(): HasMany
    {
        return $this->hasMany(FeeRatePeriod::class, 'scope_id')
            ->where('scope_type', 'class');
    }

    /*
     * Stage B — class configuration ("what configuration does this class
     * have?"). Delegates to the single {@see \App\Support\ClassSchedule} seam;
     * explicit config wins, NULL falls back to the legacy Kirtan rule.
     */

    /** @return list<int> effective attendance days, ISO 0=Sunday..6=Saturday */
    public function attendanceDays(): array
    {
        return ClassSchedule::attendanceDays(
            $this->type,
            $this->name,
            $this->attendance_days,
            $this->division,
        );
    }

    public function chargesMonthlyFee(): bool
    {
        return ClassSchedule::chargesMonthlyFee(
            $this->type,
            $this->name,
            $this->charges_monthly_fee,
            $this->division,
        );
    }

    public function isAttendanceDay(Carbon $date): bool
    {
        return ClassSchedule::isAttendanceDay(
            $this->type,
            $this->name,
            $this->attendance_days,
            $date,
            $this->division,
        );
    }

    public function attendanceDaysLabel(): string
    {
        return ClassSchedule::dayLabel($this->type, $this->name, $this->attendance_days, $this->division);
    }
}
