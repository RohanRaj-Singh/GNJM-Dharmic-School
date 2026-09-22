<?php

namespace App\Services;

use App\Models\Fee;
use App\Models\StudentSection;
use Carbon\Carbon;

/**
 * Builds the desired trailing set of unpaid monthly fees for one enrollment
 * (pending months). Always keyed by student_section_id — never student_id —
 * so a multi-class student's sibling enrollment is never touched.
 *
 * Optional $notBefore floors the desired window at the enrollment start month
 * (used by the multi-class correction utility). Existing Paid fees are never
 * deleted; amounts are resolved via MonthlyFeeResolver.
 */
class PendingMonthsGenerator
{
    public function __construct(private readonly MonthlyFeeResolver $monthlyFeeResolver)
    {
    }

    /** @return list<string> desired Y-m months, newest first */
    public function desiredMonths(int $months, ?Carbon $notBefore = null): array
    {
        if ($months < 0) {
            return [];
        }

        $desired = [];
        for ($i = 0; $i < $months; $i++) {
            $month = Carbon::now(config('app.timezone'))->subMonths($i);
            if ($notBefore !== null && $month->lt($notBefore->startOfMonth())) {
                continue;
            }
            $desired[] = $month->format('Y-m');
        }

        return $desired;
    }

    public function generate(StudentSection $studentSection, int $months, ?Carbon $notBefore = null): void
    {
        if ($months < 0) {
            return;
        }

        $desiredMonths = $this->desiredMonths($months, $notBefore);
        $desiredSet = array_flip($desiredMonths);

        $existingMonthly = Fee::where('student_section_id', $studentSection->id)
            ->where('type', 'monthly')
            ->get();
        $existingByMonth = $existingMonthly
            ->filter(fn ($fee) => !empty($fee->month))
            ->keyBy('month');
        $paidFeeIds = Fee::whereIn('id', $existingMonthly->pluck('id'))
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->pluck('id')
            ->flip()
            ->all();

        foreach ($desiredMonths as $month) {
            $amount = $this->monthlyFeeResolver->resolveForMonth($studentSection, $month);
            $existingFee = $existingByMonth->get($month);

            if ($existingFee) {
                $isPaid = isset($paidFeeIds[$existingFee->id]);

                if (!$isPaid && $amount <= 0) {
                    $existingFee->delete();
                    continue;
                }

                if (!$isPaid && (int) $existingFee->amount !== (int) $amount) {
                    $existingFee->update(['amount' => max(0, (int) $amount)]);
                }

                continue;
            }

            if ($amount > 0) {
                Fee::firstOrCreate(
                    [
                        'student_section_id' => $studentSection->id,
                        'type' => 'monthly',
                        'month' => $month,
                    ],
                    [
                        'student_id' => $studentSection->student_id,
                        'amount' => $amount,
                    ]
                );
            }
        }

        if ($months === 0) {
            Fee::where('student_section_id', $studentSection->id)
                ->where('type', 'monthly')
                ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
                ->delete();
            return;
        }

        $extra = $existingMonthly->filter(function ($fee) use ($desiredSet) {
            return !isset($desiredSet[$fee->month ?? '']);
        });

        foreach ($extra as $fee) {
            if ($fee->payments()->whereNull('deleted_at')->exists()) {
                continue;
            }
            $fee->delete();
        }
    }
}
