<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fees', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_section_id')
                  ->constrained('student_sections')
                  ->cascadeOnDelete();

            $table->string('type'); // monthly | extra
            $table->string('title');
            $table->integer('amount');

            $table->string('month')->nullable(); // YYYY-MM

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fees');
    }
};
