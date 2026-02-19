<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_rate_periods', function (Blueprint $table) {
            $table->id();
            $table->enum('scope_type', ['class', 'section']);
            $table->unsignedBigInteger('scope_id');
            $table->unsignedInteger('amount');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->index(['scope_type', 'scope_id']);
            $table->index(['scope_type', 'scope_id', 'effective_from', 'effective_to'], 'fee_rate_periods_lookup_idx');
            $table->unique(['scope_type', 'scope_id', 'effective_from'], 'fee_rate_periods_start_unique');
        });

        $baselineStart = '2000-01-01';

        $classRows = DB::table('classes')
            ->select('id', 'default_monthly_fee')
            ->where('default_monthly_fee', '>', 0)
            ->get();

        foreach ($classRows as $row) {
            DB::table('fee_rate_periods')->insert([
                'scope_type' => 'class',
                'scope_id' => $row->id,
                'amount' => (int) $row->default_monthly_fee,
                'effective_from' => $baselineStart,
                'effective_to' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $sectionRows = DB::table('sections')
            ->select('id', 'monthly_fee')
            ->where('monthly_fee', '>', 0)
            ->get();

        foreach ($sectionRows as $row) {
            DB::table('fee_rate_periods')->insert([
                'scope_type' => 'section',
                'scope_id' => $row->id,
                'amount' => (int) $row->monthly_fee,
                'effective_from' => $baselineStart,
                'effective_to' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_rate_periods');
    }
};
