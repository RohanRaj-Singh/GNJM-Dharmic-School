<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Fees table ───
        Schema::table('fees', function (Blueprint $table) {
            $table->foreignId('student_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('students');
        });

        // Backfill student_id from student_sections
        DB::statement('
            UPDATE fees
            SET student_id = (
                SELECT student_id
                FROM student_sections
                WHERE student_sections.id = fees.student_section_id
            )
        ');

        // Guard: catch orphan fees (shouldn't exist, but be safe)
        $orphanCount = DB::table('fees')->whereNull('student_id')->count();
        if ($orphanCount > 0) {
            // Delete fees whose enrollment no longer exists
            DB::table('fees')->whereNull('student_id')->delete();
        }

        Schema::table('fees', function (Blueprint $table) {
            $table->foreignId('student_id')->nullable(false)->change();
            $table->index('student_id', 'idx_fees_student_id');
        });

        // ─── Attendance table ───
        Schema::table('attendance', function (Blueprint $table) {
            $table->foreignId('student_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('students');
        });

        DB::statement('
            UPDATE attendance
            SET student_id = (
                SELECT student_id
                FROM student_sections
                WHERE student_sections.id = attendance.student_section_id
            )
        ');

        $orphanAttendance = DB::table('attendance')->whereNull('student_id')->count();
        if ($orphanAttendance > 0) {
            DB::table('attendance')->whereNull('student_id')->delete();
        }

        Schema::table('attendance', function (Blueprint $table) {
            $table->foreignId('student_id')->nullable(false)->change();
            $table->index('student_id', 'idx_attendance_student_id');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropIndex('idx_fees_student_id');
            $table->dropForeign(['student_id']);
            $table->dropColumn('student_id');
        });

        Schema::table('attendance', function (Blueprint $table) {
            $table->dropIndex('idx_attendance_student_id');
            $table->dropForeign(['student_id']);
            $table->dropColumn('student_id');
        });
    }
};
