<?php

namespace App\Services;

use App\Models\FeeRatePeriod;
use App\Models\StudentSection;
use Carbon\Carbon;

class MonthlyFeeResolver
{
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
