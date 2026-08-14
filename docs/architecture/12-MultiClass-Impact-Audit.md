# Multi-Class Impact Audit & Implementation Plan

**Date:** 2026-08-14
**Branch:** `refactor/architecture`
**Status:** AUDIT ONLY — nothing in this document is implemented. No DB change, no behavior change, no code modified.
**Review (2026-08-14):** Approved as the foundation, with one adjustment — execution is split into
**Stage A (structural multi-class)** then a **client-decision gate** then **Stage B (per-module)**.
New-class creation UI is deliberately LAST. See §12.
**Goal:** allow additional classes to exist WITHOUT disturbing the existing Gurmukhi/Kirtan system — backward compatible, minimal risk, parallel to today's behavior.

---

## Executive summary (read this first)

The database **already accepts** a third class. `classes.type` is a free-text string
(`database/migrations/2025_12_24_135759_create_classes_table.php:13` — the `// gurmukhi | kirtan`
comment is documentation only, there is no enum or check constraint). Adding a class today is a
one-line INSERT. Nothing in the schema forbids it.

**The entire two-class assumption lives in application logic**, in one root cause with three
manifestations:

1. **A silent resolver default.** `DivisionTypeResolver::division()` returns `'gurmukhi'` for
   *any* unknown class type (`app/Support/DivisionTypeResolver.php:45`) — and a duplicate,
   name-only heuristic in `routes/accountant.php:86-94`. Any third class created today is
   silently swallowed into the Gurmukhi bucket.
2. **Two closed enumerations.** A PHP enum with exactly two cases
   (`app/Support/StudentReport/Enums/Division.php:13-14`) and fixed two-key maps in the report
   service (`StudentReportService.php:75-83`) and dashboard (`DashboardController.php:109`).
3. **Fixed two-section/filter UIs.** Fees index, receive-fee, student report center, student
   show tabs, progression labels — each renders exactly "Gurmukhi" + "Kirtan" and would hide,
   merge, or mislabel a third class.

The genuinely Kirtan-specific business rules (**Sunday-only attendance, Kirtan excluded from
monthly fees, `kirtan_score`**) are NOT part of the problem. They must stay. The plan is
additive only: an explicit `division` on the class, resolver fallback preserved, all existing
inputs returning byte-identical results to today.

**Risk: MEDIUM–HIGH** to implement (many small files, one enum, report structure), **LOW to ship**
if Stage A1 characterization tests are written first.

---

## 1. Full inventory — every place with two-class logic

### 1.1 Backend — canonical resolver & structural enums

| File:Line | What it does |
|---|---|
| `app/Support/DivisionTypeResolver.php:30-55` | Canonical resolver. Order: type∋kirtan → type∋gurmukhi → name∋kirtan (legacy) → **else `'gurmukhi'`**. `isKirtan()`/`isGurmukhi()` = equality against the two strings. |
| `app/Support/StudentReport/Enums/Division.php:13-14` | **Closed 2-case enum** `Gurmukhi`, `Kirtan`. |
| `app/Support/StudentReport/NormalizeDivision.php:5-25` | `Division::from(DivisionTypeResolver::division(...))` — **throws `ValueError` if the resolver ever returns a third string.** |
| `app/Support/StudentReport/StudentReportRequest.php:28-29,61` | `DIVISION_GURMUKHI`/`DIVISION_KIRTAN` constants; validation `in:all,gurmukhi,kirtan` — a third division cannot even be requested. |
| `app/Support/StudentReport/DivisionReport.php:23,35` | DTO with nullable `KirtanScore` ("Kirtan only") — layout assumes kirtan is the special one. |
| `resources/js/utils/divisionType.js:19-35` | Frontend twin of the resolver, same `→ 'gurmukhi'` fallback. |

### 1.2 Backend — consumers of the resolver (grouped by subsystem)

**Attendance (binary day rule):**
- `routes/attendance.php:58-75` — Sunday ⇒ Kirtan-only; non-Sunday ⇒ Gurmukhi-only; redirects with an error otherwise.
- `app/Http/Controllers/Admin/AdminAttendanceController.php:53-68,101` — `$isKirtan`, `$enabled = $isKirtan ? $isSunday : !$isSunday`, returns `is_kirtan`.
- `app/Services/AbsenteeService.php:84-114` — valid-day filter `$validDay = $isKirtanClass ? $isSunday : !$isSunday`.

**Fees:**
- `app/Services/MonthlyFeeService.php:94-100` — `if (isKirtan(...)) continue;` — Kirtan excluded from monthly generation.
- `app/Http/Controllers/Admin/FeesController.php:186-223` — derives `$classTypes` via resolver → `$hasKirtan = in_array('kirtan', $classTypes)` → writes `class_type` = `'kirtan'` if kirtan present **else the first division in the array** (collapses all non-kirtan to one label).

**Dashboard:**
- `app/Http/Controllers/Admin/DashboardController.php:109` — `$classIdsByDivision = ['gurmukhi' => [], 'kirtan' => []]` (fixed two buckets).
- `DashboardController.php:111` — bucket keyed by resolver output.
- `DashboardController.php:158` — `'title' => $type === 'kirtan' ? 'Kirtan' : 'Gurmukhi'` (label ternary).
- `DashboardController.php:455,516` — `division_type` = resolver output per row.

**Student center / progression:**
- `app/Http/Controllers/StudentController.php:94-119` — groups enrollments by resolver key; `'class_type_key' => $type, // guaranteed 'gurmukhi' or 'kirtan'`.
- `app/Http/Controllers/StudentLifecycleController.php:44` — promotion target comment `// 'gurmukhi' or 'kirtan'`.

**Reports:**
- `app/Services/StudentReport/StudentReportService.php:75-83` — **fixed two keys** `$divisions['gurmukhi']` / `$divisions['kirtan']`.

**Accountant:**
- `app/Http/Controllers/Accountant/AttendanceSummaryController.php:32` — `->whereHas('schoolClass', fn($q) => $q->where('type', 'gurmukhi'))` — **hard DB type filter**; a third class is excluded unless its `type` literally contains `gurmukhi`.

### 1.3 Backend — legacy / divergent second resolver

| File:Line | What it does |
|---|---|
| `routes/accountant.php:86-104` | **Name-only heuristic**: `$isKirtan = stripos($className, 'kirtan') !== false; $classType = $isKirtan ? 'kirtan' : 'gurmukhi';` — DIFFERENT from the canonical resolver (which checks `type` first). Includes `\Log::info` debug output per enrollment. Feeds the receive-fee page fee groups. |
| `routes/admin.php:350` | CSV class import (`admin.classes.save`): `'type' => $row['type'] ?? 'gurmukhi'` — missing type in an import defaults to gurmukhi. |
| `DivisionTypeResolver.php:41-43` | The name-fallback rule itself is legacy: NULL/blank `type` + Kirtan *name* → kirtan (exists only for legacy rows). |

### 1.4 Database / seeders / factories

| File:Line | What it does |
|---|---|
| `database/migrations/2025_12_24_135759_create_classes_table.php:13` | `$table->string('type');` — free text, no constraint. **The DB is already multi-class capable.** |
| `database/seeders/SchoolSetupSeeder.php:18-38` | Seeds exactly Gurmukhi (2 sections) + Kirtan (Tabla/Dil Rubab). Seed data, not a constraint. |
| `database/seeders/DemoFeeSeeder.php:16` | Demo fees only for `where('type','gurmukhi')`. Demo-only. |

No migration, no factory, no DB constraint anywhere limits classes to two.

### 1.5 Frontend — fixed two-bucket/button UIs

| File:Line | What it does |
|---|---|
| `Pages/Admin/Fees/Index.jsx:593-619` | Splits fees into `gurmukhiFees` (`division !== "kirtan"`) and `kirtanFees`, renders **two fixed sections**. A third class's fees are shown under the "Gurmukhi" header. |
| `Pages/Accountant/ReceiveFee.jsx:29-159` | Two fixed collapsible fee groups (gurmukhi/kirtan). Third-class fees fold into the Gurmukhi group. |
| `Pages/Admin/StudentReportCenter/Index.jsx:284-344` | Reads `.divisions?.gurmukhi` / `.divisions?.kirtan`, renders two hardcoded `<Section title="Gurmukhi (Academic)">` / `"Kirtan (Spiritual)"`. |
| `Pages/Admin/StudentReportCenter/components/FilterBar.jsx:57-60` | `divisionOptions = [Gurmukhi only, Kirtan only]` (+ implicit `all`). |
| `Pages/Students/Show.jsx:22-41` | Tab build coerces `key = class_type_key === 'kirtan' ? 'kirtan' : 'gurmukhi'` — every non-kirtan enrollment becomes the Gurmukhi tab. **A 3-division student breaks the tab layout.** |
| `Pages/Students/Index.jsx` | Two-button class filter (`division() === classFilter`), `isKirtan` badge on cards. |
| `Pages/Accountant/Students/StudentsFilterBar.jsx` | Two hardcoded filter buttons. |
| `Pages/Accountant/AttendanceSections.jsx` | Two-button gurmukhi/kirtan toggle. |
| `Pages/Attendance/Sections.jsx:32-66` | Two-button filter AND **frontend re-implementation of the binary Sunday day-rule** (`if (d === "gurmukhi" && isSunday) ...`). |
| `Pages/Admin/Attendance/Index.jsx:231,491` | `isKirtan` from selected class; lesson-learned column only when kirtan. |
| `Pages/Accountant/Students/utils.js` | `division(...) === classFilter`, `isKirtan` badge. |
| `Pages/Accountant/Students.jsx` | `useState("gurmukhi")` default class filter. |
| `Pages/Admin/Dashboard.jsx:76-77` | `useState("gurmukhi")` fallback default (tabs themselves are driven by the backend `divisions` array, so this is minor). |
| `Pages/Admin/Utilities/StudentProgression.jsx:279-284` | `type === "kirtan" ? "Kirtan" : "Gurmukhi"` label ternary; `types` set is otherwise dynamic. |
| `Pages/Admin/Utilities/PromoteFlow.jsx` | `selectedType` default `"gurmukhi"`; label ternaries `t === "kirtan" ? "Kirtan" : "Gurmukhi"`; target-class dropdown filtered by division. |
| `Pages/Admin/StudentReportCenter/components/KirtanSection.jsx` | `kirtan_score` component — generic component wired only into the Kirtan section. |

### 1.6 Tests that pin the two-class behavior (characterization anchors)

- `tests/Unit/DivisionTypeResolverTest.php` — the resolver contract incl. the fallback (lines 106-114: `division(null,null) === 'gurmukhi'`, `division('music','Music') === 'gurmukhi'`).
- `tests/Unit/StudentReport/NormalizeDivisionTest.php:13-18` — `Division::from` mapping to the 2-case enum.
- `tests/Feature/MonthlyFeesGenerationTest.php:31-54` — Kirtan excluded, Gurmukhi gets fees.
- `tests/Unit/AbsenteeServiceTest.php:156-233` — the binary valid-day rule.
- `tests/Feature/FeesIndexQueryTest.php:111-177` — `class_type` values `gurmukhi`/`kirtan`; `$feeClassTypes === ['gurmukhi','kirtan']`.
- `tests/Feature/StudentFrontRoutesTest.php:224-274` — student show `summary.*.class_type_key` ordering (`gurmukhi`, `kirtan`).
- `tests/Feature/StudentReport/*` (`StudentReportCacheInvalidationTest.php:201-207`, `SecurityTest.php:115-116`) — `divisions` map exactly `gurmukhi`/`kirtan` keys.
- `tests/Feature/AttendanceLifecycleTest.php:45-57,468`, `RoleAreaSmokeTest.php:55-66`, `AttendanceAbsenteesTest.php:55-66` — fixtures use exactly the two types.

---

## 2. Classification (A–F)

Legend: **A** each of the two classes is safe/generic · **B** hard-coded two-class · **C** Kirtan business rule (keep) · **D** Gurmukhi business rule (keep) · **E** legacy/compat · **F** needs a business decision.

### B — hard-coded two-class (breaks / degrades for a third class)
- `Division` enum (2 cases) · `NormalizeDivision` `Division::from` (ValueError risk)
- `StudentReportService.php:75-83` fixed `divisions` map · `StudentReportRequest` constants + `in:` validation
- `DashboardController.php:109` two buckets · `:158` label ternary
- `FeesController.php:196-205` `hasKirtan` collapse
- `AttendanceSummaryController.php:32` hard `where('type','gurmukhi')`
- `StudentController.php:119` `class_type_key` "guaranteed gurmukhi/kirtan"
- Frontend: `divisionType.js`, `Fees/Index.jsx:593-619`, `ReceiveFee.jsx`, `StudentReportCenter/Index.jsx:284-344`, `FilterBar.jsx:57-60`, `Students/Show.jsx:22-41`, `Students/Index.jsx`, `StudentsFilterBar.jsx`, `AttendanceSections.jsx`, `Sections.jsx:32-66`, `Admin/Attendance/Index.jsx`, `Students/utils.js`, `Students.jsx`, `StudentProgression.jsx:279-284`, `PromoteFlow.jsx`, `Dashboard.jsx:76-77`

### C — Kirtan-specific business rule (MUST STAY; applies only when resolver returns kirtan)
- Sunday-only Kirtan attendance — `routes/attendance.php:58-75`, `AdminAttendanceController.php:53-68`, `AbsenteeService.php:84-114`, `Sections.jsx` frontend day rule
- Kirtan excluded from monthly fees — `MonthlyFeeService.php:94-100`
- `kirtan_score` (attendance × 0.6 + lessons × 0.4) — `KirtanScoreCalculator` / `DivisionReport::$kirtanScore` / `KirtanSection.jsx`
- lesson-learned attendance column (kirtan only) — `Admin/Attendance/Index.jsx`, `Attendance/Mark.jsx`

### D — Gurmukhi-specific business rule (MUST STAY; applies only to gurmukhi)
- Gurmukhi *is* the default academic division (see remark below — this is the trap)
- Gurmukhi classes get monthly fees (the other half of the `MonthlyFeeService` split)
- Gurmukhi attendance never on Sunday (the other half of the day rule)
- `DemoFeeSeeder` demo data for gurmukhi

### E — legacy/compat (keep, migrate later, never rely on for new classes)
- `routes/accountant.php:86-104` name-only resolver (divergent + `Log::info`)
- `DivisionTypeResolver.php:41-43` name-fallback rule
- `routes/admin.php:350` CSV-import default to `'gurmukhi'`
- Seeder creating the two known classes (data, not constraint)

### F — unknown / needs business decision
- Is a third class a **new division** (`music`, `sports`, …) or a second Gurmukhi-type academic class?
- Which day(s) may a third class take attendance? (The binary Sunday rule cannot answer this.)
- Does a third class get monthly fees? (Currently it silently would.)
- Should a third class's name default to Gurmukhi's when it has an empty/unknown `type` (the `route admin.php:350` behavior)?
- Does the Kirtan Sunday rule generalize to "spiritual divisions" or is it literally kirtan?
- Third-division label/color (kirtan=purple, gurmukhi=blue) and its report card.
- A student enrolled across 3 divisions: tab layout on `Students/Show.jsx`.
- Do new classes flow into the accountant attendance summary (currently gurmukhi-only)?

### A — safe / generic (works untouched for a third class)
- `classes` / `sections` / `student_sections` tables + Eloquent models & relations
- Fee storage & identity (`fees` keyed `(student_section_id, type, month)` + `student_id` auto-fill), payments, receipts, `FeesIndexQuery` data shape
- Attendance storage (per student/section/date), marking mechanics
- Student CRUD (Admin/Students editor is class-dropdown-driven), search, bulk status, audit trail
- `DataTable`, `StatusBadge`, `StudentCard`, `SummaryBar`, `DirectoryToolbar` components
- Report *sub*-components (`AttendanceSection`, `FeeSection`, `CalendarSection`, `IdentityBlock`) — they take `title`/`showLesson` props
- `AttendanceStudentCard` — consumes `isKirtan` as a prop
- Auth/users/roles, profile pages, backups

---

## 3. Hidden two-class assumptions (the ones that are easy to miss)

1. **The silent default is the master assumption.** `DivisionTypeResolver.php:45` and `divisionType.js:26` both return `'gurmukhi'` for unknown types. Every consumer that trusts the resolver output treats "not kirtan" and "is gurmukhi" as the same set. This is *how* a third class disappears today.
2. **`Division::from()` throws.** The enum only has 2 values; the day the resolver returns a third string, `NormalizeDivision` will throw `ValueError` in the report pipeline — a hard crash, not a graceful mislabel.
3. **`hasKirtan` collapse in FeesController.** If a filter result contains kirtan it is labeled kirtan and *everything else* is collapsed to "the first division" (`FeesController.php:204-205`). Two non-kirtan divisions would be merged into one label.
4. **The accountant has a second, wrong resolver.** `routes/accountant.php:93` answers kirtan on *name only*, ignoring the `type` field the whole rest of the app resolves on. A class whose type is `kirtan` but whose name does not contain "Kirtan" (or vice-versa) is classified differently on the receive-fee page than everywhere else.
5. **`whereNull`-agnostic accounting.** `AttendanceSummaryController.php:32` filters by bare `type='gurmukhi'` — a legacy row with `type = NULL` and a Gurmukhi-name is excluded from the accountant's attendance summary even though every resolver treats it as gurmukhi.
6. **Two-button filters with an implicit third state.** Every two-button filter (`Students/Index`, `AttendanceSections`, `StudentsFilterBar`, `Sections.jsx`) really means "gurmukhi / kirtan" — there is no "all classes" and no unknown-class bucket.
7. **`PromoteFlow` target selection by division.** Promotion filters eligible target classes by `division(c.type, c.name) === selectedType`; a new class sits in the gurmukhi bucket and would be promotable as if it were Gurmukhi.
8. **Report cache keyed per student, built per division-pair.** `StudentReportCacheInvalidationTest` proves the map has exactly the two keys; the cache is agnostic but the *builder* is not.
9. **Purple/blue identity coding.** Kirtan sections are purple, Gurmukhi blue; a third division would inherit whatever the non-kirtan branch is (the ternary "else" color).

---

## 4. Database audit

| Concern | Finding |
|---|---|
| Does the schema allow a third class? | **Yes.** `classes.type` is `string`, unconstrained. |
| Is division an enum / check constraint anywhere? | No. The `Division` enum is app-layer only. |
| Would adding a class need a migration? | No. One INSERT. |
| Unique constraint on `classes.name`? | None found. |
| Fee identity / attendance identity generic? | Yes — keyed off `student_section_id`, not class type. |
| Any index/column that assumes two types? | None. |
| **Only** schema change ever needed (Stage A2) | Add nullable `classes.division` (explicit override; NULL ⇒ today's heuristic). **Additive, no data rewrite.** |

The database is **not** a blocker. The topic of this audit is entirely application logic.

---

## 5. Business-rule audit

Four real rules encode "exactly two." Distinguish which are genuine and which are accidental:

| Rule | Where | Verdict |
|---|---|---|
| R1 Attendance valid-day is binary (Sunday ⇔ Kirtan, else Gurmukhi) | attendance.php:58-75, AdminAttendanceController, AbsenteeService, Sections.jsx | **Genuine for the two existing curricula.** A third class with a different schedule needs a per-class day rule. Decision (F-2). |
| R2 Kirtan excluded from monthly fees | MonthlyFeeService:94-100 | **Genuine.** Gurmukhi (academic) pays; Kirtan doesn't. A third class's fee policy needs a decision (F-3). |
| R3 `kirtan_score` = attendance × 0.6 + lessons × 0.4 | KirtanScoreCalculator / DivisionReport | **Genuine and kirtan-specific.** Keep. Only render when the division actually is kirtan. |
| R4 Gurmukhi is the implicit default division | Resolver fallback (+ accountant name-only, + import default) | **Accidental severity.** It currently makes "unknown type ⇒ Gurmukhi". This is the assumption to *unbind*, replacing it with explicit `division` + preserved fallback. |

---

## 6. Screen-by-screen impact matrix

Severity: what happens the day a third class (e.g. `type='music'`) is seeded.

| Screen | Current behavior for a 3rd class | Severity |
|---|---|---|
| Admin Dashboard | Third class rows bucket into Gurmukhi card; its fees/attendance merge into Gurmukhi totals | **CRITICAL** |
| Admin Fees index (`Fees/Index.jsx`) | Third-class fees shown under a "Gurmukhi" heading in the fixed two sections | **CRITICAL** |
| Accountant Receive-fee (`ReceiveFee.jsx` + accountant.php resolver) | Third-class fees fold into the Gurmukhi collapsible; and may be *mis-classified* by the name-only heuristic | **CRITICAL** |
| Student Report Center | Report builder emits only `gurmukhi`/`kirtan` keys; a third class's data is missing or merged; filter dropdown has no third option | **CRITICAL** |
| `Division` enum + `NormalizeDivision` | `Division::from()` would throw `ValueError` if a report is ever requested for the third division | **CRITICAL** |
| Student center (`StudentController` → `Students/Show.jsx`) | Third-class enrollment coerced into the Gurmukhi tab; 3-division student breaks tabs | **CRITICAL** |
| Accountant attendance summary (`AttendanceSummaryController:32`) | Third class excluded entirely (hard `where type='gurmukhi'`) | **HIGH** |
| Attendance day rules (routes, grid, absentee, Sections.jsx) | Third class forced onto Gurmukhi (non-Sunday) days | **HIGH** |
| Monthly fee generation | Third class silently gets monthly fees (if that's wrong, incorrect billing) | **HIGH** |
| Admin Attendance grid lesson column | IsKirtan=false ⇒ no lesson-learned column for the third class (matches Gurmukhi) | **MEDIUM** |
| Student Progression / Promote Flow | Label ternary + default `gurmukhi` mislabel; promotion target pool = Gurmukhi bucket | **MEDIUM** |
| Public Students list, Accountant Students FilterBar, AttendanceSections | Two-button filter; third class only reachable via the Gurmukhi button | **MEDIUM** |
| Dashboard frontend `useState("gurmukhi")` | Fallback default only; tabs are driven by the backend array | **LOW** |
| CSV class import (`admin.php:350`) | Missing type ⇒ gurmukhi (fine for legacy, wrong default for new classes) | **LOW** |
| DemoFeeSeeder | Demo data only | **LOW** |
| Student CRUD, fee record/edit, attendance mark, receipts, backup, auth | Generic | **SAFE** |

---

## 7. Compatibility strategy

**Contract to preserve:** for every class the resolver already maps to `gurmukhi` or `kirtan`,
changing nothing about the class, the resolver returns the same string it does today. This keeps
every day-rule check, monthly-fee branch, report key, and UI section bit-identical for the
existing two curricula.

**The single unbinding:** replace the *default path* of the resolver. Today:
`type ∋ kirtan → kirtan; type ∋ gurmukhi → gurmukhi; name ∋ kirtan → kirtan; else → gurmukhi`.
Tomorrow:
`explicit classes.division (non-null) → that value; else the existing 5-step logic unchanged.`

For all existing rows `classes.division` is NULL ⇒ the old logic runs ⇒ identical output. Only
rows that explicitly declare a new division produce a new bucket. **This is the whole
backwards-compatibility trick, and it is why nothing about Gurmukhi/Kirtan changes.**

---

## 8. Parallel / backward-compatible approach

1. **Additive column, merge-friendly.** `classes.division` nullable. Running `php artisan
   migrate` is additive; un-migrated environments simply don't have the column and the resolver
   reads it defensively (`?->division`). Deployed alongside, not replacing.
2. **Resolver is the single seam.** Backend one-file change; frontend `divisionType.js` mirrors
   it. No consumer changes their call site.
3. **The `Division` enum stops being a closed set.** The report layer keys by the resolver's
   output string rather than enum cases; the enum survives only as a legacy adapter or is
   replaced by string constants plus a whitelist of *known* divisions.
4. **UI becomes a loop over divisions.** Every fixed `gurmukhiFees`/`kirtanFees`, two-button
   filter, and two `<Section>` block becomes `divisions.map(...)`. Today the loop iterates the
   same two elements it hardcodes, so rendering is unchanged.
5. **New classes are opt-in.** You must explicitly create a class (with `division` set, or a
   `type`/`name` that hits an existing rule). A bare row behaves exactly like Gurmukhi, which is
   today's behavior — no surprise.

---

## 9. Reporting / PDF impact

- **Builder:** `StudentReportService` builds `divisions['gurmukhi']` / `divisions['kirtan']`
  (lines 75-83) → the fix is to build one key per *distinct resolved division among the student's
  enrollments*, with `kirtan_score` only when the division is `kirtan`. Existing reports emit the
  same two keys because only two divisions exist.
- **PDF layout:** `StudentReportCenter/Index.jsx:284-344` renders exactly two `<Section>`s and
  `FilterBar.jsx` offers exactly two division presets. Both become data-driven. The PDF/CSV
  *export plumbing* (`ReportExportSmokeTest`) is division-agnostic flat rows — SAFE.
- **Identity block:** division label comes from report `identity.division_label` (DB class name)
  — data-driven, SAFE.
- **`kirtan_score`:** stays a Kirtan-only field; a non-kirtan division renders no score (already
  nullable in `DivisionReport.php:23`).
- **Cache:** keyed per student; building more division keys is a cache-busting change (existing
  keys behave the same).

---

## 10. Testing strategy

**Stage A1 — characterization freeze (write first, before any code change).** New test
`tests/Feature/MultiClassBackwardCompatTest.php`: seed Gurmukhi + Kirtan + `music`, run the
same queries used by the suite (attendance grid, monthly-fee generation, fees index data,
dashboard summary, student-show grouping, report build), and assert two things:
1. **Gurmukhi & Kirtan results are byte-identical** to a control run with only those two classes.
2. **The third class lands in a defined, asserted bucket** (today: `gurmukhi` with a comment
   "pins pre-change behavior").

**Regression strategy after each phase:**
- Extend `ReportExportSmokeTest` / `AdminDataEndpointSmokeTest` with the 3rd-class class/section
  fixture and assert existing assertions still pass (they currently assert *counts* of 1 — those
  stay valid because the 3rd class is a separate section).
- Every B/C file change carries its own unit/feature test that runs the SAME input as today and
  asserts the SAME output (the resolver tests, monthly-fee tests, absentee tests are the anchors).
- `DivisionTypeResolverTest.php:113-114` currently asserts `division('music','Music') === 'gurmukhi'`
  — that exact assertion becomes the definition of "the fallback is preserved until a class
  opts out."
- **Frontend** has no automated tests (vanilla JSX) → a manual smoke checklist per affected page
  (Fees index, receive-fee, report center, student show, dashboard, attendance) driven by the
  same 3rd-class fixture.

Full suite target: 275 passing / 11 pre-existing Breeze failures unchanged.

---

## 11. Migration strategy (no destructive migration)

1. **Stage A2 adds one nullable column** (`classes.division`). Backfill is not a data migration —
   NULL values *are* the correct value (they mean "use the heuristic"). No data rewritten.
2. **No backfill, no rename, no constraint ever added** that would limit class count to two.
3. **Existing `type` values and class names are never rewritten.** All legacy rows keep their
   `type`; the resolver's legacy name-fallback keeps working for them.
4. **Rollback:** since columns are additive and the resolver reads defensively, a rollback is
   `git revert` of the resolver line + optional drop of the column — no data loss at any step.
5. **New classes are additive inserts.** Creating one never touches existing rows.

---

## 12. Recommended architecture

### Current architecture
Free-form `classes.type` rows → division is *derived at runtime* by string heuristics → two
closed enumerations (the `Division` enum; the dashboard/report two-key maps) assume the resolver
outputs only `kirtan`/`gurmukhi` → fixed two-section UIs assume two buckets. One divergent
name-only heuristic exists in the accountant receive-fee path.

### Two-class dependency map
`DivisionTypeResolver` (+ `divisionType.js`) is the hub. Fan-out: attendance day-rule → `routes/
attendance.php`, `AdminAttendanceController`, `AbsenteeService`, `Sections.jsx` · fee policy →
`MonthlyFeeService` · fees listing → `FeesController` → `Fees/Index.jsx`, `ReceiveFee.jsx` ·
dashboard → `DashboardController` → `Dashboard.jsx` · student center → `StudentController` →
`Students/Show.jsx` · reports → `NormalizeDivision` + `Division` enum + `StudentReportService` →
`StudentReportCenter/{Index,FilterBar}` · utilities → `StudentProgression`/`PromoteFlow`.

### Critical blockers (order to fix)
1. `DivisionTypeResolver` silent default + `divisionType.js` mirror (the master lever)
2. `Division` enum → `NormalizeDivision::from()` ValueError risk
3. `StudentReportService` fixed two-key map
4. `DashboardController` two-bucket map + label ternary
5. `FeesController` `hasKirtan` collapse; `Fees/Index.jsx`, `ReceiveFee.jsx` fixed sections
6. Student center grouping / `Students/Show.jsx` tab coercion
7. `AttendanceSummaryController` `where('type','gurmukhi')`
8. Report center fixed sections + filter options

### Safe areas (do not touch)
DB schema, models, fee/attendance storage, student CRUD, generic shared components, report
sub-components, auth — all already generic.

### Keep (business rules, not to remove)
Sunday-only Kirtan attendance · Kirtan monthly-fee exclusion · `kirtan_score` · Gurmukhi default
academic status and monthly fees.

### Recommended architecture
**Explicit-division, fallback-preserved.** `classes.division` (nullable) is the source of truth
when set; the existing resolver runs when NULL. Resolver output drives every consumer via the
same call sites. UIs iterate divisions instead of hardcoding two. New classes are additive rows.

### Migration strategy
Additive nullable column; NULL = heuristic; no data rewrite; rollback = revert resolver line.

### Implementation stages (approved: two-stage, decision-gated)

Do NOT create the new-class UI first. Do NOT rewrite Gurmukhi/Kirtan. Do NOT migrate existing
data. Do NOT touch the schema beyond the single nullable column in A2. Stage A first makes the
application able to safely *understand* a third class before any such class is allowed to exist;
then Stage B moves consumers over module-by-module, each step provably output-identical for the
two existing curricula.

```
                 THIRD CLASS SUPPORT
                         │
                 ┌───────┴────────┐
                 │                │
              FOUNDATION       BUSINESS (client)
                 │                │
          ┌──────┴──────┐         │
          │             │         │
      Characterization  │     decisions (gate)
      Explicit division │         │
      Open division     │     Fee policy
      Generic reporting │     Attendance days
                 │      │     Reporting behavior
                 ↓      ↓
      Generic dashboard · generic fees · generic attendance
      generic student center · progression · filters
                          │
                          ↓
                 New-class creation UI  ← deliberately LAST
```

#### Stage A — Structural multi-class (foundation; no behavior change)

| Step | Change | Proof |
|---|---|---|
| A1 | **Characterization freeze** — new `tests/Feature/MultiClassBackwardCompatTest.php`: seed `Gurmukhi`(gurmukhi), `Kirtan`(kirtan), `Music`(type=music); assert Gurmukhi→gurmukhi, Kirtan→kirtan, Music→gurmukhi **today** (pinning the pre-change default), and that Gurmukhi/Kirtan payloads (attendance grid, monthly-fee generation, fees-index data, dashboard summary, student-show grouping, report build) are byte-identical to a two-class control. | Green on unmodified code; defines the contract every later step must not violate |
| A2 | **Explicit division seam** — nullable `classes.division` (additive migration; NULL backfill = correct); `DivisionTypeResolver` explicit-first: non-null `division` → that value, else today's 5-step logic unchanged; mirror in `divisionType.js`. | Resolver unit tests unchanged for existing inputs; additive migration; rollback = revert the resolver line |
| A3 | **Open the closed enum** — replace the 2-case `Division` enum with resolver-string keys so `NormalizeDivision::from()` can never throw `ValueError`; the enum survives only as a legacy adapter (or is removed). | Report tests unchanged (same two keys emitted while only two divisions exist) |
| A4 | **Data-driven reports** — `StudentReportService` emits one `divisions[...]` key per distinct resolved division among the student's enrollments (`gurmukhi, kirtan, music`); `kirtan_score` only when the division is kirtan; existing reports emit the same two keys. | `ReportExportSmokeTest` + report cache-invalidation tests unchanged |

After Stage A the system can hold a third division end-to-end: it is not mislabeled Gurmukhi, it
does not crash, and it is carried through the report pipeline. Nothing about Gurmukhi/Kirtan has
changed.

#### Decision gate (client answers BEFORE Stage B)

Stage B encodes business rules — we must not replace today's hardcoding with tomorrow's. Blocked
on client answers:

1. **Attendance days** — which days may a new class take attendance? (The binary Sunday rule
   cannot answer this.)
2. **Fee policy** — does a new class receive monthly fees, and at what cadence?
3. **Kirtan Sunday rule** — is it literally Kirtan, or a broader "spiritual class" concept?
4. **Labels / colors** — third-division label and color (kirtan=purple, gurmukhi=blue).
5. **Multi-division student** — how should a student enrolled across 3 divisions render on the
   student-center tabs?
6. **Accountant summary** — should new classes appear in the accountant attendance summary
   (currently `where('type','gurmukhi')`)?

Until answered, the system is structurally multi-class but the only *producible* divisions are
the two existing ones — the correct safe posture.

#### Stage B — Per-module understanding (only after the gate; one module per commit)

| Step | Change | Proof |
|---|---|---|
| B1 | **Dashboard** — `DashboardController::buildDivisions` map-over-divisions; the label ternary becomes per-division; frontend already array-driven | Dashboard smoke test unchanged |
| B2 | **Fees** — `FeesController` `hasKirtan` collapse (the silent-merge bug) → map-over-divisions; `Fees/Index.jsx` and `ReceiveFee.jsx` fixed two sections → dynamic sections | `FeesIndexQueryTest` rows now expose `class_types` (array of every division the student has fees in); a third class no longer merges into a Gurmukhi bucket |
| B3 | **Attendance** — per-class day rules (only after gate items 1/3); `AdminAttendanceController` grid + `AbsenteeService` driven by the class's days; accountant attendance-summary filter via the resolver | Attendance/absentee tests unchanged |
| B4 | **Student center** — `StudentController` grouping + `Students/Show.jsx` tabs data-driven (drop the `=== 'kirtan' ? kirtan : gurmukhi` coercion) | `StudentFrontRoutesTest` unchanged |
| B5 | **Progression / promote flow** — labels from class name/division, not the ternary; remove the `"gurmukhi"` default | Progression feature tests unchanged |
| B6 | **Report center UI + PDF** — `Index.jsx` two `<Section>`s → loop over `report.divisions`; `FilterBar` division options from a backend-provided list | `ReportExportSmokeTest` unchanged |
| B7 | **Filters** — two-button filters (`Students/Index`, `AttendanceSections`, `StudentsFilterBar`, `Sections.jsx`) → dynamic lists; route the accountant name-only heuristic through the canonical resolver | Smoke tests unchanged |
| B8 | **New-class creation** — the UI to create/name/assign a division to a class. **Deliberately LAST.** | Manual smoke |

B8 is last on purpose: by the time it ships, creating `Music` cannot produce any of today's
silent failures, because Stage A already guarantees the resolver won't label it Gurmukhi and
Stage B already guarantees dashboard/report/fees/attendance/student-center understand it.

### Risk level
**Implementation: MEDIUM–HIGH** (small change in many files, one enum removal, report structure).
**Ship risk: LOW** given the Stage A1 characterization freeze and that every consumer sits behind
the single resolver seam. The only genuine unknowns are the Stage-A→B gate decisions.

### ONE concrete first task
**Stage A1.** Write `tests/Feature/MultiClassBackwardCompatTest.php`: seed `Gurmukhi`(gurmukhi),
`Kirtan`(kirtan), and `Music`(type=music) with a shared student; run the attendance grid,
monthly-fee generation, fees-index data, dashboard summary, student-show grouping, and report
build; assert (a) Gurmukhi and Kirtan payloads are byte-identical to a two-class control, and
(b) the Music class currently resolves to the `gurmukhi` bucket (pinning the pre-change default).
This test defines the contract A2 must not violate, and it runs green on today's code — so it is
safe to write and commit before any product change.