<?php

namespace App\Services;

use App\Models\FeeRatePeriod;
use App\Models\StudentSection;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class MonthlyFeeResolver
{
    /**
     * Resolve the monthly fee amount for a given enrollment and month.
     *
     * Resolution order:
     *  1. Free students → 0.
     *  2. Section-level active fee rate period.
     *  3. Class-level active fee rate period.
     *  4. Sections.monthly_fee (legacy).
     *  5. Classes.default_monthly_fee (legacy).
     *  6. 0 if none.
     */
    public function resolveForMonth(StudentSection $studentSection, Carbon|string $month): int
    {
        $monthStart = $month instanceof Carbon
            ? $month->copy()->startOfMonth()
            : Carbon::createFromFormat('Y-m', (string) $month, config('app.timezone'))->startOfMonth();

        if ($studentSection->student_type === 'free') {
            return 0;
        }

        $studentSection->loadMissing([
            'section:id,class_id,monthly_fee',
            'schoolClass:id,default_monthly_fee',
        ]);

        $sectionId = (int) optional($studentSection->section)->id;
        if ($sectionId > 0) {
            $sectionPeriodAmount = $this->findPeriodAmount('section', $sectionId, $monthStart);
            if ($sectionPeriodAmount > 0) {
                return $sectionPeriodAmount;
            }
        }

        $classId = (int) optional($studentSection->schoolClass)->id;
        if ($classId > 0) {
            $classPeriodAmount = $this->findPeriodAmount('class', $classId, $monthStart);
            if ($classPeriodAmount > 0) {
                return $classPeriodAmount;
            }
        }

        $sectionFee = (int) optional($studentSection->section)->monthly_fee;
        if ($sectionFee > 0) {
            return $sectionFee;
        }

        $classFee = (int) optional($studentSection->schoolClass)->default_monthly_fee;
        return $classFee > 0 ? $classFee : 0;
    }

    /**
     * Fast path: resolve using pre-loaded Section and Class data.
     * Used by the bulk-update endpoint to avoid N query chains.
     */
    public function resolveBulk(
        int $studentSectionId,
        string $studentType,
        int $sectionId,
        int $classId,
        Carbon $monthStart,
        bool $sectionHasPeriod,
        bool $classHasPeriod,
    ): int {
        if ($studentType === 'free') {
            return 0;
        }

        if ($sectionHasPeriod) {
            $amount = $this->findPeriodAmount('section', $sectionId, $monthStart);
            if ($amount > 0) return $amount;
        }

        if ($classHasPeriod) {
            $amount = $this->findPeriodAmount('class', $classId, $monthStart);
            if ($amount > 0) return $amount;
        }

        return 0;
    }

    /**
     * Check which scope IDs have any active fee rate periods.
     * This allows the caller to skip the findPeriodAmount query entirely
     * when no period exists for a scope.
     */
    public function scopeHasPeriods(string $scopeType, array $scopeIds): array
    {
        if (empty($scopeIds)) return [];

        return DB::table('fee_rate_periods')
            ->where('scope_type', $scopeType)
            ->whereIn('scope_id', $scopeIds)
            ->pluck('scope_id')
            ->unique()
            ->values()
            ->all();
    }

    private function findPeriodAmount(string $scopeType, int $scopeId, Carbon $monthStart): int
    {
        $period = FeeRatePeriod::query()
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->whereDate('effective_from', '<=', $monthStart->toDateString())
            ->where(function ($q) use ($monthStart) {
                $q->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $monthStart->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();

        if (!$period) {
            return 0;
        }

        return max(0, (int) $period->amount);
    }
}
