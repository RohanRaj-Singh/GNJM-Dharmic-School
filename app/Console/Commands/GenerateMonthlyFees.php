<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\StudentSection;
use App\Models\Fee;
use Carbon\Carbon;

class GenerateMonthlyFees extends Command
{
    protected $signature = 'fees:generate-monthly';

    protected $description = 'Generate monthly fees for eligible students';

    public function handle()
    {
        $month = Carbon::now()->format('Y-m');

        $enrollments = StudentSection::with('schoolClass')
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

            Fee::create([
                'student_section_id' => $enrollment->id,
                'type' => 'monthly',
                'title' => 'Monthly Fee',
                'amount' => $enrollment->monthly_fee,
                'month' => $month,
            ]);
        }

        $this->info('Monthly fees generated successfully.');
    }
}
