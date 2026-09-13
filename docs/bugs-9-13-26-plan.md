# Bug Fix Plan — 2026-09-13

Source: `docs/bugs-9-13-26.md`

---

## Accountant Role

### Bug A1 — Attendance grid date/day misalignment on `/student/{id}` ✅
**File:** `resources/js/Pages/Students/Show.jsx` (TabContent)

**Fix applied:**
1. `toDateKey` now parses `YYYY-MM-DD` strings locally (no timezone drift) so
   the grid cell key matches the rendered day.
2. `startDayOffset = new Date(year, month, 1).getDay()` is prepended as empty
   placeholder cells so the 1st of the month lines up under the correct
   weekday column.

---

### Bug A2 — Kirtan monthly fees not auto-generated ✅
**File:** `app/Support/ClassSchedule.php` (`chargesMonthlyFee`)

**Fix applied:** The legacy fallback no longer infers "no monthly fee" from a
Kirtan name. When `classes.charges_monthly_fee` is NULL, the class participates
in monthly fee generation by default. Kirtan opt-out is now an explicit toggle
set via the Classes "New Class" modal (which already persists
`charges_monthly_fee`).

---

## Admin Role

### Bug B1 — Student editor modal does not scroll on mobile ✅
**File:** `resources/js/Components/Modal.jsx`

**Fix applied:** Added an inner `overflow-y-auto flex-1` wrapper around the
modal children so the basic-info / enrollments / status sections scroll inside
the panel on small viewports instead of pushing the page background.

---

### Bug B2 — Search bar on attendance page to filter by student/father name ✅
**File:** `resources/js/Pages/Admin/Attendance/Index.jsx`

**Fix applied:** Added a free-text `search` input. The grid renders only
`visibleStudents` (client-side filtered by `name` or `father_name`,
case-insensitive contains). Empty-state copy distinguishes "no match" from
"no students".

---

### Bug B3 — Remove redundant "+ Add Class" button on Classes page ✅
**File:** `resources/js/Pages/Admin/Classes/Index.jsx`

**Fix applied:** Removed the inline "+ Add Class" row path (`addNewRow`,
`newRowRef`, `__isNew`, `__tempId`). The "+ New Class" modal is the sole
creation affordance. `getRowId` falls back to a `new-<name>` key for unsaved
rows (none remain, but kept defensive).

---

## Verification
- [x] `npm run build` — 2838 modules transformed, build succeeded.
- [x] `php -l app/Support/ClassSchedule.php` — no syntax errors.
- [x] Student show page: calendar dates align with weekday columns for any
      month/year.
- [x] Kirtan class with a configured monthly fee generates a fee row on the
      monthly-fee run.
- [x] Student editor modal scrolls inside its panel on a small viewport.
- [x] Admin attendance page filters students by name / father name.
- [x] Classes page has exactly one "+ New Class" button.