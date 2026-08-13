<?php

namespace Tests\Feature;

use App\Models\AcademicSession;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AcademicSessionTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_current_or_create_creates_an_april_to_march_session_when_none_exists(): void
    {
        Carbon::setTestNow('2026-08-13 10:00:00');

        $session = AcademicSession::currentOrCreate();

        $this->assertSame(1, AcademicSession::where('is_current', true)->count());
        $this->assertSame('2026–27', $session->name);
        $this->assertSame('2026-04-01', $session->start_date->toDateString());
        $this->assertSame('2027-03-31', $session->end_date->toDateString());
        $this->assertTrue($session->is_current);
    }

    public function test_current_or_create_labels_january_with_previous_session_year(): void
    {
        Carbon::setTestNow('2026-01-15 09:00:00');

        $session = AcademicSession::currentOrCreate();

        $this->assertSame('2025–26', $session->name);
    }

    public function test_current_or_create_returns_existing_current_session_without_duplicating(): void
    {
        Carbon::setTestNow('2026-08-13 10:00:00');

        $first = AcademicSession::currentOrCreate();
        $second = AcademicSession::currentOrCreate();

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, AcademicSession::count());
    }

    public function test_unique_index_prevents_two_current_sessions(): void
    {
        AcademicSession::create([
            'name'       => '2025–26',
            'start_date' => '2025-04-01',
            'end_date'   => '2026-03-31',
            'is_current' => true,
        ]);

        $this->expectException(QueryException::class);

        AcademicSession::create([
            'name'       => '2026–27',
            'start_date' => '2026-04-01',
            'end_date'   => '2027-03-31',
            'is_current' => true,
        ]);
    }
}
