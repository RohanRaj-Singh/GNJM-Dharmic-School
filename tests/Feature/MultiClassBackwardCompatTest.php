<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use App\Support\DivisionTypeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Stage A1 — characterization freeze (approved plan: docs/architecture/
 * 12-MultiClass-Impact-Audit.md).
 *
 * The client wants to add classes beyond the existing two (Gurmukhi, Kirtan).
 * Before ANY multi-class change, this pins the behaviour of the CURRENT code
 * in two directions:
 *
 *   1. STABILITY — adding a third class (type='music') must not disturb any
 *      existing Gurmukhi/Kirtan result. We snapshot the scoped payloads
 *      (attendance grid, fees report, student-show summary, monthly-fee
 *      generation) with only two classes, then add the Music class and assert
 *      the same Gurmukhi/Kirtan payloads are byte-identical.
 *
 *   2. PIN — today the Music class silently resolves into the Gurmukhi bucket
 *      (DivisionTypeResolver's fallback for unknown types). These assertions
 *      document that behaviour so Stage A2 can prove it changed.
 *
 * Everything here must stay green on the unmodified codebase. It defines the
 * contract every later step must not violate.
 */
class MultiClassBackwardCompatTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private SchoolClass $gurmukhi;
    private Section $sectionG;
    private Student $gurmukhiStudent;

    private SchoolClass $kirtan;
    private Section $sectionK;
    private Student $kirtanStudent;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-13 10:00:00'); // a Thursday

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'username' => 'multi_class_admin',
        ]);

        $this->gurmukhi = SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->sectionG = Section::create([
            'class_id' => $this->gurmukhi->id,
            'name' => 'Gurmukhi A',
            'monthly_fee' => 600,
        ]);
        $this->gurmukhiStudent = $this->enroll('Gurmukhi Kid', $this->gurmukhi, $this->sectionG)['student'];

        $this->kirtan = SchoolClass::create([
            'name' => 'Kirtan',
            'type' => 'kirtan',
            'default_monthly_fee' => 0,
        ]);
        $this->sectionK = Section::create([
            'class_id' => $this->kirtan->id,
            'name' => 'Kirtan A',
            'monthly_fee' => 0,
        ]);
        $this->kirtanStudent = $this->enroll('Kirtan Kid', $this->kirtan, $this->sectionK)['student'];
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────
       Stability: Gurmukhi/Kirtan payloads unchanged
       ─────────────────────────────────────────────── */

    public function test_gurmukhi_and_kirtan_results_are_unchanged_by_a_third_class(): void
    {
        // Generate the real fee so the report / fees-index have content.
        Artisan::call('fees:generate-monthly');
        $this->assertSame(1, $this->monthlyFeesFor($this->gurmukhiStudent->id));
        $this->assertSame(0, $this->monthlyFeesFor($this->kirtanStudent->id));

        // Snapshot every scoped Gurmukhi/Kirtan payload BEFORE a third class exists.
        $gridG = $this->attendanceGrid($this->sectionG);
        $gridK = $this->attendanceGrid($this->sectionK);
        $reportG = $this->feesReportForClass($this->gurmukhi);
        $showG = $this->studentShowSummary($this->gurmukhiStudent);
        $showK = $this->studentShowSummary($this->kirtanStudent);
        $feeRowG = $this->feeRowForStudent($this->gurmukhiStudent->id);

        // Add the third class (Music) alongside the existing two.
        $music = $this->addMusicClass();

        // The exact same scoped Gurmukhi/Kirtan payloads must be byte-identical.
        $this->assertSame($gridG, $this->attendanceGrid($this->sectionG));
        $this->assertSame($gridK, $this->attendanceGrid($this->sectionK));
        $this->assertSame($reportG, $this->feesReportForClass($this->gurmukhi));
        $this->assertSame($showG, $this->studentShowSummary($this->gurmukhiStudent));
        $this->assertSame($showK, $this->studentShowSummary($this->kirtanStudent));
        $this->assertSame($feeRowG, $this->feeRowForStudent($this->gurmukhiStudent->id));

        // Re-running monthly generation must not disturb the existing Gurmukhi
        // fee (idempotent) nor create one for Kirtan. The Music student getting
        // a fee is pinned in the second test.
        Artisan::call('fees:generate-monthly');
        $this->assertSame(1, $this->monthlyFeesFor($this->gurmukhiStudent->id));
        $this->assertSame(0, $this->monthlyFeesFor($this->kirtanStudent->id));
        $this->assertSame(1, $this->monthlyFeesFor($music['student']->id));
    }

    /* ───────────────────────────────────────────────
       Pin: Music currently resolves into the Gurmukhi bucket
       ─────────────────────────────────────────────── */

    public function test_music_class_currently_resolves_into_the_gurmukhi_bucket(): void
    {
        $music = $this->addMusicClass();

        // The resolver itself: an unknown type falls back to gurmukhi today.
        $this->assertSame('gurmukhi', DivisionTypeResolver::division('music', 'Music'));

        // Monthly fees: Music is treated as a non-Kirtan (Gurmukhi) class, so its
        // paid student gets a monthly fee — pinning the pre-change billing.
        Artisan::call('fees:generate-monthly');
        $this->assertSame(1, $this->monthlyFeesFor($music['student']->id));

        // Fees index: the Music student's row AND each of its fees is labelled gurmukhi.
        $row = $this->feeRowForStudent($music['student']->id);
        $this->assertNotNull($row, 'Music student should appear in the fees index');
        $this->assertSame(['gurmukhi'], $row['class_types']);
        $this->assertSame(['gurmukhi'], array_values(array_unique(array_column($row['fees'], 'class_type'))));

        // Student center: the Music enrollment is grouped under class_type_key gurmukhi.
        $summary = $this->studentShowSummary($music['student']);
        $this->assertSame(1, count($summary));
        $this->assertSame('gurmukhi', $summary[0]['class_type_key']);
        $this->assertSame('Music', $summary[0]['class']);

        // Dashboard: the Music class lands in the gurmukhi division (Gurmukhi Kid
        // + Music Kid = 2 active students), Kirtan keeps its own, and no 'music'
        // division exists anywhere.
        $response = $this->asAdmin()->getJson('/admin/dashboard/summary?year=2026');
        $response->assertOk();
        $divisions = collect($response->json('divisions'));
        $gurmukhiDiv = $divisions->firstWhere('type', 'gurmukhi');
        $kirtanDiv   = $divisions->firstWhere('type', 'kirtan');

        $this->assertNotNull($gurmukhiDiv);
        $this->assertNotNull($kirtanDiv);
        $this->assertSame(2, $gurmukhiDiv['stats']['students_count']);
        $this->assertSame(1, $kirtanDiv['stats']['students_count']);
        $this->assertNull($divisions->firstWhere('type', 'music'));
    }

    /* ───────────────────────────────────────────────
       Fixture helpers
       ─────────────────────────────────────────────── */

    private function enroll(string $name, SchoolClass $class, Section $section): array
    {
        $student = Student::create([
            'name' => $name,
            'father_name' => 'Father of ' . $name,
            'status' => Student::STATUS_ACTIVE,
        ]);
        $enrollment = StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
            'status' => StudentSection::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
        return ['student' => $student, 'enrollment' => $enrollment];
    }

    /**
     * The third class: type 'music' — deliberately NOT gurmukhi/kirtan, so it
     * exercises the resolver's unknown-type fallback.
     */
    private function addMusicClass(): array
    {
        $class = SchoolClass::create([
            'name' => 'Music',
            'type' => 'music',
            'default_monthly_fee' => 500,
        ]);
        $section = Section::create([
            'class_id' => $class->id,
            'name' => 'Music A',
            'monthly_fee' => 500,
        ]);
        $enrolled = $this->enroll('Music Kid', $class, $section);
        return [
            'class' => $class,
            'section' => $section,
            'student' => $enrolled['student'],
            'enrollment' => $enrolled['enrollment'],
        ];
    }

    private function asAdmin()
    {
        return $this->actingAs($this->admin);
    }

    private function attendanceGrid(Section $section): array
    {
        $response = $this->asAdmin()->getJson(route('admin.attendance.grid', [
            'section_id' => $section->id,
            'year' => 2026,
            'month' => 8,
        ]));
        $response->assertOk();
        return $response->json();
    }

    private function feesReportForClass(SchoolClass $class): array
    {
        $response = $this->asAdmin()->post(route('admin.reports.build'), [
            'report' => 'fees',
            'class_ids' => [$class->id],
            'year_from' => 2026,
            'year_to' => 2026,
        ]);
        $response->assertOk();
        $body = $response->json();
        unset($body['meta']['generated_at']); // volatile timestamp
        return $body;
    }

    private function studentShowSummary(Student $student): array
    {
        $response = $this->asAdmin()->get(route('students.show', $student->id));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Students/Show'));
        return $response->inertiaPage()['props']['summary'];
    }

    private function feesIndexRows(): array
    {
        $response = $this->asAdmin()->get(route('admin.fees.index'));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Admin/Fees/Index'));
        return $response->inertiaPage()['props']['fees'];
    }

    private function feeRowForStudent(int $studentId): ?array
    {
        foreach ($this->feesIndexRows() as $row) {
            if ((int) $row['student_id'] === $studentId) {
                return $row;
            }
        }
        return null;
    }

    private function monthlyFeesFor(int $studentId): int
    {
        return Fee::where('student_id', $studentId)
            ->where('type', 'monthly')
            ->count();
    }
}
