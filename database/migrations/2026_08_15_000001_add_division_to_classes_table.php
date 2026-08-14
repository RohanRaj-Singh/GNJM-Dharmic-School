<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stage A2 — explicit division seam (approved plan: docs/architecture/
 * 12-MultiClass-Impact-Audit.md §12).
 *
 * Adds a nullable `division` override on `classes`. When a row carries a
 * value, DivisionTypeResolver returns it verbatim (explicit-first); when NULL
 * (every existing row — no backfill migration), the resolver keeps today's
 * inference unchanged. This is the seam a third+ class sets at creation so it
 * no longer silently collapses into the Gurmukhi bucket.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->string('division', 20)->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn('division');
        });
    }
};
