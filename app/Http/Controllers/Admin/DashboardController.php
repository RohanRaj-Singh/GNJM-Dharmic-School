<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary()
    {
        $year = now()->year;

        /* ===============================
           FEES SUMMARY (same logic as reports)
        ================================ */
        $fees = DB::table('fees')
            ->leftJoin('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                     ->whereNull('payments.deleted_at');
            })
            ->where(function ($q) use ($year) {
                $q->where(function ($qq) use ($year) {
                    $qq->where('fees.type', 'monthly')
                       ->where('fees.month', 'like', $year . '-%');
                })
                ->orWhere('fees.type', 'custom');
            })
            ->select(
                'fees.amount',
                DB::raw('payments.id IS NOT NULL as is_paid')
            )
            ->get();

        $totalFees     = (int) $fees->sum('amount');
        $collectedFees = (int) $fees->where('is_paid', true)->sum('amount');
        $pendingFees   = $totalFees - $collectedFees;

        $collectionPercentage = $totalFees > 0
            ? round(($collectedFees / $totalFees) * 100, 2)
            : 0;

        /* ===============================
           ATTENDANCE SUMMARY (year based)
        ================================ */
        $attendance = DB::table('attendance')
            ->whereYear('date', $year)
            ->select('status')
            ->get()
            ->map(fn ($r) => strtolower(trim($r->status)));

        $present = $attendance->where('status', 'present')->count();
        $absent  = $attendance->where('status', 'absent')->count();
        $leave   = $attendance->where('status', 'leave')->count();

        $totalAttendance = $present + $absent + $leave;

        $attendancePercentage = $totalAttendance > 0
            ? round(($present / $totalAttendance) * 100, 2)
            : 0;

        /* ===============================
           STUDENTS SNAPSHOT
        ================================ */
        $totalStudents = DB::table('students')->count();
        $activeStudents = DB::table('students')
            ->where('status', 'active')
            ->count();

        $enrollments = DB::table('student_sections')->count();

        /* ===============================
           FINAL RESPONSE
        ================================ */
        return response()->json([
            'fees' => [
                'total'       => $totalFees,
                'collected'   => $collectedFees,
                'pending'     => $pendingFees,
                'percentage'  => $collectionPercentage,
            ],
            'attendance' => [
                'percentage' => $attendancePercentage,
                'present'    => $present,
                'absent'     => $absent,
                'leave'      => $leave,
            ],
            'students' => [
                'total'       => $totalStudents,
                'active'      => $activeStudents,
                'enrollments' => $enrollments,
            ],
            'meta' => [
                'year' => $year,
                'generated_at' => now()->toDateTimeString(),
            ],
        ]);
    }
}
