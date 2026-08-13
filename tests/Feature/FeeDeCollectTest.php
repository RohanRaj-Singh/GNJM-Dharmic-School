<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeDeCollectTest extends TestCase
{
    use RefreshDatabase;

    public function test_de_collecting_a_custom_fee_resets_is_locked(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $section = Section::create([
            'class_id' => $class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);

        $student = Student::create([
            'name' => 'Test Student',
            'father_name' => 'Test Father',
            'status' => 'active',
        ]);
        $enrollment = StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => StudentSection::STATUS_ACTIVE,
            'started_at'   => now(),
        ]);

        $fee = Fee::create([
            'student_section_id' => $enrollment->id,
            'type'   => 'custom',
            'title'  => 'Trip',
            'amount' => 500,
            'month'  => '2026-03',
        ]);

        // Collect → custom fee becomes locked.
        $this->actingAs($admin)
            ->post(route('admin.fees.collect', ['fee' => $fee->id]), [
                'collection_date' => '2026-03-15',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        // is_locked has no cast, so the DB returns it as integer 1/0.
        $this->assertSame(1, $fee->fresh()->is_locked);

        // De-collect → lock must be released so the fee is editable again.
        $this->actingAs($admin)
            ->post(route('admin.fees.deCollect', ['fee' => $fee->id]))
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertSame(0, $fee->fresh()->is_locked);
    }
}
