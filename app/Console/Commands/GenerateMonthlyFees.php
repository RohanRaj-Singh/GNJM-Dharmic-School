<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\StudentSection;
use App\Models\Fee;
use Carbon\Carbon;
use App\Services\MonthlyFeeResolver;
use App\Services\StudentReport\StudentReportCache;

class GenerateMonthlyFees extends Command
{
    protected $signature = 'fees:generate-monthly';

    protected $description = 'Generate monthly fees for eligible students';

    public function __construct(
        private readonly MonthlyFeeResolver $monthlyFeeResolver,
        private readonly StudentReportCache $reportCache,
    ) {
        parent::__construct();
    }

    public function handle()
    {
        $month = Carbon::now(config('app.timezone'))->format('Y-m');

        $enrollments = StudentSection::with(['schoolClass', 'section'])
            ->get();

        $affectedStudentIds = [];

        foreach ($enrollments as $enrollment) {
            if ($enrollment->student_type === 'free') {
                $this->clearUnpaidMonthlyFeesForFreeEnrollment($enrollment);
                $affectedStudentIds[(int) $enrollment->student_id] = true;
                continue;
            }

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

            $affectedStudentIds[(int) $enrollment->student_id] = true;
        }

        foreach (array_keys($affectedStudentIds) as $sid) {
            $this->reportCache->forget($sid);
        }

        $this->info('Monthly fees generated successfully.');
    }

    private function clearUnpaidMonthlyFeesForFreeEnrollment(StudentSection $enrollment): int
    {
        return Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->delete();
    }
}
