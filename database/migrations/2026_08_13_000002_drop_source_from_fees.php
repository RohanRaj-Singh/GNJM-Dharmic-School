<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `source` was a duplicate of `type` (monthly/custom) and drifted from it;
     * all write paths now rely on `type` alone, so the redundant column goes.
     */
    public function up(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->enum('source', ['monthly', 'custom'])->nullable()->after('type');
        });
    }
};
