<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\StudentSection;
use App\Models\Fee;
use Carbon\Carbon;
use App\Services\MonthlyFeeResolver;

class GenerateMonthlyFees extends Command
{
    protected $signature = 'fees:generate-monthly';

    protected $description = 'Generate monthly fees for eligible students';

    public function __construct(private readonly MonthlyFeeResolver $monthlyFeeResolver)
    {
        parent::__construct();
    }

    public function handle()
    {
        $month = Carbon::now(config('app.timezone'))->format('Y-m');

        $enrollments = StudentSection::with(['schoolClass', 'section'])
            ->where('student_type', 'paid')
            ->get();

        foreach ($enrollments as $enrollment) {

            // Skip Kirtan
            if ($enrollment->schoolClass->type === 'kirtan') {
                continue;
            }

            // Check if fee already exists
            $exists = Fee::where('student_section_id', $enrollment->id)
                ->where('type', 'monthly')
                ->where('month', $month)
                ->exists();

            if ($exists) {
                continue;
            }

            $amount = $this->monthlyFeeResolver->resolveForMonth($enrollment, $month);
            if ($amount <= 0) {
                continue;
            }

            Fee::create([
                'student_section_id' => $enrollment->id,
                'type' => 'monthly',
                'title' => 'Monthly Fee',
                'amount' => $amount,
                'month' => $month,
                'source' => 'monthly',
            ]);
        }

        $this->info('Monthly fees generated successfully.');
    }
}
