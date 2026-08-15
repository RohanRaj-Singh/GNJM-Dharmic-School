---
name: admin-divisions-page
description: Division settings page is at /admin/divisions; sidebar entry at AdminLayout.jsx:188; data endpoint at /admin/divisions/data
metadata:
  type: project
---

The admin "division settings" page lives at `/admin/divisions`. It lists every division the school has — bucketed via `DivisionTypeResolver::division()` — with its business-rule rollup (attendance days union, charges-fees flag, fee min/max range, class/section/student counts).

**Why:** The audit's §5 gap #1 noted that admins think in "classes" but the codebase thinks in "divisions + classes", with no admin-facing page that lists divisions. The page is the discovery surface for the resolved division concept.

**How to apply:** When a future admin feature asks "what division does X belong to?" or "are these two classes in the same division?", the canonical answer path is `DivisionController::buildDivisions()` (the JSON endpoint at `/admin/divisions/data` is the same data shape the page renders). Useful for bulk checks when adding a third+ class to confirm the resolver buckets it correctly.

Related: [[class-rename-bucket-lock]] (the `division` column is the explicit seam that the resolver's explicit-first reads), [[cross-division-report-contract]] (the cross-division queries fan out across every bucket the resolver returns).
