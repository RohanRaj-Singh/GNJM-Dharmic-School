<?php

namespace App\Support\StudentReport;

final class FeeRow
{
    public function __construct(
        public readonly int $id,
        public readonly string $type,        // 'monthly' | 'custom'
        public readonly ?string $title,
        public readonly ?string $month,      // 'YYYY-MM' or null
        public readonly int $amount,
        public readonly bool $isPaid,
        public readonly ?string $paidAt,     // 'YYYY-MM-DD' or null
    ) {}

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'month' => $this->month,
            'amount' => $this->amount,
            'is_paid' => $this->isPaid,
            'paid_at' => $this->paidAt,
        ];
    }
}
