<?php

namespace Database\Seeders;

use App\Models\AcademicSession;
use Illuminate\Database\Seeder;

class AcademicSessionSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure at least one current academic session exists.
        // Uses the helper that derives the session from today's date.
        AcademicSession::currentOrCreate();
    }
}
