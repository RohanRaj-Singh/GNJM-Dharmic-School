<?php

namespace App\Services;

use App\Models\Student;

/**
 * Pure transition matrix for student statuses.
 *
 * Single source of truth for which status changes are legal. Consumers such
 * as StudentLifecycleValidator and the roster bulk-update consult this
 * instead of re-deriving the rules themselves.
 */
class StudentStatusMachine
{
    /**
     * Allowed one-step transitions, keyed by source status.
     *
     *   active   → inactive, promoted, passed_out
     *   inactive → active, left
     *   promoted, passed_out, left are terminal (no outgoing transitions)
     *
     * Same-state changes are intentionally absent from the matrix; callers
     * treat them as no-ops.
     */
    private const TRANSITIONS = [
        Student::STATUS_ACTIVE     => [Student::STATUS_INACTIVE, Student::STATUS_PROMOTED, Student::STATUS_PASSED_OUT],
        Student::STATUS_INACTIVE   => [Student::STATUS_ACTIVE, Student::STATUS_LEFT],
        Student::STATUS_PROMOTED   => [],
        Student::STATUS_PASSED_OUT => [],
        Student::STATUS_LEFT       => [],
    ];

    public function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    /**
     * Statuses reachable from $from in a single step.
     */
    public function allowedDestinations(string $from): array
    {
        return self::TRANSITIONS[$from] ?? [];
    }
}
