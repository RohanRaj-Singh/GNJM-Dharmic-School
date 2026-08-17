<?php

namespace Tests\Unit;

use App\Enums\AttendanceStatus;
use PHPUnit\Framework\TestCase;

/**
 * Pins the App\Enums\AttendanceStatus enum (Sprint 1.2 closer).
 *
 * The enum is a backed string enum so the on-disk column value
 * matches `->value` exactly — no schema migration required. The
 * normalization contract (legacy single-letter codes 'a'/'l'/'p'
 * canonicalize to the corresponding full-word value) is the load-
 * bearing invariant: AbsenteeService::normalizeStatus() delegates
 * to fromLegacy().
 *
 * Companion: app/Enums/AttendanceStatus.php,
 * app/Services/AbsenteeService.php::normalizeStatus().
 */
class AttendanceStatusEnumTest extends TestCase
{
    public function test_three_canonical_cases_have_three_distinct_values(): void
    {
        $this->assertSame('present', AttendanceStatus::Present->value);
        $this->assertSame('absent',  AttendanceStatus::Absent->value);
        $this->assertSame('leave',   AttendanceStatus::Leave->value);

        $this->assertCount(3, AttendanceStatus::cases());
        $this->assertCount(3, AttendanceStatus::values());
    }

    public function test_values_returns_canonical_string_list(): void
    {
        // Order matches declaration (Present, Absent, Leave) — useful
        // for the mark flow's `$allowedStatuses` validation.
        $this->assertSame(['present', 'absent', 'leave'], AttendanceStatus::values());
    }

    public function test_try_from_legacy_canonicalizes_single_letter_codes(): void
    {
        $this->assertSame(AttendanceStatus::Present, AttendanceStatus::tryFromLegacy('p'));
        $this->assertSame(AttendanceStatus::Absent,  AttendanceStatus::tryFromLegacy('a'));
        $this->assertSame(AttendanceStatus::Leave,   AttendanceStatus::tryFromLegacy('l'));
    }

    public function test_try_from_legacy_canonicalizes_full_words(): void
    {
        $this->assertSame(AttendanceStatus::Present, AttendanceStatus::tryFromLegacy('present'));
        $this->assertSame(AttendanceStatus::Absent,  AttendanceStatus::tryFromLegacy('absent'));
        $this->assertSame(AttendanceStatus::Leave,   AttendanceStatus::tryFromLegacy('leave'));
    }

    public function test_try_from_legacy_is_case_insensitive_and_trims_whitespace(): void
    {
        $this->assertSame(AttendanceStatus::Present, AttendanceStatus::tryFromLegacy('  PRESENT  '));
        $this->assertSame(AttendanceStatus::Absent,  AttendanceStatus::tryFromLegacy(' Absent'));
        $this->assertSame(AttendanceStatus::Leave,   AttendanceStatus::tryFromLegacy('LEAVE '));
    }

    public function test_try_from_legacy_returns_null_for_unknown_values(): void
    {
        // tryFromLegacy() is intentionally graceful — unknown values
        // (e.g. a future 'late' status before this enum knows about it)
        // return null so the upstream normalizeStatus() can fall back
        // to the raw string. Strict validation belongs at the call
        // site (compare result to null, or pair with `tryFrom()`).
        $this->assertNull(AttendanceStatus::tryFromLegacy('zzz-not-a-status'));
        $this->assertNull(AttendanceStatus::tryFromLegacy(''));
        $this->assertNull(AttendanceStatus::tryFromLegacy('   '));
    }
}
