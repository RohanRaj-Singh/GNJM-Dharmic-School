<?php

namespace App\Support\StudentReport;

/**
 * Fee aggregate for one division over the report's range.
 *
 * V1 includes:
 *  - Total charged, total paid, pending (PKR)
 *  - Count of outstanding months (monthly fees in range with no payment)
 *  - Last payment date in range
 *  - All fee rows (ordered by month)
 *  - Per-month breakdown (one row per month with a fee in the range)
 *
 * V1.1 will add a "Fee Health Score" (collection rate + recency).
 */
final class FeeSummary
{
    /**
     * @param  list<FeeRow>  $rows
     * @param  list<MonthFeeSummary>  $monthlyBreakdown
     */
    public function __construct(
        public readonly int $totalCharged,
        public readonly int $totalPaid,
        public readonly int $pending,
        public readonly int $outstandingMonths,
        public readonly ?string $lastPaymentDate,
        public readonly array $rows,
        public readonly array $monthlyBreakdown,
    ) {}

    public function toArray(): array
    {
        return [
            'total_charged' => $this->totalCharged,
            'total_paid' => $this->totalPaid,
            'pending' => $this->pending,
            'outstanding_months' => $this->outstandingMonths,
            'last_payment_date' => $this->lastPaymentDate,
            'rows' => array_map(fn (FeeRow $r) => $r->toArray(), $this->rows),
            'monthly_breakdown' => array_map(fn (MonthFeeSummary $m) => $m->toArray(), $this->monthlyBreakdown),
        ];
    }
}
