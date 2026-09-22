<?php

namespace App\Services;

use App\Models\Fee;
use App\Models\StudentSection;
use Carbon\Carbon;

/**
 * Single monthly-fee write path.
 *
 * Each class generates its own monthly fee independently — keyed by
 * (student_section_id, type='monthly', month) — the enrollment, not the
 * student. A student enrolled in both Gurmukhi and Kirtan gets two separate
 * fees per month. This service owns that write: resolve the amount via
 * MonthlyFeeResolver, then firstOrCreate on the per-enrollment key. The CLI
 * command (fees:generate-monthly), the admin "Generate Monthly Fees" button,
 * the roster bulk-update, and new student creation all route through here;
 * the full current-month run lives in generateForMonth().
 */
class MonthlyFeeService
{
    public function __construct(
        private readonly MonthlyFeeResolver $resolver,
    ) {}

    /**
     * Resolve the monthly fee for an enrollment in a given month and write it
     * under the per-enrollment key (student_section_id, type, month). Returns
     * the fee, or null when the resolved amount is <= 0 (free student / no rate).
     */
    public function upsertForMonth(
        StudentSection $enrollment,
        Carbon|string $month,
        ?string $title = null,
    ): ?Fee {
        $amount = $this->resolver->resolveForMonth($enrollment, $month);
        if ($amount <= 0) {
            return null;
        }

        return Fee::firstOrCreate(
            [
                'student_section_id' => $enrollment->id,
                'type'               => 'monthly',
                'month'              => $month instanceof Carbon ? $month->format('Y-m') : (string) $month,
            ],
            [
                'student_id' => $enrollment->student_id,
                'title'      => $title,
                'amount'     => $amount,
            ]
        );
    }

    /**
     * Delete the unpaid monthly fees attached to a (free) enrollment.
     */
    public function clearUnpaidMonthlyForEnrollment(StudentSection $enrollment): int
    {
        return Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->delete();
    }

    /**
     * Generate monthly fees for a month across all active enrollments — the
     * "generate monthly fees" run shared by the CLI command and the admin
     * button. Each class generates its own fee independently: a student in
     * both Gurmukhi and Kirtan gets two separate fees for the same month.
     * Free enrollments get their unpaid monthly fees cleared, classes that
     * do not charge monthly fees are skipped, and a fee that already exists
     * for this specific enrollment in this month is never duplicated. Returns
     * the ids of every student whose fees may have changed so callers can
     * invalidate report caches.
     */
    public function generateForMonth(Carbon|string $month): array
    {
        $monthKey = $month instanceof Carbon ? $month->format('Y-m') : (string) $month;

        $enrollments = StudentSection::with(['schoolClass', 'section'])
            ->where('status', 'active')
            ->whereNull('transferred_at')
            ->get();

        $affectedStudentIds = [];

        foreach ($enrollments as $enrollment) {
            if ($enrollment->student_type === 'free') {
                $this->clearUnpaidMonthlyForEnrollment($enrollment);
                $affectedStudentIds[(int) $enrollment->student_id] = true;
                continue;
            }

            // Skip classes that do not charge monthly fees.
            if (!$enrollment->schoolClass->chargesMonthlyFee()) {
                continue;
            }

            // The fee may already exist for this specific enrollment this month
            // — do not create a duplicate the unique index rejects.
            $exists = Fee::where('student_section_id', $enrollment->id)
                ->where('type', 'monthly')
                ->where('month', $monthKey)
                ->exists();

            if ($exists) {
                continue;
            }

            $fee = $this->upsertForMonth($enrollment, $monthKey, 'Monthly Fee');
            if ($fee === null) {
                continue;
            }

            $affectedStudentIds[(int) $enrollment->student_id] = true;
        }

        return array_keys($affectedStudentIds);
    }
}
