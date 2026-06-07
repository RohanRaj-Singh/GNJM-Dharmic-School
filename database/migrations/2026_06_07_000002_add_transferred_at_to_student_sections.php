<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_sections', function (Blueprint $table) {
            $table->timestamp('transferred_at')->nullable()->after('assumed_pending_months');
        });

        // Backfill: existing rows are current enrollments. transferred_at = NULL.
        // (V1 does not retroactively split historical section changes.)
    }

    public function down(): void
    {
        Schema::table('student_sections', function (Blueprint $table) {
            $table->dropColumn('transferred_at');
        });
    }
};
