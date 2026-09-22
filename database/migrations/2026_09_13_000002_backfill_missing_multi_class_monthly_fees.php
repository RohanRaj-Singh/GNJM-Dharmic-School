<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill missing monthly fees for multi-class students.
 *
 * Before this migration, the unique index was on (student_id, type, month),
 * so only ONE fee existed per student per month — attributed to whichever
 * enrollment was processed first. Now that the key is per-enrollment, we
 * need to create the missing fees for the "other" enrollment(s).
 *
 * For example, student 27 (Gurmukhi + Kirtan) had only Gurmukhi fees for
 * Mar–Sep. This backfill creates the missing Kirtan fees for those months.
 */
return new class extends Migration
{
    public function up(): void
    {
        // For each active enrollment that charges monthly fees, find months
        // where no fee exists for that enrollment but a fee exists for the
        // same student in the same month (attributed to a different enrollment).
        // Create the missing fee with the correct amount.
        DB::statement('
            INSERT INTO fees (student_id, student_section_id, type, month, title, amount, is_locked, created_at, updated_at)
            SELECT
                ss.student_id,
                ss.id AS student_section_id,
                \'monthly\' AS type,
                existing.month,
                \'Monthly Fee\' AS title,
                COALESCE(
                    (SELECT frp.amount FROM fee_rate_periods frp
                     WHERE frp.scope_type = \'section\' AND frp.scope_id = ss.section_id
                     AND frp.effective_from <= LAST_DAY(CONCAT(existing.month, \'-01\'))
                     AND (frp.effective_to IS NULL OR frp.effective_to >= CONCAT(existing.month, \'-01\'))
                     ORDER BY frp.effective_from DESC LIMIT 1),
                    (SELECT frp.amount FROM fee_rate_periods frp
                     WHERE frp.scope_type = \'class\' AND frp.scope_id = ss.class_id
                     AND frp.effective_from <= LAST_DAY(CONCAT(existing.month, \'-01\'))
                     AND (frp.effective_to IS NULL OR frp.effective_to >= CONCAT(existing.month, \'-01\'))
                     ORDER BY frp.effective_from DESC LIMIT 1),
                    COALESCE(
                        (SELECT sec.monthly_fee FROM sections sec WHERE sec.id = ss.section_id AND sec.monthly_fee > 0),
                        (SELECT c.default_monthly_fee FROM classes c WHERE c.id = ss.class_id AND c.default_monthly_fee > 0),
                        0
                    )
                ) AS amount,
                0 AS is_locked,
                NOW() AS created_at,
                NOW() AS updated_at
            FROM student_sections ss
            INNER JOIN classes c ON c.id = ss.class_id
            -- Find months where another enrollment of the same student has a fee
            INNER JOIN (
                SELECT f.student_id, f.month, f.student_section_id AS other_enrollment_id
                FROM fees f
                WHERE f.type = \'monthly\' AND f.month IS NOT NULL
            ) existing ON existing.student_id = ss.student_id
            -- Only for months where THIS enrollment does NOT already have a fee
            AND NOT EXISTS (
                SELECT 1 FROM fees f2
                WHERE f2.student_section_id = ss.id
                AND f2.type = \'monthly\'
                AND f2.month = existing.month
            )
            -- Only create fees for months ON or AFTER the enrollment started
            AND existing.month >= DATE_FORMAT(ss.started_at, \'%Y-%m\')
            -- Only for active enrollments that charge monthly fees
            AND ss.status = \'active\'
            AND ss.transferred_at IS NULL
            AND (
                c.charges_monthly_fee = 1
                OR (c.charges_monthly_fee IS NULL AND c.default_monthly_fee > 0)
            )
            -- Skip free students
            AND ss.student_type != \'free\'
            -- Skip if amount would be 0 (shouldn\'t generate a fee)
            HAVING amount > 0
        ');
    }

    public function down(): void
    {
        // The backfill is additive — reverting would require knowing which
        // fees were backfilled. Since the unique index is per-enrollment now,
        // the old fees are still valid. No action needed.
    }
};
