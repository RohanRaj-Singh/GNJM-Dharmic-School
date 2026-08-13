<?php

namespace App\Policies;

use App\Models\BackupEntry;
use App\Models\User;

/**
 * Backup authorization (Sprint 3.1).
 *
 * Backup and (especially) restore are destructive, admin-only operations. The
 * whole /admin/utilities/backup surface is already behind role:admin; the
 * policy makes the authorization explicit and the super-user rule keeps admin
 * working.
 */
class BackupEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, BackupEntry $entry): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function restore(User $user, BackupEntry $entry): bool
    {
        return $user->isAdmin();
    }

    public function download(User $user, BackupEntry $entry): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, BackupEntry $entry): bool
    {
        return $user->isAdmin();
    }
}
