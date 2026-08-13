<?php

namespace Tests\Unit;

use App\Models\Student;
use App\Services\StudentStatusMachine;
use PHPUnit\Framework\TestCase;

class StudentStatusMachineTest extends TestCase
{
    private StudentStatusMachine $machine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->machine = new StudentStatusMachine();
    }

    private const ALL_STATUSES = [
        Student::STATUS_ACTIVE,
        Student::STATUS_INACTIVE,
        Student::STATUS_PROMOTED,
        Student::STATUS_PASSED_OUT,
        Student::STATUS_LEFT,
    ];

    public function test_active_transitions(): void
    {
        foreach ([Student::STATUS_INACTIVE, Student::STATUS_PROMOTED, Student::STATUS_PASSED_OUT] as $to) {
            $this->assertTrue(
                $this->machine->canTransition(Student::STATUS_ACTIVE, $to),
                "active → {$to} should be allowed"
            );
        }

        foreach ([Student::STATUS_ACTIVE, Student::STATUS_LEFT] as $to) {
            $this->assertFalse(
                $this->machine->canTransition(Student::STATUS_ACTIVE, $to),
                "active → {$to} should be denied"
            );
        }
    }

    public function test_inactive_transitions(): void
    {
        $this->assertTrue($this->machine->canTransition(Student::STATUS_INACTIVE, Student::STATUS_ACTIVE));
        $this->assertTrue($this->machine->canTransition(Student::STATUS_INACTIVE, Student::STATUS_LEFT));

        foreach ([Student::STATUS_INACTIVE, Student::STATUS_PROMOTED, Student::STATUS_PASSED_OUT] as $to) {
            $this->assertFalse(
                $this->machine->canTransition(Student::STATUS_INACTIVE, $to),
                "inactive → {$to} should be denied"
            );
        }
    }

    public function test_terminal_statuses_have_no_outgoing_transitions(): void
    {
        foreach ([Student::STATUS_PROMOTED, Student::STATUS_PASSED_OUT, Student::STATUS_LEFT] as $from) {
            foreach (self::ALL_STATUSES as $to) {
                $this->assertFalse(
                    $this->machine->canTransition($from, $to),
                    "{$from} → {$to} should be denied (terminal source)"
                );
            }
        }
    }

    public function test_unknown_source_status_is_rejected(): void
    {
        $this->assertFalse($this->machine->canTransition('unknown', Student::STATUS_ACTIVE));
        $this->assertSame([], $this->machine->allowedDestinations('unknown'));
    }

    public function test_allowed_destinations(): void
    {
        $this->assertSame(
            [Student::STATUS_INACTIVE, Student::STATUS_PROMOTED, Student::STATUS_PASSED_OUT],
            $this->machine->allowedDestinations(Student::STATUS_ACTIVE)
        );
        $this->assertSame(
            [Student::STATUS_ACTIVE, Student::STATUS_LEFT],
            $this->machine->allowedDestinations(Student::STATUS_INACTIVE)
        );
        $this->assertSame([], $this->machine->allowedDestinations(Student::STATUS_LEFT));
    }
}
