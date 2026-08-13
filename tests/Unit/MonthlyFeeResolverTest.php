<?php

namespace Tests\Unit;

use App\Models\FeeRatePeriod;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeResolver;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the monthly fee resolution order (F1 + F2) behind MonthlyFeeResolver:
 *
 *   free student → 0
 *   section fee-rate period → class fee-rate period → section.monthly_fee
 *   (legacy) → class.default_monthly_fee (legacy) → 0
 *
 * Sprint 6.1 — closes the missing service-test gap for the resolver.
 */
class MonthlyFeeResolverTest extends TestCase
{
    use RefreshDatabase;

    private function resolver(): MonthlyFeeResolver
    {
        return app(MonthlyFeeResolver::class);
    }

    private function class(int $defaultFee = 0): SchoolClass
    {
        return SchoolClass::create([
            'name' => 'Gurmukhi',
            'type' => 'gurmukhi',
            'default_monthly_fee' => $defaultFee,
        ]);
    }

    private function section(SchoolClass $class, int $monthlyFee = 0): Section
    {
        return Section::create([
            'class_id' => $class->id,
            'name' => 'Section A',
            'monthly_fee' => $monthlyFee,
        ]);
    }

    private function enroll(string $studentType, SchoolClass $class, Section $section): StudentSection
    {
        $student = Student::create(['name' => 'Fee Resolver Student', 'status' => 'active']);

        return StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => $studentType,
            'status' => 'active',
            'started_at' => now(),
        ]);
    }

    private function period(string $scopeType, int $scopeId, int $amount, string $from, ?string $to = null): FeeRatePeriod
    {
        return FeeRatePeriod::create([
            'scope_type' => $scopeType,
            'scope_id' => $scopeId,
            'amount' => $amount,
            'effective_from' => $from,
            'effective_to' => $to,
        ]);
    }

    private const MONTH = '2026-08';

    public function test_free_student_resolves_zero_regardless_of_rates(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('free', $class, $section);
        $this->period('section', $section->id, 200, '2026-01-01');
        $this->period('class', $class->id, 150, '2026-01-01');

        $this->assertSame(0, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_section_rate_period_takes_precedence(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 200, '2026-01-01');
        $this->period('class', $class->id, 150, '2026-01-01');

        $this->assertSame(200, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_class_rate_period_used_when_no_section_period(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('class', $class->id, 150, '2026-01-01');

        $this->assertSame(150, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_section_legacy_fee_used_when_no_periods(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);

        $this->assertSame(100, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_class_default_used_when_section_legacy_is_zero(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 0);
        $enrollment = $this->enroll('paid', $class, $section);

        $this->assertSame(90, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_resolves_zero_when_no_rate_anywhere(): void
    {
        $class = $this->class(0);
        $section = $this->section($class, 0);
        $enrollment = $this->enroll('paid', $class, $section);

        $this->assertSame(0, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_expired_section_period_falls_through_to_class_period(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 200, '2026-01-01', '2026-05-31');
        $this->period('class', $class->id, 150, '2026-01-01');

        $this->assertSame(150, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_open_ended_period_applies_until_now(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 200, '2026-07-01');

        $this->assertSame(200, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_period_not_yet_started_is_ignored(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 200, '2026-09-01');

        $this->assertSame(100, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_zero_amount_period_treated_as_none(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 0);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 0, '2026-01-01');

        $this->assertSame(90, $this->resolver()->resolveForMonth($enrollment, self::MONTH));
    }

    public function test_resolve_bulk_uses_precomputed_period_flags(): void
    {
        $class = $this->class(90);
        $section = $this->section($class, 100);
        $enrollment = $this->enroll('paid', $class, $section);
        $this->period('section', $section->id, 200, '2026-01-01');

        $resolver = $this->resolver();
        $monthStart = Carbon::parse('2026-08-01');

        // Section flag set → section period amount wins.
        $this->assertSame(
            200,
            $resolver->resolveBulk($enrollment->id, 'paid', $section->id, $class->id, $monthStart, true, true)
        );

        // No period flags → 0 (the fast path never consults legacy fees).
        $this->assertSame(
            0,
            $resolver->resolveBulk($enrollment->id, 'paid', $section->id, $class->id, $monthStart, false, false)
        );

        // Free student → 0 even with flags set.
        $this->assertSame(
            0,
            $resolver->resolveBulk($enrollment->id, 'free', $section->id, $class->id, $monthStart, true, true)
        );
    }

    public function test_scope_has_periods_returns_matching_ids(): void
    {
        $this->period('section', 501, 200, '2026-01-01');
        $this->period('section', 503, 150, '2026-01-01');

        $this->assertSame(
            [501, 503],
            $this->resolver()->scopeHasPeriods('section', [500, 501, 502, 503])
        );
        $this->assertSame([], $this->resolver()->scopeHasPeriods('section', [500, 502]));
        $this->assertSame([], $this->resolver()->scopeHasPeriods('class', [501, 503]));
    }
}
