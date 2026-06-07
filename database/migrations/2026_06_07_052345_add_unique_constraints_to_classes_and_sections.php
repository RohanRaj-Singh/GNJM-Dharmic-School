<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prevent future duplicate class names
        Schema::table('classes', function (Blueprint $table) {
            $table->unique(['name'], 'classes_name_unique');
        });

        // Prevent future duplicate section names within the same class
        Schema::table('sections', function (Blueprint $table) {
            $table->unique(['class_id', 'name'], 'sections_class_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropUnique('classes_name_unique');
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique('sections_class_name_unique');
        });
    }
};
