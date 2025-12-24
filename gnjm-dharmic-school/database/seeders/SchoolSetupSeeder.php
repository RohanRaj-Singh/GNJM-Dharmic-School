<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SchoolClass;
use App\Models\Section;

class SchoolSetupSeeder extends Seeder
{
    public function run(): void
    {
        // Gurmukhi Class
        $gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);

        Section::insert([
            ['class_id' => $gurmukhi->id, 'name' => 'Section A'],
            ['class_id' => $gurmukhi->id, 'name' => 'Section B'],
        ]);

        // Kirtan Class
        $kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 0,
        ]);

        Section::insert([
            ['class_id' => $kirtan->id, 'name' => 'Tabla'],
            ['class_id' => $kirtan->id, 'name' => 'Dil Rubab'],
        ]);
    }
}
