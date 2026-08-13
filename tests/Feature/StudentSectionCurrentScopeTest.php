<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class StudentSectionCurrentScopeTest extends TestCase
{
    use RefreshDatabase;

    private SchoolClass $class;
    private Section $section;

    protected function setUp(): void
    {
        parent::setUp();

        $this->class = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->section = Section::create([
            'class_id' => $this->class->id,
            'name' => 'Section A',
            'monthly_fee' => 600,
        ]);
    }

    private function makeEnrollment(string $status, ?Carbon $transferredAt = null): StudentSection
    {
        $student = Student::create([
            'name' => 'Test Student',
            'father_name' => 'Test Father',
            'status' => 'active',
        ]);

        return StudentSection::create([
            'student_id'    => $student->id,
            'class_id'      => $this->class->id,
            'section_id'    => $this->section->id,
            'student_type'  => 'paid',
            'status'        => $status,
            'started_at'    => now()->subMonth(),
            'transferred_at' => $transferredAt,
        ]);
    }

    public function test_current_scope_returns_only_active_and_not_transferred_enrollments(): void
    {
        $active = $this->makeEnrollment(StudentSection::STATUS_ACTIVE);
        $inactive = $this->makeEnrollment(StudentSection::STATUS_INACTIVE);
        // A transferred-out enrollment is NOT current even if still "active".
        $transferred = $this->makeEnrollment(StudentSection::STATUS_ACTIVE, now());

        $currentIds = StudentSection::current()->pluck('id')->all();

        $this->assertSame([$active->id], $currentIds);
        $this->assertNotContains($inactive->id, $currentIds);
        $this->assertNotContains($transferred->id, $currentIds);
    }
}
