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
        $currentMonth = Carbon::now(config('app.timezone'))->format('Y-m');

        $dueThisMonth = [];
        $dueOlder = [];
        $totalPending = 0;

        $unpaidFees = Fee::with([
            'enrollment.student',
            'enrollment.schoolClass',
            'enrollment.section',
        ])
            ->where('type', 'monthly')
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->get();

        foreach ($unpaidFees as $fee) {
            $feeMonth = $this->normalizeFeeMonth($fee->month);
            if (!$feeMonth) {
                continue;
            }

            $item = [
                'student_id' => $fee->enrollment->student->id,
                'student' => $fee->enrollment->student->name,
                'class' => $fee->enrollment->schoolClass->name,
                'section' => $fee->enrollment->section->name,
                'month' => $fee->month,
                'amount' => $fee->amount,
            ];

            $totalPending += $fee->amount;

            if ($feeMonth === $currentMonth) {
                $dueThisMonth[] = $item;
            } elseif ($feeMonth < $currentMonth) {
                $dueOlder[] = $item;
            }
        }

        return Inertia::render('Accountant/LateFees', [
            'dueThisMonth' => $dueThisMonth,
            'dueOlder' => $dueOlder,
            'totalPending' => $totalPending,
        ]);
    }

    private function normalizeFeeMonth(?string $rawMonth): ?string
    {
        $month = trim((string) $rawMonth);
        if ($month === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $month;
        }

        try {
            return Carbon::parse('1 ' . $month)->format('Y-m');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
