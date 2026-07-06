<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_sessions', function (Blueprint $table) {
            $table->id();

            $table->string('name');                          // e.g. "2025–26"
            $table->date('start_date');                      // e.g. 2025-04-01
            $table->date('end_date');                        // e.g. 2026-03-31
            $table->boolean('is_current')->default(false);   // at most one row is current

            $table->timestamps();

            $table->unique('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_sessions');
    }
};
