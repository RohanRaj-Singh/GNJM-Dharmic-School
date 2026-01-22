<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | FEES TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('fees', function (Blueprint $table) {
            // Make title nullable (monthly fees don't need it)
            $table->string('title')->nullable()->change();

            // Who created the fee (system vs manual)
            $table->enum('source', ['monthly', 'custom'])
                  ->after('type');

            // Batch ID for custom fee assignments
            $table->uuid('batch_id')
                  ->nullable()
                  ->after('student_section_id');

            // Lock system / paid fees
            $table->boolean('is_locked')
                  ->default(false)
                  ->after('amount');
        });

        /*
        |--------------------------------------------------------------------------
        | PAYMENTS TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('payments', function (Blueprint $table) {
            // Allow safe un-collect (audit trail)
            $table->softDeletes();
        });

        /*
        |--------------------------------------------------------------------------
        | STUDENT_SECTIONS TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('student_sections', function (Blueprint $table) {
            // One-time onboarding utility
            $table->unsignedTinyInteger('assumed_pending_months')
                  ->default(0)
                  ->after('monthly_fee');
        });
    }

    public function down(): void
    {
        /*
        |--------------------------------------------------------------------------
        | FEES TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('fees', function (Blueprint $table) {
            $table->dropColumn([
                'source',
                'batch_id',
                'is_locked',
            ]);

            // Revert title to NOT NULL (original state)
            $table->string('title')->nullable(false)->change();
        });

        /*
        |--------------------------------------------------------------------------
        | PAYMENTS TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('payments', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        /*
        |--------------------------------------------------------------------------
        | STUDENT_SECTIONS TABLE
        |--------------------------------------------------------------------------
        */
        Schema::table('student_sections', function (Blueprint $table) {
            $table->dropColumn('assumed_pending_months');
        });
    }
};
