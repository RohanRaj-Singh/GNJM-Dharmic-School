<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Add new columns (only if not already present) ──
        Schema::table('student_sections', function (Blueprint $table) {
            if (!Schema::hasColumn('student_sections', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('transferred_at');
            }

            if (!Schema::hasColumn('student_sections', 'outcome')) {
                $table->string('outcome')->nullable()->after('started_at');
            }

            if (!Schema::hasColumn('student_sections', 'academic_session_id')) {
                $table->foreignId('academic_session_id')
                      ->nullable()
                      ->after('outcome')
                      ->constrained('academic_sessions')
                      ->nullOnDelete();
            }
        });

        // ── 2. Backfill started_at from created_at for existing rows ──
        DB::statement('UPDATE student_sections SET started_at = created_at WHERE started_at IS NULL');

        // ── 3. Drop the UNIQUE(student_id, class_id) constraint ──
        // MySQL requires an index on FK-referencing columns. The composite
        // unique index was used for this purpose, so we must ensure
        // individual indexes exist before dropping it.
        Schema::table('student_sections', function (Blueprint $table) {
            // Ensure individual indexes exist for FK support
            $table->index('student_id', 'idx_student_sections_student_id');
            $table->index('class_id', 'idx_student_sections_class_id');

            // Drop the composite unique constraint if it still exists
            // MySQL may reject dropping if no individual index covers the FK column,
            // but we added individual indexes above so it should work.
            try {
                $table->dropUnique(['student_id', 'class_id']);
            } catch (\Throwable $e) {
                // Constraint may have already been dropped in a prior attempt
            }
        });

        // ── 4. Ensure transferred_at index exists for querying current/historical ──
        Schema::table('student_sections', function (Blueprint $table) {
            $table->index('transferred_at', 'idx_student_sections_transferred_at');
        });
    }

    public function down(): void
    {
        Schema::table('student_sections', function (Blueprint $table) {
            $table->dropForeign(['academic_session_id']);
            $table->dropColumn(['started_at', 'outcome', 'academic_session_id']);
            $table->dropIndex('idx_student_sections_transferred_at');
            $table->dropIndex('idx_student_sections_student_id');
            $table->dropIndex('idx_student_sections_class_id');
        });

        // Restore the unique constraint (will fail if duplicates exist).
        Schema::table('student_sections', function (Blueprint $table) {
            $table->unique(['student_id', 'class_id']);
        });
    }
};
