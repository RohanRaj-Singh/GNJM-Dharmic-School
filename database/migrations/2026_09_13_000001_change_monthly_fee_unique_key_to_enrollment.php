<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Phase out the F3 canonical key (student_id, type, month) in favour of
        // per-enrollment billing: (student_section_id, type, month). Each class
        // now generates its own monthly fee independently — a student in both
        // Gurmukhi and Kirtan gets two separate fees per month.
        Schema::table('fees', function (Blueprint $table) {
            $table->dropIndex('idx_fees_unique_student_monthly');
        });

        Schema::table('fees', function (Blueprint $table) {
            $table->unique(['student_section_id', 'type', 'month'], 'idx_fees_unique_enrollment_monthly')
                  ->where('type', 'monthly')
                  ->whereNotNull('month');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropIndex('idx_fees_unique_enrollment_monthly');
        });

        Schema::table('fees', function (Blueprint $table) {
            $table->unique(['student_id', 'type', 'month'], 'idx_fees_unique_student_monthly')
                  ->where('type', 'monthly')
                  ->whereNotNull('month');
        });
    }
};
