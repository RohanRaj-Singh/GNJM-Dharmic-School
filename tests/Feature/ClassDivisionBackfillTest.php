<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Support\DivisionTypeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pins the behaviour of `2026_08_16_000001_backfill_class_division_for_existing_rows.php`.
 *
 * Why this test exists: a class added with `type='gurmukhi'` but no
 * explicit `division` (e.g. the Academy row from the user report)
 * silently collapsed into the Gurmukhi bucket because the resolver's
 * 2-arg fallback fired before the name was ever consulted. The
 * backfill migration sets `division = Str::slug(name)` for any row
 * where `division IS NULL`, which:
 *   - is a no-op for Gurmukhi + Kirtan rows (their slug matches the
 *     type-based heuristic's output),
 *   - promotes "Academy" to its own division ('academy') so it
 *     surfaces on the Students pill + tab surface like any other class.
 *
 * The backfill is safe because the explicit-first seam invariant in
 * DivisionTypeResolver means `division="academy"` wins over
 * `type="gurmukhi"` — the resolver returns 'academy' instead of
 * collapsing the row.
 *
 * Companion files:
 *   - 2026_08_16_000001_backfill_class_division_for_existing_rows.php
 *   - app/Support/DivisionTypeResolver.php (the explicit-first seam)
 *   - tests/Feature/StudentCrossDivisionVisibilityTest.php (the
 *     Students page contract that depends on this backfill having
 *     run).
 */
class ClassDivisionBackfillTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_sets_division_from_slug_of_name_for_null_rows(): void
    {
        // Seed three rows in the "before" state: NULL division, mixed
        // type columns. This mirrors the live database the user reported
        // on (Gurmukhi + Kirtan + Academy all with division=NULL).
        DB::table('classes')->insert([
            ['id' => 1, 'name' => 'Gurmukhi', 'type' => 'gurmukhi', 'division' => null, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Kirtan',   'type' => 'kirtan',   'division' => null, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Academy',  'type' => 'gurmukhi', 'division' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Sanity: Academy resolves to 'gurmukhi' before the migration.
        $this->assertSame(
            'gurmukhi',
            DivisionTypeResolver::division('gurmukhi', 'Academy', null),
        );

        // Invoke the migration directly. RefreshDatabase has already
        // run it once during setUp, so going through Artisan::call
        // would skip the up() body (the migration is in the table).
        $this->runBackfillUp();

        $gurmukhi = SchoolClass::find(1);
        $kirtan = SchoolClass::find(2);
        $academy = SchoolClass::find(3);

        // Existing rows: slug matches what the type-based heuristic
        // already returned — no behavior change.
        $this->assertSame('gurmukhi', $gurmukhi->division);
        $this->assertSame('kirtan', $kirtan->division);

        // The user-reported bug: Academy now resolves to its own bucket.
        $this->assertSame('academy', $academy->division);

        // The resolver's explicit-first seam makes this a real change:
        // before the migration Academy was 'gurmukhi', after it is 'academy'.
        $this->assertSame(
            'academy',
            DivisionTypeResolver::division($academy->type, $academy->name, $academy->division),
        );
    }

    public function test_backfill_preserves_admin_overrides(): void
    {
        // A row that already has a non-NULL division must be left alone.
        // The bucket-lock memory (`class-rename-bucket-lock`) guarantees
        // an admin can set the division explicitly; the backfill must
        // not clobber that.
        DB::table('classes')->insert([
            ['id' => 1, 'name' => 'Gurmukhi', 'type' => 'gurmukhi', 'division' => 'gurmukhi', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Kirtan',   'type' => 'kirtan',   'division' => 'kirtan',   'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Academy',  'type' => 'academy',  'division' => 'academy',  'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->runBackfillUp();

        $this->assertSame('gurmukhi', SchoolClass::find(1)->division);
        $this->assertSame('kirtan', SchoolClass::find(2)->division);
        $this->assertSame('academy', SchoolClass::find(3)->division);
    }

    public function test_backfill_falls_back_to_class_when_slug_is_empty(): void
    {
        // Str::slug('') returns '' — the migration must coerce to 'class'
        // so no row is left with an empty division (which would still
        // work via the explicit-first rule but is uglier in logs).
        DB::table('classes')->insert([
            ['id' => 1, 'name' => 'ਸਿੱਖੀ', 'type' => 'gurmukhi', 'division' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->runBackfillUp();

        $this->assertSame('class', SchoolClass::find(1)->division);
    }

    /**
     * Invoke the backfill migration's `up()` directly so the assertion
     * runs against the actual migration code path (not a copy). The
     * `require` returns the anonymous migration instance the file
     * declares.
     */
    private function runBackfillUp(): void
    {
        $migration = require database_path(
            'migrations/2026_08_16_000001_backfill_class_division_for_existing_rows.php'
        );
        $migration->up();
    }
}
