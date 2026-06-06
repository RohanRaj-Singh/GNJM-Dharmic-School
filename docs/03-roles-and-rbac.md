# 03 — Roles & RBAC

## 3.1 Roles

Three roles exist, defined by `users.role`:

| Role constant | Where checked |
|---|---|
| `admin` | `User::isAdmin()` |
| `accountant` | `User::isAccountant()` |
| `teacher` | `User::isTeacher()` |

Roles are enforced exclusively via `App\Http\Middleware\RoleMiddleware` (`alias: role`). There are no Laravel Policies or Gates in the codebase.

## 3.2 Middleware chain (per route group)

From `routes/web.php`:

```
public
  /  -> role-based redirect
  /login, /register, /forgot-password, /reset-password -> guest middleware

protected (auth + session.cache_guard)
  attendance/   -> role:teacher,accountant
  admin/        -> role:admin
  accountant/   -> role:accountant
  teacher/      -> role:teacher
  students/     -> auth only (filtering by role happens in handlers)
```

`session.cache_guard` is `EnsureSessionAfterCacheClear`. It invalidates a session if a global cache stamp changed underneath (e.g. after `php artisan cache:clear`).

`SecurityHeaders` is registered globally on the web group. `DebugAuthMiddleware` and `FakeAuthForReports` exist but are not registered.

## 3.3 RoleMiddleware behavior

```php
// app/Http/Middleware/RoleMiddleware.php (paraphrased)
if (!$user) redirect('login');
if (!in_array($user->role, $roles)) {
  Log::warning('Unauthorized access attempt', [...]);
  return match ($user->role) {
    'admin'      => redirect()->route('admin.dashboard'),
    'accountant' => redirect('/accountant'),
    'teacher'    => redirect()->route('teacher.dashboard'),
    default      => abort(403, 'Unauthorized access'),
  };
}
```

There is no per-resource authorization beyond role membership.

## 3.4 Section-scoped teacher access

Teachers are linked to sections via the `section_user` pivot:

- `User::sections()` — `belongsToMany(Section::class)`.
- `Section::teachers()` / `Section::users()` — `belongsToMany(User::class)`.

Teacher-scoped reads **manually filter** by `$user->sections->pluck('id')`. Example from `routes/students.php`:

```php
if ($user->isTeacher()) {
  $allowed = $student->enrollments()
      ->whereIn('section_id', $user->sections->pluck('id'))
      ->exists();
  abort_unless($allowed, 403);
}
```

The same pattern is repeated in `routes/attendance.php` for `/attendance/sections` and `/attendance/sections/{section}`. There is no shared helper to consolidate this.

## 3.5 Capability matrix

| Capability | Admin | Accountant | Teacher |
|---|---|---|---|
| Login / Logout / Profile / Password | ✅ | ✅ | ✅ |
| Admin dashboard data (`/admin/dashboard/summary`) | ✅ | ❌ | ❌ |
| Admin placeholder dashboard page | n/a (real) | n/a | n/a |
| Accountant dashboard page | n/a | ✅ (placeholder content) | n/a |
| Teacher dashboard page | n/a | n/a | ✅ (placeholder content) |
| List students | ✅ All | ✅ All (via `/students`) | ✅ Only those enrolled in their assigned sections |
| Create student (`POST /students`) | ✅ (via Students/Create) | ✅ (same global endpoint) | ❌ No UI to invoke it |
| Show student detail | ✅ All | ✅ All | ✅ Only if any enrollment is in their sections |
| Edit / bulk-update students (`/admin/students/bulk-update`) | ✅ | ❌ | ❌ |
| Delete student | ✅ | ❌ | ❌ |
| Manage Classes / Sections | ✅ Create, edit, delete (refused if section has enrollments) | ❌ | ❌ |
| Manage Fee Rate Periods | ✅ | ❌ | ❌ |
| Manage Custom Fees | ✅ Create / edit / delete (locked if any payment exists) | ❌ | ❌ |
| Generate Monthly Fees (`/admin/fees/generate-monthly`) | ✅ | ❌ | ❌ |
| Cleanup duplicate monthly fees (Artisan) | ✅ (manual) | ❌ | ❌ |
| Receive fee (collect) — admin | ✅ | ❌ | ❌ |
| Receive fee (collect) — accountant | ❌ | ✅ (`/accountant/receive-fee`) | ❌ |
| De-collect (un-collect) | ✅ | ❌ | ❌ |
| View late fees | ❌ | ✅ | ❌ |
| Mark attendance (admin grid) | ✅ | ❌ | ❌ |
| Mark attendance (sections) | ❌ | ✅ (all sections) | ✅ (only their assigned sections) |
| View absentees | ❌ | ✅ (all sections) | ✅ (only their assigned sections) |
| Attendance streak summary API | ❌ | ✅ | ❌ |
| Reports — Fees (build, CSV, PDF) | ✅ | ❌ | ❌ |
| Reports — Attendance (build, PDF, calendar) | ✅ | ❌ | ❌ |
| Reports — Student Performa (build, PDF) | ✅ | ❌ | ❌ |
| Pending Fees Setup utility | ✅ | ❌ | ❌ |
| User CRUD (cannot delete self, cannot change own role/active) | ✅ | ❌ | ❌ |
| Utilities hub | ✅ | ❌ | ❌ |

## 3.6 Frontend role helpers

`resources/js/Hooks/useRoles.js` exposes the role + three boolean flags from `usePage().props.auth.user.role`. Components can use it to hide UI, but server enforcement is still required (do not rely on frontend gates alone).

`resources/js/Components/RoleGate.jsx` exists and is presumably a conditional renderer. (Read before extending it — INSUFFICIENT INFORMATION on its exact contract beyond the file's existence.)

## 3.7 Authorization gaps to flag (descriptive, not prescriptive)

- There is no central helper to check "may this user access this student?" — the check is duplicated inline.
- The `Accountant/Students*` files suggest a planned-but-unfinished view; the global `/students` route currently carries accountant traffic without a "view-only" assertion.
- The `Teacher` role currently has only attendance access. Bulk operations, reports, and dashboards are not part of their scope.
- The `Admin` role has no write-protection on Students (admins can bulk-delete students and trigger free↔paid transitions that cascade-delete unpaid fees).
