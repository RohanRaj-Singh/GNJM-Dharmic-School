<?php

namespace Tests\Feature\StudentReport;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use App\Services\StudentReport\StudentReportService;
use App\Support\StudentReport\StudentReportRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Stage A4 — data-driven reports (approved plan: docs/architecture/
 * 12-MultiClass-Impact-Audit.md §12).
 *
 * The report engine and dashboard must derive divisions from the data, not a
 * fixed two-division map. Once a class carries an explicit `division='music'`
 * (the A2 seam), that division must surface on its own — in the student
 * performance report AND the dashboard — instead of collapsing into gurmukhi.
 */
class MultiClassDivisionReportTest extends TestCase
{
    use RefreshDatabase;

    private function musicEnrollment(): array
    {
        $student = Student::create([
            'name' => 'Music Kid',
            'father_name' => 'Father of Music Kid',
            'status' => 'active',
        ]);
        $class = SchoolClass::create([
            'name' => 'Music',
            'type' => 'music',
            'division' => 'music', // explicit division seam (Stage A2)
            'default_monthly_fee' => 500,
        ]);
        $section = Section::create([
            'class_id' => $class->id,
            'name' => 'Music A',
            'monthly_fee' => 500,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => 'active',
            'started_at' => now(),
        ]);
        return ['student' => $student, 'class' => $class, 'enrollment' => $enrollment];
    }

    public function test_report_all_mode_surfaces_an_explicit_third_division(): void
    {
        ['student' => $student] = $this->musicEnrollment();

        $service = app(StudentReportService::class);
        $req = new StudentReportRequest(
            studentId: $student->id,
            rangeMode: StudentReportRequest::RANGE_CALENDAR_YEAR,
            singleYear: 2026,
            singleMonth: null,
            rangeStart: null,
            rangeEnd: null,
            division: StudentReportRequest::DIVISION_ALL,
        );

        $report = $service->build($req);

        // Data-driven: the 'music' division is its own report block — no empty
        // gurmukhi/kirtan stubs, and the identity label derives from the open key.
        $this->assertArrayHasKey('music', $report->divisions);
        $this->assertArrayNotHasKey('gurmukhi', $report->divisions);
        $this->assertArrayNotHasKey('kirtan', $report->divisions);
        $this->assertTrue($report->divisions['music']->enrolled);
        $this->assertSame('music', $report->divisions['music']->division);
        $this->assertSame('Music', $report->identity->divisionLabel());
    }

    public function test_dashboard_surfaces_an_explicit_third_division(): void
    {
        // Gurmukhi (default) world + an explicit 'music' class.
        $gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi', 'type' => 'gurmukhi', 'default_monthly_fee' => 600,
        ]);
        $gSection = Section::create(['class_id' => $gurmukhi->id, 'name' => 'Gurmukhi A', 'monthly_fee' => 600]);
        $gStudent = Student::create(['name' => 'G Kid', 'father_name' => 'F', 'status' => 'active']);
        StudentSection::create([
            'student_id' => $gStudent->id, 'class_id' => $gurmukhi->id,
            'section_id' => $gSection->id, 'student_type' => 'paid', 'status' => 'active', 'started_at' => now(),
        ]);

        $this->musicEnrollment();

        $admin = User::factory()->create(['role' => 'admin', 'username' => 'multi_class_dashboard']);

        $response = $this->actingAs($admin)->getJson('/admin/dashboard/summary?year=2026');
        $response->assertOk();

        $divisions = collect($response->json('divisions'));

        $this->assertSame(1, $divisions->firstWhere('type', 'gurmukhi')['stats']['students_count']);
        $this->assertSame(1, $divisions->firstWhere('type', 'music')['stats']['students_count']);
        $this->assertNull($divisions->firstWhere('type', 'kirtan'));
    }
}
