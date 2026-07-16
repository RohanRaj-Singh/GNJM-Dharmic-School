# Lifecycle System — UI Plan

> **Scope:** Every frontend change needed across existing and new pages to support the five enrollment lifecycle statuses: `active`, `inactive`, `promoted`, `passed_out`, `left`.

---

## Shared Component: StatusBadge

Currently there are **three different implementations** of enrollment status badges with different color schemes. Create a single reusable component that all pages import.

**New file:** `resources/js/Components/StatusBadge.jsx`

```jsx
const COLORS = {
  active:     "bg-green-100 text-green-800",
  inactive:   "bg-amber-100 text-amber-800",
  promoted:   "bg-blue-100 text-blue-800",
  passed_out: "bg-purple-100 text-purple-800",
  left:       "bg-gray-200 text-gray-700",
};

const LABELS = {
  active:     "Active",
  inactive:   "Inactive",
  promoted:   "Promoted",
  passed_out: "Passed Out",
  left:       "Left",
};

export default function StatusBadge({ status, size = "sm" }) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`rounded-full font-medium ${sizeClass} ${COLORS[status] || "bg-gray-100 text-gray-500"}`}>
      {LABELS[status] || status}
    </span>
  );
}
```

**Replace** all inline status badge implementations in:
- `StudentStatus.jsx` — remove local `StatusBadge`, import shared
- `EnrollmentsCell.jsx` — remove inline "Inactive" badge, use shared
- `Admin/Students/Show.jsx` — replace `{student.status}` text with `<StatusBadge>`
- `Students/Show.jsx` — replace outcome badge map with shared component
- `IdentityBlock.jsx` — replace `statusTone()` with shared colors

---

## Page-by-Page Changes

### Student Progression (`Admin/Utilities/StudentProgression.jsx`)

**Status:** Built, mock data. Minimal changes.

| Change | Detail |
|---|---|
| Action buttons | Promote and Pass Out stay. Remove all Repeat/Leave remnants. |
| Pass Out renders `status = 'passed_out'` | Already planned in lifecycle controller. No UI change needed — the modal shows success text. |
| Student list only shows `status = 'active'` | Already filtering correctly. |

No structural changes. The page already matches the new lifecycle model.

---

### Student Status (`Admin/Utilities/StudentStatus.jsx`)

**Status:** Built with active/inactive/left. Needs promoted + passed_out.

| Change | Detail |
|---|---|
| Status filter | Add `Promoted` and `Passed Out` options to the dropdown |
| Status badges | Replace local `StatusBadge` with shared component — gains promoted/passed_out colors |
| Stats bar | Add Promoted and Passed Out counts |
| Mark as Left | Keep the inactive-only gate. Works as-is. |
| Table rows | Promoted/passed out rows get `bg-gray-50` styling (like inactive/left) |
| Filter description text | Update to mention all five states |

The Mark as Left flow (selection must be only inactive) and confirmation modal stay unchanged.

---

### Student Profile — Academic History (`Students/Show.jsx`)

**Status:** Mock data. Replace with real data from student history endpoint.

| Change | Detail |
|---|---|
| Current enrollment section | Replace mock data with real enrollments. Show class, section, status badge, started_at date. |
| Previous enrollments section | Load from `StudentSection::where('student_id', X)->whereNotNull('transferred_at')->orderBy('started_at')`. Each row shows class, section, outcome badge, date range (`started_at → transferred_at`). |
| Action buttons per enrollment | View Student Report, View Attendance, View Fees — each links to the respective page filtered by that enrollment's `student_section_id`. |
| Empty state | "No previous enrollments" when no history exists. |
| StatusBadge integration | Use shared component for `promoted`/`passed_out`/`left` badges. |

**New data endpoint** (backend): The student show route already loads all enrollments. Just remove the `where('status', 'active')` filter and pass the full list.

---

### Master Directory (`Admin/Utilities/MasterDirectory.jsx`) — NEW PAGE

A browseable archive of all non-active students.

**URL:** `/admin/utilities/master-directory`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Master Directory                                             │
│ Browse all students by lifecycle status.                     │
│                                                              │
│ [Search...] [Status ▼] [Class ▼] [Section ▼]                │
│                                                              │
│ ┌────┬──────────┬──────────┬────────────────┬──────┬──────┐ │
│ │ #  │ Name     │ Status   │ Last Enrollment │ Fees │ Link │ │
│ ├────┼──────────┼──────────┼────────────────┼──────┼──────┤ │
│ │ 1  │ Amardeep │ Promoted │ GC2 - Pehli    │ Rs.0 │ View │ │
│ │ 2  │ Balwinder│ Passed   │ GC3 - Doosri   │ Rs.0 │ View │ │
│ │ 3  │ Harpreet │ Inactive │ GC1 - Pehli    │Rs.120│ View │ │
│ │ 4  │ Jaspal   │ Left     │ GC2 - Doosri   │Rs.150│ View │ │
│ └────┴──────────┴──────────┴────────────────┴──────┴──────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Filters:**
- Search (name, father name)
- Status dropdown: All / Promoted / Passed Out / Inactive / Left
- Class dropdown (optional, for filtering by last known class)
- Section dropdown (populated when class selected)

**Table columns:**
- Student name
- Father name
- Status badge (shared `StatusBadge` component)
- Last class/section (from the most recent enrollment)
- Last outcome (e.g., "Promoted to Gurmukhi Class 2")
- Outstanding fees (if any, in red)
- Actions: View Profile, View Student Report, View Fees

**Data source:** API endpoint `/admin/utilities/master-directory/data` that queries:

```sql
SELECT students.*, 
       (SELECT status FROM student_sections WHERE student_id = students.id ORDER BY started_at DESC LIMIT 1) as last_status,
       (SELECT outcome FROM student_sections WHERE student_id = students.id ORDER BY started_at DESC LIMIT 1) as last_outcome
FROM students
WHERE students.status IN ('inactive', 'passed_out', 'left')
   OR EXISTS (SELECT 1 FROM student_sections WHERE student_id = students.id AND status IN ('promoted', 'passed_out', 'left'))
```

**Empty state:** "No students match the current filters."

---

### Utilities Index (`Admin/Utilities.jsx`)

| Change | Detail |
|---|---|
| Add card | New card linking to `/admin/utilities/master-directory` with emoji `📖` and title "Master Directory" |

```jsx
<UtilityCard
  emoji="📖"
  title="Master Directory"
  description="Browse all students by lifecycle status — promoted, passed out, inactive, left"
  href="/admin/utilities/master-directory"
/>
```

---

### EnrollmentsCell (`Admin/Students/EnrollmentsCell.jsx`)

| Change | Detail |
|---|---|
| Status badge | Replace inline `bg-red-100` inactive badge with shared `StatusBadge` component |
| Color mapping | Move the green/white section coloring logic to use shared status colors |
| Edge cases | Add rendering for `promoted` and `passed_out` statuses (currently only handles `inactive`) |

---

### IdentityBlock (`Admin/StudentReportCenter/components/IdentityBlock.jsx`)

| Change | Detail |
|---|---|
| `statusTone()` function | Update the color vocabulary: replace `graduated` → `passed_out`, `transferred` → `promoted`, `dropped` → `left`. Use the shared `StatusBadge` component instead of custom color function. |
| Student-level vs enrollment-level | Clarify that the identity status is the student-level status (active/inactive/passed_out/left), not enrollment-level. |

---

### Admin Students Show (`Admin/Students/Show.jsx`)

| Change | Detail |
|---|---|
| Status display | Replace `Status: {student.status}` text with `<StatusBadge status={student.status} size="md" />` |

---

### Student Report Center (`Admin/StudentReportCenter/Index.jsx`)

**Status:** No changes needed for the lifecycle model. The report center works per-student and already loads all enrollments via `StudentIdentityResolver`. The backend change (removing `whereNull('transferred_at')` from the resolver) will make it automatically show historical enrollment data.

---

### Fee Pages (Admin Fees, Accountant Fees, Reports)

**Status:** No UI changes needed. All changes are backend-only:
- Add `transferred_at IS NULL` to queries (keeps promoted/passed_out/left enrollments out of default lists)
- Receive-fee page loads all enrollments regardless of status (backend only)
- Nothing changes in the React components

---

### Attendance Pages

**Status:** No UI changes needed. Backend-only:
- Add `transferred_at IS NULL` to all attendance queries (removes promoted students from old sections automatically)
- The per-section marking pages work correctly as-is

---

### Student Status Page — Leave School Confirmation

**Status:** Already built in the prototype. The confirmation modal:

```
┌────────────────────────────────────────────────────────┐
│ Mark as Left                                            │
│ This is a permanent action. Unlike inactive, Left       │
│ cannot be reversed.                                     │
│                                                         │
│ Action: Mark as Left                                    │
│ Students: 3 enrollment(s)                               │
│                                                         │
│ ⚠ What happens:                                         │
│ • The enrollment is permanently closed                  │
│ • The student cannot be re-enrolled                     │
│ • No future attendance or fees                          │
│ • All historical data is preserved                      │
│ • Outstanding fees remain collectible                   │
│                                                         │
│ ☐ I understand this is permanent for 3 enrollment(s)    │
│                                                         │
│               [Cancel]  [Confirm]                       │
└────────────────────────────────────────────────────────┘
```

No changes needed — the existing prototype handles this correctly.

---

## New Route

```php
// Master Directory
Route::get('/utilities/master-directory', fn() => Inertia::render('Admin/Utilities/MasterDirectory'))
    ->name('utilities.master-directory');

Route::get('/utilities/master-directory/data', function (Request $request) {
    // Query students by lifecycle status with filters
})->name('utilities.master-directory.data');
```

---

## File Change Summary

| Category | Files |
|---|---|
| **NEW shared component** | `Components/StatusBadge.jsx` |
| **NEW page** | `Admin/Utilities/MasterDirectory.jsx` |
| **EDIT** | `Admin/Utilities/StudentStatus.jsx` — add promoted/passed out to filters and stats |
| **EDIT** | `Admin/Utilities/StudentProgression.jsx` — remove Repeat/Leave remnants, verify statuses |
| **EDIT** | `Admin/Utilities.jsx` — add Master Directory card |
| **EDIT** | `Students/Show.jsx` — replace mock history with real enrollment timeline + shared StatusBadge |
| **EDIT** | `Admin/Students/EnrollmentsCell.jsx` — replace inline badge with shared StatusBadge |
| **EDIT** | `Admin/Students/Show.jsx` — replace raw status text with StatusBadge |
| **EDIT** | `Admin/StudentReportCenter/components/IdentityBlock.jsx` — use shared StatusBadge, update vocabulary |
| **EDIT** | `Admin/Utilities/StudentStatus.jsx` — remove local StatusBadge, use shared |
| **EDIT** | `routes/admin.php` — add Master Directory routes |
| **NO CHANGE** | All fee pages (backend-only) |
| **NO CHANGE** | All attendance pages (backend-only) |
