# 08 — Business Rules

Cross-cutting rules that affect multiple modules. Each rule cites where it lives in the code so a future agent can locate it without re-discovering.

## 8.1 Free vs. paid enrollments

`student_sections.student_type` ∈ {`paid`, `free`}.

- **`GenerateMonthlyFees`:** if `free`, deletes all unpaid monthly fees for that enrollment and skips generation. (Class type is also checked — see §8.9.)
- **`MonthlyFeeResolver::resolveForMonth`:** if `free`, returns `0` immediately.
- **`StudentController::store`:** if `paid`, creates a current-month `fees` row; if `free`, no fee is created.
- **Admin bulk update:** if the section becomes `free`, all unpaid monthly fees for that enrollment are deleted; the `paid` reverse does not retroactively recreate past months.
- **`PendingFeesController`:** `assumed_pending_months` is not affected by `student_type`; the `generatePendingMonthlyFees` helper still resolves via `MonthlyFeeResolver` which returns `0` for free students.

## 8.2 Fee locking after payment

- **`FeesController::collect`:** when a `fees.source='custom'` is paid, `is_locked` is set to `true`.
- **`FeesController::destroyCustomFeeForStudent`:** refuses if any non-deleted payment exists.
- **`FeesController::destroyCustomFeeForSection`:** refuses if any non-deleted payment exists.
- **`FeesController::updateCustomFee`:** refuses if any non-deleted payment exists for any student in the section.
- **`FeeRatePeriodController`:** refuses to update or delete a period if any collected monthly fee exists in the period's month range.
- **`PendingFeesController`:** `assumed_pending_months` is locked once any fee for that enrollment has a non-deleted payment.
- INSUFFICIENT INFORMATION: `FeesController::deCollect` does **not** revert `is_locked` when un-collecting.

## 8.3 Soft-deletes and "is paid"

- `payments.deleted_at` is the **only** soft-delete column.
- Every "is paid" check across the codebase filters `whereNull('deleted_at')` (sometimes written as `payments.deleted_at IS NULL`).
- Un-collect is always a soft delete (`$payment->delete()`).
- Hard-deletes of fees are restricted to unpaid rows. Paid rows are never hard-deleted by application logic (the cascade from `student_sections` deletion would, but no controller currently deletes a `student_sections` row that has paid fees).

## 8.4 Day rules (attendance)

- **Gurmukhi:** attendance can be marked only on days that are **not** Sunday.
- **Kirtan:** attendance can be marked only on **Sunday**.
- The check is render-time (`routes/attendance.php` `/attendance/sections/{section}` and `AdminAttendanceController::grid`) and rejects navigation to the marking page with a flash error.
- `lesson_learned` is only meaningful for Kirtan; for Gurmukhi it is `null` after a save (`AdminAttendanceController::save` only sets it to `true` when status is `present`).
- The Absentees page filters attendance by day-of-week for the class type when computing streaks.

## 8.5 Class type detection

- **Primary source:** `classes.type` column (`gurmukhi` / `kirtan`).
- **Fallbacks in some controllers:** string match on class name (`FeesController::normalizeDivisionType`, `DashboardController::normalizeDivisionType`).
- The Student Performa engine uses `LOWER(classes.type) != 'kirtan'` for Gurmukhi.

## 8.6 Legacy fee columns

- `classes.default_monthly_fee` and `sections.monthly_fee` are **legacy columns** kept in sync with the active `fee_rate_periods` row.
- New code should prefer `MonthlyFeeResolver` over reading these columns directly.
- `FeeRatePeriodController` calls `syncLegacyFeeColumn(scope_type, scope_id)` on every store/update/destroy.
- Both columns are still read by `PendingFeesController::resolveMonthFromMaps` (when no period matches) and by `GenerateMonthlyFees` indirectly through the resolver.

## 8.7 Fee rate period invariants

- `fee_rate_periods` rows must **not overlap** for the same `(scope_type, scope_id)`. Enforced by `assertNoOverlap`.
- `effective_from` is normalized to start-of-month.
- `effective_to = NULL` is "open".
- A new future-dated period auto-closes the existing open period **only** if there is exactly one open period AND no collected monthly fees exist from the new start onward.
- Updating a period is refused if any collected monthly fee exists in the old or new range.
- Deleting a period is refused if any collected monthly fee exists in its range.
- On every mutation, **unpaid** monthly fees in the affected month range are re-priced via `MonthlyFeeResolver` (created, updated, or deleted as needed).

## 8.8 Attendance streaks

- The Absentees page counts consecutive same-status days backwards from the most recent matching day within the date range (default yesterday-30 to yesterday, not including today).
- Categories: `absent_1`, `absent_2`, `absent_3_plus`, `leave_1`, `leave_2_plus`, `clear`. Plus a separate `today_absentees` bucket.
- The Accountant `AttendanceSummaryController` computes a similar streak from yesterday's record, filtering out Sundays for Gurmukhi.

## 8.9 Monthly fee generation skips

`GenerateMonthlyFees` skips:
- `free` enrollments (after running cleanup).
- `kirtan` class enrollments (regardless of paid/free).

INSUFFICIENT INFORMATION on whether Kirtan is meant to have monthly fees; the seed data sets `default_monthly_fee = 0` for the Kirtan class, which would produce zero-amount fees if generation weren't skipped. The skip is therefore safe but may also be a placeholder for "future work".

## 8.10 Fee rate period backfill baseline

`fee_rate_periods` rows are seeded with `effective_from = 2000-01-01` so that historical months resolve. The `2026_02_19_000003` migration shifts the earliest existing period per scope to `2000-01-01` if it is later. INSUFFICIENT INFORMATION on whether periods ever need to be moved forward again (e.g. to deprecate a 2000-era rate).

## 8.11 Inertia request conventions

- `build()` and other report endpoints force `Accept: application/json` via `$request->headers->set('Accept', 'application/json')` at the top. This guarantees JSON even if Inertia sends the standard header.
- Inertia pages pass `filters` to the controller by including them in the request body. Controllers re-extract via `$request->only([...])` and forward into the Inertia `props` for round-trip persistence in the UI.
- The student detail page uses Carbon `today()` for "current month" attendance counts; INSUFFICIENT INFORMATION on whether it honors `config('app.timezone')`.

## 8.12 Session hardening

- `EnsureSessionAfterCacheClear` invalidates sessions whose `auth_session_guard_stamp` does not match the global cache stamp. This means `php artisan cache:clear` (or any TTL-based eviction) will force a re-login for every user.
- `SecurityHeaders` adds defensive headers but does not include CSP. INSUFFICIENT INFORMATION on whether CSP is desired.

## 8.13 User management

- `UserController::bulkUpdate` and `store` cannot change the role or active status of the currently authenticated user (defensive guard `if ($isSelf) { role = $user->role; is_active = $user->is_active; }`).
- `UserController::destroy` aborts with 403 if the user tries to delete themselves.
- `User::factory()->create([...])` is invoked by `DatabaseSeeder`, suggesting the default seeded test user is `name='Test User', email='test@example.com'`. INSUFFICIENT INFORMATION on the default seeded password.
- New users are created with `Hash::make('password')` (a temp default) by `UserController::store`.
- Teacher `sections` are synced only when role is `teacher`; non-teacher users have their section assignments detached on bulk update.

## 8.14 Section deletion guard

`routes/admin.php` `/admin/sections/{section}` `DELETE` returns 422 if the section has any `student_sections`.

## 8.15 Reports "is paid" denominator

For Fees, Attendance, Dashboard, and Student Performa, **paid** is computed via `payments.id IS NOT NULL` (left join with `deleted_at IS NULL`) or `EXISTS(SELECT 1 FROM payments WHERE fee_id=fees.id AND deleted_at IS NULL)`. Custom fees and monthly fees are joined with the same predicate, so the definition is consistent.
