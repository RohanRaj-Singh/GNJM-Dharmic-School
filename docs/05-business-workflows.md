# 05 — Business Workflows

Step-by-step traces. Each step cites the file/line range an agent should open to verify.

## 5.1 Student Admission / Onboarding

**Triggers:** admin adds a new student via the global `/students/create` form, or via `/admin/students/bulk-update` (inline grid).

### 5.1.1 Single-student create
1. UI: `resources/js/Pages/Students/Create.jsx` posts to `POST /students`.
2. Controller: `App\Http\Controllers\StudentController::store`.
3. Validation: `name`, optional `father_name/father_phone/mother_phone`, `section_id`, `student_type` ∈ {paid, free}.
4. Creates `students` row with `status='active'`.
5. Loads `Section` with `schoolClass`, then creates a `student_sections` row.
6. If `student_type=paid`, calls `MonthlyFeeResolver::resolveForMonth(enrollment, current YYYY-MM)`. If > 0, `firstOrCreate`s a `fees` row (type=monthly, source=monthly, month=current, amount=resolved).
7. Redirects to `students.index`.

### 5.1.2 Bulk update (admin only)
1. UI: `resources/js/Pages/Admin/Students/Index.jsx` posts to `POST /admin/students/bulk-update` (route name `admin.students.bulk`).
2. Inside `DB::transaction`:
   - For each row, create or update `students` (title-case name normalization via `Str::of(...)->squish()->lower()->title()`).
   - Compute desired enrollments (`section_id` set), delete any existing `student_sections` for the student that are not in the desired set.
   - For each desired enrollment: `firstOrCreate` on `(student_id, class_id, section_id)`, then update `student_type` if changed.
   - If `free`: delete unpaid monthly fees for that enrollment (`whereDoesntHave('payments', deleted_at IS NULL)`), `continue`.
   - If `paid`: resolve current month amount via `MonthlyFeeResolver`, `firstOrCreate` the monthly `fees` row.
3. Returns `back()->with('success', 'Students updated')`.

## 5.2 Monthly Fee Generation (system / admin)

**Triggers:** `php artisan fees:generate-monthly` or `POST /admin/fees/generate-monthly` (which shells out to the same command).

1. `app/Console/Commands/GenerateMonthlyFees::handle`.
2. Loads **all** `StudentSection` with `schoolClass` and `section`.
3. For each enrollment:
   - If `student_type === 'free'`, run `clearUnpaidMonthlyFeesForFreeEnrollment` (delete unpaid monthly fees only) and `continue`.
   - If class `type === 'kirtan'`, `continue` (Kirtan monthly generation is intentionally skipped — INSUFFICIENT INFORMATION on whether this is correct or a bug; Kirtan seeds fee=0 so this may be deliberate).
   - If a `monthly` fee for current `YYYY-MM` already exists, `continue`.
   - Resolve amount via `MonthlyFeeResolver::resolveForMonth(enrollment, month)`. If ≤ 0, `continue`.
   - Insert `fees` row (type=monthly, source=monthly, title='Monthly Fee', amount=resolved, month=current).

The `MonthlyFeeResolver` resolution order is:
1. `student_type === 'free'` → 0.
2. **Section-level active period** at month start (from `fee_rate_periods` where `scope_type=section`).
3. **Class-level active period** at month start (where `scope_type=class`).
4. `sections.monthly_fee` (legacy column).
5. `classes.default_monthly_fee` (legacy column).
6. 0 if all blank.

## 5.3 Fee Collection (Accountant flow)

1. Accountant opens `/accountant/receive-fee?student_id=…` (route name `accountant.receive-fee`).
2. Route closure loads the student with enrollments that have unpaid fees, flattens the rows with class type detection (Kirtan vs Gurmukhi by class name), and returns `Inertia::render('Accountant/ReceiveFee', …)`.
3. UI: `resources/js/Pages/Accountant/ReceiveFee.jsx` posts to `POST /accountant/receive-fee` (name `accountant.receive-fee.store`).
4. Controller: `FeePaymentController::store`.
5. For each `fee_id` in payload:
   - Re-checks the fee is unpaid (`payments()->whereNull('deleted_at')->exists()`).
   - Creates a `Payment` with `amount_paid = $fee->amount` and `paid_at = collection_date` (parsed to start-of-day in `app.timezone`).
6. Redirects back with success flash.

**Admin path:** `POST /admin/fees/{fee}/collect` (controller `FeesController::collect`).
- Same creation logic, plus locks custom fees (`is_locked = true` if `$fee->source === 'custom'`).
- Refuses if already paid (returns error flash).

**Un-collect:** `POST /admin/fees/{fee}/deCollect`.
- Soft-deletes the most recent non-deleted payment for the fee.
- INSUFFICIENT INFORMATION: does **not** reverse the `is_locked` flag on custom fees.

## 5.4 Fee Custom Categories

### 5.4.1 Create
- `POST /admin/fees/custom` → `FeesController::storeCustomFee`.
- Requires `section_id`, `title`, `amount`. Iterates every `StudentSection` for the section, `firstOrCreate`s a `fees` row per enrollment keyed on `(student_section_id, type='custom', title)`. Idempotent on rerun.

### 5.4.2 Edit (inline)
- `POST /admin/fees/custom` (with `old_title`, `old_amount`, `new title/amount`, `section_id`).
- Refuses if **any** student in the section has paid (queried via `whereHas('payments', deleted_at IS NULL)`). Updates all matching rows in bulk.

### 5.4.3 Delete
- Per-student: `DELETE /admin/fees/custom/student/{fee}` — only if no payments.
- Per-section: `DELETE /admin/fees/custom/section` — refused if any student has paid.

## 5.5 Fee Rate Periods (admin)

File: `app/Http/Controllers/Admin/FeeRatePeriodController.php`.

1. Inline UI on the Classes & Sections index pages calls `GET /admin/classes/{class}/fee-periods` or `GET /admin/sections/{section}/fee-periods`.
2. Create (`POST .../fee-periods`): validates `amount`, `effective_from` (YYYY-MM), optional `effective_to`, optional `reset_section_ids[]` (class scope only).
   - **Auto-close open future periods** if the new start is in the future and there's exactly one open period. Refuses if multiple open periods exist or if collected fees already exist from the new start onward.
   - **No-overlap assertion** (skipping self on update).
   - Creates `FeeRatePeriod` row.
   - Calls `syncLegacyFeeColumn(scope_type, scope_id)` to write active amount into `classes.default_monthly_fee` / `sections.monthly_fee`.
   - If class scope, optionally resets listed `reset_section_ids` to `monthly_fee = 0` and zeroes their section-level rate periods (`amount=0`), then `refreshUnpaidMonthlyFeesForSections` for those.
   - Calls `refreshUnpaidMonthlyFees` to re-price all unpaid monthly fees in the affected range.
3. Update: same flow, plus refuses if any collected monthly fee exists in the old or new period range. Recomputes refresh range as union of old + new.
4. Delete: refuses if any collected monthly fee exists in the period range. Re-syncs legacy column and re-prices unpaid monthly fees in the deleted range.

## 5.6 Pending Fees Setup (admin)

File: `app/Http/Controllers/Admin/PendingFeesController.php`. UI: `Admin/Utilities/PendingFeesSetup.jsx`.

1. Admin opens `/admin/utilities/pending-fees`. Filters by `class_id` (required), optional `section_id`, optional `search`.
2. Controller selects `StudentSection` for the chosen class with computed `has_payments` flag, `assumed_pending_months`, and a 255-month prefix-sum array of expected amounts (using `MonthlyFeeResolver` resolution chain).
3. Admin edits a single row (`PATCH /admin/utilities/pending-fees/{studentSection}`) or bulk-edits (`PATCH /admin/utilities/pending-fees` with `updates: [{id, value}]`).
4. **Lock rule:** if any `Fee` for the enrollment has a non-deleted payment, the request is refused with "Pending months are locked after fee collection."
5. **Generation logic** (`generatePendingMonthlyFees`):
   - Builds desired month set = `now()->subMonths(0..N-1)`.
   - For each desired month, resolves the amount, creates the `fees` row if missing, updates amount if different (and unpaid).
   - Removes any **unpaid** monthly fees outside the desired set.
   - Special case: `months = 0` deletes **all** unpaid monthly fees.

## 5.7 Attendance Recording (Teacher / Accountant)

1. Teacher/accountant opens `/attendance/sections` — filtered by `$user->sections` for teachers.
2. Picks a section → `/attendance/sections/{section}`.
3. **Day-rule enforcement** (render-time):
   - Today is Sunday (0) and class type is `gurmukhi` → redirect back with "Gurmukhi attendance cannot be marked on Sunday."
   - Today is not Sunday and class type is `kirtan` → redirect back with "Kirtan attendance can only be marked on Sunday."
4. Renders `Attendance/Mark.jsx` with the section's `studentSections.student` list and any existing day records.
5. Save: `POST /attendance` → `AttendanceController::store` (or `POST /admin/attendance/save` for the admin grid).
6. `Attendance::updateOrCreate(['student_section_id', 'date'], ['status', 'lesson_learned'])`.
7. `lesson_learned` is set to `true` only when status is `present`; otherwise `false`/`null` (depending on the path).

## 5.8 Attendance — Absentees

1. `GET /attendance/absentees` reads from `routes/attendance.php` directly.
2. Filters: class_id, section_id, search, date range (default yesterday-30 to yesterday, not including today).
3. Per enrollment, walks the attendance within the range, builds streaks (consecutive same-status days), and buckets as `absent_1`, `absent_2`, `absent_3_plus`, `leave_1`, `leave_2_plus`, `clear`. A separate `today_absentees` bucket captures today-status when it is `absent`.
4. Sort ascending by total absent+leave days.

## 5.9 Attendance — Admin Grid

1. UI: `Admin/Attendance/Index.jsx` selects class + section + month/year.
2. `GET /admin/attendance/grid` returns enabled days (Sunday excluded for Gurmukhi, Sunday-only for Kirtan) and per-student row × day map.
3. Save (`POST /admin/attendance/save`) accepts both:
   - New: `[{ student_section_id, date, status, lesson_learned }]`
   - Legacy: `{"<studentSectionId>-<YYYY-MM-DD>": {status, lesson_learned}}`
4. The controller hard-checks each `student_section_id` belongs to the target section before writing.

## 5.10 Reports

See [06-reports-system.md](06-reports-system.md) for the three report types and their input/output contracts. The Student Performa has its own deep-dive at [07-student-report-deep-dive.md](07-student-report-deep-dive.md).

## 5.11 Admin Dashboard

`GET /admin/dashboard/summary` (controller `DashboardController::summary`).

- Accepts a `years[]` (array) or `year` (single) input. Multiple years are unioned.
- Returns:
  - `fees`: total, collected, pending, percentage.
  - `attendance`: present, absent, leave, percentage.
  - `students`: total, active, enrollments.
  - `divisions[]`: one entry per division (`gurmukhi`/`kirtan`).
    - Each division contains: `classes_count`, `sections_count`, `students_count`, `free_students_count`, `active_students_count`, `enrollments_count`, `fees` summary, `attendance` summary, and a `classes[]` array.
    - Each class entry contains the same metrics plus a `sections[]` array (per-section fee + attendance + counts).
  - `insights`: `top_absentees` (top 50), `top_pending_fees` (top 50).
  - `meta`: years, primary year, generated_at.

## 5.12 Auth lifecycle

1. `POST /login` → `AuthenticatedSessionController::store`. Standard Breeze.
2. Successful login sets the session. The `EnsureSessionAfterCacheClear` middleware stamps the session and compares to a global cache stamp; mismatch logs out.
3. `POST /logout` → `AuthenticatedSessionController::destroy`. Frontend `AdminLayout` intercepts the browser back button via `useBackButtonLogoutModal` (sessionStorage-tracked stack of protected paths) and shows a `LogoutModal` if the user pops past the first protected page.
4. Inactive users (`is_active=false`) are not blocked at middleware (INSUFFICIENT INFORMATION — middleware doesn't check `is_active`; an admin must rely on session expiry or manual logout).
