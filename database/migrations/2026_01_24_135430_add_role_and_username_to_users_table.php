<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            // ✅ Add username (if not already there)
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username')->unique()->after('name');
            }

            // ❌ REMOVE role (already exists)
            // $table->string('role')->default('teacher')->after('password');

            // ✅ Add is_active (required by auth)
            if (!Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('role');
            }

            // ✅ Allow nullable email
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username', 'is_active']);
            $table->string('email')->nullable(false)->change();
        });
    }
};
