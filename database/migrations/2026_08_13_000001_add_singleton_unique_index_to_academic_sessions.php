<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Partial unique index on `is_current`: a generated column is 1 for the
     * current session and NULL for every other row, so the unique index can
     * never hold two 1s. NULLs are never equal in MySQL, so non-current rows
     * never conflict with each other or with the current row.
     */
    public function up(): void
    {
        Schema::table('academic_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('is_current_singleton')
                ->nullable()
                ->storedAs('CASE WHEN is_current = 1 THEN 1 ELSE NULL END')
                ->unique();
        });
    }

    public function down(): void
    {
        Schema::table('academic_sessions', function (Blueprint $table) {
            $table->dropUnique(['is_current_singleton']);
            $table->dropColumn('is_current_singleton');
        });
    }
};
