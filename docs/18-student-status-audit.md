# Student Active / Inactive Status — Business Rules

> Status: Rules finalized. Implementation ready to begin.

---

## 1. Current Problem

`students.status` exists (`active` / `inactive`) but is **ignored by every module**. Inactive students appear on attendance rolls, fee collection screens, absentees lists, and dashboards. They should not.

---

## 2. New Dedicated Page: Activate / Deactivate Students

**Location:** `Admin → Utilities → Student Status`

**Purpose:** The **only** place where an admin changes student status between active and inactive.

**What it does:**
- Shows all students with their current status (active / inactive)
- Bulk action to select students and set them to **Inactive**
- Bulk action to select students and set them to **Active**
- Optional filter: Show Active only, Show Inactive only, Show All
- Search by student name or father name
- Does NOT allow editing of name, enrollment, fees, or any other field

**Why a dedicated page:**
- Keeps the bulk-update grid clean (only active students shown by default)
- Makes status management intentional, not accidental
- Simple UI — just select students and toggle status
- Separates "manage student data" from "manage student lifecycle"

---

## 3. Visibility Rules

### The Golden Rule

**Accountant and Teacher pages must NEVER see inactive students.** No toggle. No filter. No exception.

They simply do not exist in those workflows.

### Summary Matrix

| Page / Module | Active Students | Inactive Students | Toggle Available? |
|---|---|---|---|
| **Admin Utilities → Student Status** | ✅ Visible | ✅ Visible | ✅ Yes (All / Active / Inactive) |
| **Admin Students list** | ✅ Visible by default | ❌ Hidden by default | ✅ Yes ("Include Inactive" toggle) |
| **Admin Students data (API)** | ✅ Sent | ❌ Sent only if `include_inactive=true` | N/A |
| **Admin Students options (API)** | ✅ Sent | ❌ Sent only if `include_inactive=true` | N/A |
| **Admin Fee Report students selector** | ✅ Visible | ❌ Hidden | ❌ No |
| **Admin Student Report Center picker** | ✅ Visible | ❌ Hidden | ❌ No (already active-only) |
| **Admin Dashboard** | ✅ Counted | ❌ Not counted | ❌ No |
| **Admin Fee Report engine** | ✅ Included | ❌ Excluded | ❌ No |
| **Attendance absentees page** | ✅ Visible | ❌ Hidden | ❌ No |
| **Attendance marking roll** | ✅ Visible | ❌ Hidden | ❌ No |
| **Teacher student list** | ✅ Visible | ❌ Hidden | ❌ No |
| **Teacher student detail** | ✅ Visible | ❌ Hidden | ❌ No |
| **Accountant receive fee** | ✅ Visible | ❌ Hidden | ❌ No |
| **Accountant late fees** | ✅ Visible | ❌ Hidden | ❌ No |
| **Accountant student list** | ✅ Visible | ❌ Hidden | ❌ No |
| **Fee generation command** | ✅ Generates fees | ❌ Skipped | ❌ No |

### Active Student

| Action | Allowed? |
|---|---|
| Visible in student lists | ✅ Yes |
| Editable in bulk-update | ✅ Yes |
| Collect fees | ✅ Yes |
| Mark attendance | ✅ Yes |
| Appear in reports | ✅ Yes |
| Appear in fee generation | ✅ Yes |
| Counted in dashboard | ✅ Yes |

### Inactive Student

| Action | Allowed? |
|---|---|
| Visible in student lists | ❌ No (except Utilities page, or Admin with toggle) |
| Editable in bulk-update | ❌ No — not in the grid |
| Delete | ✅ Yes (from Admin Students page) |
| Collect fees | ❌ No — not in any selector |
| Mark attendance | ❌ No — not on the roll |
| Appear in default reports | ❌ No |
| Appear in historical reports | ✅ Yes — if report range includes their active period |
| Counted in dashboard | ❌ No |
| Reactivate | ✅ Yes — via Utilities page |

---

## 4. Attendance Rules

| Scenario | Behavior |
|---|---|
| Student becomes inactive mid-month | Attendance already marked remains in history. No new attendance can be marked. |
| Inactive student on attendance roll | Hidden. Teacher sees only active students. |
| Absentees page | Inactive students excluded. |
| Attendance reports | Historical attendance is queryable by date range. If the report range includes a period when the student was active, their data appears. |
| Historical attendance | ✅ Fully accessible. Past records are never modified. |

---

## 5. Fee Rules

| Scenario | Behavior |
|---|---|
| Student becomes inactive with outstanding fees | Fees remain in DB for historical reference. Not collectable. Not shown in defaulter lists. |
| Student becomes inactive after fee generation | Already-generated fees remain. Not shown in active collection screens. |
| Fee collection screen | Inactive students not in selector. |
| Late fees / defaulter report | Inactive students excluded. |
| Fee report | Inactive students excluded by default. |
| Monthly fee generation | Only active students. Inactive students skipped. |
| Historical payments | ✅ Fully visible. Never modified. |

---

## 6. Historical Data Rules

| Data Type | After Inactivation |
|---|---|
| Historical attendance | ✅ Fully accessible |
| Historical fees | ✅ Fully accessible |
| Historical payments | ✅ Fully accessible |
| Historical reports | ✅ Accessible if report range overlaps active period |
| Already-generated PDFs | ✅ Unaffected |
| Student record | ✅ Accessible via Utilities page or Admin list with toggle |

---

## 7. Edge Cases

| Edge Case | Behavior |
|---|---|
| Student becomes inactive mid-month | Prior attendance visible. No new attendance. |
| Student inactive with outstanding fees | Fees remain in DB for reference. Not collectable. |
| Student inactive with unpaid balances | Balance visible in history. Not in active defaulter lists. |
| Student reactivated | Restored to full visibility. All history intact. |
| Marked inactive by mistake | Reactivation restores everything. No data lost. |
| Inactive during multi-year report | Active-period data included. Inactive-period excluded. |

---

## 8. Future Compatibility

| Future System | Compatibility |
|---|---|
| **Batch System** | `inactive` is student-level. Batches are group-level. No conflict. |
| **Promotion System** | Only active students promoted. Inactive students stay in last class. |
| **Pass Out System** | `status = 'inactive'` is interim. Later: `graduated` or `passed_out`. Current model is a boolean subset of a richer enum. |
| **Session Management** | Sessions are time-bound. Inactive data is still queryable by session. |

**Key principle:** `students.status` is a **present-tense** flag. It controls **active workflows**, not **historical queries**.

---

## 9. Implementation Plan

### Phase 1: New Utilities page — Student Status Management

**File:** New route + new React page

**Route:** `GET /admin/utilities/student-status` → `Admin/Utilities/StudentStatus.jsx`

**API:** `POST /admin/utilities/student-status/bulk-update` — accepts `{ student_ids: [...], status: 'active' | 'inactive' }`

**Page features:**
- Table of all students (name, father_name, current_status, enrollments)
- Multi-select checkboxes on each row
- Bulk action buttons: "Set Active" and "Set Inactive"
- Filter dropdown: "All" / "Active only" / "Inactive only"
- Search by name or father name

**Effort:** ~2 hours.

### Phase 2: Backend filtering — exclude inactive from all active workflows

Add `->where('students.status', 'active')` to these endpoints:

| Endpoint | File | Change |
|---|---|---|
| `/admin/students/data` | `routes/admin.php` line 136 | Add `->where('students.status', 'active')` |
| `/admin/students/options` | `routes/admin.php` line 156 | Add `->where('students.status', 'active')` + accept `?include_inactive=1` override |
| `/admin/students` list | `routes/admin.php` line 111 | Add `->where('students.status', 'active')` |
| `/students` list (Teacher/Accountant) | `routes/students.php` line 22 | Add `->where('students.status', 'active')` |
| `/students/{id}` detail (Teacher/Accountant) | `routes/students.php` line 57 | Add `->where('students.status', 'active')` — if student is inactive, return 404 |
| Absentees page | `routes/attendance.php` line 176 | Add `->join('students')` + `->where('students.status', 'active')` |
| Attendance marking (sections list) | `routes/attendance.php` (section loading) | Add `->join('students')` + `->where('students.status', 'active')` |
| Fee generation command | `app/Console/Commands/GenerateMonthlyFees.php` | Add `->join('students')` + `->where('students.status', 'active')` |
| Dashboard enrollments | `app/Http/Controllers/Admin/DashboardController.php` | Add `->join('students')` + `->where('students.status', 'active')` |
| Dashboard free students | `app/Http/Controllers/Admin/DashboardController.php` | Add `->where('students.status', 'active')` |
| Student Report Center picker | `app/Http/Controllers/Admin/StudentReportCenterController.php` | Already correct (active-only) |

**Effort:** ~2 hours. One-line changes.

### Phase 3: Admin Students list — add "Include Inactive" toggle

**File:** `resources/js/Pages/Admin/Students/Index.jsx`

**Change:** Add a checkbox toggle "Include Inactive" that passes `include_inactive=1` to `/admin/students/data`.

**Effort:** ~1 hour.

### Phase 4: Testing

- Verify inactive students hidden from Teacher screens
- Verify inactive students hidden from Accountant screens
- Verify inactive students hidden from attendance rolls
- Verify inactive students hidden from fee collection
- Verify Utilities page shows all students and can toggle status
- Verify reactivation restores full visibility
- Verify historical data still accessible

**Effort:** ~1 hour.

**Total effort: ~6 hours.**

---

## 10. Rules for Accountant & Teacher Pages (Summary)

| Role | Sees Inactive Students? | Can Search for Inactive? | Has Toggle? |
|---|---|---|---|
| **Teacher** | ❌ No | ❌ No | ❌ No |
| **Accountant** | ❌ No | ❌ No | ❌ No |
| **Admin** | ✅ Yes (via Utilities or toggle) | ✅ Yes (via Utilities) | ✅ Yes (on Students list) |

**This is non-negotiable.** Inactive students are completely invisible to Accountant and Teacher roles. They are not a concern for those roles.
