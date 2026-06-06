# 10 — Open Questions & Gaps

Items tagged **`INSUFFICIENT INFORMATION`** during the discovery pass, plus stale-code signals and known refactor risks. The next agent should treat these as inputs to planning, not as facts.

## 10.1 Likely missing modules

| # | Topic | Evidence | Risk |
|---|---|---|---|
| 1 | **Examinations / marks / results / subjects** | No `exams`, `subjects`, `marks`, `results`, `grades` tables or models. No related routes, controllers, or pages. | If the school tracks any exam data, it lives outside this system. |
| 2 | **Notifications (email/SMS/in-app)** | `Notifiable` trait on `User` is imported but no notification classes, no mail templates, no queues. | Parent-facing communication flows (e.g. "your child was absent today") are not implemented. |
| 3 | **Parent communication via phone** | `students.father_phone` and `mother_phone` exist but are not consumed by any workflow. | The data is captured but unused. |
| 4 | **Report card printing** | No PDF template for academic progress; only fees/attendance/student performa exist. | Out of scope unless added. |

## 10.2 Stubs and dead code

| # | Item | Where | Status |
|---|---|---|---|
| 5 | `FakeAuthForReports` middleware | `app/Http/Middleware/FakeAuthForReports.php` | Disabled in `Kernel.php`; safe to delete or wire up for staging. |
| 6 | `DebugAuthMiddleware` | `app/Http/Middleware/DebugAuthMiddleware.php` | Disabled in `Kernel.php`; useful for log inspection. |
| 7 | `ReportPreset` model | `app/Models/ReportPreset.php` | No migration, no controller, no route. The `ReportRegistry` is the only metadata system currently in use. |
| 8 | `Accountant/Students/*` and `Accountant/Students.jsx` | `resources/js/Pages/Accountant/...` | The corresponding `routes/accountant.php` student routes are commented out. |
| 9 | `Accountant/Reports.jsx` | `resources/js/Pages/Accountant/Reports.jsx` | Placeholder, not linked from any sidebar. |
| 10 | `Accountant/Attendance.jsx` | `resources/js/Pages/Accountant/Attendance.jsx` | Placeholder, not linked. |
| 11 | `Accountant/AttendanceSummaryController` | `app/Http/Controllers/Accountant/AttendanceSummaryController.php` | Functional but no UI page consumes it. |
| 12 | Commented teacher "Phase 1" in `routes/teacher.php` | routes file | Implies more teacher functionality is planned. |
| 13 | Disabled "DemoLogin" route in `routes/web.php` | `//Route::get('/demo-login', ...)` | Likely a leftover from initial setup. |
| 14 | `SchoolSetupSeeder` creates `default_monthly_fee=600` for Gurmukhi and `0` for Kirtan | seeders | This explains the empty Kirtan fee stream. |
| 15 | `DemoFeeSeeder` writes `month` in `'F Y'` format (e.g. `'April 2026'`) while the rest of the system expects `'YYYY-MM'` | seeders | **This is a latent bug.** `LateFeeSummaryController` has a `normalizeFeeMonth` helper that tolerates both, but other report queries use `where('fees.month', $value)` which will silently produce no rows for the seeded values. |

## 10.3 Refactor signals (descriptive, not prescriptive)

| # | Signal | Notes |
|---|---|---|
| 16 | `ReportRegistry::fees()` is the only registered report | The Student Performa and Attendance report are wired directly in `ReportController`. Either retire the registry or expand it. |
| 17 | Many admin routes are inline closures in `routes/admin.php` | Move to controller methods for testability. |
| 18 | `fees.title` is `nullable` but the column type is `string` | No DB-level default. `GenerateMonthlyFees` writes `'Monthly Fee'`, but legacy rows may have `null`. |
| 19 | `Attendance` model has duplicate `enrollment()` and `studentSection()` | Both `belongsTo(StudentSection::class, 'student_section_id')`. Consolidate. |
| 20 | `fees.source` was added later as an enum; legacy rows may have `NULL` | `DashboardController::applyFeeYearFilter` and the report controllers defensively `orWhereNull('fees.source')` to handle this. |
| 21 | `Student::status` (`active`/`inactive`) is written but not enforced in any read query | Inactive students still show up in lists. |
| 22 | `EnsureSessionAfterCacheClear` is a session-stamp guard but uses `Cache::rememberForever` (a TTL-less store) | A `cache:clear` will force re-login. Document the expected cadence. |
| 23 | `.env` is checked into the repo | Rotate any secrets in it before sharing externally. |
| 24 | Tailwind declared twice in `package.json` (v3 and v4) | Verify which is active. |
| 25 | `phpunit.xml` exists, `tests/` not catalogued | Coverage is unknown. |

## 10.4 Open questions about the Student Performa

These are the most consequential unknowns for any audit of the Student Performa:

1. **Should historical fee amounts be re-resolved via `MonthlyFeeResolver` or shown as-stored?**
2. **Should partial payments (`payments.amount_paid < fees.amount`) be a future-supported state?**
3. **Should the report register itself in `ReportRegistry`?**
4. **Should multi-year ranges be supported?**
5. **Should the report be exposed to the Accountant role (read-only)?**
6. **Should the calendar show lesson ✓ for Gurmukhi as well?**
7. **Should `is_locked` and `batch_id` be surfaced for custom fees?**
8. **Should the report cache results per `(student_id, year, month_from, month_to)`?**
9. **What is the expected behavior for cross-year `month_from`/`month_to` ranges?**
10. **Should the per-day status precedence (`present > leave > absent`) be configurable, or is it a stable rule?**

## 10.5 Open questions about authorization

1. Should `is_active=false` users be auto-logged-out on the next request? (Currently not enforced.)
2. Should the `Accountant` role be granted read-only access to reports? (Currently no.)
3. Should the per-resource "may this user access this student?" check be extracted to a single helper? (Currently duplicated inline.)
4. Should the `RoleGate` component contract be documented? (Currently only inferred from the file name.)

## 10.6 Open questions about fees and rate periods

1. Is the Kirtan monthly fee skip in `GenerateMonthlyFees` intentional or a placeholder?
2. Is the "period cannot be edited if collected fees exist" rule global, or should historical corrections be possible via superuser override?
3. Should `deCollect` revert `is_locked` on custom fees?
4. Is the legacy `default_monthly_fee` / `monthly_fee` column still authoritative for any code path, or is it pure mirror data?
5. Is the `2000-01-01` baseline for backfilled rate periods acceptable, or should there be a way to "close" old periods?

## 10.7 Things to verify before changing the Student Performa

- The seeded `month` format mismatch (#15) — decide whether the seeder should be fixed or whether the controller should also tolerate the legacy format.
- Whether the React `month_from` / `month_to` selectors actually pass `null` (the React code uses `useState(null)` initially; the controller treats them as `nullable` and as strings via `request->string(...)` — confirm no falsy-but-not-null values slip through).
- Whether the `useBackButtonLogoutModal` hook affects navigation away from the Student Report (a back-button-driven navigation to login would invalidate the report session but not corrupt data).
- Whether `Carbon::create($year, $m, $d)` in the report loop respects the application timezone (the resolver explicitly does, the report loop does not).

## 10.8 Inventory of files not yet read in detail (INSUFFICIENT INFORMATION)

The discovery pass read every file under `app/`, `database/`, `routes/`, `resources/views/`, and most files under `resources/js/`. The following were not deeply audited and may contain additional context:

- `resources/js/Components/RoleGate.jsx` — exact contract.
- `resources/js/Hooks/useBackButtonLogoutModal.jsx` — exact behavior.
- `resources/js/Layouts/SimpleLayout.jsx` — exact behavior.
- `resources/js/Layouts/AuthenticatedLayout.jsx` — exact behavior.
- `resources/js/Pages/Admin/Students/hooks/*` — exact behavior.
- `tests/` — contents and coverage.
- `vite.config.js`, `postcss.config.js`, `tailwind.config.js` — exact Tailwind/PostCSS pipeline.

These are listed so a future agent knows what to read before declaring a task fully scoped.
