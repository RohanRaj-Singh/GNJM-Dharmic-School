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

    // Effective attendance days (explicit config or legacy fallback) are
    // serialized so the frontend day-rule UI reads them directly instead of
    // re-deriving kirtan/gurmukhi from type/name.
    protected $appends = ['attendance_days_effective'];

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
        // Legacy rows may have charges_monthly_fee = NULL (unconfigured) but a
        // configured default_monthly_fee — the admin explicitly set an amount,
        // so the class participates in monthly fee generation. This is what
        // lets an existing Kirtan class with default_monthly_fee = 300 generate
        // fees like Gurmukhi does (Bug: Kirtan fees stopped after Feb 2026).
        // Newly-created Kirtan classes are unaffected: the save endpoint sets
        // charges_monthly_fee = false explicitly, so the seam below returns
        // false and the unit tests still pass.
        if ($this->charges_monthly_fee === null && (int) ($this->default_monthly_fee ?? 0) > 0) {
            return true;
        }

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

    public function getAttendanceDaysEffectiveAttribute(): array
    {
        return $this->attendanceDays();
    }
}
