<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->id();

            $table->string('name');                        // e.g. "Batch 2025"
            $table->unsignedSmallInteger('admission_year'); // e.g. 2025

            $table->timestamps();

            $table->unique('admission_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
