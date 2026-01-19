<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\StudentSection;
use App\Models\Fee;
use Carbon\Carbon;

class DemoFeeSeeder extends Seeder
{
    public function run(): void
    {
        // Only Gurmukhi student-sections (monthly fee class)
        $studentSections = StudentSection::whereHas('schoolClass', function ($q) {
            $q->where('type', 'gurmukhi');
        })->get();

        foreach ($studentSections as $studentSection) {

            $monthlyFee = $studentSection->schoolClass->default_monthly_fee;

            if ($monthlyFee <= 0) {
                continue;
            }
            $previousMonth = Carbon::now()->subMonth();
$currentMonth  = Carbon::now();
            // Previous month
            Fee::create([
                'student_section_id' => $studentSection->id,
                'title' => 'Monthly Fee - ' . $previousMonth->format('F Y'),
                'type' => 'monthly',
                'month' => $previousMonth->format('F Y'),
                'amount' => $monthlyFee,
            ]);

            // Current month
            Fee::create([
                'student_section_id' => $studentSection->id,
                'title' => 'Monthly Fee - ' . $currentMonth->format('F Y'),
                'type' => 'monthly',
                'month' => $currentMonth->format('F Y'),
                'amount' => $monthlyFee,
            ]);
        }
    }
}
