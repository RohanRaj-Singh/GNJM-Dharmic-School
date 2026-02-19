<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $targetStart = '2000-01-01';

        $earliestByScope = DB::table('fee_rate_periods')
            ->select('scope_type', 'scope_id', DB::raw('MIN(effective_from) as min_start'))
            ->groupBy('scope_type', 'scope_id')
            ->get();

        foreach ($earliestByScope as $scope) {
            if ((string) $scope->min_start <= $targetStart) {
                continue;
            }

            $earliestRow = DB::table('fee_rate_periods')
                ->where('scope_type', $scope->scope_type)
                ->where('scope_id', $scope->scope_id)
                ->whereDate('effective_from', $scope->min_start)
                ->orderBy('id')
                ->first();

            if (!$earliestRow) {
                continue;
            }

            DB::table('fee_rate_periods')
                ->where('id', $earliestRow->id)
                ->update([
                    'effective_from' => $targetStart,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // No safe automatic rollback for historical period backfill.
    }
};
