# Module-by-Module Business Workflow Audit — Multi-Class Compatibility

**Branch:** `refactor/architecture`
**Date:** 2026-08-15
**Scope:** End-to-end review of every operational module against the question: *does this screen genuinely support arbitrary classes, or does it only LOOK like it supports multiple classes?*
**Method:** Direct read of every route, controller, service and Inertia page that touches class/division resolution. Side-by-side comparison against the Stage A + Stage B baseline (committed through Stage B11).
**Ground rule:** This is **AUDIT ONLY**. No code, schema, UI or behavior was modified. The recommendations at the end are the *next* map, not the executed plan.

---

## 1. Executive Summary

### What genuinely works for arbitrary classes today
- The `DivisionTypeResolver` (`type → name → explicit division`) plus `classes.division` seam (Stage A) is consumed correctly by every server-side reader we audited: dashboard divisions, fee resolver, monthly-fee service, absentee service, student report service, late-fee summary.
- `ClassSchedule::attendanceDays()` and `ClassSchedule::chargesMonthlyFee()` (Stage B config seam) are the single source of truth for attendance-day rules and monthly-fee eligibility. Kirtan Sunday-only is just one legitimate input to that seam, not a hardcoded branch.
- Frontend `divisionMeta()` (Stage B4) generates a deterministic palette color and title-cased label for any division key the resolver returns — a third+ division gets a "Music / Tabla / Punjabi" tab with a palette-driven color without any frontend code change.
- `routes/admin.php → POST /admin/classes/save` (Stage B10) accepts full Stage B config on the create path: attendance days, charges-monthly-fee toggle, monthly-fee amount, division slug derived from the name.
- Multi-class student identity is correct end-to-end (F3 — fees keyed by `(student_id, type, month)`), so a student in Gurmukhi + Tabla is not double-charged.

### What works *visually* but leaks hardcoding under the hood
- The Accountant "Students" page filter bar still ships **two hardcoded buttons** (`gurmukhi`, `kirtan`). A third+ division is invisible to accountants without a code change.
- Several UI elements gate the Kirtan Sunday-only behavior (`isKirtanTab`, `class_type_key === 'kirtan'`, `lesson_learned`, lesson-notes block) on a string compare. This is *legitimate business* (Kirtan alone has lesson notes), not a defect — but the same "string-gating" pattern must be re-evaluated for any *new* business rule that genuinely belongs to one division only.
- A stale code comment in `StudentController::show` (`app/Http/Controllers/StudentController.php:119`) still says `'class_type_key' => $type,   // guaranteed 'gurmukhi' or 'kirtan'` — the resolver has long since lifted that guarantee.

### What is missing for genuine "any class" support
- **Class creation UI** beyond the modal shipped in B10 is fine; the gap is *operational*. There is no "Classes" entry in `AdminLayout` navigation that an admin would naturally look for, and the "+ New Class" modal is hidden behind `/admin/classes` which is only reachable from `/admin/classes/save` redirects or direct URL.
  - **Resolved (B15):** `resources/js/Layouts/AdminLayout.jsx:187` ships `<SidebarLink href="/admin/classes" label="Classes" />`. The page is now discoverable from the main admin sidebar; the audit's claim of "no entry" was incorrect against the current code.
- **Section creation** is fully tied to the inline-row + modal flow on `/admin/classes/:id` (it lives in the per-class edit page). For a third class, sections must be created through the same flow — works, but the discoverability is "find the class, click edit, scroll down".
- **Dashboard division picker** defaults to "gurmukhi" and the dashboard section was not validated against a three-division payload in any test. (Stage B4 palette does the *display*, but the active-division state machine was not tested for "third division + missing data".)
- **Reports** have not been audited for whether PDF exports, CSV exports, or print views hardcode "Gurmukhi / Kirtan" headers anywhere.

### Bottom line
The codebase is structurally ready for a third+ class. The remaining work is **discoverability + operational UX** (where to create a class from, how accountants see all divisions, how reports render multi-division titles) — not a rewrite. The "three-division" test most likely to fail today is *the accountant opening their student list and wondering where Music is*.

---

## 2. Module-by-Module Audit

Conventions:
- 🟢 **KEEP** — already correct, do not touch.
- 🔵 **ALREADY COMPATIBLE** — works today by virtue of Stage A/B seams; no code change needed.
- 🟡 **MINOR CHANGE** — small surgical fix (one button, one comment, one label).
- 🟠 **REDESIGN** — needs a dedicated refactor (controller-level rework, not just a string).
- 🔴 **MISSING** — feature/workflow does not exist.
- ⚪ **NOT APPLICABLE** — module doesn't make sense for this question.

For every module: **Screens**, **Backend**, **Frontend**, **Business Workflow**, **Multi-Class Compatibility** (Gurmukhi + Kirtan + new "Music"), **Multi-Class Student** (one student in two divisions), **Existing Class Compatibility** (Gurmukhi alone still works), **Business Alignment**, **Required Action**.

---

### Module 1 — Class / Section Management

**Screens**
- `GET /admin/classes` (Inertia `Admin/Classes/Index.jsx` — list + inline edit + fee timeline modal + CreateClassModal).
- `GET /admin/classes/sections/{class}`-style — sections edit lives within the class edit page (per-class).

**Backend**
- `routes/admin.php` `POST /admin/classes/save` accepts full Stage B payload on the create path (B10). Update path unchanged.
- `DivisionTypeResolver::division(type, name, explicit)` is the entry point.
- `SchoolClass::attendanceDays()` / `chargesMonthlyFee()` proxies to `ClassSchedule`.

**Frontend**
- `Admin/Classes/Index.jsx` ships two creation paths: inline row (Mon-Sat default) + `CreateClassModal` (full Stage B config: attendance day chips, charges-monthly-fee toggle, monthly-fee amount, live division-slug preview, Kirtan-name banner that snaps to Sunday-only).
- `deriveDivisionSlug(name)` slugifies the class name and stores it on `classes.division` explicitly. The seam works for any name (Music, Tabla, Punjabi).
- `isKirtanName(name)` is a UI-only helper, not a hardcoded backend branch.

**Business Workflow**
1. Admin clicks "+ New Class" → modal opens.
2. Admin types name (e.g., "Music") → division slug previews as `music`.
3. Admin toggles attendance days; for non-Kirtan names, defaults to Mon-Sat.
4. Admin toggles monthly fee; if on, enters amount.
5. Submit → backend creates row with explicit `division='music'`, `type='music'` (mirrors name), `attendance_days=[1..6]`, `charges_monthly_fee=true|false`.
6. Kirtan name path: `attendance_days=[0]` (Sunday-only), `charges_monthly_fee=false` enforced by UI banner (still server-validated via defaults).

**Multi-Class Compatibility (Gurmukhi + Kirtan + Music)** 🟢
- Stage A4 resolver buckets Gurmukhi, Kirtan, Music into three divisions. Stage B4 `divisionMeta` generates a palette color for Music.
- Stage B config is data-driven: Music with Mon-Sat attendance and a monthly fee behaves identically to Gurmukhi.

**Multi-Class Student** ⚪
- A student enrolled in Music + Gurmukhi is handled the same way as Gurmukhi + Kirtan (F3 fee identity by `student_id + type + month`).

**Existing Class Compatibility (Gurmukhi alone)** 🟢
- Inline row creation path is unchanged. Existing-row updates are unchanged.

**Business Alignment** 🟢
- One legitimate hardcoded exception remains in the frontend (`isKirtanName`) — that is the correct place for Kirtan-only UI cues (Sunday-only banner).

**Required Action** 🟡
- "Where is the Classes menu in admin sidebar?" is an **operational gap**, not a code defect. The modal exists; admin discoverability is not the audit's scope to fix. Note for §5.

---

### Module 2 — Student Management (Directory + Editor)

**Screens**
- `GET /admin/students` (Inertia `Admin/Students/Index.jsx` — list, bulk delete, editor modal).
- `GET /admin/students/{id}/edit`-style (`StudentEditorModal.jsx` + `EditorBasicInfo.jsx` + `EditorEnrollments.jsx`).
- `GET /students` (public-facing `Students/Index.jsx` — similar pattern, different scope).

**Backend**
- `routes/admin.php` exposes `/admin/students/data?status=...` (JSON), bulk delete, single create/update.
- `Admin\StudentController` handles roster + bulk update. Enrollments are keyed by `section_id` only (no `class_id` per enrollment row — class is inferred via section).

**Frontend**
- `Admin/Students/Index.jsx` filter bar has `classFilter` / `sectionFilter` / `feeFilter` / `statusFilter` — **all sourced from the live `classes` payload**, not hardcoded.
- `normalizeStudent` ensures every enrollment carries `class_name`, `section_name`, `student_type`, `status`.
- The "Class / Section" column renders **one pill per enrollment**, so a multi-class student shows both pills — this is the visible UI confirmation that "a student can be in two divisions" is supported.
- Fee/Paid pill is per-enrollment (a student can be Free in Music, Paid in Gurmukhi).

**Business Workflow**
1. Admin filters by class or section → table re-renders.
2. Admin edits student → enrollment editor lists all current enrollments, lets admin add another (which can be in a different division).
3. Bulk delete removes student + dependent rows.

**Multi-Class Compatibility (Gurmukhi + Kirtan + Music)** 🟢
- Filter dropdowns are sourced from `/admin/students` initial props (`classes` array). A new division is automatically a filter option.
- No string compare against `gurmukhi`/`kirtan` in this page.

**Multi-Class Student** 🟢
- Multiple enrollment pills per student row. Fee filter is per-enrollment.

**Existing Class Compatibility** 🟢
- No change.

**Business Alignment** 🟢
- This is one of the cleanest modules in the audit. It was already multi-class friendly.

**Required Action** 🟢 KEEP — no change required.

---

### Module 3 — Enrollment Management

**Screens**
- Embedded in `EditorEnrollments.jsx` (admin student editor) and student-side `Students/Create.jsx`.

**Backend**
- `student_sections` table: one row per `(student_id, section_id, status)`. No `class_id` on the row; class is joined via section.
- `enrollments` queried by `section_id IN (...)` everywhere. The class_id flow is: Student → Section → Class.

**Frontend**
- Enrollment creation lets admin pick a class, then a section under it. Both dropdowns are data-driven.

**Business Workflow**
1. Admin opens student editor.
2. Admin clicks "Add enrollment" → class dropdown → section dropdown → save.
3. Server creates `student_sections` row.

**Multi-Class Compatibility** 🟢
- The flow naturally allows the same student to have one enrollment in Gurmukhi Section A and another in Music Section A.

**Multi-Class Student** 🟢
- Multiple enrollments per student is the core feature.

**Existing Class Compatibility** 🟢

**Business Alignment** 🟢
- The class→section picker chain is data-driven and correct.

**Required Action** 🟢 KEEP.

---

### Module 4 — Fees (Admin/Accountant)

**Screens**
- `GET /admin/fees` (admin `Admin/Fees/Index.jsx`).
- `GET /accountant/fees` (`Accountant/Fees/Index.jsx`).
- `POST /accountant/fees/receive` (`Accountant/ReceiveFee.jsx`).
- `GET /accountant/late-fees` (`Accountant/LateFees.jsx`).

**Backend**
- `MonthlyFeeResolver` (per-class default + section override) is the seam.
- `MonthlyFeeService::generateMonthly()` honors `chargesMonthlyFee()` per class, so a Music class with `charges_monthly_fee=true` gets fees, a Music class with `charges_monthly_fee=false` does not.
- `FeesController` iterates `class_types` from the resolver, builds per-class totals.
- `ReceiveFee` uses `DivisionTypeResolver` for the dynamic class-type dropdown.
- F3 fee identity: keyed by `(student_id, type, month)` — a student in Gurmukhi + Music is not double-charged.

**Frontend**
- Admin fees page: per-class-type summary blocks driven by the resolver.
- Accountant receive-fee page: dynamic class-type dropdown, dynamic fee line items.

**Business Workflow**
1. Admin opens Fees → sees per-class totals (Gurmukhi, Kirtan, Music — auto-listed).
2. Accountant opens Receive Fee → picks student → sees enrollment lines (Gurmukhi, Music).
3. Accountant marks paid → fee line clears.

**Multi-Class Compatibility** 🟢
- All fee surfaces iterate over the resolver's division keys. Adding Music adds one more block.

**Multi-Class Student** 🟢
- F3 in `MonthlyFeeService` keeps fees separate per `(student_id, type, month)`. A student in Gurmukhi + Music has two distinct fee records.

**Existing Class Compatibility** 🟢
- Kirtan with `charges_monthly_fee=false` still produces no fees.
- Gurmukhi with `charges_monthly_fee=true` still produces fees.

**Business Alignment** 🟢
- The fee layer is the textbook example of "this was already done correctly in Stage A/B".

**Required Action** 🟢 KEEP.

---

### Module 5 — Attendance

**Screens**
- `GET /attendance/dashboard` (`Attendance/Dashboard.jsx`).
- `GET /attendance/mark` (`Attendance/Mark.jsx`, `AttendanceMarkPage.jsx`).
- `GET /accountant/attendance` (`Accountant/Attendance.jsx`, `Accountant/AttendanceSections.jsx`).
- `GET /teacher/attendance` (`Teacher/Attendance.jsx`).

**Backend**
- `routes/attendance.php` (122 lines) — dashboard, mark, summary.
- `SchoolClass::isAttendanceDay(Carbon $date)` is the single source of truth for "is today an attendance day for this class".
- `ClassSchedule::attendanceDays()` returns the array (Kirtan = `[0]`, default = `[1..6]`, explicit = whatever's stored).

**Frontend**
- Dashboard renders the section list grouped by class; no string hardcoding.
- Mark page reads `attendance_days` from class meta.

**Business Workflow**
1. Teacher opens mark page → picks class + section → sees only attendance days configured for that class (Kirtan teacher sees only Sundays; Music teacher sees Mon-Sat).
2. Teacher marks present/absent/leave.

**Multi-Class Compatibility** 🟢
- Attendance-day rule is data-driven. A Music class with `[1,2,3,4,5]` (no Saturday) is honored.

**Multi-Class Student** 🟢
- Attendance is per `(student, class)` enrollment; multi-class students have separate attendance records per division.

**Existing Class Compatibility** 🟢
- Kirtan Sunday-only rule preserved.

**Business Alignment** 🟢
- Sunday-only is a real business rule (Kirtan happens on Sundays); preserved by the seam, not a hardcoded `if (kirtan)` branch.

**Required Action** 🟢 KEEP.

---

### Module 6 — Absentees

**Screens**
- `GET /attendance/absentees` (`Attendance/Absentees.jsx`, `Absentees/TodayAbsenteesPanel.jsx`, `Absentees/AbsenteesStudentList.jsx`, `Absentees/AbsenteesFiltersPanel.jsx`).

**Backend**
- `app/Services/AbsenteeService.php` iterates sections, calls `$class->isAttendanceDay()` — **no hardcoded strings**.
- `top_absentees` summary is class-aware, computed against attendance-day rules.

**Frontend**
- Absentees panel filters by date + class. Class dropdown is data-driven from active classes.

**Business Workflow**
1. Admin opens absentees → picks date → picks class → sees students absent on an attendance day for their class.

**Multi-Class Compatibility** 🟢
- The filter naturally surfaces Music students absent on a Monday.

**Multi-Class Student** 🟢
- Attendance is per-enrollment; absentee count is per-enrollment too.

**Existing Class Compatibility** 🟢

**Business Alignment** 🟢

**Required Action** 🟢 KEEP.

---

### Module 7 — Student Center (Student-Facing Show Page)

**Screens**
- `GET /students/{id}` (Inertia `Students/Show.jsx`).
- `GET /students/{id}` also served by `App\Http\Controllers\StudentController::show` for non-Teacher/Accountant/Admin users.

**Backend**
- `StudentController::show` groups enrollments by `DivisionTypeResolver::division()` — returns one `summary[]` item per division the student is enrolled in.
- Each summary item carries `class_type_key` (resolver output), `class`, `section`, `attendance.recent[]`, `fees`, etc.
- ⚠️ **Stale comment** at `app/Http/Controllers/StudentController.php:119`: `'class_type_key' => $type,   // guaranteed 'gurmukhi' or 'kirtan'` — this comment is **wrong** post-Stage A. The resolver may return any division key.

**Frontend**
- `Students/Show.jsx` builds **one tab per division** via `useMemo`, label and color from `divisionMeta(class_type_key)`.
- Kirtan tab shows "Sundays only" pill + Lesson Notes block; gated on `class_type_key === 'kirtan'`. Other tabs use generic attendance calendar.
- FeeSection renders only if `canViewFees` (admin/accountant).

**Business Workflow**
1. Student opens their own page → sees one tab per division they're enrolled in.
2. Kirtan student sees Sunday-only calendar + lesson notes (genuine business rule).
3. Music student sees Mon-Sat calendar (no lesson notes block, no Sunday pill).

**Multi-Class Compatibility** 🟢
- Tabs render dynamically from the resolver output. Music gets a third tab.

**Multi-Class Student** 🟢
- This is the **headline use case** — a student in Gurmukhi + Kirtan sees two tabs. Adding Music makes it three.

**Existing Class Compatibility** 🟢
- Tabs collapse to one when student is in a single division; rendering still works.

**Business Alignment** 🟢 — except the stale comment.

**Required Action** 🟡
- **Update stale comment** at `StudentController.php:119`. Documentation-only fix; behaviour already correct.

---

### Module 8 — Student Reports (Admin Student Report Center)

**Screens**
- `GET /admin/student-report-center` (`Admin/StudentReportCenter/Index.jsx`).
- Components: `IdentityBlock`, `AttendanceSection`, `FeeSection`, `KirtanSection`, `CalendarSection`, `HistoryTimeline`, `FilterBar`.

**Backend**
- `app/Services/StudentReport/StudentReportService.php`:
  - Iterates `$classIdsByDivision` — every division is iterated, including `'all'` for cross-division view.
  - `kirtanScore` is gated on `$division === 'kirtan'` — **legitimate business** (only Kirtan students have a kirtan-score column).
  - Attendance and fee aggregation is class-type-aware (per `(student, type)` enrollment).

**Frontend**
- `FilterBar` lets user pick division (data-driven), class, section, student.
- `KirtanSection` component renders lesson notes + kirtan score; rendered only when the active division is Kirtan. The component is correctly gated.

**Business Workflow**
1. Admin opens Student Report Center → picks division → class → section → student.
2. Sees per-division attendance + fees + (if Kirtan) lesson notes + kirtan score.

**Multi-Class Compatibility** 🟢
- Division dropdown is sourced from resolver output.

**Multi-Class Student** 🟢
- Per-division tabs/sections render for students in multiple divisions.

**Existing Class Compatibility** 🟢
- Kirtan-only fields stay Kirtan-only.

**Business Alignment** 🟢

**Required Action** 🟢 KEEP.

---

### Module 9 — Fee Reports

**Screens**
- `GET /admin/reports` (`Admin/Reports/Index.jsx`).
- `GET /accountant/reports` (`Accountant/Reports.jsx`).
- `GET /accountant/late-fees` (`Accountant/LateFees.jsx`, `LateFeesFiltersPanel.jsx`, `LateFeesSectionCard.jsx`).

**Backend**
- `LateFeeSummaryController` is enrollment-based; no division-key string compare.
- Monthly fee reports iterate divisions via the resolver.

**Frontend**
- Reports are data-driven; division filters are dynamic.

**Business Workflow**
1. Admin opens fee report → picks month + division filter → sees totals.

**Multi-Class Compatibility** 🟢

**Multi-Class Student** 🟢

**Existing Class Compatibility** 🟢

**Business Alignment** 🟢

**Required Action** 🟢 KEEP.

---

### Module 10 — Attendance Reports

**Screens**
- `GET /admin/attendance` (`Admin/Attendance/Index.jsx`).
- `GET /admin/reports/attendance` (`Admin/Reports/Attendance.jsx`).

**Backend**
- Attendance queries are class-type-agnostic at the row level (one row per `(student, class, date)`).
- Aggregation respects `isAttendanceDay()`.

**Frontend**
- Filters are data-driven (class + section + date range).

**Business Workflow**
1. Admin opens attendance report → picks class + month → sees attendance grid.

**Multi-Class Compatibility** 🟢

**Multi-Class Student** 🟢

**Existing Class Compatibility** 🟢

**Business Alignment** 🟢

**Required Action** 🟢 KEEP.

---

### Module 11 — Dashboards

**Screens**
- `GET /admin/dashboard` (`Admin/Dashboard.jsx`).
- `GET /accountant/dashboard` (`Accountant/Dashboard.jsx`).
- `GET /teacher/dashboard` (`Teacher/Dashboard.jsx`).
- `GET /attendance/dashboard` (`Attendance/Dashboard.jsx`).

**Backend**
- `Admin/DashboardController::buildDivisions()` buckets classes by resolver output — already map-over-divisions, NOT a fixed `['gurmukhi' => ..., 'kirtan' => ...]` map.
- `DashboardController::summary` returns `divisions[]`, `insights.top_absentees[]`, `insights.top_pending_fees[]` — every entry carries `division_type`, `class_id`, `section_id` so the frontend can filter.
- Title is `ucfirst($type)` (Kirtan-only cosmetic quirk: label is "Kirtan" not "kirtan").

**Frontend**
- `Admin/Dashboard.jsx`:
  - Renders one button per division from `data.divisions` (data-driven). A third+ division gets its own button.
  - Class dropdown filters by active division.
  - Section dropdown filters by active class.
  - Top-absentees + top-pending-fees filtered by `division_type`, `class_id`, `section_id`.

**Business Workflow**
1. Admin opens dashboard → sees buttons: Gurmukhi, Kirtan, Music.
2. Clicks Music → class dropdown shows Music classes; section dropdown shows Music sections.
3. Class/Section performance tables show Music-only data.

**Multi-Class Compatibility** 🟢
- ✅ Already data-driven at the button level.
- ⚠️ **No test currently asserts "dashboard renders three division buttons when three divisions exist."** This is a test gap, not a code gap.

**Multi-Class Student** ⚪
- Dashboard operates on aggregate enrollment rows.

**Existing Class Compatibility** 🟢
- Two-division case renders two buttons as before.

**Business Alignment** 🟢

**Required Action** 🟡
- Add a feature test that seeds three divisions and asserts the API returns three division buckets + the frontend would render three buttons. Not a code change; a regression test.

---

### Module 12 — Search / Filters

**Screens**
- Accountant "Students" filter bar (`Accountant/Students/StudentsFilterBar.jsx`) — **TWO HARDCODED BUTTONS**.
- Admin student directory (`Admin/Students/Components/DirectoryToolbar.jsx`) — data-driven.
- Admin sections (`Admin/Sections/Index.jsx`) — data-driven.
- Late-fees filters (`LateFeesFiltersPanel.jsx`) — data-driven (class dropdown).

**Backend**
- `Accountant/Students` controller supplies the full `students` payload (all classes), but the **frontend filter UI is hardcoded**.

**Frontend**
- `Accountant/Students/StudentsFilterBar.jsx`:
  ```jsx
  <button onClick={() => onClassFilterChange("gurmukhi")}>Gurmukhi</button>
  <button onClick={() => onClassFilterChange("kirtan")}>Kirtan</button>
  ```
  No third button. A student in Music is **filtered out** when this bar is shown.

**Business Workflow**
1. Accountant opens Students → only sees Gurmukhi + Kirtan buttons → cannot click Music.
2. To see Music students, accountant must change something elsewhere (and there is no elsewhere).

**Multi-Class Compatibility** 🔴
- **This is the audit's most consequential finding.** An accountant looking at "their" students sees no Music option. The page's data does include Music students, but the filter bar hides them.

**Multi-Class Student** 🔴
- Multi-class students (Gurmukhi + Music) are filtered out by default; the only way to see them is to be on the Gurmukhi tab (where Music is invisible) or Kirtan tab (where Music is also invisible).

**Existing Class Compatibility** 🟢
- Gurmukhi + Kirtan buttons still work as before.

**Business Alignment** 🔴
- This is a real defect, not an enhancement gap. An accountant whose school adds Music would silently lose access to half their students.

**Required Action** 🟠
- **REDESIGN** the filter bar to be data-driven (sourced from the resolver's division list) OR provide a "All" button that shows every division. This is the single most important fix coming out of this audit.

---

### Module 13 — Utilities

**Screens**
- `GET /admin/utilities` (`Admin/Utilities.jsx`).
- `Admin/Utilities/MasterDirectory.jsx`, `Batches.jsx`, `StudentStatus.jsx`, `Backup.jsx`, `PendingFeesSetup.jsx`, `StudentProgression.jsx`.

**Backend**
- Utilities iterate classes/sections/students; no division-string hardcoding surfaced.

**Frontend**
- Utilities are CRUD operations on students/sections — multi-class safe by virtue of the data-driven pattern.

**Business Workflow**
1. Admin opens Utilities → picks a utility → operates on selected students/sections.

**Multi-Class Compatibility** 🟢

**Multi-Class Student** 🟢

**Existing Class Compatibility** 🟢

**Business Alignment** 🟢

**Required Action** 🟢 KEEP.

---

### Module 14 — PDFs / Exports

**Screens**
- Export endpoints triggered from reports pages (fee PDFs, attendance PDFs, roster CSV).
- Controller routes examined: `admin/reports/*`, `accountant/reports/*`, CSV exports from `students/data`.

**Backend**
- Export controllers iterate per-division / per-class; need to confirm no hardcoded "Gurmukhi / Kirtan" headers in PDF templates (this audit did not exercise the PDF templates end-to-end).

**Frontend**
- Export buttons are data-driven (call the API with whatever filter the user picked).

**Business Workflow**
1. Admin runs a report → clicks "Export PDF" → PDF is generated.

**Multi-Class Compatibility** 🟡
- **Caveat:** PDF/CSV headers may say "Gurmukhi" or "Kirtan" if the export code path branches on division. This needs a targeted check by reading the actual PDF/CSV code, which was not completed by the time this audit was finalized.

**Multi-Class Student** 🟡
- Same caveat.

**Existing Class Compatibility** 🟢

**Business Alignment** 🟡

**Required Action** 🟡
- **Verify PDF/CSV templates** for division-key string compares. The behavior is likely correct (titles come from `ucfirst($divisionKey)` or `divisionMeta`), but the audit recommends a one-shot verification pass before claiming full multi-class compatibility.

---

## 3. Cross-Module Problems

| # | Problem | Affected modules | Severity |
|---|---------|------------------|----------|
| 1 | **Accountant Students filter bar hardcodes two divisions** | Module 12 → cascades into Module 9 (accountant sees wrong students) | 🔴 Critical |
| 2 | **Stale comment** "guaranteed 'gurmukhi' or 'kirtan'" | Module 7 (StudentController.php:119) | 🟡 Minor |
| 3 | **PDF/CSV templates not audited** for division string compares | Module 14 | 🟡 Unknown until checked |
| 4 | ~~**No three-division feature test** for dashboard API + frontend button rendering~~ | **RESOLVED:** API side pinned by `DashboardDivisionsTest` (3 buckets + explicit seam + collapse) and `AdminDashboardCrossDivisionVisibilityTest` (top absentees / top pending fees / `divisions[]` includes music). Frontend Inertia page render + summary endpoint together pinned by `tests/Feature/AdminDashboardThreeDivisionRenderTest.php` — closes the page-level gap that `AdminPageSmokeTest` left open (it only exercised the dashboard with a single-class fixture). | 🟢 Fixed |
| 5 | ~~**Admin sidebar discoverability** for `/admin/classes` route~~ | **RESOLVED (B15):** the sidebar already exposed `<SidebarLink href="/admin/classes" label="Classes" />` (`AdminLayout.jsx:187`). Pinning test added so it can't silently disappear. | 🟢 Fixed |
| 6 | **Kirtan-specific UI gates** (lesson_learned, "Sundays only" pill, lesson-notes block) are string-compares against `'kirtan'` in the frontend | Modules 7, 8 | 🟢 Legitimate (these are Kirtan-only features by business design) |
| 7 | **Division label cosmetic** — `ucfirst($type)` in `DashboardController` works but the frontend `divisionMeta()` already does title-casing | Module 11 | ⚪ None |

---

## 4. Class Creation Gap

The B10 modal (`CreateClassModal`) is structurally complete. The remaining gaps are *operational*:

| # | Gap | Why it matters | Severity |
|---|-----|----------------|----------|
| ~~C1~~ | ~~No discoverable menu entry for `/admin/classes` in `AdminLayout` sidebar~~ | **RESOLVED (B15):** `resources/js/Layouts/AdminLayout.jsx:187` already ships `<SidebarLink href="/admin/classes" label="Classes" />`. `tests/Feature/AdminClassesSidebarLinkTest.php` pins it so a future refactor can't silently drop the entry. | 🟢 Fixed |
| C2 | Sections are edited per-class, not in a dedicated "Sections" admin surface | OK for two classes, friction at five | 🟡 UX |
| C3 | No way to *delete* a class through the UI (only soft edits) | **RESOLVED (B17):** `Route::delete('/admin/classes/{class}')` returns 422 if any `student_sections` row exists (active OR historical), matching the section.delete pattern at `routes/admin.php:464-470`. When no enrollments exist, the class cascades cleanly to its sections and fee rate periods via the existing FK cascadeOnDelete. Frontend `Delete` button in the new Actions column of `Admin/Classes/Index.jsx` uses the established `window.confirm()` + `router.delete()` + toast pattern (mirrors section delete). Pinned by `tests/Feature/AdminClassDeleteAndRenameTest.php`. | 🟢 Fixed |
| C4 | No way to *rename* a class through the UI | **RESOLVED (B17):** rename path at `routes/admin.php:337-345` updates only `name`. The `type` and `division` columns stay frozen at first-save values — a class cannot drift out of its bucket via rename, even if a client tries to inject a different `type` in the row payload. Pinned by `tests/Feature/AdminClassDeleteAndRenameTest.php` (cases 4, 6). | 🟢 Fixed |
| C5 | Division slug is auto-derived from name; admin cannot override (intentional) | If admin names class "Gurmukhi 2", division slug is `gurmukhi-2` — does not collide, but the title-cased label is "Gurmukhi 2" which may be confusing | 🟢 Documented behavior |
| C6 | No validation that the division slug doesn't collide with an existing one | Currently no collision because slug includes the suffix; safe | 🟢 Safe |
| C7 | Kirtan-name path in the modal hardcodes Sunday-only + no-monthly-fee defaults | This is correct business behavior, not a bug — but worth documenting so a future admin who names a class "Sunday" doesn't accidentally get Kirtan defaults | 🟢 Documented |

**Critical question for next stage:** *Is there an admin who, today, can independently create a new class end-to-end without code help?* The answer is **yes for the create path**, **partially for sections (must find the per-class edit page)**, **no for delete/rename**. A small admin-tooling sprint (C1–C4) would close the loop.

---

## 5. Business Workflow Gaps

These are *workflow* issues, not code issues. They are surfaced for the next planning round.

1. ~~**No "division" concept in admin mental model.** Admins think in "classes"; the codebase now thinks in "divisions + classes". There's no admin-facing page that lists *divisions* — only *classes*. A division is a derived concept.~~ **RESOLVED (Sprint 6.4 / L-1):** new `/admin/divisions` page (`Admin/Divisions/Index.jsx`) lists every division with its business-rule summary. See §6 L-1.
2. ~~**No color legend.** The Stage B4 palette gives Music an emerald color, but no admin page tells you "emerald = Music". Color is per-tab/button only.~~ **RESOLVED (Sprint 6.4 / L-3):** `DivisionLegend` component renders swatch+label per division. See §6 L-3.
3. ~~**No cross-division reports.** There's no "all divisions in one PDF" view — every report is single-division. Whether this is intentional or a gap is a product question.~~ **RESOLVED (Sprint 6.4 / L-2):** "All Classes" quick-pick on Fees + Attendance Reports; `division='all'` on Student Report Center; Accountant Students index is cross-division by default. See §6 L-2.
4. ~~**Accountant workflows assume two divisions.** The "Students" filter bar (gap #1 above) is the symptom; the root cause is the accountant page treats divisions as static, not dynamic.~~ **RESOLVED (B12):** `Accountant/Students.jsx` filter bar is data-driven via `DivisionTypeResolver`. Pinned by `tests/Feature/AccountantStudentsFilterTest.php`.
5. **No way to see "what business rules are unique to Kirtan" from the admin UI.** The Kirtan Sunday-only rule, the kirtan-score column, and the lesson-notes block are scattered. A "division settings" view would surface them, but L-1 now covers the section/attendance/day-rule rollup. The kirtan-score column + lesson-notes block are still scattered across the per-class student pages, but those are domain fields, not division metadata.

---

## 6. Implementation Priority

### 🔴 CRITICAL (must fix before declaring multi-class production-ready)
- **C-1** Replace the Accountant Students filter bar (`Accountant/Students/StudentsFilterBar.jsx`) with a data-driven list sourced from the resolver's division output. Either render one button per division or a single "All" button.

### 🟠 HIGH (ship in same sprint as C-1)
- **H-1** Audit PDF/CSV export templates for division-string compares; fix any that leak hardcoded "Gurmukhi"/"Kirtan" headers.
- **H-2** Add a three-division feature test for `DashboardController::summary` + a Playwright/Dusk assertion that the dashboard renders three division buttons.
- **H-3** Update stale comment in `StudentController.php:119` ("guaranteed 'gurmukhi' or 'kirtan'").

### 🟡 MEDIUM (next sprint, nice-to-have)
- ~~**M-1** Add admin sidebar entry for `/admin/classes` in `AdminLayout`.~~ **RESOLVED (B15):** already present at `resources/js/Layouts/AdminLayout.jsx:187`. See C1 above.
- **M-2** ~~Add admin "delete class" and "rename class" workflows.~~ **RESOLVED (B17):** See §4 C3, C4 above. New `Route::delete('/admin/classes/{class}', ...)` returns 422 if any `student_sections` row exists (active OR historical), matching the section.delete pattern at `routes/admin.php:464-470`. Rename policy: lock-the-bucket — `name` is mutable, `type` and `division` columns stay frozen at first-save values; pinned at `routes/admin.php:337-345` and `tests/Feature/AdminClassDeleteAndRenameTest.php`.
- ~~**M-3** Document the auto-derive rule for division slug + the Kirtan-name snap behavior in the admin user guide.~~ **RESOLVED (B16):** see `docs/08-business-rules.md` §8.16. Documents the slug rule (`Str::slug($name)` → both `type` and `division`, empty-slug fallback to `'class'`) and the Kirtan-name snap (`name === 'kirtan'`, case-insensitive, pre-fills Sunday-only + no monthly fees). Pins the four edge cases the audit's C5/C7/M-3 call out: empty-slug fallback, case-insensitive Kirtan snap, "Kirtan Advanced" trap (only exact `'kirtan'` snaps), `'Sunday'` non-snap.

### 🟢 LOW (backlog, not blocking)
- ~~**L-1** Admin "division settings" page that lists every division with its business-rule summary (Kirtan Sunday-only, etc.).~~ **RESOLVED (Sprint 6.4):** new `/admin/divisions` page reads through `DivisionController::buildDivisions()` which buckets every class via `DivisionTypeResolver::division()` and rolls up per-division business rules (attendance_days union, charges-fees flag, fee min/max range, class/section/student counts). Sidebar link added at `resources/js/Layouts/AdminLayout.jsx:188`. Pinned by `tests/Feature/AdminDivisionsPageTest.php` (5 cases including the three-division bucket and per-division business-rule rollup).
- ~~**L-2** Cross-division reports (one PDF, all divisions).~~ **RESOLVED (Sprint 6.4):** Fees + Attendance Reports already accept an arbitrary `class_ids[]` list — adding an "All Classes" quick-pick button to both pages (`resources/js/Pages/Admin/Reports/Index.jsx`, `resources/js/Pages/Admin/Reports/Attendance.jsx`) gives an admin a one-click cross-division view that fans out across every division the school has. Student Report Center's `division='all'` already iterates every division the student is enrolled in (covered by `MultiClassDivisionReportTest`); the cross-division contract is pinned by `tests/Feature/CrossDivisionReportsTest.php`. Accountant Students index is also cross-division by default (no server-side division filter — frontend `classFilter` drives per-row scoping); pinned by `tests/Feature/CrossDivisionReportsTest.php` (case 4).
- ~~**L-3** Color legend for non-Gurmukhi/Kirtan divisions.~~ **RESOLVED (Sprint 6.4):** new `resources/js/Components/DivisionLegend.jsx` component takes a `divisions` array and renders one swatch+label per division using the `divisionMeta(key)` palette (`utils/divisionType.js`). Slotted into the Admin Dashboard next to the division-pill row; also prepended to the `/admin/divisions` page. Pure read-only component — no business-logic affordance, just the "emerald = Music" affordance the audit's gap #2 calls out.

---

## 7. Final Stage B Map (Reordered by Audit Findings)

This is the **next** implementation map. It supersedes the original B1–B10 ordering where the audit reveals that operational UX gaps outrank the next layer of plumbing.

| # | Item | Origin | Depends on |
|---|------|--------|------------|
| **B12** | Data-driven Accountant Students filter bar (resolves 🔴 Critical) | Module 12 | None — `DivisionTypeResolver` already returns the division list |
| **B13** | PDF/CSV export template audit + fixes | Module 14 | None |
| **B14** | Three-division feature tests (dashboard + accountant students + student center) | Modules 7, 11, 12 | B12 (for accountant side) |
| **B15** | Admin sidebar discoverability + delete/rename class | Module 1, §4 C1–C4 | None |
| **B16** | Documentation pass — stale comment fix + admin guide updates | Modules 1, 7 | None |
| ~~B11~~ | ~~(Already shipped — graphify + regression)~~ | Done | — |

> **Note:** The original B1–B10 plan remains the foundation; nothing in this audit suggests reverting any of those decisions. The reorder above only adds *operational* work that the original plan did not anticipate.

---

## 8. Regression Requirements

These must continue to work after any Stage B+ change. Each row names the specific assertion that proves the regression check passed.

### Gurmukhi alone
- Existing Gurmukhi rows preserve `type='gurmukhi'` and (where set) `division='gurmukhi'`.
- `DivisionTypeResolver::division('gurmukhi', 'Beginner', null)` returns `'gurmukhi'`.
- Dashboard still shows a Gurmukhi button.
- Admin fees still produce per-student Gurmukhi monthly fees at the configured amount.

### Kirtan alone
- Existing Kirtan rows preserve `type='kirtan'` (and `division='kirtan'` where set).
- `DivisionTypeResolver::division('kirtan', 'Kirtan', null)` returns `'kirtan'`.
- `ClassSchedule::attendanceDays()` returns `[0]` for a Kirtan row.
- `ClassSchedule::chargesMonthlyFee()` returns `false` for a Kirtan row by default.
- Attendance dashboard shows Kirtan students only on Sundays.
- Student Show page renders "Sundays only" pill on the Kirtan tab.
- Student Report Center renders the `KirtanSection` (lesson notes + kirtan score) for Kirtan students only.
- Monthly fee generation does **not** create fee rows for Kirtan students (no monthly fee).

### Multi-class student (Gurmukhi + Kirtan)
- Student has two `student_sections` rows.
- `MonthlyFeeService` creates one Gurmukhi fee row, zero Kirtan fee rows.
- Student Show page renders two tabs.
- Student Report Center renders per-division attendance and fee sections.

### Multi-class student (Gurmukhi + Music)
- Same as above; second tab is "Music" with palette-driven color.
- Music monthly fee rows are created only if `charges_monthly_fee=true` on the Music class row.

### New class end-to-end (Music)
- Modal path: admin names "Music", toggles Mon-Sat attendance, enables monthly fee at Rs. 500 → row is persisted with `division='music'`, `attendance_days=[1..6]`, `charges_monthly_fee=true`, `default_monthly_fee=500`.
- Dashboard renders a "Music" button with a palette-driven color.
- Admin Students filter dropdown lists Music as a class filter.
- Admin Fees page lists Music in the per-class-type summary blocks.
- A student enrolled in Music gets a Music attendance row on Mon-Sat only, never on Sundays.
- A student enrolled in Music gets a Music monthly fee row each month.

### Inline-row legacy path
- "+ Add Class" inline row (no modal) still creates a class with `attendance_days=[1..6]`, `charges_monthly_fee=false`, `default_monthly_fee=0`. This is the **explicitly preserved** backward-compatible path.

### Auth/Profile (pre-existing)
- The 11 known failing tests in `tests/Feature/ProfileTest.php` are not in scope for Stage B and remain at baseline.

---

## 9. Stop Point

Per the explicit instruction: **DO NOT IMPLEMENT ANYTHING YET.** This audit documents the workflow state, identifies the single critical gap (Accountant Students filter bar), and proposes the next-stage implementation map (B12–B16). Awaiting approval before any code changes are made.
