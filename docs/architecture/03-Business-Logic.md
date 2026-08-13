# Phase 2 — Business Logic Audit

## Goal
Identify duplicated, misplaced, or conflicting business logic across the codebase.

---

## 1. Fee Generation & Resolution

### Current State

Fee resolution is **well-structured** in `MonthlyFeeResolver.php` with a clear chain:
1. Free students → 0
2. Section-level fee rate period
3. Class-level fee rate period
4. Section.monthly_fee (legacy fallback)
5. Class.default_monthly_fee (legacy fallback)
6. 0

### Duplications Found

| Location | What It Does | Problem |
|---|---|---|
| `MonthlyFeeResolver::resolveForMonth()` | Full resolution chain | ✅ Canonical implementation |
| `MonthlyFeeResolver::resolveBulk()` | Fast path for bulk operations | ✅ Clean optimization |
| `routes/admin.php:515-531` | `Fee::firstOrCreate(...)` inline in bulk-update | ⚠️ calls `$resolver->resolveForMonth()` then does its own firstOrCreate — fee creation logic is shared but scattered |
| `app/Console/Commands/GenerateMonthlyFees.php` | CLI fee generation | ⚠️ Unknown if it reuses resolver or duplicates logic |

### Business Rule Registry — Fees

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Free students pay 0 monthly fee | ✅ | `MonthlyFeeResolver` + bulk-update | ⚠️ Free-student check duplicated in `routes/admin.php:498-511` (also deletes unpaid fees) |
| Fee rates resolve: section period → class period → section default → class default | ✅ | `MonthlyFeeResolver` | Single implementation |
| Fees are keyed by (student_id, type, month) | ✅ | `Fee::firstOrCreate` call | Deduplication logic in controller closure |
| Custom fees are assigned per section | ✅ | `FeesController::storeCustomFee` | ✅ Clean |
| Custom fees cannot be updated if any student paid | ✅ | `FeesController::updateCustomFee` | Inline validation in controller |
| Payments soft-delete (not hard delete) | ✅ | `Payment` uses SoftDeletes | ✅ Good |
| Fee amounts are integers (paise not supported) | ✅ | Casting/conversion | ⚠️ Limitation for partial payments |

---

## 2. Attendance

### Current State

Attendance logic is distributed across:
- `AttendanceController::store()` — saving attendance records
- `routes/attendance.php` closures — listing, absentees, streak calculation
- `AdminAttendanceController` — admin grid views
- `StudentReportService` — attendance rollup for reports

### Duplications Found

| Logic | Location 1 | Location 2 | Location 3 |
|---|---|---|---|
| Sunday rule (Kirtan on Sunday only, Gurmukhi not on Sunday) | `routes/attendance.php:72-82` day check | `routes/attendance.php:225-228` absentee filter | Student Report Center division grouping |
| Status normalization ('a'/'absent'/'p'/'present'/'l'/'leave') | `routes/attendance.php:143-149` closure | Various attendance views | — |
| Attendance counts by status (present/absent/leave) | `StudentReportService::loadHistory()` | `routes/admin.php:552-555` enrollment-history endpoint | `StudentReportService::buildDivisionReport()` |

### Business Rule Registry — Attendance

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Kirtan class attendance can only be marked on Sunday | ✅ | `routes/attendance.php:78-81` | Hardcoded day check, not configurable |
| Gurmukhi class attendance cannot be marked on Sunday | ✅ | `routes/attendance.php:72-75` | Hardcoded day check |
| Teacher can only mark attendance for their assigned sections | ✅ | `routes/attendance.php:54-59` access check | ✅ Good |
| Attendance belongs to the enrollment where it was recorded | ✅ | `attendance.student_section_id` FK | ✅ Recent migration enforces this |
| Absentee streak ≥ 3 days = "absent_3_plus" category | ✅ | `routes/attendance.php:303` | ⚠️ Magic number + string literal |
| Lesson notes limited to last 3 | ✅ | `routes/attendance.php:128-135` | ⚠️ Magic number 3 |

---

## 3. Student Progression

This is the **best-structured domain** in the codebase.

### Business Rule Registry — Student Progression

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Only active students can be promoted | ✅ | `StudentLifecycleValidator::canPromote()` | ✅ Clear validation |
| Promotion closes enrollment of same class type only | ✅ | `StudentLifecycleController::promote()` lines 51-55 | ✅ Correct — Kirtan and Gurmukhi are independent |
| Promotion creates a new enrollment in the target section | ✅ | `StudentLifecycleController::promote()` lines 66-73 | ✅ Clean |
| Fees never move between enrollments | ✅ | Not explicitly stated but enforced by FK structure | ⚠️ Business rule exists in design but isn't documented |
| Pass-out closes all enrollments, sets student status | ✅ | `StudentLifecycleController::passOut()` | ✅ Clean |
| Leave-school requires inactive status first | ✅ | `StudentLifecycleValidator::canLeaveSchool()` | ✅ Safety gate |
| Reactivation sets inactive enrollments back to active | ✅ | `StudentLifecycleController::reactivate()` | ⚠️ Updates ALL inactive enrollments, not specifying which |
| Student report cache is invalidated on lifecycle change | ✅ | `$this->reportCache->forget()` in each method | ✅ Good |

### Issues

| Issue | Detail |
|---|---|
| **Promotion target not validated for class progression** | Any section can be selected as promotion target — no check that the target class is the "next" logical class |
| **Outcome duplication** | Status constants exist on both `Student` and `StudentSection` with overlapping values |
| **Inconsistent transferred_at usage** | `makeInactive()` does NOT set `transferred_at` (intentional), but `promote()` and `passOut()` do. This is correct but undocumented — a future developer might not know the distinction |

---

## 4. Reports

### Business Rule Registry — Reports

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Historical reports are read-only | ✅ | Inertia renders; no write paths | ⚠️ Not explicitly enforced |
| Student report aggregates across ALL enrollments | ✅ | `StudentReportService` groups by class_ids from all enrollments | ✅ Correct for cross-enrollment reports |
| Report data is cached per request | ✅ | `StudentReportCache` | ✅ Good, with cache invalidation on mutations |
| PDF export is GET-based (bookmarkable) | ✅ | `StudentReportCenterController::exportPdfGet` | ✅ Clean design |

---

## 5. Authentication & Permissions

### Business Rule Registry — Auth

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Admin can access admin area | ✅ | `RoleMiddleware` | ✅ Clean middleware |
| Accountant can access accountant area | ✅ | `RoleMiddleware` | ✅ Clean middleware |
| Teacher can access teacher area | ✅ | `RoleMiddleware` | ✅ Clean middleware |
| Teacher can only access their assigned sections | ✅ | `routes/attendance.php:54-59`, `User::sections()` | ✅ Checked per-request |
| Users can be active/inactive | ✅ | `User.is_active` column | ✅ Clean |
| Password reset is admin-only | ✅ | `UserController::resetPassword` | ✅ |

### Issues

| Issue | Detail |
|---|---|
| **No explicit authorization layer** (no Gates/Policies) | All authorization is route-level via middleware or inline checks. No `@can` or `Gate::authorize()` usage |
| **Role enum is a string column** | `users.role` is a string with no DB constraint; typos possible |
| **Frontend role gating** | `RoleGate.jsx` component wraps UI sections — relies on backend role, could be bypassed but backend checks prevent access |

---

## 6. Utilities

### Business Rule Registry — Backup

| Rule | Implemented | Location | Issues |
|---|---|---|---|
| Backup creates compressed SQL dump | ✅ | `BackupService::create()` | ✅ Clean implementation |
| Restore drops all tables and re-imports | ✅ | `BackupService::restore()` | ⚠️ Risk if restore fails mid-way (partial restore) — sets FK checks=0 then drops everything |
| Restore validates file existence before proceeding | ✅ | `BackupService::restore()` | ✅ Good |
| Backup compatibility is checked (version, migration count) | ✅ | `BackupService::checkCompatibility()` | ✅ Good |
| Compatibility warnings don't block restore | ✅ | Warnings returned, not exceptions | ⚠️ Acceptable UX trade-off |

---

## 7. Logic in Wrong Layer

This is the most impactful finding.

| Logic | Current Location | Should Be In |
|---|---|---|
| Student bulk-upsert (with fee generation and enrollment archiving) | `routes/admin.php` closure (lines 407-537) | `StudentService` or `BulkUpsertStudentAction` |
| Absentee streak calculation | `routes/attendance.php` closure (lines 286-301) | `AbsenteeService` |
| Fee aggregation with COALESCE subqueries | `FeesController::index()` (lines 61-98) | `FeeService` or model scope |
| Enrollment history rollup (attendance counts + fee sums) | `routes/admin.php` closure (lines 539-564) | Reuse `StudentReportService::loadHistory()` |
| Master directory listing | `routes/admin.php` closure (lines 243-277) | Controller method |
| Student progression data query | `routes/admin.php` closure (lines 185-241) | Controller or dedicated service |

---

## 8. Conflicting Implementations

| Concept | Implementation A | Implementation B | Conflict |
|---|---|---|---|
| "Is this a Kirtan class?" | `$isClassType($type, 'kirtan')` — checks raw string for contains | `FeesController::normalizeDivisionType()` — checks `class_type` and `class_name` for substring | A uses simple contains; B uses more complex logic with class_name fallback. Results could differ |
| "Active enrollment check" | `scopeCurrent()` — checks `transferred_at IS NULL` | Inline checks in closures — often also check `status = 'active'` | `scopeCurrent()` does NOT check status, only transferred_at. Most inline checks need BOTH conditions |
| "Student active status" | `Student::STATUS_ACTIVE = 'active'` | Inline string `'active'` in closures and queries | Strings repeated without constant reference |

---

*Generated: 2026-07-30*
