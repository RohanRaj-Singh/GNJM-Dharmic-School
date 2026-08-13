<?php

namespace App\Actions;

use App\Services\MonthlyFeeService;
use Carbon\Carbon;

/**
 * Single entry point for the monthly-fee generation run (Sprint 5.1) — shared
 * by the CLI command (fees:generate-monthly, also scheduled) and the admin
 * "Generate Monthly Fees" button. Returns the ids of every affected student so
 * the caller can invalidate report caches.
 */
class GenerateMonthlyFeeAction
{
    public function __construct(
        private readonly MonthlyFeeService $service,
    ) {}

    public function __invoke(Carbon|string|null $month = null): array
    {
        $month ??= Carbon::now(config('app.timezone'))->format('Y-m');

        return $this->service->generateForMonth($month);
    }
}
