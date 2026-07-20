<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_entries', function (Blueprint $table) {
            $table->id();
            $table->string('filename');
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->unsignedBigInteger('db_size')->default(0);
            $table->string('checksum', 64);
            $table->string('app_version', 32)->nullable();
            $table->string('laravel_version', 32)->nullable();
            $table->unsignedInteger('migration_count')->default(0);
            $table->string('status')->default('created');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_entries');
    }
};
