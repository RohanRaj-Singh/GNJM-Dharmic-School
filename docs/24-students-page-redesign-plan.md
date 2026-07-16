# Students Page — Redesign Plan

> **Status:** Plan for review before implementation.
>
> Covers: splitting the monolithic 711-line TanStack spreadsheet into a focused directory + editor modal.

---

## The Problem

`Admin/Students/Index.jsx` (711 lines) is a single TanStack Table that tries to be everything at once:

| What it tries to be | Why it fails |
|---|---|
| Student directory | 300ms hydration delay hack, hardcoded `min-w-[900px]`, unusable on mobile |
| Inline spreadsheet editor | `TextCell`/`PhoneCell` in-table inputs are fragile, tab-between-cells causes missed blurs |
| Enrollment manager | `EnrollmentsCell.jsx` (247 lines) fires 200+ API calls on mount, deeply coupled to parent state |
| Bulk operations | No single-student update — every edit POSTs the whole dataset |
| Responsive page | No responsive design at all |

---

## Proposed Architecture

Three focused surfaces replace the single monolithic page:

```
Student Directory (read-heavy, responsive)
  └─ table on desktop, cards on mobile
  └─ search + filters
  └─ actions: Edit (opens modal), View (goes to profile)

Student Editor Modal (write-focused)
  └─ Basic Info tab (name, father, phones)
  └─ Enrollments tab (class/section/type per enrollment)
  └─ Status toggle
  └─ Save → POST existing `/admin/students/bulk-update`

Bulk Operations (already exist as separate pages)
  └─ Student Status (bulk active/inactive/left)
  └─ Student Progression (promote / pass out)
```

---

## Key Changes

**Remove TanStack Table** — replaced by a plain `<table>` with simple state-based sorting. TanStack's column visibility, inline editing, filter model, and pagination were unused or overkill. Drops 56KB from the page bundle.

**Remove inline editing** — no more `<input>` elements inside table cells. All editing happens in a modal. The spreadsheets-in-a-table pattern is eliminated.

**Remove EnrollmentsCell.jsx** — the deeply nested 247-line sub-component is deleted. Enrollment management moves into the modal's EditorEnrollments section.

**Remove 300ms hydration hack** — with Inertia server-rendered props (data passed on initial page load instead of fetched after mount), there's no loading flash and no delay.

**Responsive design** — cards on mobile, table on desktop, via Tailwind's `hidden md:table` / `block md:hidden`.

---

## File Change Summary

| Type | Files |
|---|---|
| **NEW** | 11 component files (DirectoryToolbar, DataTable, CardList, StudentCard, SummaryBar, StudentEditorModal, EditorBasicInfo, EditorEnrollments, useClassOptions, useStudentCrud, StudentDirectory) |
| **REWRITE** | `Admin/Students/Index.jsx` — becomes thin shell using new components |
| **MODIFY** | `routes/admin.php` — pass students/classes as Inertia props on GET |
| **DELETE** | `EnrollmentsCell.jsx`, `useStudentFilters.jsx`, `useStudentsData.js` |
| **UNCHANGED** | `Students/Index.jsx` (teacher cards), `Students/Show.jsx`, `Students/Create.jsx`, all utility pages |

## Implementation Order

1. **Phase 1 — Directory** (read-only, responsive): new components, rewrite Index, Inertia props
2. **Phase 2 — Editor Modal**: modal replaces all inline editing, delete EnrollmentsCell
3. **Phase 3 — Cleanup**: delete dead hooks, remove TanStack, remove hydration hack
