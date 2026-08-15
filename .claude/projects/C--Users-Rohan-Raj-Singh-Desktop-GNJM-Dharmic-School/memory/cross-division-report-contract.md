---
name: cross-division-report-contract
description: Cross-division reports accept any class_ids[] list; Student Report Center has division='all'; Accountant Students is cross-division by default
metadata:
  type: project
---

Cross-division report surfaces in the codebase:

- **Fees Report** (`POST /admin/reports/build` report=fees): accepts any `class_ids[]` list. The "All Classes" quick-pick button next to the class picker on `/admin/reports` selects every class. No per-division string gates anywhere in the query.
- **Attendance Report** (`POST /admin/reports/build` report=attendance): same shape — `class_ids[]` accepts an arbitrary list. Same "All Classes" button on the page.
- **Student Report Center** (`POST /admin/student-report-center/build`): `division='all'` is the sentinel that iterates every division the student is enrolled in (multi-class students).
- **Accountant Students** (`GET /accountant/students`): cross-division by default — no server-side division filter. The frontend `classFilter` state drives per-row scoping client-side.

**Why:** The audit's §6 L-2 + §5 gap #3 called out "no cross-division reports" as a gap. The fix here is **not a new server-side cross-division mode** — the existing endpoints already accept the necessary multi-class input. The fix is the UI affordance (the "All Classes" button) and the regression pin (`tests/Feature/CrossDivisionReportsTest.php`).

**How to apply:** Don't add a new `?all=1` query parameter or a hardcoded "all divisions" sentinel. The contract is "any class_ids[] you pass is honored". If a new report is added, follow the same pattern: accept an arbitrary list, expose the "All Classes" button, regression-pin the cross-division case.

Pinned by `tests/Feature/CrossDivisionReportsTest.php` (4 cases: Fees report, Attendance report, Student Report Center, Accountant Students).

Related: [[admin-divisions-page]] (the divisions page is the discovery surface for "what divisions does this school have?" — the "All Classes" button reads the same data).
