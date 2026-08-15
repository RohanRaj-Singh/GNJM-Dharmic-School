<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Backfill `classes.division` from `Str::slug(name)` for every row where
 * the column is currently NULL.
 *
 * Context: `2026_08_15_000001_add_division_to_classes_table.php` added
 * `division` as a nullable column deliberately WITHOUT a backfill so the
 * migration was safe to run on a live database — the explicit-first seam
 * invariant (DivisionTypeResolver) means a NULL `division` simply falls
 * through to the legacy 2-arg `type`/`name` heuristic, preserving
 * historical behavior for Gurmukhi + Kirtan rows verbatim.
 *
 * The follow-up backfill became necessary because a class added after
 * that migration ran (id=6 "Academy" with `type="gurmukhi"` but no
 * explicit `division`) silently collapsed into the Gurmukhi bucket:
 * the resolver saw `type="gurmukhi"` and returned "gurmukhi" before
 * the name was ever consulted. "Academy" then never showed up as its
 * own filter pill / tab on the Students or Attendance pages.
 *
 * Safety: this backfill sets `division = Str::slug(name)` for the
 * three rows currently NULL. For Gurmukhi ("Gurmukhi" → "gurmukhi")
 * and Kirtan ("Kirtan" → "kirtan") the slug matches what the legacy
 * type-based heuristic already returns — zero behavior change. For
 * "Academy" ("Academy" → "academy") the slug correctly escapes the
 * Gurmukhi bucket, which is the intended fix.
 *
 * Empty-slug fallback: `Str::slug('')` returns ''; we coerce to
 * 'class' so no row is left with an empty division (which would still
 * work via the explicit-first rule but is uglier in logs + tests).
 *
 * Pinned by `tests/Feature/ClassDivisionBackfillTest.php`.
 */
return new class extends Migration {
    public function up(): void
    {
        // SQLite (test env) supports UPDATE…WHERE out of the box; MySQL
        // (production) needs the same one-liner. We use the lower-level
        // DB facade to avoid loading Eloquent models in a migration context.
        $rows = DB::table('classes')->whereNull('division')->get(['id', 'name']);

        foreach ($rows as $row) {
            $slug = Str::slug((string) $row->name);
            if ($slug === '') {
                $slug = 'class';
            }

            DB::table('classes')
                ->where('id', $row->id)
                ->update(['division' => $slug]);
        }
    }

    public function down(): void
    {
        // The backfill is idempotent and informational — reversing it
        // restores the historical NULL state. We don't try to remember
        // which rows were originally NULL (the data column doesn't
        // exist for that), so the down simply NULLs every row that
        // matches what the backfill WOULD have written. In practice
        // this is a no-op because subsequent inserts will already
        // set the column.
        $rows = DB::table('classes')->get(['id', 'name']);

        foreach ($rows as $row) {
            $slug = Str::slug((string) $row->name);
            if ($slug === '') {
                $slug = 'class';
            }

            // Only NULL rows that the backfill would have touched.
            // (If an admin manually changed a row's division after the
            //  backfill, we leave it alone — they consciously diverged.)
            DB::table('classes')
                ->where('id', $row->id)
                ->where('division', $slug)
                ->update(['division' => null]);
        }
    }
};