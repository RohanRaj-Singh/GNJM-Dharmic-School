# Fees Redesign — Implementation Plan & Prototype Strategy

> **Status:** Plan for review before any production code change. This is the §17
> deliverable from the embedded redesign spec, revised to incorporate the user's
> 5 corrections. Nothing in the codebase has been modified; this document only
> describes what would be built, why, and in what order.
>
> **Branch:** `refactor/architecture` · **Audience:** RohanRaj-Singh (project owner)
> **Hard rules (§16):** No production code, no Laravel/PHP changes, no migrations,
> no edits to `Index.jsx` / `CustomFee.jsx` / controller / routes / tests. Only this
> doc is produced.
>
> **Prerequisite reading:** `docs/architecture/15-fee-ui-ux-redesig.md` (current-state
> walkthrough, used as evidence) and `docs/25-admin-fees-page-redesign-plan.md`
> (the OLD phased plan, phases 0-4 of which are already shipped on
> `refactor/architecture` — referenced for what's already in place).
>
> **Revisions in this version (vs first draft):**
> 1. Phase ordering corrected — prototype now precedes backend changes (§5).
> 2. Two-tier payload model — Index payload stays lightweight; Student Fee
>    Sheet has its own detail endpoint (§4).
> 3. Reuse-Student-Center rule added — Fees sheet is fee-specific, not a
>    second student-report system (§4.3).
> 4. Historical-fees stress test strengthened with the canonical Harpreet
>    fixture and explicit per-enrollment assertions (§9.2).
> 5. Legacy controller field removal gated on a full consumer search,
>    not on "the new UI doesn't use it anymore" (§13 Step 10).
> 6. Prototype is dev-only / Storybook / isolated — never a production route
>    (§5.8).

---

## 1. Current architecture findings (what is reusable)

The Fees module is already well-factored from the prior stability-preserving
pass (the OLD plan in `docs/25-`). Phases 0-4 of that plan shipped and are
now baseline; this redesign layers new behavior on top.

### 1.1 Controller query (`app/Http/Controllers/Admin/FeesController.php`)

- **`index()`** at lines 34-251 — 5-action controller. Returns per-student
  groups via `groupBy('student_id')` at line 178, mapping to a shape with
  `class_name` (CSV), `class_types[]`, `section_name` (CSV), `paid_*`,
  `unpaid_*`, `total_amount`, and a nested `fees[]` (lines 192-232). The
  per-fee mapping is the canonical seam between DB and React.
- **`customIndex()`** at lines 343-387 — separate view model for
  `/admin/fees/custom`. Returns `{rows, sections}`. Unaffected by this redesign.
- **`collect()`** at lines 270-313 — validates `collection_date`, creates a
  `Payment`, locks the fee if custom (line 307), invalidates report cache.
  Idempotent (rejects double-pay at lines 275-283).
- **`deCollect()`** at lines 314-341 — soft-deletes the payment, unlocks the
  fee (line 336), audit-logs, invalidates the cache.
- **`generateMonthlyFees()`** at lines 253-268 — delegates to the existing
  `GenerateMonthlyFeeAction` (constructor-injected at line 22). Admin-only.
- **Custom-fee CRUD** at lines 393-584 — `storeCustomFee`, `updateCustomFee`,
  `destroyCustomFeeForStudent`, `destroyCustomFeeForSection`. Admin-only;
  update/delete of paid custom fees is rejected (lines 467, 511).
- **`studentIdFor()`** at lines 29-33 — centralizes the lookup so all seven
  write paths stay consistent.

### 1.2 Division resolver (`app/Support/DivisionTypeResolver.php`)

- **`division()`** at lines 36-57 — single source of truth. Order: explicit
  `division` column, then `type contains 'kirtan'`, then
  `type contains 'gurmukhi'`, then `name contains 'kirtan'`, then default
  `'gurmukhi'`. Controller calls it per fee at `FeesController.php:192-201`
  and `:225-229`. Already dynamic — no Gurmukhi/Kirtan coupling in code.

### 1.3 Routes (`routes/admin.php:551-565`)

- 8 fee routes total: `fees.{index, generate-monthly, {fee}.collect,
  {fee}.deCollect}` and `fees.custom.{index, store, update,
  destroy.student, destroy.section}`. All names stable and pinned by tests.

### 1.4 Policy (`app/Policies/FeePolicy.php`)

- **`viewAny`** (line 19) — admin OR accountant.
- **`collect`** (line 24) — admin OR accountant.
- **`deCollect` / `generateMonthly` / `createCustom` / `updateCustom` /
  `deleteCustom`** (lines 30-57) — admin only.
- All gates already correct; nothing to change.

### 1.5 Page decomposition (`resources/js/Pages/Admin/Fees/`)

- `Index.jsx` (812 lines) — main page. Inline `useState` for filter inputs,
  inline `useEffect` to fetch `/admin/classes/options` and
  `/admin/sections/options`. Summary tiles at lines 763-789 are already
  present.
- `CustomFee.jsx` — separate page, out of scope.
- `components/FilterSection.jsx`, `FeeActionCard.jsx`, `FeeGroupColumn.jsx`
  — extracted in OLD Phase 0; all reusable.
- `components/CollectFeeModal.jsx` (71 lines) — hand-rolled modal at
  lines 27-68. Will be migrated to shared `Modal` if any new collection UI
  is added.
- `components/feesFormatters.js` — `formatMonthLabel`,
  `formatCollectionDate`. Reusable.

### 1.6 Shared components available (`resources/js/Components/`)

- `Modal` (Headless UI; props: `show`, `maxWidth sm/md/lg/xl/2xl`,
  `closeable`, `onClose`, `children`) — primary surface for any new
  modal/sheet.
- `DataTable` (tanstack) — for desktop student list.
- `ConfirmDialog` — exists per OLD plan Phase 5; used for un-collect and
  monthly generation.
- `FilterBar`, `SearchInput`, `StatusBadge`, `RoleGate`, `DivisionLegend`,
  `PageLoader` — auxiliary, available for the new flow.

### 1.7 Reuse matrix

- **Reuse as-is:** controller query shape, division resolver, route names,
  policy gates, payment model, custom-fee CRUD, `FeePolicy`, `Modal`,
  `DataTable`, `ConfirmDialog`, `feesFormatters`.
- **Reuse after small extension:** the per-fee mapping in
  `FeesController.php:217-232` needs to carry `student_section_id` (it does
  not today — see §4); the per-student grouping needs to add an
  `enrollments[]` layer.
- **Do not reuse:** the expanded-row render of `Index.jsx:383-428` — the
  new UX replaces this with a Student Fee Sheet modal. `FeeGroupColumn` and
  `FeeActionCard` stay; their consumer changes.

---

## 2. Current Fees Index problem inventory (condensed from §8 of doc 15)

The P-U1..P-T5 inventory in `15-fee-ui-ux-redesig.md` §8 is condensed here
and re-grouped by relevance to the new spec. We do not re-derive; the
original doc remains the evidence source.

### 2.1 Multi-enrollment / dynamic-class issues (most relevant)

- **P-U1 — Per-student grouping loses per-enrollment context.** All of a
  student's fees are flattened into one row. A student who moved from
  Class 2 to Class 3 last month has their old fees merged with the new
  class. The new spec requires Current vs Previous Enrollments as
  first-class UI buckets.
- **P-U2 — The expanded-row UI cannot answer "what does this student owe
  right now across all classes".** A 3-class student requires expand →
  click each of 3 division columns → read across. The new spec moves this
  to a Student Fee Sheet.
- **P-T1 — Cross-division visibility is OK at the row level
  (`class_types[]`, per-fee `class_type`) but the rest of the UI assumes
  one row per student-with-class.** Historical enrollments are not
  surfaced at all; the current query joins on `orig_enrollment` per fee
  and `current_enrollment` for the active same-class row, but the
  per-student group is not split.

### 2.2 Mobile UX issues (P-M1..P-M4)

- **P-M1 — `DataTable tableClassName="min-w-[1000px] text-sm"`**
  (`Index.jsx:799`) forces horizontal scroll on narrow viewports.
- **P-M2 — Per-row action buttons are below WCAG 2.5.5's 44x44 tap
  target** (`FeeActionCard.jsx:35,43` use `px-2 py-1 rounded text-xs`).
- **P-M3 — Filter card stretches to >200% of viewport height when fully
  open at 375px** (4 accordions with sub-captions).
- **P-M4 — Collection modal works on mobile but lacks student context
  header** (spec §7 wants "Harpreet Singh / Class 2 · Section A /
  August 2026 / Monthly Fee"). `CollectFeeModal.jsx:31-33` shows only
  title + amount.

### 2.3 Noise / clarity issues (less relevant, still noted)

- **P-N1 — 12 sub-captions in `text-[11px] text-gray-500`** in the filter
  card. The new "less-used filters behind a sheet" approach removes most.
- **P-N2 — `Generate Monthly Fees` has primary-action visual weight but
  is rarely used.** Not addressed in this redesign.
- **P-N3 — `window.confirm()` for un-collect** — to be verified in
  Phase 0 audit that OLD plan Phase 5 `ConfirmDialog` rollout is in
  place.

### 2.4 Not in scope for this redesign

- P-Bulk / "Mark all paid" (deferred in OLD plan §Out of Scope).
- P-Server pagination (same).
- P-Search debounce (same).
- P-Receipt/PDF (same).

---

## 3. Proposed UX architecture

The new flow is: **Fees list → Select student → Student Fee Sheet →
Select enrollment → Fee history → Collect**.

```
Main page (mobile)
+------------------------------------------------+
|  Fees                                          |
|  [ Search ]  [ Unpaid this month v] [Filters]  |
|  Total Unpaid Rs X  Total Paid Rs Y  Students N |
|  Active: [ Unpaid x] [ August 2026 x]          |
|  Harpreet Singh   Class 2 . Section A   View > |
|  Unpaid Rs 2,000                               |
|  Simran Kaur     Kirtan . Sunday         View >|
|  Unpaid Rs 500                                 |
+------------------------------------------------+

Tap "View" -> Student Fee Sheet:
+-------------------------------------------+
|  Harpreet Singh                       x   |
|  Current Enrollments                      |
|   Class 2 . Section A   Unpaid Rs 2,000 > |
|   Kirtan  . Sunday      Unpaid Rs   500 > |
|   Music   . Section B   Paid              |
|  Previous Enrollments                     |
|   Class 1 . Section A   Balance Rs 3,000 >|
+-------------------------------------------+

Tap "Class 2 . Section A" -> Enrollment fee details:
+-------------------------------------------+
|  < Class 2 . Section A   Unpaid Rs 2,000  |
|  Recent Fees                              |
|   August 2026   Monthly Fee   Rs 2,000    |
|                       [Collect]           |
|   July 2026    Monthly Fee   Paid         |
|  View older fees (4) >                    |
+-------------------------------------------+

Tap "Collect" -> Collection modal:
+-------------------------------------------+
|  Collect Fee                              |
|  Harpreet Singh . Class 2 . Section A     |
|  August 2026 . Monthly Fee                |
|  Amount [ Rs 2,000 ]  Date [ 17 Aug 2026 ]|
|  [ Cancel ]                  [ Collect ]  |
+-------------------------------------------+
```

### 3.1 Main page (mobile-first)

- **Header:** "Fees" title; Generate Monthly Fees demoted to a text-link
  or kebab-menu entry.
- **Search:** full-width input, top-of-fold.
- **Primary status/filter control:** single compact pill row
  (`All | Paid | Unpaid`) + a Month chip if set. OLD plan Phase 6 default
  seeds `month=<current>&status=unpaid` on canonical URL.
- **Filters button:** opens the Filter Sheet (slide-up on mobile,
  side-sheet on desktop).
- **Active filter chips:** beneath the filter button, one chip per active
  filter with an inline x.
- **Collection summary:** 3 tiles (Total Unpaid / Total Paid / Students
  Shown) — already shipped at `Index.jsx:763-789`, reused.
- **Student list:**
  - **Mobile (< 640px):** stacked student cards (name, current class/section,
    unpaid amount, primary action).
  - **Desktop (>= 1024px):** `DataTable` with `#`, Student, Class/Section
    (single best line), Unpaid, Action. Expanded-row pattern removed;
    Action column is a single `View` button.

### 3.2 Filter sheet / modal

`<Modal maxWidth="md">` containing the same filter inputs the OLD plan
already shipped (Year, Class, Section, Status, Month, Month range,
Collection date range). Inputs live in a modal, not a permanent card.
Closing the modal keeps filters applied.

### 3.3 Active filter chips

Below the filter button. Each chip: `{label} x`. Tap x clears that one
filter key and re-fetches via `router.get`.

### 3.4 Student Fee Sheet (new component)

`StudentFeeSheet` — a `<Modal maxWidth="lg">` containing:

**Level 1 — Student overview:**
- Student header (name, father name).
- "Current Enrollments" — list of cards/rows. Each: class . section,
  fee summary, chevron right.
- "Previous Enrollments" — list with `Balance: Rs X` or `Paid` or
  `No balance`.

**Level 2 — Enrollment fee details (in-sheet drill-down):**
- Header with back arrow + class . section + summary.
- "Recent" fees — last N months (default 3).
- "View older fees (count)" — tap to expand into a paginated list.

### 3.5 Collection modal

`CollectFeeModal` is replaced by `CollectFeeSheet` that adds the
student/enrollment context header. Reuses the shared `<Modal>`
(Headless UI). Validation, submission, audit logging remain on the
controller — unchanged.

---

## 4. Student → Enrollment → Fee data contract

The student fee UX is a two-tier payload. This is the most important
technical decision in the redesign — it shapes the controller work,
the network payload size, and the testing surface.

```
                 FEES INDEX
                     |
          +----------+----------+
          |                     |
    Student Summary       Filters/Search
          |
       tap student
          ↓
   STUDENT FEE SHEET
          |
    +-----+-----+
    |           |
 Current      Previous
Enrollments  Enrollments
    |           |
    +-----+-----+
          ↓
   Select Enrollment
          ↓
    Fee History
          ↓
       Collect
          ↓
   Existing collect()
```

- **Fees Index** carries a **lightweight summary payload** per student.
- **Student Fee Sheet** has its **own detail endpoint**, returning a
  **student-specific detail payload** (Current Enrollments + Previous
  Enrollments, each with its own complete relevant fee history).
- This is **not** "load every fee for every student and ship them all
  in one payload". That distinction will matter as the school grows.

The Fees sheet is fee-specific by design. It is **not** a duplicate
of the Student Center / complete student report — that already exists
in the application and must not be re-implemented here. The Fees
sheet answers only: *What does this student owe, for which
enrollment/class, and what has been paid?*

### 4.1 Two-tier payload shape

**Tier 1 — Fees Index payload** (lightweight summary):

```js
{
  fees: Array<{
    student_id,
    student_name,
    father_name,
    primary_class,          // best single class label (first current enrollment)
    primary_section,        // best single section label
    unpaid_count, unpaid_amount,
    paid_count, paid_amount,
    total_amount,
  }>,
  filters: { ...same 10 keys as today... },
}
```

The Index payload intentionally does NOT carry per-fee rows. The
prototype mock data for this tier is small — one row per student with
totals only.

**Tier 2 — Student Fee Sheet payload** (detail, from
`GET /admin/fees/students/{student}/detail` — likely/expected
architecture; see §4.6):

```js
{
  student: {
    id, name, father_name,
    current_enrollments: Array<{
      student_section_id, class_id, class_name, division_key,
      section_id, section_name,
      started_at,
      fee_summary: { paid_count, paid_amount, unpaid_count, unpaid_amount },
      fees: Array<{
        id, type, month, title, amount, paid_at, class_type, is_paid,
      }>,
    }>,
    previous_enrollments: Array<{
      student_section_id, class_id, class_name, division_key,
      section_id, section_name,
      started_at, transferred_at,
      fee_summary: { paid_count, paid_amount, unpaid_count, unpaid_amount },
      fees: Array<{
        id, type, month, title, amount, paid_at, class_type, is_paid,
      }>,
    }>,
  },
}
```

Each enrollment owns its own `fees[]`. Fees never move between
enrollments; the per-enrollment grouping enforces that invariant.

### 4.2 Why the existing Index payload is insufficient for the Sheet

The current `FeesController::index()` is filter-driven. With
`?month=2026-08&status=unpaid`, the query at `FeesController.php:128-162`
narrows the result set to **only** August 2026 unpaid fees. If the
UI then opens Harpreet and asks "show me all of Harpreet's July and
June paid fees too", those rows are not in the payload — they were
filtered out at the SQL layer.

The prototype must therefore use **mock data** for both tiers and
not depend on the existing Index payload for Sheet content. The
detail endpoint is **likely/expected architecture**, not optional.

### 4.3 Reuse — not duplicate — the Student Center

The Student Center / complete student report is the canonical
"everything about a student" surface. The Fees sheet is **not**
that surface. The Fees sheet only answers fee-specific questions:

- What does this student owe right now?
- For which enrollment/class?
- Across which historical enrollments, with what outstanding
  balance?
- What has been paid, when?

It deliberately does **not** render attendance, demographics,
contact info, or other student report fields. The detail endpoint
serves fee records only.

### 4.4 What the existing `FeesController::index()` already returns

Per-student row (lines 205-233 today):

| Field | Today | New Index payload | Notes |
|---|---|---|---|
| `student_id` / `student_name` / `father_name` | yes | yes | unchanged |
| `class_name` / `section_name` | CSV string | `primary_class` / `primary_section` (single label) | CSV becomes a single label |
| `class_types` | array | not at row level | moved into detail endpoint |
| `paid_*` / `unpaid_*` / `total_amount` | row-total | yes | unchanged — keeps summary tiles working |
| `fees[]` | flat array | **not in Index payload** | moved into detail endpoint per-enrollment |

Per-fee (lines 217-232 today): the per-fee mapping is only relevant
to the **detail endpoint** in the new model. The Index does not
ship per-fee rows at all.

### 4.5 Backend gap analysis

The detail endpoint is a **new** endpoint. Verifying whether
existing endpoints already serve student fee detail is part of
Phase 3 (Backend audit). Candidates to check during that audit:

- The Student Center / student report controller (likely
  `app/Http/Controllers/StudentController.php` based on the
  DivisionTypeResolver docblock's reference).
- Any existing `/admin/students/{id}/fees` or similar route.
- `StudentReportCache` (mentioned in `FeesController.php:21`) may
  already aggregate per-student fee data.

If an existing endpoint can be **extended** rather than a new
endpoint **added**, that is the preferred path. New routes only
when no existing endpoint can carry the data without scope creep.

### 4.6 Index payload changes (minimal)

The Index controller changes are small but should not be the
first move:

1. Replace `class_name` (CSV) and `section_name` (CSV) with
   `primary_class` and `primary_section` (single label — first
   current enrollment).
2. Drop the per-fee `fees[]` from the row level (it moves to the
   detail endpoint).
3. Keep `class_types[]`, `paid_*`, `unpaid_*`, `total_amount` at
   the row level — summary tiles and active-filter chips still
   depend on them.

These changes are **proposed for Phase 4** (Minimal backend
adaptation), gated on Phase 1 (prototype) and Phase 3 (audit)
approvals.

### 4.7 What does NOT change

- All 8 routes are untouched (until Phase 4 adds the detail
  endpoint, if no existing endpoint can be extended).
- `collect`, `deCollect`, `generateMonthlyFees`, custom-fee CRUD
  are untouched.
- `FeePolicy` is untouched.
- Payment model, fee model, audit log, report cache are untouched.
- The 10 existing tests are untouched — none assert the row-level
  `class_name` (CSV) or `section_name` (CSV) shape in a way that
  blocks the new Index payload; they assert
  `fees.0.student_name`, `fees.0.fees.0.class_type`, etc. (see
  §9). The Phase 4 change is gated on re-verifying each test.

---

## 5. Phased implementation plan

The original draft of this document proposed Phase 1 as a backend
data-contract change. That ordering is **rejected**: we cannot
justify modifying `FeesController` until we have validated the UX
against mock data. The corrected order is **prototype first,
backend second**.

Each phase ends with a named gate; the gate must hold before the
next phase begins. **Laravel/PHP is not touched until Phase 4.**

### Phase 0 — Current-state verification

**Build:** none. **Verify:** the findings in §1 of this doc match the
current state of `Index.jsx`, `FeesController.php`, `DivisionTypeResolver`,
routes, policy, and components. Spot-check that:
- `FeesController.php:178-234` produces the row shape documented in §4.4.
- `Index.jsx:763-789` summary tiles are still in place.
- `ConfirmDialog` is wired into un-collect and monthly-generation
  confirmations (was shipped in OLD plan Phase 5).

**Gate:** a one-page diff (or a separate verification note)
confirming no drift from §1. If drift is found, update §1 of this doc
before moving on.

### Phase 1 — Pure React prototype with mock data

This is the **first build phase**. No backend changes, no route
additions, no controller edits. Everything runs on a local mock
fixture. The prototype is **not** a production route — see §5.8.

**Build (in order):**
1. Mock data fixture for the §11 stress-test scenario plus 5
   additional mock cases (single-class, all-paid, no-fees,
   zero-balance enrollment, multi-class without previous).
2. **Mobile Fees Index** — `StudentCard`-based list at 375px.
3. **Desktop Fees Index** — `DataTable`-based list at 1280px.
4. **Filters Sheet** — `<Modal>` containing the existing filter
   inputs, plus **Active Filter Chips** above the list.
5. **Student Fee Sheet** — modal opened by tapping a student;
   renders Current + Previous Enrollments, then drills into one
   enrollment's fee history with "View older fees" expansion.
6. **Collect Fee modal** — focused modal with student + enrollment
   context header, amount + date inputs, submit/cancel wired to a
   **no-op handler** (the prototype does not call any endpoint).
7. A small dev-only entry point that mounts the prototype (see
   §5.8) so the user can review the UX without it being a
   production route.

**Gate (UX approval):**
- All 6 mock cases render correctly on mobile and desktop.
- §11.3 5-point checklist passes for the critical stress-test
  case.
- All tap targets ≥ 44x44.
- No `window.confirm()` calls anywhere in the prototype.
- Visual review with the user — UX must be **explicitly approved**
  before Phase 2 starts.

### Phase 2 — UX approval

**Build:** none. **Action:** present the prototype to the user for
review. Capture feedback as a revision list. **The user must
explicitly approve the UX direction** before any backend work
starts.

**Gate:** user sign-off on the UX, recorded as a revision of this
document if feedback requires doc changes.

### Phase 3 — Backend / data-contract audit

**Build:** none. **Audit:** compare the prototype's prop needs
(§4.1, §4.2) against what the existing backend already exposes.
Specifically:
- Does the Student Center / student-report controller already
  serve per-student fee detail? If yes, **extend** that endpoint;
  do not add a duplicate.
- Does any existing route already aggregate per-student fee data
  across all enrollments (current + previous)? Examples to search:
  `app/Http/Controllers/StudentController.php`,
  `/admin/students/{id}`, `/admin/student-report-center`, anything
  using `StudentReportCache`.
- If a suitable endpoint exists, the prototype connects to it
  in Phase 4 with no new route added.
- If no endpoint exists, **propose** the smallest new endpoint that
  serves the §4.2 detail payload. The proposal is reviewed and
  approved before any code is written.

**Gate:** an audit document identifying either (a) an existing
endpoint that can be extended, or (b) a proposed new endpoint with
justification for why no existing endpoint fits.

### Phase 4 — Minimal backend adaptation

**Build:**
- If Phase 3 found an existing endpoint to extend: extend it
  (controller + tests).
- If Phase 3 proposed a new endpoint: add the smallest possible
  endpoint that serves §4.2. Add it under the existing fee routes
  (`routes/admin.php:551-565`) with the same policy gates.
- Index payload changes per §4.6 only if the prototype requires
  them. The proposed changes (`primary_class` / `primary_section`,
  dropping per-fee rows from row level) are gated on every
  existing test in §9.1 remaining green.

**Gate:** all 10 tests in §9.1 green; new tests in §9.2 added
(test-first) and green.

### Phase 5 — Connect prototype to real data

**Build:** swap the prototype's mock fixtures for the real
backend payload (Index payload + detail endpoint). The UI is
already shaped for §4.1/§4.2, so this is wiring, not redesign.

**Gate:** the prototype renders the same way with real data as it
did with mock data, for all 6 mock cases (now reconstructed in a
test fixture).

### Phase 6 — Connect existing collection actions

**Build:** wire the Collect Fee modal to the existing
`admin.fees.collect` endpoint (route, controller method, and policy
unchanged). Replace the no-op handler from Phase 1. Add success /
error toasts identical to the current page. Validation messages
identical to the current page.

**Gate:** `FeesCollectionSheetTest` (real-data version) green;
manual smoke: collect, de-collect, audit log entry, report cache
invalidation all behave identically to the current page.

### Phase 7 — Production cutover

**Build:**
- Behind the **same** mechanism used by the OLD plan Phase 6
  (`?prototype=fees` query param OR `localStorage` flag), mount the
  prototype at `/admin/fees`.
- Run for 1-2 sprints in parallel with the existing `Index.jsx`.
- After 1 sprint of stable usage, remove the old expanded-row UI
  (`Index.jsx:383-428` and the `renderExpandedRow` plumbing).
- After 1 more sprint, remove the prototype flag.

**Gate (after each sub-step):**
- All 17 tests green (10 existing + 7 new).
- Summary tile values match the rolled-up totals.
- No `window.confirm()` left in the file.
- Mobile screenshot of the §11 critical case is on file.

### 5.8 Prototype isolation — not a production route

The prototype is **not** mounted at a production route such as
`/admin/fees/prototype`. Doing so risks the prototype becoming a
permanent admin surface.

The preferred mount options (any one is acceptable; pick during
Phase 1 implementation):

- **Local-only Storybook story** (`resources/js/Pages/Admin/Fees/__stories__/Index.stories.jsx`)
  — renders the prototype with mock data inside Storybook; no URL
  inside the running app.
- **A `<FeesPrototypePreview>` dev-only React tree** rendered when
  `import.meta.env.DEV === true` and a `?feesPreview=1` query param
  is present, but the route is `/admin/fees` itself (the prototype
  replaces the existing page in dev only, never in production
  builds).
- **A Vite-only `/admin/__dev/fees-prototype` route registered
  inside a `routes/admin.dev.php` file loaded only when
  `APP_ENV !== 'production'`** — guard with a config check.

Whatever option is chosen, the rule is: **the prototype is
reviewable by the user but not reachable from the production
admin nav, sidebar, or any persistent URL**.

---

## 6. Files likely to change

### 6.1 Frontend

| Path | Type | Phase | Why |
|---|---|---|---|
| `resources/js/Pages/Admin/Fees/Index.jsx` | MODIFY | Phase 7 | swap to new layout |
| `resources/js/Pages/Admin/Fees/components/SummaryTiles.jsx` | NEW | Phase 1 | extract from `Index.jsx:763-789` |
| `resources/js/Pages/Admin/Fees/components/ActiveFilterChips.jsx` | NEW | Phase 1 | chips row |
| `resources/js/Pages/Admin/Fees/components/FiltersModal.jsx` | NEW | Phase 1 | filter sheet |
| `resources/js/Pages/Admin/Fees/components/StudentCard.jsx` | NEW | Phase 1 | mobile card |
| `resources/js/Pages/Admin/Fees/components/DesktopFeesTable.jsx` | NEW | Phase 1 | desktop table |
| `resources/js/Pages/Admin/Fees/components/FeeSummaryTile.jsx` | NEW | Phase 1 | summary tile |
| `resources/js/Pages/Admin/Fees/components/StudentFeeSheet.jsx` | NEW | Phase 1 | student sheet |
| `resources/js/Pages/Admin/Fees/components/EnrollmentFeeList.jsx` | NEW | Phase 1 | per-enrollment fee history |
| `resources/js/Pages/Admin/Fees/components/CollectFeeSheet.jsx` | NEW | Phase 1 | dedicated collection modal |
| `resources/js/Pages/Admin/Fees/__mocks__/feeFixture.js` | NEW | Phase 1 | Harpreet canonical + 5 additional fixtures |
| `resources/js/Pages/Admin/Fees/__stories__/Index.stories.jsx` | NEW (optional) | Phase 1 | Storybook entry if §5.8 option chosen |
| `resources/js/Pages/Admin/Fees/components/CollectFeeModal.jsx` | DELETE | Phase 7 | after cutover (replaced by `CollectFeeSheet.jsx`) |
| `resources/js/Pages/Admin/Fees/components/feesFormatters.js` | MODIFY | Phase 1 | add `formatBalance` |
| `resources/js/Pages/Admin/Fees/CustomFee.jsx` | UNCHANGED | — | not in scope |
| `resources/js/Components/Modal.jsx` | UNCHANGED | — | reused as-is |
| `resources/js/Components/DataTable.jsx` | UNCHANGED | — | reused as-is |

Note: All Phase 1 components are prototype-only — they live under
`resources/js/Pages/Admin/Fees/` (or a sub-folder) and are mounted
through the §5.8 dev-only mechanism, not on a production route.

### 6.2 Backend

| Path | Type | Phase | Why |
|---|---|---|---|
| `app/Http/Controllers/Admin/FeesController.php` | MODIFY | Phase 4 | minimal: extend existing endpoint OR add detail endpoint per §4.5 |
| `routes/admin.php` | MODIFY (conditional) | Phase 4 | only if no existing endpoint can be extended; new route under `fees.*` namespace |
| `app/Policies/FeePolicy.php` | UNCHANGED | — | permissions already correct |
| `app/Support/DivisionTypeResolver.php` | UNCHANGED | — | already dynamic |
| `app/Actions/GenerateMonthlyFeeAction.php` | UNCHANGED | — | out of scope |
| `app/Models/Fee.php`, `Payment.php`, `StudentSection.php` | UNCHANGED | — | out of scope |
| `app/Http/Controllers/StudentController.php` (or wherever `StudentReportCache` is hydrated) | EXTEND (conditional) | Phase 4 | only if audit in Phase 3 finds this is the right place |

### 6.3 Tests

| Path | Type | Phase | Why |
|---|---|---|---|
| 10 existing tests (listed in §9.1) | UNCHANGED | re-verified Phase 4 | 10 gate tests must stay green |
| `tests/Feature/FeesIndexHistoricalMultiClassTest.php` | NEW | Phase 4 | canonical Harpreet fixture — 7 assertions |
| `tests/Feature/FeesIndexMultiClassEnrollmentTest.php` | NEW | Phase 4 | 3-class + previous enrollment pin |
| `tests/Feature/FeesIndexFilterChipTest.php` | NEW | Phase 4 | filter chip removal pin |
| `tests/Feature/FeesCollectionSheetTest.php` | NEW | Phase 4 | dedicated collection flow |
| `tests/Feature/FeePermissionBoundaryTest.php` | NEW | Phase 4 | policy on per-enrollment collect |
| `tests/Feature/FeeDetailEndpointTest.php` (conditional) | NEW (conditional) | Phase 4 | only if a new detail endpoint is added in Phase 4 |

### 6.4 Documentation

| Path | Type | Why |
|---|---|---|
| `docs/architecture/16-fee-redesign-implementation-plan.md` | NEW | this doc |
| `docs/architecture/11-Task-Tracker.md` | MODIFY (Phase 7) | record the rollout |

---

## 7. Components likely to be created

All new components live under `resources/js/Pages/Admin/Fees/components/`
unless noted. Props are rough shapes — finalize during implementation.

### 7.1 `SummaryTiles`

- Reuses `feesFormatters`.
- Props: `{ totalUnpaid: number, totalPaid: number, studentCount: number }`.
- Pure presentational; lift calculation to parent. Extracted from
  `Index.jsx:763-789`.

### 7.2 `ActiveFilterChips`

- Reuses `feesFormatters`.
- Props: `{ filters, onRemove: (key) => void, onReset: () => void }`.
- One chip per non-empty filter key with an inline x that calls
  `onRemove(key)`. Includes "Clear all" when more than one chip.

### 7.3 `FiltersModal`

- Reuses `<Modal maxWidth="md">`, `FilterSection`, `FeeFilterSelect`,
  `SearchInput`.
- Props: `{ open, onClose, filters, onApply, classes, sections }`.
- Same inputs as the current filter card, but in a modal. On `Apply`,
  calls `onApply(newFilters)` and closes.

### 7.4 `StudentCard`

- Reuses `feesFormatters`.
- Props: `{ student: StudentRow, onOpen: (studentId) => void }`.
- Mobile card layout. Shows student name, the "primary" current
  class/section (first enrollment in `enrollments[]` where
  `is_current` is true), the unpaid amount. The entire card is the
  tap target.

### 7.5 `StudentFeeSheet`

- Reuses `<Modal maxWidth="lg">`.
- Props: `{ studentId, onClose }`.
- Internal state for the current enrollment view. May fetch
  `/admin/fees/{student}/detail` (new endpoint — see §8) if list-page
  payload is too large. Renders student overview, then drills down.

### 7.6 `EnrollmentFeeList`

- Reuses `FeeActionCard`, `feesFormatters`.
- Props: `{ enrollment: EnrollmentRow, onCollect: (fee) => void, onDeCollect: (feeId) => void }`.
- Renders per-enrollment fee history with a default cap (3-6 items)
  and a "View older fees (N)" expansion.

### 7.7 `CollectFeeSheet`

- Reuses `<Modal maxWidth="md">` (was hand-rolled in `CollectFeeModal.jsx`).
- Props: `{ fee, studentContext, enrollmentContext, collectionDate, onDateChange, onClose, onConfirm }`.
- Dedicated collection modal with student + enrollment context header
  per spec §7.

### 7.8 Prototype mount (dev-only, NOT a production route)

The prototype is **not** a standalone route. It is one of the three
mount options listed in §5.8 (Storybook story, dev-only render at
`/admin/fees`, or `routes/admin.dev.php` guarded by
`APP_ENV !== 'production'`). It reuses all of the above + `DataTable`
+ `AdminLayout`, plus the `__mocks__/feeFixture.js` mock data from §6.1.

The prototype must not be reachable from the production admin nav,
sidebar, or any persistent URL. The mount is reviewable by the user
during Phase 2 but cannot accidentally become a permanent admin
surface.

---

## 8. Backend changes required, if any

Per spec §16: "No database redesign without evidence. No migrations
unless proven necessary."

### 8.1 Required (small, only if Phase 3 audit says so)

The Phase 3 audit decides whether to extend an existing endpoint or
add a new one. **Both paths are small** — no DB changes, no
migrations, no new columns. The data is already in the joined
tables (`FeesController.php:42-95`).

**Path A — Extend existing endpoint (preferred if audit finds one):**
1. Surface `student_section_id` per fee (the column is in `fees.*`,
   selected at line 74, but not currently emitted in the per-fee
   mapping at lines 217-232).
2. Group the detail response by `student_section_id` per student
   into `current_enrollments[]` and `previous_enrollments[]`
   (per §4.2).

**Path B — Add a new detail endpoint:**
1. Add `GET /admin/fees/students/{student}/detail` under
   `routes/admin.php:551-565`.
2. Reuse the same query + join at `FeesController.php:42-95`, but
   without the filter chain — return every fee for the student
   across all enrollments.
3. Apply the same `FeePolicy::viewAny` gate.

### 8.2 Index payload changes (minimal, §4.6)

- Replace `class_name` (CSV) and `section_name` (CSV) at the row
  level with `primary_class` and `primary_section` (single label).
- Drop the per-fee `fees[]` from the row level (it moves to the
  detail endpoint per §4.1).
- Keep `class_types[]`, `paid_*`, `unpaid_*`, `total_amount` at
  the row level — summary tiles and active-filter chips still
  depend on them.

**These changes are gated on every test in §9.1 remaining green.**

### 8.3 Explicitly not changed

- No DB schema change. No new migration. No new column.
- No `FeePolicy` change.
- No route additions/removals/renames.
- No `collect`/`deCollect`/`generateMonthlyFees` change.
- No custom-fee CRUD change.
- No `Payment` model change.

---

## 9. Tests required

### 9.1 Existing tests to preserve (unmodified, must remain green)

| Test | Pins |
|---|---|
| `AdminPageSmokeTest` | `Admin/Fees/CustomFee` renders |
| `AdminDataEndpointSmokeTest` | Filter query-string round-trip on `admin.fees.index`; basic `fees` shape |
| `AuditTrailTest` | `admin.fees.collect / deCollect / custom.store / custom.update / custom.destroy.student / generate-monthly` audit |
| `FeesIndexQueryTest` | `fees.0.class_types`, `fees.0.fees[*].class_type`, `fees.0.student_name`, `fees.0.section_name`, `fees.0.class_name`, `fees.0.fees.0.month` |
| `FeeUniqueIndexTest` | Fee uniqueness invariants |
| `FeeDeCollectTest` | `admin.fees.collect` / `deCollect` lock/unlock lifecycle |
| `MonthlyFeesGenerationTest:206` | `admin.fees.generate-monthly` |
| `AuthorizationPolicyMatrixTest` | `FeePolicy::*` paths |
| `FeePolicyTest` | Same |
| `MultiClassBackwardCompatTest:137-175` | `$row['class_types']` + per-fee `class_type`; Music bucket |

**Important:** `FeesIndexQueryTest::test_fee_shows_current_section_within_same_class`
asserts `fees.0.section_name` and `fees.0.class_name` as strings. After
Phase 4 these fields may no longer exist at the row level (they are
replaced by `primary_class` / `primary_section` per §4.6). **See
§10 / §13 Step 10 for the removal gate — do not remove them in
Phase 4.**

### 9.2 New tests required

The historical-fees correctness test is the **canonical stress
test** for this redesign. It directly protects the rule that fees
never move between enrollments.

**Fixture (the canonical Harpreet case):**

```
Student: Harpreet

CURRENT
├── Class 2
│   ├── August 2026 -> UNPAID
│   ├── July 2026   -> PAID
│   └── June 2026   -> PAID
│
├── Kirtan
│   └── August 2026 -> PAID
│
└── Music
    └── August 2026 -> UNPAID

PREVIOUS
└── Class 1
    ├── July 2026 -> UNPAID
    └── June 2026 -> PAID
```

| Test | Pins |
|---|---|
| `FeesIndexHistoricalMultiClassTest::test_class_2_shows_only_class_2_fees` | Drilling into Class 2 enrollment shows ONLY the 3 Class 2 fees; Kirtan, Music, and Class 1 fees are not present. |
| `FeesIndexHistoricalMultiClassTest::test_kirtan_shows_only_kirtan_fees` | Drilling into Kirtan enrollment shows ONLY the 1 Kirtan fee. |
| `FeesIndexHistoricalMultiClassTest::test_music_shows_only_music_fees` | Drilling into Music enrollment shows ONLY the 1 Music fee. |
| `FeesIndexHistoricalMultiClassTest::test_previous_class_1_shows_only_class_1_historical_fees` | Drilling into Class 1 (previous) shows ONLY the 2 Class 1 fees — including the outstanding July UNPAID fee. |
| `FeesIndexHistoricalMultiClassTest::test_student_total_aggregates_without_moving_ownership` | The student-row `total_amount`, `paid_amount`, `unpaid_amount` aggregate across all 4 enrollments (7 fees total) WITHOUT changing which enrollment owns each fee. |
| `FeesIndexHistoricalMultiClassTest::test_zero_balance_enrollment_still_appears` | A separate fixture with one current enrollment, all paid (zero unpaid balance), still renders that enrollment in the sheet — not collapsed away. |
| `FeesIndexHistoricalMultiClassTest::test_no_fees_student_still_appears` | A separate fixture with a student that has 0 fees still renders the student card with `unpaid_amount=0, paid_amount=0`. |
| `FeesIndexMultiClassEnrollmentTest::test_three_class_student_has_three_enrollments` | 3 active enrollments -> 3 entries in `enrollments[]`, each `is_current=true`. |
| `FeesIndexMultiClassEnrollmentTest::test_previous_enrollment_is_marked_inactive` | 1 active + 1 previous -> 2 entries; previous has `is_current=false`, `transferred_at` set. |
| `FeesIndexFilterChipTest::test_chips_reflect_active_filters` | One chip per active filter key; clearing a chip removes that single key. |
| `FeesIndexFilterChipTest::test_removing_chip_preserves_other_filters` | Removing `month` chip keeps `status=unpaid`, `class_id=N`, etc. |
| `FeesCollectionSheetTest::test_collect_endpoint_still_uses_collection_date_validation` | `admin.fees.collect` still rejects missing/malformed `collection_date`. |
| `FeesCollectionSheetTest::test_collect_response_shape_unchanged` | Same redirect + flash + `reportCache->forget` side effect. |
| `FeePermissionBoundaryTest::test_accountant_can_collect_for_any_enrollment` | Accountant policy still grants `collect` regardless of `is_current`. |
| `FeePermissionBoundaryTest::test_accountant_cannot_deCollect` | Accountant cannot un-collect. |

The first 7 tests are the **canonical fixture** — they must all
pass on the same Harpreet data before Phase 5 (connect to real data)
is considered successful.

### 9.3 Manual test matrix

Three scenarios on mobile (375x812) and desktop (1280x800):

1. **Harpreet canonical fixture** — 3 current classes + 1 previous
   class + paid/unpaid/historical-outstanding (the §18 critical
   case).
2. **Single-class student, fully paid.**
3. **Single-class student with one unpaid fee.**

The mobile screenshot of case 1 is the gate for Phase 7 cutover.

---

## 10. Risks and regression points

### 10.1 Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | Phase 1 grouping loses a fee (data loss) | L | C | The mapper re-emits; no DB change. Test: every `fee.id` from old shape appears in new. |
| R2 | Historical fees silently appear under the new class | M | H | Per-enrollment grouping by `student_section_id`. Pinned by `test_fee_belongs_to_correct_enrollment`. |
| R3 | Monthly generation picks up previous enrollments | L | H | `GenerateMonthlyFeeAction` untouched. Pinned by `MonthlyFeesGenerationTest`. |
| R4 | Collection rejects valid flows | L | H | `collect()` controller unchanged. Pinned by `FeesCollectionSheetTest`. |
| R5 | Un-collection breaks (lock/audit) | L | H | `deCollect()` unchanged. Pinned by `FeeDeCollectTest`. |
| R6 | Multi-class grouping drops a fee | M | H | Add `student_section_id` per-fee; group-by-`student_section_id` inside `groupBy('student_id')`. Pinned by new tests. |
| R7 | Historical enrollments invisible | M | M | New `enrollments[]` array is the seam. UI renders all with `is_current` flag. |
| R8 | Accountant loses `collect` access | L | C | `FeePolicy::collect` unchanged. Pinned by `AuthorizationPolicyMatrixTest`. |
| R9 | Report cache not invalidated | L | M | `collect`/`deCollect` still call `$this->reportCache->forget(...)`. Pinned by `AuditTrailTest`. |
| R10 | Existing expanded-row consumers break | M | L | Phase 7 cutover is gated on new UI being usable; old UI removed only after. |
| R11 | `window.confirm()` regression | L | L | Audit Phase 0 — confirm `ConfirmDialog` at `Index.jsx:294, 304`. |
| R12 | Mobile horizontal scroll reintroduced | L | L | Mobile path uses `StudentCard`; `DataTable` desktop-only. |
| R13 | Prototype ships before tests pass | M | H | Phase gate sequence enforces test-first. |
| R14 | Hardcoded "Gurmukhi/Kirtan" reintroduced | L | M | Reuse `DivisionTypeResolver::division()` everywhere. |
| R15 | URL state lost between sheet open/close | M | M | Sheet is a modal — URL unchanged. `localStorage` only if deep-linking needed (deferred). |
| R16 | Reports miss new shape | L | M | Reports use `StudentReportCache`, not the index controller. Out of scope. |

(L = Low, M = Medium, H = High, C = Critical)

### 10.2 Most-likely regression

**R6** (multi-class grouping loses a fee) and **R2** (historical fee
attaches to wrong class) are the two regressions most likely to
occur during Phase 4 (the backend changes). Both are pinned by the
new test cases in §9.2. Because Phase 1 is a mock-data prototype,
the user reviews these regressions visually before any controller
change is made.

---

## 11. What should be prototyped first

The spec's §18 critical scenario: **a student has three current
classes and previous enrollment history, with paid and unpaid fees
across those enrollments.** Per the corrected phase ordering (§5),
this prototype is the **first** build step, before any backend
work.

### 11.1 Minimum mock data to validate

The canonical Harpreet fixture (see §9.2):

- **Current enrollments:**
  - Class 2 Section A — Aug 2026 UNPAID, Jul 2026 PAID, Jun 2026 PAID.
  - Kirtan Sunday — Aug 2026 PAID.
  - Music Section B — Aug 2026 UNPAID.
- **Previous enrollment:**
  - Class 1 Section A (transferred last month) — Jul 2026 UNPAID,
    Jun 2026 PAID.

That gives 7 fees across 4 enrollments; the previous enrollment has
an outstanding unpaid fee (the historical-collectible scenario);
one current enrollment (Music) has a single UNPAID; one current
enrollment (Kirtan) is fully paid; Class 2 has a mix. All four
per-enrollment groupings are different — the prototype must show
the right grouping in each.

### 11.2 Why this case specifically

- 3 active enrollments forces the per-enrollment grouping to be
  correct (any grouping-by-current-class collapses them).
- The previous enrollment with an outstanding balance forces the
  "Outstanding historical fees remain collectible" rule
  (`docs/architecture/13-` §4 module workflow — historical fees
  must remain collectible, not be re-billed).
- Paid + unpaid across both current and previous forces the
  current/previous separation to be unambiguous in the UI.
- Different fee amounts across enrollments stress the per-enrollment
  summary tiles.

### 11.3 What "passes" the prototype

The prototype must show:

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
   correct student + enrollment context (Class 2 + Aug 2026 +
   Rs X,000).
6. All tap targets are ≥ 44x44.

### 11.4 Order of prototype work

This order is fixed. **Do not deviate.**

1. Build the §11.1 mock fixture (Harpreet canonical case + 5
   additional cases).
2. Render `MobileFeesIndexMockup` and `DesktopFeesIndexMockup`
   against the fixture.
3. Render `StudentFeeSheetMockup` against the fixture. Verify
   §11.3 5-point checklist passes.
4. Render `FiltersSheetMockup` + `ActiveFilterChipsMockup`
   against the fixture.
5. Render `CollectFeeSheetMockup` against the fixture (no-op
   submit handler).
6. Wire all 7 mockups together inside the dev-only mount from
   §5.8.
7. **Stop.** Hand the prototype to the user for review. No
   backend work starts until the user explicitly approves the UX.

---

## 12. What should explicitly not be changed

Per spec §16 constraints, the following are out of bounds for this
redesign:

| Item | Justification |
|---|---|
| DB schema (no migrations) | Spec §16 forbids migrations without evidence. No evidence of a missing field; per-fee `student_section_id` is already on `fees` and surfaced from the existing join. |
| `Payment` model | Not on the critical path of the redesign. `collect`/`deCollect` are unchanged. |
| Fee calculation logic | Spec §16 explicitly requires preserving calculations. Monthly fee generation stays untouched. |
| `FeePolicy` permissions | Already correct (admin vs accountant). Spec §16 requires preserving permissions. |
| `GenerateMonthlyFeeAction` | Admin-only, audited, idempotent. Untouched. |
| Custom-fee CRUD | `storeCustomFee`, `updateCustomFee`, `destroyCustomFeeForStudent`, `destroyCustomFeeForSection` all preserved. Spec §16 forbids unnecessary refactor. |
| `DivisionTypeResolver` | Already dynamic. Untouched. |
| `collect`, `deCollect`, `generateMonthlyFees` controller methods | Untouched. Spec §16 forbids refactoring working flows. |
| 8 fee routes | Tests pin route names. Untouched. |
| `CustomFee.jsx` page | Out of scope; redesign is for `/admin/fees` only. |
| Other admin pages (Classes, Sections, Users) | "Do not modify unrelated modules" — spec §16. |
| `ConfirmDialog` global rollout | Was kept narrow in OLD plan; stays narrow. |
| Reports (`/admin/student-report-center`) | Independent feature. Untouched. |
| Bulk-collect / "Mark all paid" | Was deferred in OLD plan §Out of Scope. Stays deferred. |
| Server-side pagination | Was deferred. Stays deferred. |
| Search debounce | Was deferred. Stays deferred. |

---

## 13. Recommended implementation order

After plan approval, work proceeds step by step. Each step ends with a
named gate; the gate must hold before the next step begins.

### Step 1 — Approval gate

The user reviews this document and either approves, requests revisions,
or rejects. **Gate:** explicit user approval in writing.

### Step 2 — Phase 0 verification

Run a quick diff against the §1 findings. Confirm no drift. **Gate:**
§1 is accurate.

### Step 3 — Phase 1: pure React prototype (mock data only)

This step is **the first build step** and produces a working
prototype with mock fixtures. No backend, no routes, no controller
edits. The prototype is mounted per §5.8 (dev-only / Storybook /
isolated — never a production route).

Sub-steps:
1. Build the §11 mock-data fixture (Harpreet canonical case + 5
   additional cases).
2. Build `MobileFeesIndexMockup` — student-card list at 375px.
3. Build `DesktopFeesIndexMockup` — `DataTable` list at 1280px.
4. Build `FiltersSheetMockup` and `ActiveFilterChipsMockup`.
5. Build `StudentFeeSheetMockup` with Current + Previous
   Enrollments and "View older fees" expansion.
6. Build `EnrollmentFeeListMockup` per-enrollment fee history.
7. Build `CollectFeeSheetMockup` with student + enrollment
   context header; submit wired to a no-op handler.
8. Wire all 7 mockups together inside the dev-only mount
   described in §5.8.

**Gate:**
- All 6 mock cases render correctly on mobile (375px) and desktop
  (1280px).
- §11.3 5-point checklist passes for the Harpreet canonical case.
- All tap targets ≥ 44x44.
- No `window.confirm()` calls anywhere in the prototype.
- Visual review with the user.

### Step 4 — Phase 2: UX approval

Present the prototype to the user. Capture feedback. **Gate:**
user sign-off on the UX.

### Step 5 — Phase 3: backend / data-contract audit

Search the codebase for an existing endpoint that already serves
per-student fee detail across all enrollments. Candidates:
`StudentController::show`, `/admin/students/{id}`,
`/admin/student-report-center`, anything using `StudentReportCache`
(constructor-injected into `FeesController` at line 21).

**Gate:** an audit document identifying either (a) an existing
endpoint that can be extended, or (b) a proposed new endpoint
with justification.

### Step 6 — Phase 4: minimal backend adaptation

- If Phase 3 found an existing endpoint to extend: extend it
  (controller + tests).
- If Phase 3 proposed a new endpoint: add the smallest possible
  endpoint under `routes/admin.php:551-565` with the same policy
  gates.
- Index payload changes per §4.6 only if the prototype requires
  them. **Do not remove `class_name` / `section_name` from the
  Index payload yet** — see Step 10 gate.

**Gate:** all 10 tests in §9.1 green; new tests in §9.2 added
(test-first) and green.

### Step 6.5 — Phase 3 audit: backend / data-contract inspection

**This step is read-only.** No Laravel files are modified, no
migrations run, no controllers extended. The audit's output is the
A/B/C/D/E table below; the corresponding decisions are carried into
Step 7 (Phase 4) only after UX approval.

#### A. Already available (no work, zero risk)

| Asset | Path | Why it suffices |
|---|---|---|
| `Fee` model with `student_id` + `student_section_id` + `payments()` | `app/Models/Fee.php` | Canonical identity is `student_id` (F3), with `student_section_id` as the link to the enrollment that originated the fee. Boot hook auto-fills `student_id` from `StudentSection` on create. |
| `StudentSection` scope `current()` / `historical()` | `app/Models/StudentSection.php:40-53` | The exact `is_current_enrollment` derivation the prototype needs (active + `transferred_at IS NULL`). |
| `DivisionTypeResolver` | `app/Support/DivisionTypeResolver.php` | Single source of truth for division resolution. Already dynamic, no Gurmukhi/Kirtan hardcoding. |
| `StudentReportCache` | `app/Services/StudentReport/StudentReportCache.php` | Generation-counter cache pattern that any future per-student detail endpoint can mirror. |
| Existing fee collection actions | `fees.collect` / `fees.deCollect` (routes/admin.php:555-556) | Already gated by `FeePolicy`, already idempotent — Phase 6 just wires them. |
| `GenerateMonthlyFeeAction` | (referenced via `monthlyFeeService`) | Already creates monthly fees keyed by `(student_id, type, month)` — preserves the F3 invariant for any new fee-detail surface. |
| FeePolicy gates | `app/Policies/FeePolicy.php` | Existing `view`, `collect`, `deCollect` gates apply to a new detail endpoint without policy edits. |

**Decision:** zero new authorization code needed for any option that
loads fees via existing controllers.

#### B. Reusable as-is for the prototype's Tier 1 (Fees Index summary)

| Asset | Path | What the prototype uses |
|---|---|---|
| `FeesController::index()` per-student grouped rows | `app/Http/Controllers/Admin/FeesController.php:34-251` | The 6 fields the prototype already consumes (`student_section_id`, `class_id`, `class_name`, `division_key`, `fee_summary`, `fees[]`) — these are already returned by the existing mapper at lines 217-232 (with the one caveat listed in C/D below for `student_section_id`). |
| `FeesIndexQueryTest` | `tests/Feature/FeesIndexQueryTest.php` | The existing test pins the row shape; the prototype's mock fixture mirrors it. |

**Decision:** Tier 1 does NOT need a new endpoint. The prototype's
mock fixtures in `__prototypes__/feeFixture.js` map 1:1 to the
existing controller output. Phase 5 is a straight fixture swap.

#### C. Missing (must build before Phase 5)

| Asset | What the prototype needs | Why it's missing |
|---|---|---|
| **Per-student fee detail endpoint** | `GET /admin/students/{student}/fees` (or equivalent) returning per-fee rows with `{fee_id, fee_type, month, title, amount, payment_status, payment_date, payment_amount, student_section_id, is_current_enrollment}` | `StudentController@show` (the closest existing endpoint) returns a fee summary per enrollment (counts, totals, unpaid month names) — it does NOT return the per-fee row array the Tier 2 Sheet needs. `StudentReportCenterController@build` is a full report (heavy, not appropriate for a modal). No existing controller returns individual fee rows scoped to one student with all the prototype fields. |

**Decision:** a new per-student fee-detail endpoint is required. It
must be small: one controller action, one route, one policy call, one
test-first feature test. It must NOT replace `StudentController@show`
(the Student Center has its own summary shape the team depends on).

#### D. Needs transformation only (re-shape, no new endpoint)

| Asset | Path | Transformation |
|---|---|---|
| Index payload's `student_section_id` field | `app/Http/Controllers/Admin/FeesController.php:217-232` | The current mapper at lines 217-232 emits `fees[]` entries but does NOT include `student_section_id` per row (it only includes the rollup on the parent). The prototype's Index page itself does not strictly need per-row `student_section_id` (it routes by `student_id` to the Sheet), but the Sheet's "View previous enrollments" tab does. This is the **only** Index payload change Phase 4 needs. It is additive (one field per fee row), non-breaking, and gated by Step 10's consumer search before any removal. |
| `StudentController::show` summary | `app/Http/Controllers/StudentController.php:158-166` | The Student Center already returns per-enrollment fee summary (`all_paid`, `total`, `paid`, `pending`, `unpaid_months`). The Sheet's "snapshot at top" mirrors this — no controller change needed, but the Sheet uses the new detail endpoint for the per-row breakdown. The two surfaces stay separate by design (Student Center = aggregate, Fee Sheet = per-fee rows). |

**Decision:** one additive field (`student_section_id`) on Index fee
rows; no removals. Step 10 cleanup gate still applies.

#### E. Actually requires backend changes (Phase 4 scope)

| Change | Where | Why it's required |
|---|---|---|
| New `GET /admin/students/{student}/fees` controller action | `app/Http/Controllers/Admin/FeesController.php` (extend) **OR** `app/Http/Controllers/StudentController.php` (new method, route-registered under admin guard) | Per §C. Must respect `FeePolicy::view`. Must return only fee rows the user is authorized to see (same scope as `StudentController@show`'s teacher-scoping at lines 87-95 if extended there). |
| New route | `routes/admin.php:551-565` (extend `fees.*` group) **OR** `routes/admin.php:585-590` (extend `student-report-center.*` group) | Same policy gate, same admin auth. |
| Index payload additive: `student_section_id` per fee row | `app/Http/Controllers/Admin/FeesController.php:217-232` | Per §D. |
| New feature test (test-first) | `tests/Feature/StudentFeeDetailTest.php` | Must pin: HARPREET canonical case from §9.1 (4 cases including historical); policy gates; pagination if implemented; cache behavior if implemented. |
| Cache invalidation hook | `app/Services/StudentReport/StudentReportCache.php::forget()` already exists | If the detail endpoint is cached, reuse `StudentReportCache::forget($student->id)` from the same write paths (collection, de-collection, custom fee store/update/destroy) — already called from `StudentController@store`. |

#### What is explicitly NOT in Phase 4 scope

- No new tables. No migrations.
- No removal of `class_name` / `section_name` from the Index payload.
- No change to the existing `FeesController::index()` query.
- No change to `StudentController@show` shape (Student Center surface is frozen).
- No change to `FeePolicy`.
- No change to the existing collection/de-collection endpoints.
- No new fee-calculation logic.

#### Decision tree for Phase 4 implementation

After UX approval:

1. **Extend `FeesController` vs add to `StudentController`?**
   Default: extend `FeesController` (it owns the fee surfaces). The
   new method is `studentFees(Student $student)`. The route is
   `GET /admin/fees/students/{student}/fees` (name: `fees.student.show`)
   inside the existing `fees.*` group at `routes/admin.php:551`. This
   keeps the URL hierarchy consistent (`/admin/fees/*` for the Fees
   module, `/admin/students/*` for the Student Center).
2. **Cache or no cache?**
   Default: NO cache for the Sheet. It is opened on-demand, and the
   volume per student is small (~12 rows). The Index is the heavy
   query that benefits from caching; that work is out of Phase 4
   scope (it is the existing Index, not the prototype).
3. **Pagination?**
   Default: NO pagination in Phase 4. Most students have < 24 fee
   rows (2 years of monthly). If a student has > 100 rows (multi-year
   pending), the Sheet renders all rows and uses a "View older fees"
   collapse. If the canonical Harpreet fixture needs > 50 rows, that is
   a sign we need pagination in a later phase.
4. **Authorization?**
   Default: `FeePolicy::view` for admins and accountants. Teachers
   are NOT a Phase 4 consumer (the Sheet is admin-only per §3
   audience). If a teacher scope is added later, it mirrors the
   `StudentController@show` teacher-scoping pattern at lines 87-95.

#### Audit summary table

| Question from Phase 3 prompt | Answer |
|---|---|
| Does a student-detail endpoint already exist? | Yes: `students.show` (`StudentController@show`). But it returns fee SUMMARY, not per-fee rows. The prototype needs the latter. |
| Does a per-student fee-detail endpoint exist? | No. New endpoint required (C above). |
| Can the existing `StudentController@show` be extended? | Yes (additive, non-breaking), but it violates SRP and risks coupling two surfaces that should evolve independently. Default: new controller method on `FeesController`. |
| What does the prototype need from the backend? | Tier 1: nothing new (existing Index suffices). Tier 2: a new per-student endpoint (C). One Index payload addition (`student_section_id` per fee row) (D). |
| What is the minimum backend change? | One new route + controller method + one test (C + D). ~50-80 lines, single PR. |
| Does the current data model support the UX? | Yes. No DB redesign. Fees link to students and enrollments correctly; StudentSection has `current()`/`historical()` scopes; DivisionTypeResolver handles the dynamic-division case. |

**Gate:** this audit is approved by the user before Phase 4 begins.
No code is written in Phase 3.

### Step 7 — Phase 5: connect prototype to real data

Swap the prototype's mock fixtures for the real backend payload.
**Gate:** the prototype renders identically with real data as it
did with mock data, for all 6 mock cases (now reconstructed as a
test fixture).

### Step 8 — Phase 6: connect existing collection actions

Wire the Collect Fee modal to the existing `admin.fees.collect`
endpoint. Replace the no-op handler from Phase 1. **Gate:**
`FeesCollectionSheetTest` green; manual smoke identical to the
current page.

### Step 9 — Phase 7: production cutover

- Behind `?prototype=fees` query param, swap `Index.jsx` to render
  the new layout on the main route. **DONE** (Phase 5).
- Run for 1-2 sprints in parallel with the OLD plan Phase 6 default
  (`month=<current>&status=unpaid`) preserved.
- After 1 sprint of stable usage, remove the old expanded-row UI
  (`Index.jsx:383-428` and the `renderExpandedRow` plumbing).
- After 1 more sprint, remove the `?prototype=fees` flag.

**Step 9a — Gate flip (done in execution):**

The gate is now INVERTED so the new layout is the default at
`/admin/fees` and the legacy UI is reachable only behind
`?legacy=fees` for the 1-2 sprint rollback window. Reasoning:
flipping the default is a safe, reversible code-level change; the
temporal gates (1 sprint of usage) constrain the REMOVAL of the
legacy surface, not its demotion to a rollback flag.

```
  /admin/fees                  → new FeesIndexPrototype (default)
  /admin/fees?legacy=fees      → legacy Index.jsx UI (rollback)
  /admin/fees?prototype=fees   → new prototype (legacy flag,
                                 still recognized for compatibility)
```

**Gate (after each sub-step):**
- All 17 tests green.
- Summary tile values match the rolled-up totals.
- No `window.confirm()` left in the file.
- Mobile screenshot of the §11 critical case is on file.

### Step 10 — Cleanup (legacy field removal)

Cleanup is **gated by a full consumer search**, not by "the new UI
doesn't use them anymore". Inertia props and shared components can
have consumers we don't expect (audit logs, downstream reports,
external scripts).

The cleanup gate is a 4-step process:

```
1. Search all consumers of `fees[].class_name` and `fees[].section_name`
   across the codebase:
   - ripgrep / grep across resources/js/**/*.{js,jsx,ts,tsx}
   - ripgrep / grep across app/ for any PHP consumer of the prop
     shape (tests, transformers, jobs)
   - Search Blade templates, Storybook stories, README references
2. Confirm: zero consumers found
3. Remove legacy row-level `class_name` (CSV) and `section_name`
   (CSV) fields from the controller mapper
4. Update `FeesIndexQueryTest` to assert the new shape; run the
   full feature suite
```

**Step 10 — Consumer-search audit (done in execution):**

The search found TWO live consumers of the Index payload's legacy
`class_name` (CSV) and `section_name` (CSV) row fields:

| Consumer | File | What it reads |
|---|---|---|
| PendingFeesSetup | `resources/js/Pages/Admin/Utilities/PendingFeesSetup.jsx:218,220` | Renders `{row.class_name}` and `{row.section_name}` in the Utilities → Pending Fees table. Wired to `PendingFeesController` (NOT `FeesController`), but the field NAMES collide — verify which payload it actually reads before any removal. |
| FeesIndexPrototype (this redesign) | `resources/js/Pages/Admin/Fees/FeesIndexPrototype.jsx:69,70` | The `summarizeFromBackend()` adapter splits the CSV strings into primary_class / primary_section arrays. Removing the CSV fields would break the prototype's Index view until the adapter is rewritten against a structured payload. |

PHP-side search found multiple `class_name` / `section_name` field
usages in `DashboardController`, `PendingFeesController`,
`StudentReport\StudentIdentityResolver`, and `Reports\ReportRegistry`
— but each is a SEPARATE query/projection, not a consumer of the
`FeesController::index` payload. Confirmed via row-shape inspection.

**Cleanup gate status: BLOCKED.** Step 10 sub-step 2 (zero
consumers) fails — the prototype itself is a consumer. The
cleanup is deferred until the prototype's `summarizeFromBackend()`
adapter is rewritten to read from a structured payload (e.g.,
`fees[].class_id` / `fees[].section_id` already present in the
mapper, or a new `class_names[]` / `section_names[]` array field
on the row). Until then the legacy CSV fields stay.

**Gate:** clean diff; all 17 tests still green; manual smoke on
`/admin/fees` and `/admin/fees/custom` both pass; `php artisan
test` runs the full suite with no skipped tests.

Additional cleanup at this step (also gated by the same consumer
search):
- Delete `CollectFeeModal.jsx` (replaced by `CollectFeeSheet.jsx`).
- Remove the prototype mount described in §5.8 if it lives in
  `routes/`.

---

## Appendix A — Open questions for the user

These are assumptions I flagged that the user should confirm before
approval:

1. **Q: Modal vs dedicated route for the Student Fee Sheet?** I assumed
   modal (`<Modal>`) for mobile-friendly dismissal. A dedicated route
   (`/admin/fees/students/{id}`) enables deep-linking and back-button
   navigation but adds complexity. Confirm before Step 5.
2. **Q: Should the new main-page prototype preserve the OLD plan
   Phase 6 default-state seeding (`month=<current>&status=unpaid`)?**
   I assumed yes — preserved. Confirm before Step 3.
3. **Q: Where does `Generate Monthly Fees` go in the new header?** I
   assumed it stays in the header but is demoted visually. Alternative:
   kebab menu or settings page. Confirm before Step 3.
4. **Q: Inline vs paginated for "View older fees"?** I assumed
   paginated at 10/page. Confirm before Step 5.
5. **Q: Which dev-only mount option for the prototype?** §5.8 lists
   three options (Storybook / dev-only render at `/admin/fees` /
   `routes/admin.dev.php` guarded by `APP_ENV !== 'production'`).
   Pick one before Step 3.
6. **Q: How many recent fees show by default before "View older fees"?**
   I assumed 3. Confirm before Step 5.

---

*End of plan. Awaiting user approval before any code change.*
