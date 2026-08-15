<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the cross-division visibility contract on the front-facing
 * /students routes. Before this fix, both Students/Index (filter pills)
 * and Students/Show (tabs) hardcoded the 2-division
 * "Gurmukhi/Kirtan" contract. That hid any third+ class an admin added
 * (Music, Tabla, …) from the student's overview entirely.
 *
 * After this fix:
 *   - /students ships `divisions[]` = every distinct division key the
 *     resolver returns across the classes table — third+ classes
 *     surface as filter pills automatically.
 *   - /students/{id} ships `divisions[]` so the show page renders a tab
 *     for every configured division, even when the student has no
 *     enrollment there. Tabs without an enrollment render a
 *     "Not enrolled in this class" placeholder in the view.
 *
 * The seam invariant: explicit `classes.division` wins over the legacy
 * 2-arg `type`/`name` heuristic — see app/Support/DivisionTypeResolver
 * and the memory note `class-rename-bucket-lock`.
 */
class StudentCrossDivisionVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $accountant;
    private SchoolClass $gurmukhi;
    private Section $gurmukhiSection;
    private SchoolClass $kirtan;
    private Section $kirtanSection;
    private SchoolClass $music;
    private Section $musicSection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountant = User::factory()->create([
            'role'     => 'accountant',
            'username' => 'acct_cross_division_test',
        ]);

        // Legacy divisions: explicit division matches the legacy type.
        $this->gurmukhi = SchoolClass::create([
            'name'                => 'Gurmukhi',
            'type'                => 'gurmukhi',
            'division'            => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->gurmukhiSection = Section::create([
            'class_id'    => $this->gurmukhi->id,
            'name'        => 'Section A',
            'monthly_fee' => 600,
        ]);

        $this->kirtan = SchoolClass::create([
            'name'                => 'Kirtan',
            'type'                => 'kirtan',
            'division'            => 'kirtan',
            'default_monthly_fee' => 0,
        ]);
        $this->kirtanSection = Section::create([
            'class_id'    => $this->kirtan->id,
            'name'        => 'Section B',
            'monthly_fee' => 0,
        ]);

        // Third+ division with EXPLICIT division='music'. Without the
        // explicit column, the resolver would have collapsed this to
        // 'gurmukhi' and hidden it from every pill + tab.
        $this->music = SchoolClass::create([
            'name'                => 'Music',
            'type'                => 'music',
            'division'            => 'music',
            'default_monthly_fee' => 500,
        ]);
        $this->musicSection = Section::create([
            'class_id'    => $this->music->id,
            'name'        => 'Section C',
            'monthly_fee' => 500,
        ]);
    }

    private function student(string $name): Student
    {
        return Student::create([
            'name'        => $name,
            'father_name' => 'Test Father',
            'status'      => Student::STATUS_ACTIVE,
        ]);
    }

    private function enroll(
        Student $student,
        SchoolClass $class,
        Section $section,
        string $startedAt,
    ): StudentSection {
        return StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => $class->id,
            'section_id'   => $section->id,
            'student_type' => 'paid',
            'status'       => 'active',
            'started_at'   => $startedAt,
        ]);
    }

    /* ───────────────────────────────────────────────────────────
       Index — divisions prop must include third+ classes
       ─────────────────────────────────────────────────────────── */

    public function test_index_ships_every_distinct_division_in_the_prop(): void
    {
        $response = $this->actingAs($this->accountant)->get(route('students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Index')
            ->where('divisions', fn ($divisions) => collect($divisions)
                ->contains('music')
                && collect($divisions)->contains('kirtan')
                && collect($divisions)->contains('gurmukhi')
            ));
    }

    public function test_index_divisions_are_distinct_when_two_classes_share_a_bucket(): void
    {
        // A second Music-named class with the same explicit `division`
        // bucket must collapse to a single entry in the divisions prop
        // so the pill bar doesn't render duplicate pills.
        SchoolClass::create([
            'name'                => 'Music Advanced',
            'type'                => 'music',
            'division'            => 'music',
            'default_monthly_fee' => 600,
        ]);

        $response = $this->actingAs($this->accountant)->get(route('students.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Index')
            ->where('divisions', fn ($divisions) =>
                collect($divisions)->filter(fn ($d) => $d === 'music')->count() === 1
            ));
    }

    /* ───────────────────────────────────────────────────────────
       Show — divisions prop + summary cover third+ classes
       ─────────────────────────────────────────────────────────── */

    public function test_show_ships_every_configured_division_even_when_student_isnt_enrolled(): void
    {
        $student = $this->student('Gurmukhi Only');
        // Enrolled in Gurmukhi only — divisions prop must still include
        // Music and Kirtan so the show page can render them as tabs.
        $this->enroll($student, $this->gurmukhi, $this->gurmukhiSection, '2026-07-01');

        $response = $this->actingAs($this->accountant)->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->where('divisions', fn ($divs) => collect($divs)
                ->contains('music')
                && collect($divs)->contains('kirtan')
                && collect($divs)->contains('gurmukhi')
            ));
    }

    public function test_show_summary_includes_third_division_when_student_is_enrolled(): void
    {
        $student = $this->student('Three Section Kid');
        $this->enroll($student, $this->gurmukhi, $this->gurmukhiSection, '2026-07-01');
        $this->enroll($student, $this->music, $this->musicSection, '2026-08-01');

        $response = $this->actingAs($this->accountant)->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            ->has('summary', 2)
            ->where('summary', fn ($summary) => collect($summary)
                ->pluck('class_type_key')
                ->contains('music')
            ));
    }

    public function test_show_falls_back_to_gurmukhi_when_explicit_division_is_null(): void
    {
        // Regression pin for the explicit-first seam invariant: NULL
        // `division` falls through to the 2-arg resolver, which
        // collapses an unknown 'music' type to 'gurmukhi'.
        $legacyMusic = SchoolClass::create([
            'name'                => 'Old Music',
            'type'                => 'music', // legacy classification
            'division'            => null,     // explicit seam: NULL
            'default_monthly_fee' => 0,
        ]);
        $legacySection = Section::create([
            'class_id'    => $legacyMusic->id,
            'name'        => 'Section D',
            'monthly_fee' => 0,
        ]);

        $student = $this->student('Legacy Kid');
        $this->enroll($student, $this->gurmukhi, $this->gurmukhiSection, '2026-07-01');
        $this->enroll($student, $legacyMusic, $legacySection, '2026-08-01');

        $response = $this->actingAs($this->accountant)->get(route('students.show', $student->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Show')
            // Both classes collapse into the single 'gurmukhi' group via
            // the explicit-first seam — pinned so the legacy 2-arg
            // fallback never silently leaks into a new tab.
            ->has('summary', 1)
            ->where('summary.0.class_type_key', 'gurmukhi')
        );
    }
}
