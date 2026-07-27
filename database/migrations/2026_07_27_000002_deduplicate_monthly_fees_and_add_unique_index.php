<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Deduplicate monthly fees: keep the first row per (student_id, month).
        DB::statement('
            DELETE FROM fees
            WHERE id IN (
                SELECT id FROM (
                    SELECT f.id
                    FROM fees f
                    INNER JOIN (
                        SELECT student_id, month, MIN(id) as keep_id
                        FROM fees
                        WHERE type = "monthly" AND month IS NOT NULL
                        GROUP BY student_id, month
                        HAVING COUNT(*) > 1
                    ) dup ON f.student_id = dup.student_id AND f.month = dup.month
                    WHERE f.type = "monthly"
                    AND f.id != dup.keep_id
                ) AS del_ids
            )
        ');

        // Add a partial unique index so the database prevents future duplicates.
        // Only monthly fees with a non-null month are constrained.
        Schema::table('fees', function (Blueprint $table) {
            $table->unique(['student_id', 'type', 'month'], 'idx_fees_unique_student_monthly')
                  ->where('type', 'monthly')
                  ->whereNotNull('month');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropIndex('idx_fees_unique_student_monthly');
        });
    }
};
