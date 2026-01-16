<?php

namespace App\Http\Controllers\Accountant;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use Carbon\Carbon;
use Inertia\Inertia;

class LateFeeSummaryController extends Controller
{
    public function index()
    {

        // Current month in machine-friendly format
        $currentMonth = Carbon::now()->format('Y-m');

        $dueThisMonth = [];
        $dueOlder = [];
        $totalPending = 0;

        // Get all unpaid monthly fees
        $unpaidFees = Fee::with([
            'enrollment.student',
            'enrollment.schoolClass',
            'enrollment.section',
        ])
        ->where('type', 'monthly')
        ->whereDoesntHave('payments')
        ->get();

        foreach ($unpaidFees as $fee) {

            /**
             * TEMP FIX:
             * Convert "December 2025" → "2025-12"
             * This keeps logic working without DB changes
             */
            try {
                $feeMonth = Carbon::parse('1 ' . $fee->month)->format('Y-m');
            } catch (\Exception $e) {
                // Skip invalid month formats safely
                continue;
            }

            $item = [
                'student_id' => $fee->enrollment->student->id,
                'student' => $fee->enrollment->student->name,
                'class'   => $fee->enrollment->schoolClass->name,
                'section' => $fee->enrollment->section->name,
                'month'   => $fee->month,   // keep human readable
                'amount'  => $fee->amount,
            ];

            // Total pending always increases
            $totalPending += $fee->amount;

            // Categorize
            if ($feeMonth === $currentMonth) {
                $dueThisMonth[] = $item;
            } elseif ($feeMonth < $currentMonth) {
                $dueOlder[] = $item;
            }
        }
        //dd($unpaidFees->count(), $unpaidFees->pluck('month'));


        return Inertia::render('Accountant/LateFees', [
            'dueThisMonth' => $dueThisMonth,
            'dueOlder'     => $dueOlder,
            'totalPending' => $totalPending,
        ]);
    }
}
