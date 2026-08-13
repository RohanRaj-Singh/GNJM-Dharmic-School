<?php

namespace App\Console\Commands;

use App\Actions\GenerateMonthlyFeeAction;
use App\Services\StudentReport\StudentReportCache;
use Illuminate\Console\Command;

class GenerateMonthlyFees extends Command
{
    protected $signature = 'fees:generate-monthly';

    protected $description = 'Generate monthly fees for eligible students';

    public function __construct(
        private readonly GenerateMonthlyFeeAction $generateMonthlyFeeAction,
        private readonly StudentReportCache $reportCache,
    ) {
        parent::__construct();
    }

    public function handle()
    {
        $affectedStudentIds = ($this->generateMonthlyFeeAction)();

        foreach ($affectedStudentIds as $sid) {
            $this->reportCache->forget((int) $sid);
        }

        $this->info('Monthly fees generated successfully.');
    }
}
