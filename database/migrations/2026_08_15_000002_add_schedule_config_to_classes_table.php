<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stage B — class schedule/fee configuration (approved plan: docs/architecture/
 * 12-MultiClass-Impact-Audit.md §12, decision gate cleared).
 *
 * Replaces the binary "is this Gurmukhi or Kirtan?" day/fee hardcoding with
 * per-class configuration. Two additive, nullable columns:
 *
 *   - `attendance_days`   JSON array of ISO day-of-week numbers (0=Sunday ..
 *                         6=Saturday). NULL = not configured → legacy rule
 *                         (Kirtan is Sunday-only; every other class is
 *                         Monday–Saturday).
 *   - `charges_monthly_fee` boolean. NULL = not configured → legacy rule
 *                         (Kirtan is excluded from monthly fees; every other
 *                         class participates).
 *
 * Like Stage A2's `division` column: no backfill. NULL is the correct default
 * for every existing row, so all current Gurmukhi/Kirtan behaviour resolves
 * exactly as before. New classes created through the UI set these explicitly.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->json('attendance_days')->nullable()->after('division');
            $table->boolean('charges_monthly_fee')->nullable()->after('attendance_days');
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn(['attendance_days', 'charges_monthly_fee']);
        });
    }
};
