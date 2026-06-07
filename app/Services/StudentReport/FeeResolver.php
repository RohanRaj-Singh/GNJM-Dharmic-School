<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\FeeRow;
use App\Support\StudentReport\FeeSummary;
use App\Support\StudentReport\MonthFeeSummary;
use Illuminate\Support\Facades\DB;

/**
 * Loads fees + payments for a division and computes the summary.
 *
 * V1 rules:
 *  - Monthly fees: filtered by `month BETWEEN startMonth AND endMonth`.
 *  - Custom fees: included regardless of month (matches Fees report engine).
 *  - Free student: monthly fees are still queried but the report UI shows
 *    "exempt" — V1 does not exclude them at the engine level because the
 *    `fees` table may have historical rows from when the student was paid.
 *  - `is_paid` uses `EXISTS(payments WHERE deleted_at IS NULL)`.
 *  - `outstanding_months` = count of monthly rows with no payment.
 */
final class FeeResolver
{
    /**
     * @param  list<int>  $sectionIds
     */
    public function resolve(array $sectionIds, string $startMonth, string $endMonth): FeeSummary
    {
        if (empty($sectionIds)) {
            return new FeeSummary(0, 0, 0, 0, null, [], []);
        }

        $startMonth = substr($startMonth, 0, 7);
        $endMonth = substr($endMonth, 0, 7);

        $rows = DB::table('fees as f')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.fee_id', '=', 'f.id')->whereNull('p.deleted_at');
            })
            ->whereIn('f.student_section_id', $sectionIds)
            ->where(function ($q) use ($startMonth, $endMonth) {
                $q->where(function ($q2) use ($startMonth, $endMonth) {
                    $q2->where('f.type', 'monthly')
                        ->whereBetween('f.month', [$startMonth, $endMonth]);
                })->orWhere('f.type', 'custom');
            })
            ->orderByRaw('f.month IS NULL')
            ->orderBy('f.month')
            ->get([
                'f.id', 'f.type', 'f.title', 'f.month', 'f.amount',
                'p.paid_at', 'p.id as payment_id',
            ]);

        $feeRows = [];
        $totalCharged = 0;
        $totalPaid = 0;
        $outstandingMonths = 0;
        $lastPaymentDate = null;
        $byMonth = []; // 'YYYY-MM' => [charged, paid, pending, is_paid]

        foreach ($rows as $r) {
            $isPaid = $r->payment_id !== null;
            $paidAt = $isPaid ? substr((string) $r->paid_at, 0, 10) : null;
            $amount = (int) $r->amount;

            $feeRows[] = new FeeRow(
                id: (int) $r->id,
                type: (string) $r->type,
                title: $r->title,
                month: $r->month,
                amount: $amount,
                isPaid: $isPaid,
                paidAt: $paidAt,
            );

            $totalCharged += $amount;
            if ($isPaid) {
                $totalPaid += $amount;
                if ($lastPaymentDate === null || $paidAt > $lastPaymentDate) {
                    $lastPaymentDate = $paidAt;
                }
            } elseif ((string) $r->type === 'monthly') {
                $outstandingMonths++;
            }

            // Per-month breakdown: only for monthly fees.
            if ((string) $r->type === 'monthly' && !empty($r->month)) {
                $m = (string) $r->month;
                if (!isset($byMonth[$m])) {
                    $byMonth[$m] = ['charged' => 0, 'paid' => 0, 'is_paid' => true];
                }
                $byMonth[$m]['charged'] += $amount;
                if ($isPaid) {
                    $byMonth[$m]['paid'] += $amount;
                } else {
                    $byMonth[$m]['is_paid'] = false;
                }
            }
        }

        $monthlyBreakdown = [];
        ksort($byMonth);
        foreach ($byMonth as $month => $agg) {
            $pending = $agg['charged'] - $agg['paid'];
            $monthlyBreakdown[] = new MonthFeeSummary(
                month: $month,
                charged: $agg['charged'],
                paid: $agg['paid'],
                pending: $pending,
                isPaid: $agg['is_paid'] && $pending === 0,
            );
        }

        return new FeeSummary(
            totalCharged: $totalCharged,
            totalPaid: $totalPaid,
            pending: $totalCharged - $totalPaid,
            outstandingMonths: $outstandingMonths,
            lastPaymentDate: $lastPaymentDate,
            rows: $feeRows,
            monthlyBreakdown: $monthlyBreakdown,
        );
    }
}
