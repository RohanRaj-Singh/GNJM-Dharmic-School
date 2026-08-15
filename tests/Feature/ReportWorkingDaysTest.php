<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * B13 — working_days on the attendance report must reflect the attendance
 * days of the classes in the report, not a hardcoded Mon-Sat count.
 *
 * The audit flagged `app/Http/Controllers/Admin/ReportController.php` because
 * the old code did `$workingDays += in_array(date('N', $ts), [1,2,3,4,5,6])`,
 * silently dropping Kirtan (Sunday-only) and any future class with a custom
 * schedule. The fix routes the count through `SchoolClass::attendanceDays()`
 * (the canonical ClassSchedule seam) and takes the union across selected
 * classes.
 *
 * The expected counts below are computed against the August 2026 calendar:
 *   - Sundays (Kirtan attendance):   2, 9, 16, 23, 30            → 5 days
 *   - Mon–Sat (Gurmukhi attendance): every other day              → 26 days
 *   - Union of both:                                              → 31 days
 */
class ReportWorkingDaysTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private SchoolClass $gurmukhi;
    private SchoolClass $kirtan;
    private SchoolClass $music;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-15 10:00:00');

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'report_working_days',
        ]);

        // Gurmukhi — legacy Mon-Sat (no explicit attendance_days → fallback).
        $this->gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);

        // Kirtan — legacy Sunday-only via the type/name seam.
        $this->kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 0,
        ]);

        // Music — a third class with an explicit Stage B schedule
        // (Tue + Thu). Pins that explicit JSON config wins over the fallback.
        $this->music = SchoolClass::create([
            'name' => 'Music',
            'type' => 'music',
            'division' => 'music',
            'attendance_days' => [2, 4], // Tue + Thu
            'default_monthly_fee' => 500,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function buildAttendanceReport(array $classIds): array
    {
        $response = $this->actingAs($this->admin)->post(route('admin.reports.build'), [
            'report' => 'attendance',
            'class_ids' => $classIds,
            'month_from' => '2026-08',
            'month_to' => '2026-08',
        ]);

        $response->assertOk();
        return $response->json();
    }

    public function test_gurmukhi_only_counts_mon_sat(): void
    {
        $body = $this->buildAttendanceReport([$this->gurmukhi->id]);

        $this->assertSame(31, $body['summary']['total_days']);
        $this->assertSame(26, $body['summary']['working_days']);
    }

    public function test_kirtan_only_counts_sundays(): void
    {
        // The regression: the old hardcoded Mon-Sat loop returned 26 here
        // (Sundays excluded), undercounting Kirtan attendance capacity.
        $body = $this->buildAttendanceReport([$this->kirtan->id]);

        $this->assertSame(31, $body['summary']['total_days']);
        $this->assertSame(5, $body['summary']['working_days']);
    }

    public function test_gurmukhi_plus_kirtan_unions_both_schedules(): void
    {
        // Union of Mon-Sat + Sundays = every calendar day.
        $body = $this->buildAttendanceReport([$this->gurmukhi->id, $this->kirtan->id]);

        $this->assertSame(31, $body['summary']['total_days']);
        $this->assertSame(31, $body['summary']['working_days']);
    }

    public function test_third_class_explicit_schedule_is_respected(): void
    {
        // Music is Tue + Thu only. August 2026 has 4 Tuesdays and 4 Thursdays.
        $body = $this->buildAttendanceReport([$this->music->id]);

        $this->assertSame(31, $body['summary']['total_days']);
        $this->assertSame(8, $body['summary']['working_days']);
    }

    public function test_mixed_three_classes_union_is_mon_sat_plus_sunday(): void
    {
        // Music (Tue+Thu) is fully contained in Gurmukhi's Mon-Sat window, so
        // adding it does not expand the union — pinning that we de-duplicate
        // before counting, not after.
        $body = $this->buildAttendanceReport([
            $this->gurmukhi->id,
            $this->kirtan->id,
            $this->music->id,
        ]);

        $this->assertSame(31, $body['summary']['total_days']);
        $this->assertSame(31, $body['summary']['working_days']);
    }
}