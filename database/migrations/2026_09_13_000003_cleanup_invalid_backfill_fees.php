<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Clean up invalid fees created by the backfill migration.
 *
 * The backfill created fees for:
 *   1. Free students (should have no monthly fees)
 *   2. Months BEFORE the enrollment started (e.g., enrollment started
 *      2026-02 but backfill created fees for 2025-12, 2025-11, etc.)
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Delete fees for free students
        DB::table('fees')
            ->where('type', 'monthly')
            ->whereIn('student_section_id', function ($q) {
                $q->select('id')->from('student_sections')
                    ->where('student_type', 'free');
            })
            ->delete();

        // 2. Delete fees where fee month is BEFORE the enrollment started
        DB::statement('
            DELETE f FROM fees f
            INNER JOIN student_sections ss ON ss.id = f.student_section_id
            WHERE f.type = \'monthly\'
            AND f.month < DATE_FORMAT(ss.started_at, \'%Y-%m\')
        ');
    }

    public function down(): void
    {
        // Irreversible — the backfill migration would need to be re-run.
    }
};
