<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::table('attendance', function (Blueprint $table) {
        $table->enum('status', ['present', 'absent', 'leave'])
              ->default('present')
              ->after('date');

        $table->dropColumn('present');
    });
}

public function down()
{
    Schema::table('attendance', function (Blueprint $table) {
        $table->boolean('present')->default(true);
        $table->dropColumn('status');
    });
}

};
