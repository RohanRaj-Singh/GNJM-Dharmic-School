<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds a `status` column to `student_sections` (enrollment-level status).
     *
     * This allows deactivating a student from a specific class/section
     * without affecting their other enrollments or deleting historical data.
     *
     * Values: 'active' (default), 'inactive'
     */
    public function up(): void
    {
        Schema::table('student_sections', function (Blueprint $table) {
            $table->string('status')->default('active')->after('student_type');
        });

        // Backfill: all existing enrollments are active
        DB::table('student_sections')->update(['status' => 'active']);
    }

    public function down(): void
    {
        Schema::table('student_sections', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
