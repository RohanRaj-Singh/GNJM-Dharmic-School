<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Sprint 6.3 — HTTP smoke tests: the report builder and the export endpoints
 * (CSV + PDF) return 200 with the expected content type.
 *
 *  - POST /admin/reports/build             fees + attendance/calendar JSON
 *  - POST /admin/reports/export/csv        fees report → text/csv
 *  - POST /admin/reports/export/pdf        fees report → application/pdf
 *  - GET  /admin/student-report-center/export/pdf
 *  - POST /admin/student-report-center/export/pdf
 *
 * The deeper fee/attendance query behaviour is pinned in FeesIndexQueryTest and
 * AttendanceLifecycleTest; the StudentReport build/GET-export security flow in
 * StudentReport\SecurityTest. Here we only smoke the endpoint contracts.
 */
class ReportExportSmokeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $class;
    private Section $section;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'report_export_smoke',
        ]);

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
        $this->student = Student::create([
            'name' => 'Report Student',
            'father_name' => 'Report Father',
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $this->student->id,
            'class_id' => $this->class->id,
            'section_id' => $this->section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        Fee::create([
            'student_section_id' => $enrollment->id,
            'type' => 'monthly',
            'month' => now(config('app.timezone'))->format('Y-m'),
            'amount' => 600,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function asAdmin()
    {
        return $this->actingAs($this->admin);
    }

    private function classIds(): array
    {
        return [$this->class->id];
    }

    /* ───────────────────────────────────────────────
       Report builder
       ─────────────────────────────────────────────── */

    public function test_fees_report_build_returns_summary(): void
    {
        $response = $this->asAdmin()->post(route('admin.reports.build'), [
            'report' => 'fees',
            'class_ids' => $this->classIds(),
            'year_from' => 2026,
            'year_to' => 2026,
        ]);

        $response->assertOk();
        $body = $response->json();
        $this->assertSame('fees', $body['meta']['report']);
        $this->assertArrayHasKey('summary', $body);
        $this->assertArrayHasKey('breakdowns', $body);
        $this->assertArrayHasKey('tables', $body);
        $this->assertSame(1, $body['summary']['total_students']);
    }

    public function test_attendance_calendar_build_returns_days(): void
    {
        $response = $this->asAdmin()->post(route('admin.reports.build'), [
            'report' => 'attendance',
            'view' => 'calendar',
            'class_ids' => $this->classIds(),
            'year' => 2026,
            'month' => '08',
        ]);

        $response->assertOk();
        $body = $response->json();
        $this->assertArrayHasKey('calendar', $body);
        $this->assertCount(31, $body['calendar']['days']);
        $this->assertSame('Report Student', $body['calendar']['students'][0]['name']);
    }

    /* ───────────────────────────────────────────────
       Exports — legacy reports area (POST)
       ─────────────────────────────────────────────── */

    public function test_fees_report_csv_export(): void
    {
        $response = $this->asAdmin()->post(route('admin.reports.export.csv'), [
            'report' => 'fees',
            'class_ids' => $this->classIds(),
            'year' => 2026,
        ]);

        $response->assertOk();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Student Name', $csv);
        $this->assertStringContainsString('Report Student', $csv);
    }

    public function test_fees_report_pdf_export(): void
    {
        $response = $this->asAdmin()->post(route('admin.reports.export.pdf'), [
            'report' => 'fees',
            'class_ids' => $this->classIds(),
            'year' => 2026,
        ]);

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    /* ───────────────────────────────────────────────
       Exports — student report center (GET + POST)
       ─────────────────────────────────────────────── */

    public function test_student_report_center_pdf_export_get(): void
    {
        $response = $this->asAdmin()->get(route('admin.student-report-center.export.pdf.get', [
            'student_id' => $this->student->id,
            'range_mode' => 'calendar_year',
            'single_year' => 2026,
            'division' => 'all',
        ]));

        $response->assertOk();
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_student_report_center_pdf_export_post(): void
    {
        $response = $this->asAdmin()->post(route('admin.student-report-center.export.pdf.post'), [
            'student_id' => $this->student->id,
            'range_mode' => 'calendar_year',
            'single_year' => 2026,
            'division' => 'all',
        ]);

        $response->assertOk();
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }
}
