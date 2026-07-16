# Student Progression — React Prototype

> **Status:** UX prototype with mock data. No backend integration.

---

## Files

### New

| File | Purpose |
|---|---|
| `Admin/Utilities/StudentProgression.jsx` | Main page — advanced filters, bulk selection, promote/pass out actions |
| `Admin/Utilities/StudentProgression/mockData.js` | Mock students, classes (with `nextClassId`), sections, enrollments, history |
| `Admin/Utilities/StudentProgression/PromoteFlow.jsx` | 3-step promote modal (auto-detects target class, accepts `preselectedIds` for bulk) |
| `Admin/Utilities/StudentProgression/PassOutFlow.jsx` | Pass out confirmation modal (accepts `preselectedIds` for bulk) |
| `Admin/Utilities/StudentProgression/ImpactSummary.jsx` | Shared impact summary component |

### Modified

| File | Change |
|---|---|
| `Admin/Utilities.jsx` | Replaced old Student Promotion + Batches cards with single Student Progression card |
| `Admin/Utilities/StudentStatus.jsx` | Added Left status filter, Mark as Left button (inactive-only), confirmation dialog |
| `Students/Show.jsx` | Added mock Academic History section for admin/accountant |
| `routes/admin.php` | Single `/utilities/student-progression` route |

### Deleted

| File | Reason |
|---|---|
| `StudentProgression/RepeatFlow.jsx` | Repeat concept removed entirely |
| `StudentProgression/LeaveSchoolFlow.jsx` | Leave moved to Student Status page |

---

## Pages

### 1. Student Progression (`/admin/utilities/student-progression`)

**Actions:** Promote, Pass Out (per-student and bulk)

**Advanced filters bar:**
- Search (name or father name)
- Class dropdown
- Section dropdown (populated when class is selected)
- Count badge showing filtered and selected counts

**Bulk action bar** (appears when selections are made):
- Promote Selected — enabled only if all selected students have a next class available
- Pass Out Selected
- Clear

**Table:** Checkbox per row, select-all in header. Each row shows name, father, class, type badge, outstanding amount, Promote/Pass Out action buttons.

**Auto-disable:** Promote button is disabled (replaced with gray italic text) when the student has no next class available.

### 2. Student Status (`/admin/utilities/student-status`)

Extended with Leave School workflow.

**New status:** `left` — permanent terminal status, visually distinct (gray badge), separate from `inactive` (red badge).

**Security constraint:** Mark as Left button is only enabled when ALL selected enrollments have status `inactive`. An amber info banner explains this when mixed selections exist.

**Stats bar:** Tracks Active, Inactive, Left counts with color-coded badges.

**Confirmation modal:**
- Explains `Left` is permanent and irreversible
- Red info box listing consequences
- Requires explicit checkbox acknowledgment
- Success state shows 📋 with summary of what happened

### 3. Promote Flow (Modal)

- Target class is auto-detected via `nextClassId` chain and shown as read-only with an **Auto** badge
- Admin only picks section and effective date
- Supports bulk via `preselectedIds` prop — success text shows count instead of name
- Guard: if no next class exists, shows a "Cannot Promote" message with suggestion to use Pass Out

### 4. Pass Out Flow (Modal)

- Single confirmation step
- Supports bulk via `preselectedIds`
- 🎓 success state

### 5. Student Profile — Academic History

Admin/accountant-only section showing historical enrollments with outcome badges and action buttons (Student Report, Attendance, Fees). Mock data for students 5, 8, 15.

---

## Data Model

```
MOCK_CLASSES now includes nextClassId for auto-detection:
  Gurmukhi 1 → 2, Gurmukhi 2 → 3, Gurmukhi 3 → null
  Kirtan Tabla Basic → 5 (Advanced), Advanced → null
  Kirtan Dil Rubab → null (standalone)
```

`resolveNextClassForEnrollments()` walks the chain for each division and returns available targets.

---

## Navigation Flow

```
Admin Utilities
  ├─ Student Progression
  │    ├─ Promote (per-student or bulk) → Auto-detect class → Pick section+date → Impact → Confirm
  │    └─ Pass Out (per-student or bulk) → Impact → Confirm
  │
  └─ Student Status
       ├─ Set Active / Set Inactive (bulk)
       └─ Mark as Left (inactive-only, permanent)

Student Profile
  └─ Academic History (enrollment action links)
```

---

## Key Business Rules

| Rule | Implementation |
|---|---|
| Only active students appear in Progression | Hard filter in `StudentProgression` |
| Only inactive can be marked Left | `selectionHasOnlyInactive` guards the button |
| Left is permanent | Confirmation text emphasizes irreversibility |
| Inactive is temporary | Can be toggled back to Active at any time |
| Target class auto-detected | `nextClassId` chain on class model |
| No next class = cannot promote | Disabled button + "Cannot Promote" modal |
