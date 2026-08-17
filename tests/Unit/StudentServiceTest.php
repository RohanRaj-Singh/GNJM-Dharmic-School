<?php

namespace Tests\Unit;

use App\Services\StudentService;
use PHPUnit\Framework\TestCase;

/**
 * Pins the pure-logic surface of the extracted StudentService.
 *
 * The DB-bound methods (bulkUpsert, rosterRows, buildEnrollmentHistory,
 * filterOptions) are already heavily pinned by 5 feature tests running
 * through the full HTTP path. This unit test covers the pure helpers
 * for a fast in-process failure signal.
 *
 * Companion: app/Services/StudentService.php (Sprint 1.1 extraction).
 */
class StudentServiceTest extends TestCase
{
    private StudentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        // The pure helpers don't use either constructor dependency, but
        // constructing the service ensures the type's autoload is fine.
        $this->service = new StudentService(
            \Mockery::mock(\App\Services\StudentStatusMachine::class),
            \Mockery::mock(\App\Services\MonthlyFeeService::class),
        );
    }

    protected function tearDown(): void
    {
        \Mockery::close();
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────────────────
       normalizeName — the title-cased name trim used by bulkUpsert
       ─────────────────────────────────────────────────────────── */

    public function test_normalize_name_trims_collapses_lowercases_and_title_cases(): void
    {
        $this->assertSame('Harnam Singh', $this->service->normalizeName('  harnam   singh  '));
    }

    public function test_normalize_name_returns_null_for_null_input(): void
    {
        $this->assertNull($this->service->normalizeName(null));
    }

    public function test_normalize_name_returns_null_for_whitespace_only_input(): void
    {
        $this->assertNull($this->service->normalizeName('   '));
        $this->assertNull($this->service->normalizeName(''));
    }

    public function test_normalize_name_handles_mixed_case_with_squish(): void
    {
        // Title-case applied AFTER squish — internal double spaces collapse,
        // then each word is title-cased.
        $this->assertSame('Harnam Singh', $this->service->normalizeName('  HARNAM    singh  '));
    }

    public function test_normalize_name_preserves_punctuation_but_lowercases_after_apostrophe(): void
    {
        // Pins the actual implementation behavior: Str::title() preserves
        // apostrophes and hyphens but does NOT know that "'s" / "'t" are
        // separable suffixes, so the letter after an apostrophe stays
        // lowercase. This is a quirk of Laravel's Str::title() and is
        // accepted as-is — the contract is "title-case after squish+lower",
        // not "intelligent title-case per Unicode word boundaries".
        $this->assertSame("O'brien-Smith", $this->service->normalizeName("o'brien-smith"));
    }
}
