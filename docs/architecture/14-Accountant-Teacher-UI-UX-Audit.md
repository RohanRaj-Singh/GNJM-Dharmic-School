# Accountant & Teacher UI/UX Audit — Cross-Division Hardcoding & Redesign Map

**Branch:** `refactor/architecture`
**Date:** 2026-08-15
**Scope:** End-to-end review of every non-admin screen (Accountant + Teacher + shared Attendance surfaces consumed by both roles) against two questions:
1. **What is hardcoded UI/UX?** — string gates, color choices, copy, layout assumptions that silently break once a third+ division enters the school.
2. **What needs to be redesigned or updated** to honor the Stage A/B seams (resolver, divisionMeta, isAttendanceDay, attendance_days_effective) and the new admin-facing surfaces (Division Settings page, Cross-Division Reports, Color Legend) shipped in Sprint 6.4 (commit `9d8c17d`).

**Method:** Direct read of every Inertia page under `resources/js/Pages/Accountant/**`, `resources/js/Pages/Teacher/**`, the shared `resources/js/Pages/Attendance/**`, the mobile layout (`SimpleLayout`), and the supporting utils / components. Cross-referenced against the actual route list (`php artisan route:list`).

**Ground rule:** AUDIT ONLY. No code, copy, layout, or behavior was changed. The recommendations at the end are the *next* map, not the executed plan.

---

## 1. Executive Summary

### Verdict legend
- 🟢 **KEEP** — already correct against Stage A/B seams, do not touch.
- 🟡 **MINOR CHANGE** — small surgical fix (one button, one badge color, one comment).
- 🟠 **REDESIGN** — needs a dedicated refactor (page-level rework, not just a string swap).
- 🔴 **BROKEN** — link/route does not exist; clicking it lands on a 404 / Inertia error.
- ⚪ **NOT APPLICABLE** — page is a trivial re-export or dead placeholder.

### Bottom line

| Severity | Count | Examples |
|---|---|---|
| 🔴 BROKEN | 2 | `Accountant/Dashboard.jsx:31` → `/accountant/attendance`; `Accountant/AttendanceSections.jsx:45` → `/accountant/attendance/sections/...` |
| 🟠 REDESIGN | 5 | `Attendance/Sections.jsx` (hardcoded pills + naive day-rule fallback), `Accountant/Dashboard.jsx` (no division legend), `Teacher/Dashboard.jsx` (no role-tailoring), `Attendance/Dashboard.jsx` (single-card dead-end), `Accountant/LateFees/LateFeesSectionCard.jsx` (placeholder text passed as `emoji`) |
| 🟡 MINOR CHANGE | 11 | `StudentsList.jsx` badge color, `AttendanceStudentCard`/`AttendanceRecordCard` lesson-note color, `ReceiveFee.jsx` date constraint, `LateFeesFiltersPanel` class filter by ID not name, etc. |
| 🟢 KEEP | 4 | `Accountant/Students/StudentsFilterBar.jsx`, `Accountant/Students/utils.js`, `LateFees/LateFees/utils.js` (data plumbing), `divisionType.js`, `attendanceDays.js` |
| ⚪ N/A | 3 | `Accountant/Attendance.jsx` + `Teacher/Attendance.jsx` (re-exports), `Accountant/Reports.jsx` (dead placeholder) |

### The two failures that block day-to-day work today

1. **Broken link on the Accountant dashboard** (`Accountant/Dashboard.jsx:31`). The "Attendance" card points to `/accountant/attendance` but the only attendance routes are global (`/attendance/sections`, `/teacher/attendance/sections`) or teacher-namespaced. Clicking it produces a 404 / Inertia error.
2. **Hardcoded filter pills silently drop the third+ division** in `Attendance/Sections.jsx:75-82` and `Accountant/AttendanceSections.jsx`. The default state is `"gurmukhi"`, the pills are a hardcoded two-item array, and a third+ division is *not in the filter set at all* — there is no UI to even toggle it on. An accountant who opens attendance on a Tabla-only class sees nothing.

### The redesign candidates (in priority order)

1. **Fix `/accountant/attendance` link** (🔴) — point the dashboard card at `/attendance/sections` (the existing global route). One-line fix, but the symptom is "the whole attendance workflow is unreachable from the accountant dashboard".
2. **Remove hardcoded pills from `Attendance/Sections.jsx` + delete `Accountant/AttendanceSections.jsx`** (🟠) — the shared page already supports per-role pills via a `divisions` prop from the backend; the dedicated accountant file is a duplicate that hardcodes the two-division contract.
3. **Add division color legend to the accountant dashboard** (🟡) — mirrors the admin sidebar color legend shipped in Sprint 6.4 L-3 so accountants know what color Music vs Tabla actually means before they click into a list.
4. **Delete `Accountant/Attendance.jsx` + `Teacher/Attendance.jsx` re-export wrappers** (⚪) — they exist solely to re-export `Attendance/Dashboard.jsx`. The route handler can resolve the shared component directly.
5. **Decide on `Accountant/Reports.jsx`** (⚪) — it's a `<div>Reports will be here</div>` placeholder. Either implement it or delete it.
6. **Replace `isKirtan` prop on `AttendanceStudentCard` / `AttendanceRecordCard`** with `divisionMeta(key)` (🟡) — the lesson-notes block is purple today because someone wrote `isKirtan` literally. The right seam is "this division has lesson notes" → check via `divisionMeta(divisionKey).hasLessonNotes` (a future field), not by color.
7. **Constrain `ReceiveFee.jsx` `collection_date`** to ≤ today (🟡) — a typo of next month's date silently creates a future-dated payment.

---

## 2. Per-Page Audit — Accountant Screens

### 2.1 `Accountant/Dashboard.jsx` — 🟠 REDESIGN

**Route:** `GET /accountant` → `accountant` (named)
**Layout:** `SimpleLayout` (mobile-only)

**What it shows today**
- 4 `ActionCard`s in a 2x2 grid: Students, Absentees, Late Fees, Attendance.
- Each card is emoji + title + description.

**Hardcoded UI/UX problems**
- 🔴 **Broken link** at line 31: `href="/accountant/attendance"` — the route `accountant.attendance` does not exist (`php artisan route:list` confirms). Clicking it 404s.
- 🟡 **Inconsistent emoji**: 📋 (Students) / ❌ (Absentees) / ❗ (Late Fees) / 🕒 (Attendance). Late Fees uses a glyph with semantic variation selector; Absentees uses `❌` which reads as "error" not "absent". No icon system to enforce consistency.
- 🟡 **No division color legend** — admins get a legend in the sidebar (Sprint 6.4 L-3), accountants get nothing. A school with Gurmukhi + Kirtan + Tabla will see three colored badges elsewhere but the accountant dashboard doesn't explain the palette.
- 🟡 **`Late Fees` ActionCard** uses a hardcoded `highlight` prop (`bg-yellow-100`) — no relation to the division palette, just a manual accent.
- 🟠 **No role-tailoring** — same 4 cards for an accountant at a single-class school vs a multi-division school. Should collapse to 2 cards (Late Fees + Receive Fee) if only one division exists, expand when more exist.

**Redesign recommendations**
- Replace the broken `href="/accountant/attendance"` with `href="/attendance/sections"` (the existing global route — accountants are authed to it via the `auth` + role middleware in `routes/attendance.php`).
- Add a small division legend strip below the cards showing each active division with its `divisionMeta(key).color` swatch and label — same data source as the admin sidebar legend.
- Replace `❌` with `🚫` or `📭` for Absentees; replace `❗` with `⏰` for Late Fees. Or use the lucide-react icon set used in `AdminLayout` for consistency.
- Move the `Late Fees` `highlight` accent onto a proper "outstanding amount" badge driven by `lateFeesSummary.totalPending > 0`.

---

### 2.2 `Accountant/Students.jsx` — 🟢 KEEP (with minor sibling issues)

**Route:** `GET /accountant/students` → `accountant.students.index`
**Layout:** `SimpleLayout`

**What it shows today**
- Student list with a filter bar (`StudentsFilterBar`), list (`StudentsList`), and per-row division badge.
- Reads `divisions` array from the Inertia props; `StudentsFilterBar` renders a pill per division with `divisionMeta(key)` colors.

**Verdict**
- 🟢 The page itself is already data-driven and cross-division-aware (B12). Filter bar uses `divisionMeta(key)`. The backend (`AccountantStudentsController::index`) ships a `divisions` array built via the resolver — see [[cross-division-report-contract]].

**Hardcoded UI/UX problems in sibling files**
- 🟡 `Accountant/Students/StudentsList.jsx` — line ~70:
  ```jsx
  className={`px-2 py-1 rounded-full ${badge.isKirtan ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}
  ```
  Hardcoded purple/gray. Should use `divisionMeta(badge.division).bgColor` + `.textColor` from the utils file. (Confirmed: `utils.js`'s `getEnrollmentBadges` returns `{ isKirtan }` — the right fix is to also return `division` key so the row can look up the meta.)
- � `Accountant/Students/utils.js` — `getEnrollmentBadges` only computes `{ isKirtan: boolean }`. Should compute `{ division: key, hasLessonNotes: bool, color: ..., bgColor: ..., textColor: ... }` using `divisionMeta()`.

---

### 2.3 `Accountant/ReceiveFee.jsx` — 🟡 MINOR CHANGE

**Route:** `GET /accountant/receive-fee` + `POST /accountant/receive-fee` → `accountant.receive-fee` + `accountant.receive-fee.store`
**Layout:** `SimpleLayout`

**What it shows today**
- One collapse-section per division (`gurmukhi`, `kirtan`, etc.) via `divisionMeta(key)`. ✅ data-driven.
- Inside each section: per-student rows with checkboxes + amount input.
- Bottom: `collection_date` (defaults to today), "Total" sum, "Save Payment" button.

**Hardcoded UI/UX problems**
- 🟡 **`collection_date` has no max constraint** — accountant can pick a future date and the controller will accept it. Should be `max={today}` on the input + a validation rule on the backend (`before_or_equal:today`).
- 🟡 **Total amount disappears when no checkboxes are selected** — the layout collapses into a near-empty save bar. Should show a persistent "Select at least one student" hint or keep a `$0.00` placeholder so the form structure doesn't jump.
- 🟡 **`getTodayDateInput()` is recreated on every render** — minor perf nit, but moving it to a `useMemo` or computing it once at mount is the established pattern.

---

### 2.4 `Accountant/LateFees.jsx` — 🟠 REDESIGN (component-level)

**Route:** `GET /accountant/late-fees` → `accountant.late-fees`
**Layout:** `SimpleLayout`

**What it shows today**
- Top: `LateFeesFiltersPanel` with class filter (single-select), month filter, sort.
- Below: `LateFeesSectionCard` per class section, each showing "This Month" + "Older" buckets.

**Hardcoded UI/UX problems**
- 🟠 **`LateFeesSectionCard.jsx` accepts `emoji` prop, but the caller passes `"[This Month]"` / `"[Older]"`** — placeholder text strings used as if they were emoji. They render as literal `[This Month]` next to the title. This is a broken prop contract — either pass real emoji (`📅`, `📦`) or drop the prop and use an SVG icon.
- � **`LateFeesFiltersPanel.jsx` class filter built from class names** (via `utils.buildClassOptions`) — values are class-name strings, not class IDs. If two classes ever have the same name across divisions (theoretical but possible), they collide. Should ship class IDs.
- 🟡 **`utils.dedupeFeesByMonth` picks the highest amount per (student, month)** — for a student with both a "monthly fee" and a "late fee adjustment" on the same month, only the higher is shown. Intentional? The audit can't tell without reading the spec. **Flagged for product confirmation.**

---

### 2.5 `Accountant/Reports.jsx` — ⚪ NOT APPLICABLE (or 🔴 if kept)

**Route:** not routed (the file exists but no route references it).

**What it shows today**
```jsx
<div>Reports will be here</div>
```

**Verdict**
- ⚪ Dead file. Either implement (cross-division reports already exist at `/admin/reports/build`) or delete. Keeping it as a placeholder is misleading — a developer reading the Inertia components folder will assume it's a real page.

---

### 2.6 `Accountant/Attendance.jsx` — ⚪ NOT APPLICABLE

**File content (verbatim):**
```jsx
import AttendanceDashboard from "@/Pages/Attendance/Dashboard";
export default AttendanceDashboard;
```

**Verdict**
- ⚪ Trivial re-export wrapper. Adds no value over importing `Attendance/Dashboard` directly in the route handler. **Delete the file and the import in the route definition.**

---

### 2.7 `Accountant/AttendanceSections.jsx` — 🟠 REDESIGN (full delete candidate)

**Route:** not routed (file exists; verified by grep that no route references `Accountant/AttendanceSections`).

**What it shows today**
- Hardcoded filter state:
  ```jsx
  const [classFilter, setClassFilter] = useState("gurmukhi");
  ```
- Two hardcoded pills: Gurmukhi + Kirtan (rendered as buttons with no other options).
- Default state = `"gurmukhi"` silently drops Kirtan students and *any third+ class*.

**Hardcoded UI/UX problems**
- 🔴 **Hardcoded 2-division contract** — a Tabla-only class is invisible by default. The user has to know to manually edit the JSX to add a third pill, which means the page is *not* data-driven.
- 🟡 **Uses 2-arg `division(type, name)`** (not the 3-arg form with `explicitDivision`). The page will resolve a class to its bucket via name-matching rather than the explicit `classes.division` column. See [[class-rename-bucket-lock]] for why this is risky.
- 🔴 **Dead file** — not routed. Should be deleted; the work it tries to do is already correctly implemented in `Attendance/Sections.jsx`.

**Redesign recommendations**
- **Delete `Accountant/AttendanceSections.jsx`** entirely. The shared `Attendance/Sections.jsx` is the canonical page, and it already accepts role-aware props (the accountant pill branch at `Attendance/Sections.jsx:75-82` — which is itself a separate 🔴 problem, see §4.1).

---

### 2.8 `Accountant/Fees/Index.jsx` — 🟡 MINOR CHANGE (orphaned page)

**Route:** not routed from any visible nav.

**What it shows today**
- A read-only fees table per student with sort helpers (`toMonthValue`, `isPaid`, `getPaidAt`) defined inline.

**Hardcoded UI/UX problems**
- 🟡 **Sort helpers defined inline in the component** — should move to `utils.js` so other fee pages can share them.
- 🟡 **No division filtering** — a school with 3 divisions shows everything in one list.

**Verdict**
- ⚪ **Not linked from anywhere visible in the SimpleLayout or accountant dashboard.** Either link to it from the Students page ("View Fees" button per student) or delete.

---

## 3. Per-Page Audit — Teacher Screens

### 3.1 `Teacher/Dashboard.jsx` — � REDESIGN

**Route:** `GET /teacher` → `teacher.dashboard`
**Layout:** `SimpleLayout`

**What it shows today**
- 3 `ActionCard`s: Students, Absentees, Attendance.
- Uses **generic paths** (`/students`, `/attendance/absentees`, `/attendance`) — not role-prefixed (`/teacher/...`).

**Hardcoded UI/UX problems**
- 🟡 **Generic paths instead of role-prefixed** — relies on the global `/students` and `/attendance/absentees` routes being open to teachers. Confirmed via `routes/teacher.php`: teachers *do* have access via the shared routes, but the dashboard hides the namespacing. Inconsistent with the accountant-side `accountant.students.index` pattern.
- � **Inconsistent emoji**: 👨‍🎓 / ❌ / 🕒 (same "error" emoji issue as Accountant dashboard).
- 🟠 **No role-tailoring** — same cards regardless of how many sections the teacher owns. A teacher who only marks Gurmukhi gets the same dashboard as one who marks all three divisions.
- 🟡 **No division legend** (same issue as Accountant dashboard).

**Redesign recommendations**
- Switch `href="/students"` → `href="/teacher/students"` (route the equivalent in `routes/teacher.php`, or use `accountant.students.index` if cross-role read is acceptable — currently `routes/accountant.php` is accountant-only).
- Add the same division color legend strip proposed for `Accountant/Dashboard.jsx`.
- Tailor the cards: if the teacher only marks one division, the "Attendance" card should pre-filter to that division. (This requires the backend to return a `myDivisions` array on the dashboard payload — see §6.)

---

### 3.2 `Teacher/Attendance.jsx` — ⚪ NOT APPLICABLE

**File content (verbatim):**
```jsx
import AttendanceDashboard from "@/Pages/Attendance/Dashboard";
export default AttendanceDashboard;
```

**Verdict**
- ⚪ Same as `Accountant/Attendance.jsx` — trivial re-export. **Delete.**

---

## 4. Per-Page Audit — Shared Attendance Screens (consumed by Accountant + Teacher)

### 4.1 `Attendance/Sections.jsx` — 🟠 REDESIGN

**Route:** `GET /attendance/sections` → `attendance.sections`
**Layout:** `SimpleLayout`

**What it shows today**
- Lists sections grouped by division, with "Mark" + "History" links per row.
- For the **accountant role** specifically: a hardcoded 2-pill filter at lines 75-82:
  ```jsx
  {isAccountant && (
    <div className="flex gap-2 mb-4">
      <PillButton active={classFilter === "gurmukhi"} onClick={() => setClassFilter("gurmukhi")} color="blue">Gurmukhi</PillButton>
      <PillButton active={classFilter === "kirtan"} onClick={() => setClassFilter("kirtan")} color="purple">Kirtan</PillButton>
    </div>
  )}
  ```
- Default state for accountants: `useState("gurmukhi")`.
- `canMarkToday()` (the day-rule check) has a fallback: when `attendance_days_effective` is missing on the section payload, it falls back to `division() === "kirtan"`.

**Hardcoded UI/UX problems**
- 🔴 **Hardcoded 2-pill filter for accountants** — a third+ division has no pill at all. The shared `divisions` array (already on the Inertia props for the admin sidebar legend) should drive this.
- 🔴 **Default state `"gurmukhi"`** silently drops Kirtan students *and* any third+ class.
- 🟠 **`canMarkToday()` fallback to naive `division() === "kirtan"`** — if the backend didn't ship `attendance_days_effective`, the page decides "Sunday" by string compare. The right seam is `isAttendanceDay(attendance_days, today)` with `attendance_days` read from `ClassSchedule`. The fallback path also bypasses the 3-arg `division()` form (no `explicitDivision`), which means a renamed class could be misclassified — see [[class-rename-bucket-lock]].
- 🟡 **`PillButton` color hardcoded to "blue" / "purple"** — should use `divisionMeta(key)` palette so a third+ pill picks up its deterministic color.
- 🟡 Uses 2-arg `division(type, name)` — should be 3-arg `division(type, name, explicitDivision)` to read the explicit bucket first.

**Redesign recommendations**
- Replace the hardcoded 2-pill block with a `divisions.map(key => <PillButton color={divisionMeta(key).color}>...)`. Remove `useState("gurmukhi")` — default to `"all"` or to the first division in the prop array.
- Drop the `canMarkToday()` fallback; always read `attendance_days_effective` from the payload. If the seam is missing, treat the section as not-markable-today (fail closed) rather than guessing Kirtan.
- Wire the backend (`AttendanceController::sections`) to ship `divisions` array on the Inertia props (mirroring the admin division legend payload).

---

### 4.2 `Attendance/Mark.jsx` — 🟡 MINOR CHANGE

**Route:** `GET /attendance/sections/{section}` → `attendance.mark` (via `attendance.sections.show` or similar)
**Layout:** `SimpleLayout`

**What it shows today**
- Per-student card with present / absent / leave buttons + optional lesson-notes block.
- Lesson notes only render when `isKirtan` is true.

**Hardcoded UI/UX problems**
- 🟡 **`isKirtan = resolveIsKirtan(section.school_class?.type, section.school_class?.name)`** uses the 2-arg helper — should be 3-arg with `section.school_class?.division` as the explicit param. (See [[class-rename-bucket-lock]].)
- 🟡 **Lesson-notes block gated on `isKirtan` literal** — fine as a business rule (Kirtan alone has lesson notes today) but expressed as a string compare. The right seam is `divisionMeta(division).hasLessonNotes` — a future-configurable field — so a third+ division can opt into lesson notes without re-grepping the codebase.
- 🟡 **Defensive `parseLessonLearned`** handles boolean/number/string — fine as a safety net but suggests the upstream type isn't trusted. The backend (`POST /attendance/lesson-notes/{studentSection}`) should settle on one shape.

---

### 4.3 `Attendance/AttendanceMarkPage.jsx` + `Attendance/AttendanceSummaryPage.jsx` — 🟡 MINOR CHANGE

**What they show today**
- `Mark` page: full student cards via `AttendanceStudentCard` with `isKirtan` prop.
- `Summary` page: per-day record cards via `AttendanceRecordCard` with `showLesson` prop.

**Hardcoded UI/UX problems**
- � **`isKirtan` and `showLesson` boolean props** leak the Kirtan-specific lesson-notes rule out of the data layer. The cards should ask "does this section's division have lesson notes?" via a `divisionMeta(key).hasLessonNotes` lookup, not via a boolean the caller has to compute.
- 🟡 **Hardcoded purple** for the lesson-notes UI in both cards (`bg-purple-50 text-purple-700`) — should pull from `divisionMeta(key).accentColor`.

---

### 4.4 `Attendance/Dashboard.jsx` — 🟠 REDESIGN

**Route:** `GET /attendance` (via re-export `Accountant/Attendance.jsx` and `Teacher/Attendance.jsx`)

**What it shows today**
- A single `AttendanceCard` linking to "Mark Attendance".

**Hardcoded UI/UX problems**
- 🟠 **Single card, no role-tailoring** — same dead-end for accountant and teacher. The dashboard should branch:
  - For teacher: list their assigned sections with a "Mark" link per section.
  - For accountant: list all sections with a "Mark" + "View Absentees" pair per section, plus a division filter.
- 🟡 **No division legend** (same issue as the role dashboards).

---

### 4.5 `Attendance/Absentees.jsx` — 🟡 MINOR CHANGE

**Route:** `GET /attendance/absentees` → `attendance.absentees`
**Layout:** `SimpleLayout`

**What it shows today**
- Full-featured filter+sort+search page with `AbsenteesFiltersPanel`, `AbsenteesStudentList`, `TodayAbsenteesPanel`.
- 12 `useState` hooks for filters.

**Hardcoded UI/UX problems**
- 🟡 **12 separate `useState` hooks** — should be consolidated into a single `filters` reducer or a `useFilters` custom hook. Not a correctness bug, just maintenance debt.
- 🟡 **`hasActiveFilters` computed twice** (once in the panel, once in the parent). Should be a single shared selector.
- 🟡 **`AbsenteesStudentList.jsx`** has hardcoded red/yellow badges for "high absence rate" + "watchlist" — fine, but should source the threshold from a config, not a magic number.

---

### 4.6 `Attendance/Absentees/TodayAbsenteesPanel.jsx` — 🟡 MINOR CHANGE

**Hardcoded UI/UX problems**
- 🟡 **Hardcoded red** (`text-red-700`) for the "today absent" header — fine semantically but doesn't acknowledge the division context. A red row in the Kirtan column looks the same as a red row in Gurmukhi; should at minimum carry the division badge color so the eye can group rows by division.
- 🟡 **No division awareness** — a 3-division school sees one big red blob instead of three color-grouped red rows.

---

## 5. Per-Page Audit — Components & Layouts

### 5.1 `Components/AttendanceStudentCard.jsx` — 🟡 MINOR CHANGE

**Hardcoded UI/UX problems**
- 🟡 **`isKirtan` boolean prop** drives the lesson-notes block. Should be `divisionKey: string` + lookup via `divisionMeta(key)`.
- � **Hardcoded purple** for the lesson-notes section background.
- 🟡 **Hardcoded green/red/yellow** for present/absent/leave — fine semantically but should be sourced from a `STATUS_META` table like the division palette is.
- 🟡 **History accordion** uses raw `<details>` HTML element instead of the shared `Disclosure` component used in admin pages.

---

### 5.2 `Components/AttendanceRecordCard.jsx` — 🟡 MINOR CHANGE

**Hardcoded UI/UX problems**
- Same as `AttendanceStudentCard`: `showLesson` boolean prop, hardcoded purple lesson-notes block, hardcoded status colors.

---

### 5.3 `Components/AttendanceCard.jsx` — 🟢 KEEP

**Verdict**
- 🟢 Generic, props-only card. No division hardcoding.

---

### 5.4 `Components/FeeFilterSelect.jsx` — 🟢 KEEP

**Verdict**
- 🟢 React-select wrapper with multi/single modes + dedup. Data-agnostic.

---

### 5.5 `Layouts/SimpleLayout.jsx` — 🟡 MINOR CHANGE

**What it shows today**
- Mobile-only layout (`max-w-md`). Header with date + back/home emoji buttons (`←`, `🏠`).
- Logout + leave-page dialogs.

**Hardcoded UI/UX problems**
- 🟡 **Emoji back/home buttons** (`←`, `🏠`) — inconsistent with `AdminLayout`'s lucide-react icon system. Acceptable for a mobile layout (emoji render crisply on small screens), but a unified `<Icon name="back" />` would let a future theme change propagate.
- 🟡 **No division context** in the header — for an accountant or teacher who works across 3 divisions, the header date is the only context. Should optionally show the active division pill if the current route is filtered to one.
- 🟡 **Hardcoded `max-w-md`** — fine for mobile-first, but the layout should be reused on desktop for accountants at a desk. Use `md:max-w-2xl` to give a desktop browser more room.

---

## 6. Backend / Route Layer Audit

### 6.1 Routes

Verified via `php artisan route:list` on branch `refactor/architecture`:

| Path | Name | Status |
|---|---|---|
| `/accountant` | `accountant` | ✅ |
| `/accountant/late-fees` | `accountant.late-fees` | ✅ |
| `/accountant/receive-fee` | `accountant.receive-fee` | ✅ |
| `/accountant/students` | `accountant.students.index` | ✅ |
| **`/accountant/attendance`** | — | **❌ ROUTE MISSING** (file `Accountant/Dashboard.jsx:31` links here) |
| `/teacher` | `teacher.dashboard` | ✅ |
| `/teacher/attendance/sections` | `teacher.attendance.sections` | ✅ |
| `/teacher/attendance/sections/{section}` | `teacher.attendance.mark` | ✅ |
| `/attendance` | `attendance.dashboard` | ✅ |
| `/attendance/sections` | `attendance.sections` | ✅ |
| `/attendance/sections/{section}` | `attendance.mark` | ✅ |
| `/attendance/absentees` | `attendance.absentees` | ✅ |
| `POST /attendance` | `attendance.store` | ✅ |
| `/attendance/lesson-notes/{studentSection}` | `attendance.lesson-notes.store` | ✅ |

**Findings:**
- 🔴 **`/accountant/attendance` route is missing.** Either add it (mirroring `/teacher/attendance/sections`) or change `Accountant/Dashboard.jsx:31` to point to the existing `/attendance/sections`.
- 🟡 **`/teacher/attendance` (the dashboard re-export)** is routed; `Accountant/Attendance.jsx` exists as a file but is *not* routed — orphan file.
- 🟡 **`Accountant/Reports.jsx`** exists as a file but is not routed — orphan file.

### 6.2 Controllers

| Controller | Status |
|---|---|
| `App\Http\Controllers\Accountant\AccountantStudentsController` | 🟢 already cross-division (B12 + Sprint 6.4 L-2) |
| `App\Http\Controllers\Accountant\LateFeeSummaryController` | � ships `class` as class name string (not ID) — `LateFees` UI is keyed off this |
| `App\Http\Controllers\Accountant\AttendanceSummaryController` | � **exists but is NOT routed** (orphan). Cross-division-by-default contract noted in [[cross-division-report-contract]] §6 L-2 |
| `App\Http\Controllers\AttendanceController` | 🟡 `sections()` should be enriched to ship `divisions` array on the Inertia props (currently doesn't) |
| `App\Http\Controllers\Teacher\TeacherDashboardController` (if any) | 🟡 no `myDivisions` payload — see §3.1 |

### 6.3 Utils

| File | Status |
|---|---|
| `resources/js/utils/divisionType.js` | 🟢 correct — 3-arg `division()`, `isKirtan()`, `isGurmukhi()`, `divisionMeta()` with `LEGACY_META` + `PALETTE` |
| `resources/js/utils/attendanceDays.js` | 🟢 correct — `isAttendanceDay()`, `attendanceDaysLabel()`, `DEFAULT_DAYS`, `DAY_NAMES` |

---

## 7. Cross-Cutting Redesign Recommendations

### 7.1 The "hardcoded 2-pill filter" anti-pattern

The single most common UI defect across the audit is the hardcoded 2-pill filter (Gurmukhi + Kirtan). It appears in:
- `Accountant/AttendanceSections.jsx` — default `"gurmukhi"`, 2 pills.
- `Attendance/Sections.jsx:75-82` — same pattern, accountant-only branch.
- (Implicit) `Teacher/Dashboard.jsx` — uses generic paths, not a filter at all.

**The canonical pattern** is: backend ships `divisions: [{key, label, color}]` on the Inertia props; the page maps that array into `<PillButton color={d.color} key={d.key}>{d.label}</PillButton>`. No JSX change needed to add a third+ division — just one new row in the database + a `classes.division` value.

### 7.2 The "Kirtan has lesson notes" business rule

Expressed today as `isKirtan` boolean prop on 3 components (`AttendanceStudentCard`, `AttendanceRecordCard`, `AttendanceMarkPage`) + the explicit `lesson_learned` check on the backend.

**The canonical pattern** is: `divisionMeta(key).hasLessonNotes: bool` — a future-configurable field. For now, `LEGACY_META['kirtan'].hasLessonNotes = true` and all others `false`. Components ask "does this division have lesson notes?" via the meta, not by string compare. When a new division opts in (e.g. Music wants progress notes), one config change and every card picks it up.

### 7.3 The "broken link / orphan file" hygiene

Three issues of the same shape:
- `Accountant/Dashboard.jsx:31` → `/accountant/attendance` (route doesn't exist)
- `Accountant/Attendance.jsx` — file exists, route doesn't reference it
- `Accountant/AttendanceSections.jsx` — file exists, route doesn't reference it
- `Accountant/Reports.jsx` — file exists, route doesn't reference it
- `Accountant/Fees/Index.jsx` — file exists, no nav links to it

**The fix**: a CI lint that runs `php artisan route:list` and greps each Inertia page's path to confirm a route exists. Or, lighter: add a `phpunit` feature test that boots every Inertia component and asserts it can resolve. Both are out of scope for this audit but should be a Stage C follow-up.

### 7.4 The division color legend

Sprint 6.4 L-3 added a division color legend to the admin sidebar. Accountants and teachers do not see one. **Recommendation**: extract the legend into a shared `<DivisionLegend divisions={...} />` component, render it in:
- `AdminLayout.jsx` (already there)
- `SimpleLayout.jsx` (new — collapsible footer or header pill row)
- `Accountant/Dashboard.jsx` (new — strip below the action cards)
- `Teacher/Dashboard.jsx` (new — same)

### 7.5 The `Date` constraint pattern

`Accountant/ReceiveFee.jsx` accepts any date for `collection_date`. Several other forms (Late Fees month filter, Absentees date range) have similar constraints. **Recommendation**: a shared `<DatePicker max={today} />` wrapper that enforces the no-future rule at the input level + a backend `before_or_equal:today` validation rule.

---

## 8. Suggested Priority Order

| # | Fix | Severity | Effort | Why this order |
|---|---|---|---|---|
| 1 | Replace `Accountant/Dashboard.jsx:31` link from `/accountant/attendance` → `/attendance/sections` | 🔴 | 1 line | Day-1 bug; every accountant hits it on first login |
| 2 | Delete `Accountant/AttendanceSections.jsx` (orphan + hardcoded 2-pill anti-pattern) | 🟠 | file delete + audit removal | Removes the worst duplicate |
| 3 | Generalize `Attendance/Sections.jsx` hardcoded pills to `divisions.map()` | 🟠 | ~20 lines + tests | Unlocks any third+ class for the accountant attendance flow |
| 4 | Delete `Accountant/Attendance.jsx` + `Teacher/Attendance.jsx` re-export wrappers | ⚪ | 2 file deletes + route update | Pure cleanup |
| 5 | Add division color legend strip to `SimpleLayout` | 🟡 | new component + 1 hookup | Establishes the visual contract for non-admin users |
| 6 | Replace `isKirtan` prop on `AttendanceStudentCard`/`AttendanceRecordCard` with `divisionMeta(key).hasLessonNotes` | � | refactor 2 components + propagate through `Mark.jsx`/`Summary` | Removes Kirtan-as-string-gate from the component layer |
| 7 | Fix `Accountant/Students/StudentsList.jsx` hardcoded purple/gray badge → `divisionMeta(key)` | � | ~5 lines + utils tweak | Visible regression today |
| 8 | Add `max={today}` to `ReceiveFee.jsx` `collection_date` + backend validation | 🟡 | 1 input attr + 1 validation rule | Data integrity |
| 9 | Fix `LateFeesSectionCard.jsx` placeholder text-as-emoji (`"[This Month]"`) → real icon or drop prop | 🟠 | ~10 lines | Looks broken to the user |
| 10 | Decide on `Accountant/Reports.jsx` (implement or delete) | ⚪ | depends | Closes an orphan |
| 11 | Switch `LateFeesFiltersPanel` class filter from name-based to ID-based | 🟡 | utils + filter panel | Hygiene for any future name-collision |
| 12 | Switch `Attendance/Sections.jsx` + `Mark.jsx` from 2-arg `division()` to 3-arg with explicit `classes.division` | 🟡 | grep + replace | Honors the [[class-rename-bucket-lock]] invariant |
| 13 | Add `myDivisions` to teacher dashboard payload + tailor `Teacher/Dashboard.jsx` | 🟠 | controller + page | Unlocks per-role UX |
| 14 | Generalize `Attendance/Dashboard.jsx` into role-aware tiles | 🟠 | ~30 lines | The shared attendance "front door" should branch by role |
| 15 | Consolidate `Attendance/Absentees.jsx` 12 `useState` hooks into a reducer | 🟡 | refactor | Maintenance, not user-facing |

---

## 9. What this audit does NOT cover

- **Admin screens** — already covered by `docs/architecture/13-Module-By-Module-Business-Workflow-Audit.md` (admin modules 1–N).
- **Backend service layer for late fees / fees / attendance** — services are covered in 13. The UI plumbing is the gap.
- **Mobile-specific UX testing** — no real device runs were performed. The `SimpleLayout` is mobile-first by design; if a future requirement is "accountant works equally well on a 13" laptop", that's a layout-level decision out of scope here.
- **Accessibility** — no a11y pass was performed. The hardcoded emoji icons and color-only division badges are likely WCAG-failing (color contrast on palette-derived colors isn't audited). **Flagged for a future Stage C accessibility audit.**
- **i18n** — every copy string is English. No localization surface was reviewed.

---

## 10. Memory / Graph

- Run `graphify update .` after any change here so the graph reflects the new findings.
- Memory notes saved alongside this audit: [[cross-division-report-contract]] (already exists), [[admin-divisions-page]] (already exists), [[class-rename-bucket-lock]] (already exists).
- New memory note candidate: `accountant-teacher-hardcoded-pills` — pin the "backend ships `divisions[]` array, page maps to pills" canonical pattern so future accountants/teacher pages don't re-introduce the hardcoded 2-pill anti-pattern.

---

## 11. Related Documents

- [[13-Module-By-Module-Business-Workflow-Audit|docs/architecture/13-Module-By-Module-Business-Workflow-Audit.md]] — the admin-side companion; defines the seams this audit expects to be honored.
- [[08-business-rules|docs/08-business-rules.md]] — the canonical place for the "Kirtan has lesson notes" rule + the cross-division contract.
- `resources/js/utils/divisionType.js` — `division()`, `divisionMeta()`, `isKirtan()`, `isGurmukhi()` seams.
- `resources/js/utils/attendanceDays.js` — `isAttendanceDay()`, `attendanceDaysLabel()` seams.
- `app/Support/DivisionTypeResolver.php` — backend resolver seam (3-arg `division()`).
