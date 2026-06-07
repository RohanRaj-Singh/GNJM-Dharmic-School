<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->date('enrollment_date')->nullable()->after('status');
        });

        // Backfill: use the earliest student_sections.created_at per student.
        // If a student has no enrollments, leave NULL (engine handles null).
        DB::statement("
            UPDATE students
            SET enrollment_date = (
                SELECT DATE(MIN(ss.created_at))
                FROM student_sections ss
                WHERE ss.student_id = students.id
            )
        ");
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('enrollment_date');
        });
    }
};
