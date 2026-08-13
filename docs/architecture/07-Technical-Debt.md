# Phase 6 — Technical Debt Register

## Classification

| Priority | Definition | Timeline |
|---|---|---|
| **Critical** | Causes incorrect data, crashes, or blocks development | Fix immediately |
| **High** | Significant risk of bugs, high maintenance cost | Fix this sprint |
| **Medium** | Code quality, testability, or consistency issues | Fix this quarter |
| **Low** | Cleanup, style, or nice-to-have improvements | When convenient |

---

## Critical

### C1. No unique constraint on (student_section_id, date) for attendance
- **File**: `database/migrations/2025_12_24_204347_create_attendance_table.php`
- **Detail**: The attendance table has no unique index preventing duplicate attendance records for the same student+enrollment+date. The recent deduplication migration (`2026_07_27_000002`) was a one-time fix, not a constraint.
- **Risk**: Duplicate attendance records corrupt absentee statistics, attendance rates, and student reports.
- **Fix**: Add a unique index: `ALTER TABLE attendance ADD UNIQUE KEY uniq_attendance (student_section_id, date);`

### C2. Route closures with business logic (600+ lines)
- **File**: `routes/admin.php`, `routes/attendance.php`
- **Detail**: ~600 lines of business logic (student CRUD, fee generation, absentee streak calculation) embedded in route definitions instead of controllers/services.
- **Risk**: Untestable, undiscoverable, and cannot be reused. Every inline query is a potential N+1 or inconsistency bug.
- **Fix**: Extract into Controller classes and Services.

### C3. Absentee streak logic is inline and fragile
- **File**: `routes/attendance.php:286-301`
- **Detail**: The absentee streak calculation uses a nested loop with mutable state over a collection, where iteration order matters but isn't guaranteed. The magic number `3` and string `'absent_3_plus'` are hardcoded.
- **Risk**: Incorrect streak classification leads to wrong absentee categories.
- **Fix**: Extract to a pure function with tests.

---

## High

### H1. Division-type normalization duplicated 3+ ways
- **Files**: 
  - `routes/attendance.php:15-22` (`$isClassType` closure)
  - `FeesController.php:270-300` (`normalizeDivisionType()`)
  - Student Report Center (implied Kirtan detection via `class_type_key`)
- **Risk**: Different implementations produce different results for the same class — Kirtan fees could be classified as Gurmukhi in one view and Kirtan in another.
- **Fix**: Create a single `DivisionTypeResolver` service class.

### H2. Student status transitions enforced in multiple places
- **Files**:
  - `StudentLifecycleValidator.php` (canPromote, canPassOut, etc.)
  - `routes/admin.php:498-511` (free student unpairing assumes active status)
  - Various inline `where('status', 'active')` checks
- **Risk**: State machine rules are not centralized — a new controller could bypass validation and create orphan enrollments.
- **Fix**: Centralize status validation into a `StudentStatusMachine` with explicit transition rules.

### H3. Fee listing with 4 inline COALESCE subqueries
- **File**: `FeesController.php:61-98`
- **Detail**: The fee listing page embeds 4 COALESCE subqueries (each with its own JOIN and subquery) to resolve current section/class names. This runs for every fee row.
- **Risk**: Performance degrades quadratically with number of fees. Each fee row triggers 4 correlated subqueries.
- **Fix**: Extract to a view/query scope or use a reporting-specific query pattern.

### H4. `scopeCurrent()` does not check enrollment status
- **File**: `StudentSection.php:40-43`
- **Detail**: `scopeCurrent()` only checks `transferred_at IS NULL`, but most closures also check `status = 'active'`. This inconsistency means `scopeCurrent()` can return inactive enrollments.
- **Risk**: Fee/attendance queries using `scopeCurrent()` may include or exclude wrong enrollments.
- **Fix**: Add `->where('status', StudentSection::STATUS_ACTIVE)` to `scopeCurrent()`.

### H5. No pagination on student/fee lists
- **Files**: `routes/admin.php` (student list, fee list), `FeesController::index()`
- **Detail**: Student and fee queries return ALL matching records without LIMIT/OFFSET.
- **Risk**: Memory exhaustion with >1000 students or >10000 fee records. Inertia prop size limits may be hit.
- **Fix**: Implement Laravel `paginate()` on list endpoints and pagination UI on React pages.

---

## Medium

### M1. SQLite with unenforced foreign keys
- **File**: `.env` (DB_CONNECTION=sqlite by default)
- **Detail**: An application can set `DB_CONNECTION=sqlite` (current config) while also having MySQL/MariaDB migrations. SQLite requires `PRAGMA foreign_keys = ON` per-connection (Laravel does this, but raw access or different drivers may not).
- **Risk**: Orphan records in test/dev environments.
- **Fix**: Add `->foreign()->references()->on()->cascadeOnDelete()` explicitly in all migrations, enforced by a test.

### M2. Hardcoded day-of-week rules for attendance
- **Files**: `routes/attendance.php:72-82` and `:225-228`
- **Detail**: Sunday rule for Kirtan/Gurmukhi is hardcoded (`$today === 0`, `$date->dayOfWeek === Carbon::SUNDAY`). Not configurable or linked to the class definition.
- **Risk**: Changing school timings requires code changes.
- **Fix**: Add day-of-week mask to `classes` table (e.g., `attendance_days` JSON column) or a config file.

### M3. Hardcoded magic numbers and strings
| Value | File | Line(s) |
|---|---|---|
| `3` (absentee streak threshold) | `routes/attendance.php` | 303 |
| `3` (lesson notes limit) | `routes/attendance.php` | 133 |
| `'absent_3_plus'`, `'absent_2'`, `'absent_1'`, `'leave_2_plus'`, `'leave_1'` | `routes/attendance.php` | 303-307 |
| `500` (chunk size for export) | `BackupService.php` | 334 |
| `30` (days for "old" backup warning) | `BackupService.php` | 207 |

- **Fix**: Extract to constants or config values with meaningful names.

### M4. `Sections.teachers()` and `Sections.users()` are identical
- **File**: `Section.php:28-35`
- **Detail**: Both methods return `$this->belongsToMany(User::class)` — they are literal duplicates. Callers use both names interchangeably.
- **Risk**: Confusion about which relationship to use. Future developer might add different filtering to one but not the other.
- **Fix**: Remove `teachers()` and keep `users()`, or vice versa, and update all callers.

### M5. `Fee.source` and `Fee.type` overlap semantically
- **Files**: `Fee.php`, `FeesController.php`
- **Detail**: Both columns hold values like "monthly" and "custom". The `source` column was introduced first, then `type` was added later for a specific query pattern.
- **Risk**: Redundant column increases complexity. New developers won't know which to use.
- **Fix**: Remove one column after verifying all query patterns.

### M6. Student report summary duplicates enrollment-history logic
- **Files**: `StudentReportService.php:182-202` (loadHistory)
- **Comparison**: `routes/admin.php:539-564` (enrollment-history endpoint)
- **Detail**: Both iterate enrollments, count attendance by status, and sum fee amounts. The controller endpoint is nearly identical to the service method.
- **Fix**: Have the controller endpoint call `StudentReportService::loadHistory()`.

---

## Low

### L1. `BackupService::formatBytes()` is a private formatting helper
- **File**: `BackupService.php:438-447`
- **Detail**: A generic byte-formatting function inside a backup service. Not reusable elsewhere.
- **Fix**: Use Laravel's `Illuminate\Support\Str::bytesToHuman()` or extract to a helper.

### L2. Backup service's `calculateDbSize()` and `getMigrationCount()` duplicate DB calls
- **File**: `BackupService.php`
- **Detail**: `calculateDbSize()` calls `information_schema`, then `saveToEntry()` also needs it. The `getOverview()` method recalculates the same values.
- **Fix**: Cache DB size during backup creation.

### L3. `$student->isTeacher()` method is unused in frontend
- **File**: `routes/admin.php:332` calls `$user->isTeacher()`
- **Detail**: The method exists on User model and is used. Not truly debt, but the naming convention `isTeacher()` vs `isAdmin()` vs `isAccountant()` is inconsistently applied in blade/Inertia views vs controllers.
- **Note**: This is minor — no action needed unless the project adopts a consistent convention.

### L4. No test files for any service class
- **File**: `tests/` directory exists but contains only the default `TestCase.php`
- **Detail**: No unit tests for MonthlyFeeResolver, BackupService, StudentLifecycleValidator, or any other service. No feature tests for controllers.
- **Risk**: Refactoring closures into services has no safety net.
- **Fix**: Write tests as part of extraction tasks.

### L5. Inline `dd()` and commented code
- **File**: `FeesController.php:242`
- **Detail**: A commented-out `dd()` call exists: `// dd($fees->count(), $fees->take(5));`
- **Fix**: Remove before production.

### L6. `FeesController::studentIdFor()` queries DB per fee
- **File**: `FeesController.php:27-29`
- **Detail**: `studentIdFor()` hits the DB to resolve student_id from a fee. Called in collect, deCollect, and destroyCustomFeeForStudent. In bulk custom fee operations, this runs N separate queries.
- **Fix**: Load the relationship eagerly and cache.

### L7. `BackupController` inline version check
- **File**: `routes/admin.php:197-199` (in the restore flow)
- **Detail**: Version comparison logic exists in both `BackupService::checkCompatibility()` and presumably in the controller. Minor duplication.
- **Fix**: Consolidate version checking into the service.

### L8. Mixed route naming conventions
- **Detail**: Some routes use `snake_case` (`paid_from`, `paid_to`), some use `camelCase` (`monthFrom`, `monthTo`), and others use `kebab-case`. Query parameter names are inconsistent between endpoints.
- **Fix**: Standardize parameter naming for filter inputs.

---

## Debt Summary

| Severity | Count | Key Items |
|---|---|---|
| Critical | 3 | Missing unique constraint, route closure logic, fragile streak logic |
| High | 5 | Division normalization duplication, status enforcement, COALESCE subqueries, scopeCurrent inconsistency, pagination |
| Medium | 6 | FK enforcement, hardcoded days, magic numbers, redundant Section methods, redundant Fee columns, duplicated enrollment-history |
| Low | 8 | formatBytes utility, test coverage, dead code, naming conventions |

**Total: 22 items**

---

## Quick Wins (Can Fix in < 1 Hour Each)

| Item | Effort | Impact |
|---|---|---|
| L5 — Remove commented `dd()` | 1 minute | Low |
| H4 — Fix `scopeCurrent()` to check status | 15 minutes | Medium — prevents incorrect enrollment filtering |
| M4 — Remove duplicate `teachers()` method | 15 minutes | Low — cleanup |
| M5 — Consolidate Fee.source and Fee.type | 30 minutes | Low — requires finding all callers |
| C1 — Add unique index on attendance | 15 minutes | High — prevents data corruption |
| L4 start — Add 3 basic tests for MonthlyFeeResolver | 1 hour | Low — but builds confidence |

---

*Generated: 2026-07-30*
