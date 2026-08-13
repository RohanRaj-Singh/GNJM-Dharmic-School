<?php

namespace App\Policies;

use App\Models\Fee;
use App\Models\User;

/**
 * Fee authorization (Sprint 3.1).
 *
 * Collecting a payment is open to admin (fees page) and accountant
 * (receive-fee counter). Everything else — un-collecting, monthly generation,
 * and custom-fee management — is admin-only. Admins bypass via the Gate::before
 * super-user rule in AppServiceProvider.
 */
class FeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isAccountant();
    }

    /** Collect a payment — admin fees page + accountant receive-fee counter. */
    public function collect(User $user, Fee $fee): bool
    {
        return $user->isAdmin() || $user->isAccountant();
    }

    /** Reverse a collected payment — admin only. */
    public function deCollect(User $user, Fee $fee): bool
    {
        return $user->isAdmin();
    }

    /** Generate monthly fees — admin only. */
    public function generateMonthly(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Assign a custom fee to a section — admin only. */
    public function createCustom(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Edit a custom fee — admin only. */
    public function updateCustom(User $user, Fee $fee): bool
    {
        return $user->isAdmin();
    }

    /** Remove a custom fee — admin only. */
    public function deleteCustom(User $user, Fee $fee): bool
    {
        return $user->isAdmin();
    }
}
