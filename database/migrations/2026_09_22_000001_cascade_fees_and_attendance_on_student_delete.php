<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Student hard-delete was blocked by RESTRICT FKs on fees.student_id /
 * attendance.student_id (student_sections already cascaded). Cascade those
 * dependents so DELETE FROM students succeeds (payments cascade from fees).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')
                  ->references('id')
                  ->on('students')
                  ->cascadeOnDelete();
        });

        Schema::table('attendance', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')
                  ->references('id')
                  ->on('students')
                  ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')
                  ->references('id')
                  ->on('students')
                  ->restrictOnDelete();
        });

        Schema::table('attendance', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')
                  ->references('id')
                  ->on('students')
                  ->restrictOnDelete();
        });
    }
};
