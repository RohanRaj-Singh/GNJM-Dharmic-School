<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Clean up backfill-generated unpaid fees.
 *
 * The backfill migration created fees for multi-class students to fill in
 * missing Kirtan/Gurmukhi fees. However, many of these were just "generated"
 * placeholders that were never paid. This cleanup removes unpaid fees that
 * were created by the backfill, keeping:
 *   - All PAID fees (regardless of when they were created)
 *   - Original unpaid fees (created before the backfill) — these represent
 *     real outstanding balances the school is tracking
 */
return new class extends Migration
{
    public function up(): void
    {
        // Delete unpaid fees created by the backfill (on/after 2026-09-13)
        DB::table('fees')
            ->where('type', 'monthly')
            ->where('created_at', '>=', '2026-09-13')
            ->whereNotIn('id', function ($q) {
                $q->select('fee_id')->from('payments')
                    ->whereNull('deleted_at');
            })
            ->delete();
    }

    public function down(): void
    {
        // Irreversible — the backfill migration would need to be re-run.
    }
};
