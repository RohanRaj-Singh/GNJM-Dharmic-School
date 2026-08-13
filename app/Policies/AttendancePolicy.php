<?php

namespace App\Policies;

use App\Models\User;

/**
 * Attendance authorization (Sprint 3.1).
 *
 * All staff roles mark attendance somewhere: teachers/accountants via the
 * global /attendance routes, admins via /admin/attendance. Admins bypass via
 * the Gate::before super-user rule. Teachers are additionally restricted to
 * their assigned sections inside the controllers / route closures.
 */
class AttendancePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isAccountant() || $user->isTeacher();
    }

    public function mark(User $user): bool
    {
        return $user->isAdmin() || $user->isAccountant() || $user->isTeacher();
    }
}
