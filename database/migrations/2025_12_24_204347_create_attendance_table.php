<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attendance', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_section_id')
                  ->constrained('student_sections')
                  ->cascadeOnDelete();

            $table->date('date');

            $table->boolean('present')->default(true);

            // Only for Kirtan (nullable for Gurmukhi)
            $table->boolean('lesson_learned')->nullable();

            $table->timestamps();

            $table->unique(['student_section_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance');
    }
};
