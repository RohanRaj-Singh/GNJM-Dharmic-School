<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;

/**
 * Student authorization (Sprint 3.1).
 *
 * Reading is open to every authenticated staff role (the global /students
 * routes serve accountant + teacher front desks; teachers are additionally
 * section-scoped inside the controllers). Mutation is admin-only. Admins
 * bypass entirely via the Gate::before super-user rule in AppServiceProvider.
 */
class StudentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Student $student): bool
    {
        return true;
    }

    /** Front-desk student creation (accountant + teacher use the global /students routes). */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isAccountant() || $user->isTeacher();
    }

    /** Roster bulk-update (admin area). */
    public function update(User $user, Student $student): bool
    {
        return $user->isAdmin();
    }

    /** Student deletion (admin area). */
    public function delete(User $user, Student $student): bool
    {
        return $user->isAdmin();
    }
}
