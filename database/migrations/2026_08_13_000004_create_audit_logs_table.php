<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3.2 — audit trail (R14).
 *
 * Append-only event log. Every significant fee/attendance mutation writes one
 * row: who did it (user_id), what happened (action), and the affected record
 * (polymorphic auditable) plus a JSON payload for extra context.
 *
 * user_id is intentionally nullable + nullOnDelete: an audit trail must
 * survive the deletion of the user who performed the action.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('action')->index();
            $table->string('auditable_type')->nullable()->index();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
