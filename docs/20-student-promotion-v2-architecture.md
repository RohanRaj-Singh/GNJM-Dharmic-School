# Student Promotion V2 — Architecture Reassessment

> **Context:** This document supersedes the previously planned Batch Management system. The school does not operate yearly promotions. Promotion is an operational action — any day, any time, individually or in small groups. This document reassesses the full architecture given that constraint.

---

## Philosophy

Promotion simply means:

> The student's current enrollment ends. A new enrollment begins. Historical records remain untouched.

No yearly batch assumptions. No academic session dependency. No waiting for a date.

---

## Current Model Review

| Model | Status | Notes |
|---|---|---|
| `Student` | **Valid** | Core entity. Drop `batch_id` (unused FK to removed table). Keep `status` for student-level lifecycle (active/inactive). |
| `StudentSection` | **Valid — the enrollment record** | Already has `transferred_at`, `started_at`, `outcome`, `status`. Nearly sufficient as-is. A row is an enrollment. Current = `transferred_at IS NULL`. Historical = `transferred_at IS NOT NULL`. |
| `Attendance` | **Valid — no change** | Tied to `student_section_id`. Already enrollment-scoped. |
| `Fee` | **Valid — no change** | Tied to `student_section_id`. Already enrollment-scoped. |
| `Payment` | **Valid — no change** | Tied to `fee_id` → `student_section_id`. Already enrollment-scoped. |
| `Batch` | **Remove** | No cohort concept needed in this model. Drop table and all FKs. |
| `AcademicSession` | **Keep (optional reporting metadata)** | Not required for promotion logic. Drop FK constraint on `student_sections` but keep column nullable for optional labelling. |
| `SchoolClass` / `Section` | **Valid — no change** | |

### What StudentSection already provides

```
student_sections
├── transferred_at   → null = current, set = historical
├── started_at       → when this enrollment began
├── outcome          → promoted | repeated | passed_out | left
├── status           → active | inactive
└── academic_session_id → optional, for reporting labels only
```

This is sufficient. No new columns needed.

---

## What Changes From The Previous Plan

| Previous Decision | New Decision |
|---|---|
| Batch Management system | **Discarded entirely** |
| Academic session as promotion dependency | **Removed** — promotion has no date/session constraints |
| Batch-based promotion UI | **Removed** — single-student and small-group only |
| Promotion as yearly event | **Replaced** — any day, any time |
| New promotion-specific models | **Not needed** — StudentSection suffices |
| New report pages for history | **Not needed** — reuse existing reports with enrollment filter |

---

## What Can Be Reused (As-Is)

| Component | Reuse Strategy |
|---|---|
| **Student Report Center** | Already operates on a single `student_id` + date range. Add optional `enrollment_id` filter → load that enrollment's section IDs → engine works unchanged. The same Blade template and React components render historical data. |
| **Attendance Reports** (`ReportController`) | Already accepts `section_ids` param. Pass historical enrollment's section ID. Remove the `status = 'active'` hard filter for historical queries. |
| **Fee Reports** (`ReportController`) | Same pattern as attendance. Already accepts `section_ids`. Filter by enrollment ID. |
| **FeePaymentController** | Collects on any `fee_id`. Historical enrollment fees are already in the `fees` table with `student_section_id` pointing to the old enrollment. Works with zero changes. |
| **PendingFeesController** | Already operates per-enrollment. Historical enrollment pending fees are visible and collectible. No change needed. |
| **MonthlyFeeResolver** | Accepts enrollment + month. No change needed. |
| **Student Status utility** | Already operates at enrollment level. Add "promoted" as a display label derived from `outcome`. |
| **Student Show page** (React) | Currently loads `status = 'active'` enrollments. Remove that filter, add a "Previous Enrollments" section below the current one. Same component pattern. |

---

## What Should Be Removed

| Artifact | Reason |
|---|---|
| `batches` table + `Batch` model | No cohort concept. Drop table. |
| `students.batch_id` column | FK to removed table. Drop column. |
| `fees.batch_id` FK constraint | Column is nullable and unused by any query. Drop FK, keep column. |
| `student_sections.academic_session_id` FK constraint | Not required for promotion. Drop FK, keep column nullable for optional reporting labels. |
| `resources/js/Pages/Admin/Utilities/Batches.jsx` | Prototype mockup with no backend. Delete. |
| `resources/js/Pages/Admin/Utilities/StudentPromotion.jsx` | Prototype mockup with no backend. Delete. |
| Academic session dependency in promotion flow | Never reference `academic_session_id` in promotion logic. |

---

## Required Database Changes

Minimal. No new tables, no new columns, no new indexes.

1. **Drop `batches` table** (rollback migration `2026_07_06_000002`)
2. **Drop `students.batch_id`** (rollback migration `2026_07_06_000003`)
3. **Drop FK on `fees.batch_id`** (from `2026_01_21_113815`)
4. **Drop FK on `student_sections.academic_session_id`** (from `2026_07_06_000004`)

Keep all columns — just remove FK constraints.

---

## Required Business Rule Changes

| Rule | Before | After |
|---|---|---|
| Fee generation scope | `student_sections.status = 'active'` | `student_sections.transferred_at IS NULL` |
| Report enrollment scope | `student_sections.status = 'active'` | Current: `transferred_at IS NULL`. Historical: filter by enrollment ID. |
| Promotion validation | Academic session required | No validation beyond "student exists" and "target class/section exists" |
| Student statuses | `active` / `inactive` / `graduated` / `transferred` / `dropped` | Simplify to `active` / `inactive`. Promotion sets `outcome` on the enrollment instead. |

---

## Promotion Workflow

The promotion action is a single database transaction:

```
1. Admin selects a student
2. Admin picks: Target Class, Target Section, Effective Date (default: today)
3. System warns if outstanding fees exist (informational, not blocking)
4. Admin confirms

Transaction:
  a. Set transferred_at = now on current enrollment
  b. Set outcome = 'promoted' on current enrollment
  c. Create new StudentSection with:
     - same student_id
     - new class_id, section_id
     - same student_type (paid/free)
     - started_at = now
     - transferred_at = null
     - status = 'active'
  d. Invalidate student report cache
```

### Four actions, same pattern

| Action | Outcome on old enrollment | Creates new enrollment? |
|---|---|---|
| Promote Student | `promoted` | Yes |
| Repeat Class | `repeated` | Yes (same class, possibly new section) |
| Pass Out Student | `passed_out` | No |
| Leave School | `left` | No |

---

## Outstanding Fees Workflow

**Critical rule:** Fees are never moved, merged, or deleted on promotion.

- Outstanding fees remain attached to the **old** enrollment (`student_section_id`)
- The accountant can still view, collect, and report on them via existing fee pages
- The new enrollment starts with a **clean fee slate**
- Promotion shows a warning (not a blocker) if the student has outstanding fees

**No code changes needed** — fees are already enrollment-scoped via `student_section_id`.

---

## Historical Data Workflow

```
Student
  └─ enrollments()        ← all StudentSection rows
       ├─ current         ← transferred_at IS NULL
       │    ├─ attendance ← preserved
       │    ├─ fees       ← preserved, payments collectible
       │    └─ reports    ← accessible via enrollment ID
       └─ historical[]    ← transferred_at IS NOT NULL, outcome set
            ├─ attendance ← preserved
            ├─ fees       ← preserved, payments still collectible
            └─ reports    ← accessible via enrollment ID
```

Every previous enrollment is a complete, self-contained record. Nothing is overwritten.

---

## Reporting Integration

### Strategy: Add an enrollment selector. Do not create new report pages.

### Student Report Center

- Add optional `enrollment_id` field to `StudentReportRequest`
- When provided, `StudentIdentityResolver` loads that specific enrollment (including historical) instead of only current enrollments
- `AttendanceResolver`, `FeeResolver`, `CalendarBuilder` already work with provided section IDs — no internal changes
- The existing Blade PDF template (`student_center.blade.php`) and React components render historical data identically

### Attendance & Fee Reports (ReportController)

- Already accept `section_ids` and `student_ids`
- For historical data: pass the historical enrollment's section ID
- Remove the hard-coded `student_sections.status = 'active'` filter when an enrollment ID is explicitly provided

### What the UI needs

A dropdown on each report page: **"Enrollment"**
- Current (default)
- Previous — Gurmukhi Class 1 (Promoted)
- Previous — Kirtan Tabla (Passed Out)

One selector. No new views.

---

## Student Profile Integration

The Student Profile (`/students/{id}`) becomes the academic history hub.

### Change

Remove the `where('status', 'active')` filter from the enrollments load. Show:

```
Student: Amardeep Singh
─────────────────────────────────
Current Enrollment
  Gurmukhi Class 2 - Section A (Active)
  [View Report] [View Attendance] [View Fees]

Previous Enrollments
  Gurmukhi Class 1 - Section A (Promoted → 2026-03-15)
  [View Report] [View Attendance] [View Fees]

  Kirtan Tabla Basic (Passed Out → 2025-12-20)
  [View Report] [View Attendance] [View Fees]
```

Each link opens the respective report page pre-filtered for that enrollment.

The controller at `routes/students.php:62` already loads `enrollments`, `enrollments.attendance`, `enrollments.fees.payments` — just remove the `where('status', 'active')` scope.

---

## Utilities Design

### Before

- PendingFeesSetup
- StudentStatus
- StudentPromotion (prototype mockup)
- Batches (prototype mockup)

### After

```
Utilities
├── Student Progression
│    ├── Promote Student    → search student → pick target class/section → confirm
│    ├── Repeat Class       → search student → pick section → confirm
│    ├── Pass Out Student   → search student → confirm
│    └── Leave School       → search student → confirm
├── Student Status          → KEEP (already enrollment-level)
└── Pending Fees Setup      → KEEP (already enrollment-level)
```

### Student Progression page design

Single-page, search-first:

```
┌─────────────────────────────────────────────────────────────┐
│ Student Progression                                         │
│                                                             │
│ [Search student...] ────────── [Q]                          │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Amardeep Singh    Father: Gurpreet Singh               │ │
│ │ Current: Gurmukhi Class 2 - Section A                  │ │
│ │                                                        │ │
│ │ [Promote] [Repeat] [Pass Out] [Leave School]           │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Balwinder Kaur    Father: Jaswant Singh                │ │
│ │ Current: Gurmukhi Class 1 - Section B                  │ │
│ │   ⚠ Outstanding: Rs. 1,200                             │ │
│ │                                                        │ │
│ │ [Promote] [Repeat] [Pass Out] [Leave School]           │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

Clicking **Promote** opens a modal/panel:
- Target Class (dropdown)
- Target Section (dropdown, filtered by class)
- Effective Date (default: today)
- [Cancel] [Confirm]

---

## Recommended Implementation Order

| # | Step | Effort | Depends On |
|---|---|---|---|
| 1 | Drop `batches` table + `students.batch_id` + FKs | Small | — |
| 2 | Drop FK on `student_sections.academic_session_id` | Small | — |
| 3 | Drop FK on `fees.batch_id` | Small | — |
| 4 | Update `GenerateMonthlyFees` to use `transferred_at IS NULL` instead of `status = 'active'` | Tiny | — |
| 5 | Update `StudentController::store` to set `started_at = now` | Tiny | — |
| 6 | Delete `Batches.jsx` + `StudentPromotion.jsx` | Small | — |
| 7 | Create `StudentProgressionController` with `promote`, `repeat`, `passOut`, `leaveSchool` | Medium | 1-3 |
| 8 | Create `StudentProgression.jsx` page | Medium | 7 |
| 9 | Update Student Profile to show all enrollments (remove `status = 'active'` filter) | Small | — |
| 10 | Add optional `enrollment_id` to `StudentReportRequest` + `StudentIdentityResolver` | Medium | — |
| 11 | Add enrollment selector dropdown to Student Report Center UI | Small | 10 |
| 12 | Audit all queries filtering by `status = 'active'` — switch to `transferred_at IS NULL` where appropriate | Medium | — |

---

## Summary

| Metric | Count |
|---|---|
| New files | ~3 (Controller, React page, route) |
| Files to modify | ~6-8 |
| Files to delete | 2 (mock pages) |
| DB tables to drop | 1 (`batches`) |
| DB columns to drop | 1 (`students.batch_id`) |
| FK constraints to drop | 2 (`fees.batch_id`, `student_sections.academic_session_id`) |
| New DB columns | 0 |
| New DB tables | 0 |
| Report pages to create | 0 |

The key insight: **Promotion is just closing one StudentSection and opening another.** Fees, attendance, payments, and reports are already enrollment-scoped via `student_section_id`. The existing infrastructure handles historical data with zero structural changes to the data model.
