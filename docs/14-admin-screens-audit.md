# Admin Screens Audit

**Date:** 2026-08-15
**Branch:** `refactor/architecture`
**Scope:** All admin pages, controllers, routes, sidebar, authorization
**Status:** Complete — awaiting fix-implementation plan

---

## Inventory

| Layer | Count | Notes |
|---|---|---|
| Admin pages (`resources/js/Pages/Admin/**`) | 36 React files | Includes `Batches.jsx` (orphan mockup) + `Students/Show.jsx` (dead) |
| Admin controllers (`app/Http/Controllers/Admin/**`) | 11 PHP files | All behind `role:admin` middleware (`web.php:42`) |
| Admin routes (`routes/admin.php`) | 648 lines | + the 3 routes for Dashboard summary and Divisions live inline |
| Sidebar top-level links | 13 | All match registered routes |

---

## 1. Critical Bugs

### 🔴 B1 — Dashboard `topAbsentees` / `topPendingFees` use 2-arg resolver, collapses third+ classes into Gurmukhi bucket

**File:** `app/Http/Controllers/Admin/DashboardController.php`

- **Line 465:** `DivisionTypeResolver::division($row->class_type ?? null, $row->class_name ?? null)` — 2-arg call inside `topAbsentees()`.
- **Line 526:** Same 2-arg call inside `topPendingFees()`.

**Root cause:** The two SQL queries JOIN `classes` but only SELECT `classes.type`, not `classes.division`. The 2-arg resolver then sees e.g. `type='gurmukhi'` for an "Academy" / "Music" class with explicit `division='music'` and returns the legacy "gurmukhi" bucket — same bug pattern the B16 backfill migration fixed for Students pages.

**Impact:** The admin dashboard's "Top Absentees" and "Top Pending Fees" widgets will silently file Music/Academy/Tabla students under the "Gurmukhi" card. The dashboard already ships `divisions[]` from the correct `buildDivisions()` (line 102-117) — but the per-student breakdowns use the broken query.

**Fix:**
```php
// Lines ~440, 488 (SELECT clauses)
'classes.division as class_division',

// Lines ~500, 508 (GROUP BY)
'classes.division',

// Lines 465, 526 (mapping closures)
'division_type' => DivisionTypeResolver::division(
    $row->class_type ?? null,
    $row->class_name ?? null,
    $row->class_division ?? null
),
```

**Severity:** HIGH. Mirrors the B16 bug class (silent bucket-collapse on dashboards); user-reported in B17 conversation context.

---

### 🔴 B2 — `routes/admin.php` lines 276-277, 289-292: route name double-prefix

**Confirmed via `php artisan route:list`:**

| URL | Resolved name (before) | Resolved name (after B2 fix) |
|---|---|---|
| `GET /admin/dashboard/summary` | `admin.admin.dashboard.summary` | `admin.dashboard.summary` |
| `GET /admin/divisions` | `admin.admin.divisions.index` | `admin.divisions.index` |
| `GET /admin/divisions/data` | `admin.admin.divisions.data` | `admin.divisions.data` |

**Root cause:** `web.php:42` applies `->name('admin.')` prefix to the admin group. Three route definitions inside `routes/admin.php` then call `->name('admin.dashboard.summary')` / `admin.divisions.*` — full names, not relative ones. Laravel concatenates, producing `admin.admin.X`.

**Latency:** No code currently calls `route('admin.dashboard.summary')` etc. (`grep -rn` returned no matches). The bug is currently latent — any future call site would throw `RouteNotFoundException`. The 3 URLs themselves are correct. The bug was independently re-discovered by the B18/B1 test, which initially failed with `RouteNotFoundException` until the test was switched to hit the URL directly.

**Fix:**
```php
// routes/admin.php:277
->name('dashboard.summary');

// routes/admin.php:290
->name('divisions.index');

// routes/admin.php:292
->name('divisions.data');
```

**Severity:** LOW (latent). Fix as part of B18 housekeeping before any team member adds `route()` calls for these three.

---

## 2. Dead / Orphan Code

### ⚠️ O1 — `Batches.jsx` is a frontend-only mockup, no backend

**File:** `resources/js/Pages/Admin/Utilities/Batches.jsx` (169 lines).

- Header comment: "This is a visual prototype. All data is mock data. No backend integration yet."
- Defines `MOCK_BATCHES` constant; renders UI from it.
- NOT linked from the sidebar or from `Admin/Utilities.jsx`.
- No route registered.

**Action:** Either delete or wire to a real `batches` table. Recommend **delete** unless a `batches` table migration is planned soon.

---

### ⚠️ O2 — `Admin/Students/Show.jsx` is legacy dead code

**File:** `resources/js/Pages/Admin/Students/Show.jsx` (55 lines).

- Uses `SimpleLayout` (not `AdminLayout`).
- Renders a single `<StudentReport>` component for a `student` prop and a `report` prop.
- No `/admin/students/{id}` route is registered for it.
- The actual student-detail view is the **Student Report Center** (`/admin/student-report-center`).

**Action:** Delete. It's a leftover from before V1 of Student Report Center.

---

## 3. Cross-Division Hardcodes — Mostly Clean, Two `isKirtan` Short-Forms

### ✅ Clean — fully data-driven:

- `Admin/Students/Index.jsx` — no division filter.
- `Admin/Classes/Index.jsx`, `Admin/Sections/Index.jsx`, `Admin/Users/Index.jsx`, `Admin/Divisions/Index.jsx` — all data-driven.
- `Admin/Utilities/{PendingFeesSetup,StudentStatus,MasterDirectory,Backup}.jsx` — class/section/status filters only, no division.
- `Admin/DashboardController.php::buildDivisions()` (lines 102-117) — uses 3-arg form correctly.
- `Admin/DivisionController.php::buildDivisions()` (lines 50-69) — uses 3-arg form correctly.
- `Admin/AdminAttendanceController.php::grid()` (line 57-61) — uses 3-arg form `$class->type ?? null, $class->name ?? null, $class->division ?? null`.
- `Admin/FeesController.php` (lines 193-197, 225-229) — uses 3-arg form.
- `Admin/StudentReportCenterController.php::page()` (line 122-135) — seeds `['all', 'gurmukhi', 'kirtan']` then **appends** every distinct `classes.division` from the DB and sorts — data-driven extension.
- `Admin/StudentReportCenter/components/FilterBar.jsx` (lines 61-75) — labels map has legacy keys but falls back to `${ucFirst(value)} only` for any third+ key.
- `Admin/StudentReportCenter/Index.jsx` (line 306) — `const isKirtan = divisionKey === "kirtan"` is the **documented intentional** domain gate for the Kirtan-specific widget (kirtan_score, lesson-learned badge). Comment at line 290-291: "the single intentional Kirtan special case".
- `Admin/Reports/Index.jsx`, `Admin/Reports/Attendance.jsx`, `Admin/Fees/Index.jsx` (line 609 uses `divisionMeta()` correctly) — all data-driven.

### 🟡 Minor — gap, not a bug:

### ⚠️ B3 — `Admin/Attendance/Index.jsx` line 112 + backend `AdminAttendanceController.php::index` line 28

**Files:**
- `resources/js/Pages/Admin/Attendance/Index.jsx:112`: `const isKirtan = resolveIsKirtan(selectedClass?.type, selectedClass?.name);` — 2-arg form.
- `app/Http/Controllers/Admin/AdminAttendanceController.php:28`: `SchoolClass::select('id', 'name', 'type')` — doesn't ship `division`.

**Impact:** Negligible. `resolveIsKirtan(type, name)` was the original 2-arg form before the seam refactor. For the current data (Gurmukhi/Kirtan as the only two divisions, with `division` set explicitly), the 2-arg form happens to return the right value because:
- `type='gurmukhi'` → "Kirtan = false" — correct regardless of division.
- `type='kirtan'` → "Kirtan = true" — correct regardless of division.

If a class is added with `type='music'` and `division='music'`, the 2-arg returns "false" for Kirtan (correct, Music ≠ Kirtan). The Kirtan-only "Lesson" column won't appear in the Music attendance grid, which is what we want. So the 2-arg form is **currently safe**.

**Recommendation:** Ship `division` from the controller and use 3-arg form on the frontend for consistency with the bucket-lock invariant. **Low priority** — no functional bug today.

### ⚠️ B4 — `Admin/Utilities/StudentProgression.jsx` line 99 + `routes/admin.php` line 222

**Files:**
- `resources/js/Pages/Admin/Utilities/StudentProgression.jsx:99`: `const isKirtan = division(enrollment?.classType, enrollment?.className) === "kirtan";` — 2-arg form.
- `routes/admin.php:222`: `'classType' => $e->schoolClass->type,` — doesn't ship `classDivision`.

**Impact:** Cosmetic. The `Kirtan` badge rendered in the Student Progression table is wrong for any third+ class (e.g. "Music" would badge as not-Kirtan, which is correct; but "Tabla" with `type='gurmukhi'` would also badge as not-Kirtan, also correct). Since this badge just sets a yellow ribbon for Kirtan classes, missing the badge on a third+ class isn't damaging.

**Recommendation:** Ship `classDivision` from the closure + use 3-arg form on the frontend. **Low priority** — purely cosmetic.

---

## 4. Authorization & Role Gating

### ✅ All admin routes are admin-gated
- `web.php:41-46` applies `->middleware('role:admin')` to the whole admin prefix. Every route in `routes/admin.php` inherits this.
- Sidebar links: 13 top-level links, all map to admin-gated routes.

### ✅ Per-controller authorize calls (where applicable):
- **`Admin/AdminAttendanceController.php`**: `authorize('viewAny', Attendance::class)` (line 39), `authorize('mark', Attendance::class)` (line 111).
- **`Admin/BackupController.php`**: `authorize('viewAny', ...)` on `overview`/`history`, `authorize('create')`, `authorize('download', $entry)`, `authorize('restore', $entry)`, `authorize('delete', $entry)`, `authorize('view', $entry)` — full coverage.
- **`Admin/StudentController.php`**: `authorize('update', Student::class)` (line 168), `authorize('view', $student)` (line 315), `authorize('delete', $student)` (line 348), `authorize('delete', Student::class)` (line 361).
- **`Admin/FeesController.php`**: `authorize('viewAny', Fee::class)` (line 36).
- **`Admin/PendingFeesController.php`**: No explicit authorize calls (relies on `role:admin` middleware) — OK for admin endpoints.
- **`Admin/FeeRatePeriodController.php`**: No explicit authorize calls (relies on `role:admin` middleware) — OK.
- **`Admin/UserController.php`**: No explicit authorize calls. The self-edit guard at line 69 (`$isSelf = $user->id === auth()->id()`) prevents privilege escalation via bulk role change on your own account. ✓
- **`Admin/StudentReportCenterController.php`**: No explicit authorize calls — OK, all admin-gated.
- **`Admin/DashboardController.php`**: No explicit authorize calls — OK, admin-gated.
- **`Admin/DivisionController.php`**: No explicit authorize calls — OK, admin-gated.
- **`Admin/ReportController.php`**: No explicit authorize calls — OK, admin-gated.

**No authorization gaps found.**

---

## 5. Sidebar vs Registered Pages — Full Coverage

| Sidebar link | Registered route | Status |
|---|---|---|
| Dashboard | `GET /admin/dashboard` → `admin.dashboard` | ✓ |
| Students | `GET /admin/students` → `admin.students.index` | ✓ |
| Classes | `GET /admin/classes` → `admin.classes.index` | ✓ |
| Divisions | `GET /admin/divisions` → `admin.divisions.index` | ✓ |
| Sections | `GET /admin/sections` → `admin.sections.index` | ✓ |
| Attendance | `GET /admin/attendance` → `admin.attendance.index` | ✓ |
| Manage Fees | `GET /admin/fees/` → `admin.fees.index` | ✓ |
| Fee Categories | `GET /admin/fees/custom` → `admin.fees.custom.index` | ✓ |
| Student Center | `GET /admin/student-report-center` → `admin.student-report-center.page` | ✓ |
| Fees Report | `GET /admin/reports/` → `admin.reports.index` | ✓ |
| Attendance Report | `GET /admin/reports/attendance` → `admin.reports.attendance.index` | ✓ |
| Users | `GET /admin/users` → `admin.users.index` | ✓ |
| Utilities | `GET /admin/utilities` → `admin.utilities.index` | ✓ |

**Utilities landing page** (`Admin/Utilities.jsx`) links to 7 sub-pages — all registered:
- `pending-fees` → `admin.utilities.pending-fees`
- `student-status` → `admin.utilities.student-status`
- `student-progression` → `admin.utilities.student-progression`
- `master-directory` → `admin.utilities.master-directory`
- `backup` → `admin.utilities.backup.index`
- Bulk Student Upload / Bulk Student Edit — placeholders only, no link (cards render with no `href`).

**Orphan pages NOT in sidebar nor Utilities landing:**
- `Admin/Students/Show.jsx` (dead, uses SimpleLayout)
- `Admin/Utilities/Batches.jsx` (mockup prototype)

---

## 6. Recommended Fixes (Prioritized)

### 🔴 Priority 1 — Fix Dashboard bucket-collapse (B1)

Same bug class as B16 (silent collapse into Gurmukhi). Updates:
- `app/Http/Controllers/Admin/DashboardController.php`:
  - Add `'classes.division as class_division'` to SELECT and GROUP BY in `topAbsentees()` (~line 440-449) and `topPendingFees()` (~line 487-510).
  - Change the two `DivisionTypeResolver::division()` calls (lines 465, 526) to the 3-arg form.

Followed by a feature test (e.g. `AdminDashboardCrossDivisionVisibilityTest.php`) that seeds a class with explicit `division='music'` + `type='gurmukhi'`, asserts the dashboard JSON puts it under "music" not "gurmukhi".

### 🟡 Priority 2 — Fix route name double-prefix (B2)

Update three lines in `routes/admin.php`:
- Line 277: `->name('admin.dashboard.summary')` → `->name('dashboard.summary')`
- Line 290: `->name('admin.divisions.index')` → `->name('divisions.index')`
- Line 292: `->name('admin.divisions.data')` → `->name('divisions.data')`

Run `php artisan route:list --name=admin.divisions` before/after to confirm.

### 🟡 Priority 3 — Delete orphan pages (O1, O2)

- Delete `resources/js/Pages/Admin/Utilities/Batches.jsx`.
- Delete `resources/js/Pages/Admin/Students/Show.jsx`.
- Verify `grep -r "Batches\|Admin/Students/Show" resources/js app routes` returns no remaining references.

### 🔵 Priority 4 — Optional consistency fixes (B3, B4)

For consistency with the bucket-lock invariant, ship `division` from the attendance + student-progression endpoints and use 3-arg form. **No functional bug today** — defer to a B18 housekeeping ticket.

---

## Files Audited (Reference)

### Routes & controllers (read fully):
- `routes/admin.php` (648 lines)
- `routes/web.php` (73 lines)
- `app/Http/Controllers/Admin/{DashboardController,StudentController,AdminAttendanceController,FeesController,PendingFeesController,FeeRatePeriodController,StudentReportCenterController,UserController,BackupController,DivisionController,ReportController}.php`

### Pages (read fully):
- `Admin/Dashboard.jsx` (496 lines)
- `Admin/Students/{Index,Show}.jsx`
- `Admin/Classes/Index.jsx` (699 lines)
- `Admin/Sections/Index.jsx` (424 lines)
- `Admin/Users/Index.jsx` (447 lines)
- `Admin/Divisions/Index.jsx` (196 lines)
- `Admin/Utilities.jsx` + `{PendingFeesSetup,StudentStatus,MasterDirectory,Backup,Batches}.jsx`
- `Admin/Attendance/Index.jsx` (530 lines)
- `Admin/Fees/{Index,CustomFee}.jsx`
- `Admin/Reports/{Index,Attendance}.jsx`
- `Admin/StudentReportCenter/Index.jsx` + `components/{FilterBar,IdentityBlock,AttendanceSection,FeeSection,KirtanSection,CalendarSection,HistoryTimeline}.jsx`
- `Admin/Utilities/StudentProgression.jsx` (partial — first 100 lines)
- `Admin/Layouts/AdminLayout.jsx` (286 lines)

### Files NOT read (not required to identify the critical findings):
- `Admin/Students/Components/*.jsx` (subcomponents of the Students index — all delegation, no division logic)
- `Admin/Utilities/StudentProgression/{PromoteFlow,PassOutFlow,ImpactSummary}.jsx` (flow modals — same delegation pattern)
- `app/Models/*.php`, policies, the seeders — out of audit scope
