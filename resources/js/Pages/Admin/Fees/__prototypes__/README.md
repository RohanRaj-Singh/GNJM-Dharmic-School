# Phase 1 Fees UX Prototype

This directory contains the **Phase 1 React-only prototype** for the
Fees redesign described in
[`docs/architecture/16-fee-redesign-implementation-plan.md`](../../../../docs/architecture/16-fee-redesign-implementation-plan.md)
§5 and §11.

> **Status:** Prototype. **Not wired into any route.** **Not a
> production surface.** **No backend changes.** Stop here for UX
> review per §13 Step 3 of the planning doc.

## What's in this directory

| File | Role |
|---|---|
| `feeFixture.js` | Mock data: Harpreet canonical case + 5 additional cases (Simran, Gurleen, Jaspal, Aman, Ravi) per §9.2 / §11.1 |
| `FeesUxPrototype.jsx` | Self-contained React component integrating all 7 mockups: Mobile Index, Desktop Index, Filters Sheet, Active Filter Chips, Student Fee Sheet, Enrollment Drill-down, Collect Fee modal |
| `README.md` | This file |

## What this demonstrates

The prototype exercises **all §11.3 5-point checklist items** plus the
documented cases:

1. Mobile (375px): four enrollment rows visible without horizontal
   scroll; previous enrollment visually distinct from current.
2. Drilling into the Class 2 enrollment shows only its 3 fees
   (Aug UNPAID, Jul PAID, Jun PAID); the previous Class 1 fees do
   not appear, and the Kirtan / Music fees do not appear.
3. Drilling into the previous Class 1 enrollment shows only its 2
   own fees (Jul UNPAID, Jun PAID), including the outstanding
   historical fee.
4. The student-row total aggregates across all 4 enrollments
   (7 fees) without moving ownership of any fee.
5. Collect from any enrollment opens the dedicated modal with the
   correct student + enrollment context (Class 2 + Aug 2026 + Rs X,000).
6. All tap targets ≥ 44x44.

## How to preview the prototype

Three options, listed in increasing order of effort:

### Option A — CodeSandbox / StackBlitz (recommended for fastest review)

1. Zip this directory (`__prototypes__/`) plus the project's
   `resources/js/Components/Modal.jsx`,
   `resources/js/Components/DataTable.jsx`,
   `resources/js/utils/divisionType.js`, and
   `resources/js/Pages/Admin/Fees/components/feesFormatters.js`.
2. Upload to CodeSandbox as a Vite + React project.
3. Import `FeesUxPrototype` from `App.jsx` and render it.

### Option B — Local Vite dev (already wired)

The project's `vite.config.js` already handles JSX in `resources/js/`.
To mount this prototype temporarily for review without touching any
existing file:

```js
// resources/js/Pages/Admin/Fees/__prototypes__/_dev_mount.jsx
import FeesUxPrototype from "./FeesUxPrototype";
import { createRoot } from "react-dom/client";

if (import.meta.env.DEV && new URLSearchParams(location.search).has("feesPrototype")) {
  const host = document.getElementById("prototype-root") ?? document.body.appendChild(document.createElement("div"));
  host.id = "prototype-root";
  createRoot(host).render(<FeesUxPrototype />);
}
```

Then visit any existing admin route with `?feesPrototype=1` and the
prototype will mount in dev mode only. **Production builds will not
include this mount** because of `import.meta.env.DEV`. Delete the
`_dev_mount.jsx` file when review is complete.

### Option C — Standalone HTML (zero project wiring)

Use `preview.html` in this directory. Open it directly in a browser
after `npx vite` is running from the project root. The preview file
imports `FeesUxPrototype` through the project's existing Vite
config — no project edits needed.

## Constraints respected (per §16)

- **No production code changes.** No edits to `Index.jsx`,
  `CustomFee.jsx`, `FeesController.php`, `routes/admin.php`, or any
  existing component or test.
- **No backend touched.** No new routes, no new endpoints, no
  controller edits, no migrations.
- **No `window.confirm()`.** All confirmations would route through
  real Inertia flows in production.
- **No prototype route in production.** Mounting options are
  dev-only / Storybook / isolated HTML.

## What this does NOT cover

- Real persistence. The Collect button calls `onConfirm` which
  simply closes the modal in the prototype.
- Real route-driven filters. Filters live in component state.
- Real authorization. The prototype is rendered without policy
  gates because it has no user context.
- Server-side fee calculation. All amounts come from the fixture.

These are all deferred to Phase 4+ per the planning doc.

## Next gate

After UX review and approval:

- Phase 3: Backend / data-contract audit
- Phase 4: Minimal backend adaptation
- Phase 5: Connect prototype to real data
- Phase 6: Connect existing collection actions
- Phase 7: Production cutover

See `docs/architecture/16-fee-redesign-implementation-plan.md` §13
for the full step-by-step.