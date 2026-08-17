# Admin Fees Page — Redesign Plan

> **Status:** Plan for review before implementation. No code has been changed.
>
> **Branch:** `refactor/architecture` · **Goal:** stability-first visual / structural clarity on `/admin/fees` and `/admin/fees/custom` · **Hard rule:** zero backend changes, zero API-contract changes, zero behavior changes. Every existing test must stay green without modification.

## Locked Decisions (from checkpoint review)

1. **Default-state behavior in Change B** — *Client-side + reflect in URL via router.replace.* On first load with a canonical URL (`/admin/fees` with no params), the page seeds local state to `month=<current-month>&status=unpaid` AND calls `router.get(…, { preserveScroll: true })` so the controller re-fetches with those filters and the table renders filtered data. The URL bar reflects the preset. Bookmarking captures it. Server-side tests are unaffected (they hit the controller directly, not via the browser). Returning visitors with a bookmark like `/admin/fees?month=2026-08&status=unpaid` see no flash on refresh because the controller already returned filtered data.
2. **Phase order** — *Keep the recommended order.* Phase 0 → Phase 7 as planned. Phase 6 (filter accordion collapse + default state) lands last.
3. **Change F (drop Total column)** — *Drop the column.* Per-row grid becomes 6 columns (`#`, Student, Father, Section, Unpaid, Paid, Details). `total_amount` stays in the data prop. Summary strip above the table surfaces page-level totals.

---

## Background

`/admin/fees` is the admin's primary tool for bulk-collecting this month's unpaid fees, inspecting outstanding balances by class/section/status/month, drilling into per-student per-division breakdowns, and managing section-scoped custom fees via `/admin/fees/custom`. The page is large and works, but accumulates UX friction that increases cognitive load on the dominant use case and degrades ungracefully on mobile.

This plan is a **stability-preserving UX pass**: every existing flow keeps producing the same outcome, the Inertia prop shape is unchanged, every filter query-string maps to the same backend handler, every confirm/cancel branch keeps its semantics. Only the surface (HTML structure, component decomposition, modal library usage, tap targets) is reorganized.

---

## Current State Inventory

### Files & sizes

| Path | LOC | Role |
|---|---|---|
| `app/Http/Controllers/Admin/FeesController.php` | 585 | 5 actions. **No change.** |
| `resources/js/Pages/Admin/Fees/Index.jsx` | **985** | Main page; owns inline `FilterSection`, `FeeActionCard`, `FeeGroupColumn`, `CollectFeeModal`. |
| `resources/js/Pages/Admin/Fees/CustomFee.jsx` | 256 | Custom-fee CRUD table. |
| `routes/admin.php:551-565` | – | 8 routes. **No change.** |
| `resources/js/Layouts/AdminLayout.jsx:192-195` | – | Sidebar entry: "Manage Fees" + "Fee Categories". |

### Inertia prop shapes (preserved verbatim)

`FeesController::index()` lines 236-250 ships:

```js
{
  fees: Array<{
    student_id, student_name, father_name,
    class_name (CSV), class_types (array of division keys),
    section_name (CSV),
    paid_count, paid_amount,
    unpaid_count, unpaid_amount,
    total_amount,
    fees: Array<{
      id, type, month, title, amount, paid_at,
      class_type (string),  // resolved via DivisionTypeResolver
      is_paid (bool),
    }>,
  }>,
  filters: { year, class_id, section_id, search, status,
             month, month_from, month_to,
             paid_from, paid_to },
}
```

`FeesController::customIndex()` lines 376-386 ships `{rows, sections}`. Both shapes are **untouched** by this redesign.

### Query-string filters actually applied server-side

`year` (year + all custom fees) · `class_id` / `section_id` (EXISTS on active enrollment) · `month` (exact) · `month_from` / `month_to` (inclusive range, monthly only) · `paid_from` / `paid_to` (date range on `payments.paid_at`) · `status` (`paid` / `unpaid` / other = all) · `search` (LIKE on `students.name` OR `students.father_name`).

Every UI filter maps 1:1 to one of these keys. **This mapping is preserved verbatim.**

### Existing shared components available

`DataTable` (tanstack-backed, with `sortable`, `globalFilter`, `emptyMessage`, `loading`, `renderExpandedRow`+`expandedId`, `externalSort`, `pagination`, `pagerClassName`) · `Modal` (Headless UI based, `maxWidth sm/md/lg/xl/2xl`) · `FilterBar` (exports `FilterField`, `FilterSelect`) · `FeeFilterSelect` (react-select wrapper) · `MultiSelect`, `SearchInput`, `StatusBadge`, `RoleGate`, `DivisionLegend` · `PageLoader`.

### Tests that pin current behavior (must remain green unmodified)

| Test | Pins |
|---|---|
| `tests/Feature/FeesIndexQueryTest.php` | `fees.0.class_types` (array of keys), `fees.0.fees[*].class_type` (string), `fees.0.student_name`, `.section_name`, `.class_name`, `.fees.0.month`. ~10 pinned paths across 3 tests. |
| `tests/Feature/AdminDataEndpointSmokeTest.php::test_fees_index_accepts_filter_params` | Filter query-string round-trip; `Admin/Fees/Index` component; `filters.class_id/section_id/status` echoed. |
| `tests/Feature/AdminPageSmokeTest.php` | `Admin/Fees/CustomFee` renders. |
| `tests/Feature/FeeDeCollectTest.php` | `admin.fees.collect` / `deCollect`. |
| `tests/Feature/FeeUniqueIndexTest.php` | Independent of UI. |
| `tests/Feature/MonthlyFeesGenerationTest.php:206` | `admin.fees.generate-monthly`. |
| `tests/Feature/MultiClassBackwardCompatTest.php:137-175` | `$row['class_types']` + per-fee `class_type`; pins the Music bucket. |
| `tests/Feature/AuditTrailTest.php:95-241` | `admin.fees.collect / deCollect / custom.store / custom.update / custom.destroy.student / generate-monthly`. |
| `tests/Feature/FeePolicyTest.php`, `AuthorizationPolicyMatrixTest.php` | All `FeePolicy::viewAny / collect / deCollect / generateMonthly / createCustom / updateCustom / deleteCustom` paths. |
| `tests/Unit/DivisionTypeResolverTest.php` | `resources/js/utils/divisionType.js#divisionMeta()` key derivation. |

---

## Three-Perspective Analysis

### 1. Product Engineer perspective

The page does four jobs today: bulk-collect this month's fees (dominant), inspect outstanding by class/section/status/month, drill into a student's per-fee breakdown to collect/un-collect, and assign/manage section-scoped custom fees.

**Problems found (11):**

| # | Problem | Evidence |
|---|---|---|
| P1 | 10 filter inputs in 4 accordions — high cognitive load for the dominant "collect this month's unpaid" use case | `Index.jsx:681-963` (4 `FilterSection`s, 2 range-pair Apply buttons) |
| P2 | "This Month" button sets `month` but not `status=unpaid` — common path takes 2 clicks | `Index.jsx:665` `useCurrentMonth` writes only month range |
| P3 | Status pill toggle uses pills, rest of row uses dropdowns — inconsistent input vocabulary | `Index.jsx:711-727` (pills) inside a row of `<select>`s |
| P4 | Header helper copy is fallback-info, not primary | `Index.jsx:633` — always shown but rarely relevant |
| P5 | `Generate Monthly Fees` is a fallback action with primary-action visual weight | `Index.jsx:636` — only header action; should be confirm-gated + visually demoted |
| P6 | No page-level totals — admin must eye-scan rows | `Index.jsx:524-552` columns are per-row only; no totals row, no header KPIs |
| P7 | No empty state — `DataTable`'s `emptyMessage` prop exists but is unused | `DataTable.jsx:49,167-169` — empty message opt-in |
| P8 | `window.confirm()` for un-collect — dated vs toast pattern | `Index.jsx:487` `if (!confirm("Un-collect this fee?"))` |
| P9 | `CustomFee.jsx` no empty state, no batched save, hand-rolled modal | `CustomFee.jsx:194-253` modal, line 49 confirm |
| P10 | Search fires per-keystroke to server — no debounce | `Index.jsx:940` calls `applySearchLive(value)` on every `onChange` |
| P11 | Per-fee collect only reachable after `View` — discoverability issue | `Index.jsx:564-568` (View/Hide) + `FeeActionCard:118-126` (Collect) — 2 clicks |

**Dead/redundant UI** (audit-worthy): none — all 10 filter fields are wired to backend params; all buttons fire actions. The dead surface is **unused shared-component affordances** (`emptyMessage`, `loading`, `sortable`, `pagination`, `globalFilter`).

**Features already present but buried**: search (P10), `status` pill (P3), per-fee collect without expand (would require a row-level action button).

### 2. UX perspective

**Visual hierarchy** — the eye lands on `Fees` heading → `Generate Monthly Fees` button → filter card → active-filter badge. For an admin whose intent is "what's outstanding this month", the actual answer is **nowhere on screen**; you must set two filters, scroll past them, expand a row, click into the per-fee grid. 4 clicks and ~50-80px of scrolling before the answer appears.

**Cognitive load** — filter card offenders:
- Four `FilterSection`s each get their own title + description + badge chip pattern
- Two have `Apply <X>` buttons that don't dispatch until clicked (`Index.jsx:850, 903`); others auto-apply. Two mental models in one card
- Each input has an "explain what this is" sub-caption in `text-[11px] text-gray-500` — **twelve** such micro-captions (lines 729, 766, 809, 858, 911, 944). Self-documenting at the cost of noise on a data-dense page

**Tabular density** — `Index.jsx:972` `tableClassName="min-w-[1000px] text-sm"` is fine for desktop, punishing for mobile (see §3). The expanded row (`Index.jsx:600-625`) renders `lg:grid-cols-2` per division, stacking on narrow viewports — this is the page's strongest design choice and is preserved.

**Consistency with other admin pages**:
- `Admin/Classes/Index.jsx` and `Admin/Sections/Index.jsx` use `AdminLayout` + same Tailwind border/rounded/text vocabulary ✓
- Classes/Sections use `DataTable` with `sortable` + `pagination` + `globalFilter`. **Fees does not** — because fees is grouped data, but the visual footer pattern is still missing here
- **Modal pattern is inconsistent**: Class/Section modals use `<Modal>` (shared Headless UI). `Index.jsx` CollectFeeModal uses hand-rolled `fixed inset-0 z-50 bg-black/40` (`Index.jsx:199`). `CustomFee.jsx` line 195 uses bare `bg-black/40 z-50`. Fees is the **only** place in admin that hand-rolls its modals
- **Filter pattern is inconsistent**: Classes/Sections/Users use plain top-bar inputs. Fees is the **only** admin page with accordion filter sections — a clue the current pattern is over-engineered

**Empty / loading / error states**: none handled. `DataTable`'s `loading` and `emptyMessage` props are never used here.

**Confirmation patterns**: 3 separate `window.confirm()` calls (collect-not-required-but-skipped, un-collect, generate monthly, custom delete) — no shared component.

**Color usage**: `divisionMeta()` palette used correctly for per-division column headers. Body uses ad-hoc `text-red-600` (unpaid), `text-green-600` (paid), `text-yellow-700` (un-collect). Blue overused: 4 distinct shades (Generate btn, active-filter badge, View link, link accents).

**Typography**: headings `text-base`, table cells `text-sm`, captions `text-xs`/`text-[11px]` — inconsistent caption sizes.

**Spacing**: `space-y-3` inside filter card, `gap-3` between basics. Reasonable.

### 3. Mobile Responsive perspective

The school admin might check this page from a phone during parent pickup.

**Current state at 375px viewport**:
- `AdminLayout` sidebar: off-canvas by default on mobile ✓ (`AdminLayout.jsx:154-159, 170, 222-228`)
- Header strip: `flex flex-wrap items-center justify-between` — wraps cleanly ✓
- Filter card outer: `rounded-xl border bg-white p-4 sm:p-5` — responsive ✓
- Filter card inner: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4` — single-stacks on narrow ✓ (the filter card **mostly degrades well**; its content is just too dense)
- **DataTable is the actual mobile blocker** (`Index.jsx:966-974`):
  - `containerClassName="bg-white border rounded-lg overflow-x-auto"` → forced horizontal scroll
  - `tableClassName="min-w-[1000px] text-sm"` → forces 1000px minimum; text is not legible at scale-down
  - `Collect` / `Un-collect` buttons inside expanded row: 11px tall × ~60px wide — **below WCAG 2.5.5 44×44 minimum tap target** (`Index.jsx:111` `px-2 py-1 rounded text-xs`)
- Expanded row's inner `lg:grid-cols-2` already collapses to `grid-cols-1` on mobile ✓
- CollectFeeModal `flex items-center justify-center bg-black/40 px-4` — already responsive-friendly ✓
- CustomFee.jsx modal: three inputs in single column, `w-full border px-3 py-2 rounded` — workable on mobile

**Tap target audit (WCAG 2.5.5: 24×24 minimum, 44×44 recommended)**:

| Button | Class | Approx size | 44×44 |
|---|---|---|---|
| `Generate Monthly Fees` (`Index.jsx:640`) | `px-4 py-2 text-sm` | ~88×36 | ✗ |
| `This Month` / `Reset Filters` (`:666-674`) | `px-3 py-2 text-sm` | ~68×36 | ✗ |
| `Apply Months` (`:853`) | `px-4 py-2 text-sm` | ~108×36 | ✗ |
| `Confirm Collection` (`:234`) | `px-4 py-2 text-sm` | ~140×36 | ✗ |
| `View` / `Hide` (`:564-568`) | `text-blue-600 text-sm` | ~36×22 | ✗ |
| `Collect` (`:121`) | `px-2 py-1 rounded text-xs` | ~52×22 | ✗ |
| `Un-collect` (`:113`) | same | ~78×22 | ✗ |
| `+ Assign Custom Fee` (CustomFee.jsx:178) | `px-4 py-2 rounded text-sm` | ~144×36 | ✗ |

**None** of the action buttons in `FeeActionCard` or the link-style `View/Hide` clear 44×44. The page is designed for desktop mouse clicks.

**Filter bar on mobile**: a `Filters` drawer (slide-up sheet on mobile) would be a real improvement. Today the filter card stretches from top-of-fold to mid-table, and at 375px it occupies >200% of viewport height when fully open.

---

## Proposed Changes

Six concrete, independently-deployable changes. Each preserves the API contract (filter query-string keys, Inertia prop shape, route names, confirm/cancel semantics).

| # | Change | Why | Risk |
|---|---|---|---|
| **A** | Header strip → Classes-style flex row (left: search, right: `+ Generate Monthly Fees`); drop helper copy | P4, P5; visual parity with Classes/Sections | Zero — CSS-only |
| **B** | Collapse 4 accordions → single always-visible row with 5 inputs (Year, Class, Section, Status, Month); advanced filters (`month_from/to`, `paid_from/to`) behind a `[Advanced]` disclosure that auto-opens if URL carries them. **On first load with no URL params, auto-seed `month=<current>&status=unpaid` and reflect via `router.get(…, { preserveScroll: true })` so URL + data both reflect the preset (locked).** | P1, P2, P3, P9; matches Classes/Sections | Largest UI change — preserve every filter key's URL param mapping exactly; default-state seeding skips itself when URL already carries params |
| **C** | `emptyMessage="No fees match the current filters."` on `DataTable`; summary strip with 3 tiles (Total Unpaid / Total Paid / Students shown) above the table; bump tap targets to ≥44×44 via `min-h-[40px] sm:min-h-[36px]` | P6, P7; WCAG 2.5.5 | Low — `emptyMessage` is a pre-existing prop |
| **D** | New shared `resources/js/Components/ConfirmDialog.jsx` (Headless UI + existing `Modal` wrapper); replaces `window.confirm()` for un-collect + generate monthly | P8; accessibility, focus trap, ESC-dismissable | Minimal — same Confirm/Cancel semantics |
| **E** | Replace hand-rolled modal in `CustomFee.jsx:194-253` with `<Modal maxWidth="md">`; add empty state; reuse `ConfirmDialog` | UX consistency, P9, mobile | Tiny — form fields bit-for-bit unchanged |
| **F** | Drop redundant `Total` column from per-row grid (`Index.jsx:549-552`); keep `total_amount` in data prop; surface totals via the Change C summary strip | P6; reduces columns from 7→6, fits 1024px | Low — `FeesIndexQueryTest` does not assert `total_amount` by name |

**Critical contract preservation across all six changes:**
- Every filter key (`year, class_id, section_id, search, status, month, month_from, month_to, paid_from, paid_to`) maps to the same query-string param
- Inertia `fees`/`filters` prop shape unchanged
- All 8 route names untouched
- All confirm/collect/de-collect flows produce identical outcomes
- `divisionMeta()` palette + cross-division contract preserved (third+ divisions still render with deterministic palette from `utils/divisionType.js:77-83`)

---

## File Change Summary

| Type | Files |
|---|---|
| **NEW** | `resources/js/Pages/Admin/Fees/components/CollectFeeModal.jsx` (extract from `Index.jsx:189-242`) |
| **NEW** | `resources/js/Pages/Admin/Fees/components/FeeActionCard.jsx` (extract from `Index.jsx:89-128`) |
| **NEW** | `resources/js/Pages/Admin/Fees/components/FeeGroupColumn.jsx` (extract from `Index.jsx:130-187`) |
| **NEW** | `resources/js/Pages/Admin/Fees/components/FilterSection.jsx` (extract from `Index.jsx:51-87`) |
| **NEW** | `resources/js/Components/ConfirmDialog.jsx` |
| **MODIFY** | `resources/js/Pages/Admin/Fees/Index.jsx` (header strip, filter bar collapse, summary strip, empty state, touch targets, `ConfirmDialog` wiring, drop Total column) |
| **MODIFY** | `resources/js/Pages/Admin/Fees/CustomFee.jsx` (modal swap, empty state, `ConfirmDialog` wiring) |
| **UNCHANGED** | `app/Http/Controllers/Admin/FeesController.php`, `routes/admin.php`, all tests, all shared components (consumer-only) |

---

## Implementation Sequencing

Each phase is independently deployable. Each phase explicitly states what test gates must stay green before the next phase begins.

### Phase 0 — Pure extraction (no behavior change)

Extract four sub-components out of `Index.jsx` into `resources/js/Pages/Admin/Fees/components/`:

| New file | Source lines | Notes |
|---|---|---|
| `CollectFeeModal.jsx` | 189-242 | Same prop contract. |
| `FeeActionCard.jsx` | 89-128 | Same prop contract. |
| `FeeGroupColumn.jsx` | 130-187 | Same prop contract. |
| `FilterSection.jsx` | 51-87 | Same prop contract. |

`Index.jsx` keeps the exact same exports, props usage, query-string usage.

**Gate:** `npm run build` succeeds; `php artisan test --filter='AdminDataEndpointSmokeTest|AdminPageSmokeTest|FeesIndexQueryTest|MultiClassBackwardCompatTest|AuditTrailTest|MonthlyFeesGenerationTest|FeeDeCollectTest|FeeUniqueIndexTest|FeePolicyTest|AuthorizationPolicyMatrixTest'` passes byte-for-byte.

### Phase 1 — Change A (header strip refactor)

Replace `Index.jsx:627-644` with the Classes-style bar shape.

**Gate:** same tests as Phase 0 + `npm run build`.

### Phase 2 — Change C (empty state + summary strip + touch targets)

Empty state pass to `DataTable`. Summary strip above the table. Touch targets bumped to ≥44×44 (use `min-h-[40px] sm:min-h-[36px]`).

**Gate:** smoke tests; no controller touched, so prop-shape tests are unaffected.

### Phase 3 — Change F (drop Total column + embed summary strip)

**Gate:** smoke + `FeesIndexQueryTest`.

### Phase 4 — Change E (CustomFee modal swap + empty state + `ConfirmDialog` in CustomFee only)

Build `ConfirmDialog.jsx`. Use it in `CustomFee.jsx` only — smaller surface first.

**Gate:** `AuditTrailTest` (still hits custom routes via HTTP).

### Phase 5 — Change D (use `ConfirmDialog` on the main page too)

Wire `ConfirmDialog` into `deCollectFee` and `generateMonthlyFees` on the main page.

**Gate:** same tests.

### Phase 6 — Change B (filter accordion collapse — the largest UX change)

Do **last**, after the rest of the page has stabilized, because it is the most discoverable to reviewers.

**Gate:** `AdminDataEndpointSmokeTest::test_fees_index_accepts_filter_params` (filter query-string round-trip) + `AdminPageSmokeTest` (page renders) + `FeesIndexQueryTest` (server-side correctness).

### Phase 7 — Documentation

Add a short note to `docs/architecture/11-Task-Tracker.md` under "Additional Work Completed Outside the Roadmap" listing the redesign as a UX-pass. `docs/14-admin-screens-audit.md` §5 sidebar routes still match — no edit needed.

---

## Verification Plan

### Manual smoke checks (run after each phase)

Run on `php artisan serve` (or `dev`/`.env`-pointed equivalent):

| Scenario | Steps | Expectation |
|---|---|---|
| Page load (canonical URL) | `GET /admin/fees` | Page renders, table populated; **after Phase 6** default state triggers a router.get that re-fetches with `?month=YYYY-MM&status=unpaid`; URL bar updates to reflect the preset; no flash because the second fetch lands before first paint |
| Page load (returning visitor) | `GET /admin/fees?month=2026-08&status=unpaid` (bookmark/refresh) | Server already returns filtered data; page hydrates with filter pills pre-populated; default-state seed step skipped |
| Filter by year | Pick `2026` | Same rows shown for that year; URL `?year=2026` |
| Filter by class | Pick `Gurmukhi` | Section dropdown enables, list narrows; URL `?class_id=N` |
| Filter by status | Pick `Unpaid` | Per-row "Paid" column may show 0; "Paid" row total ≠ "Total" |
| Exact month | Pick `2026-08` from Month select | List narrows; URL `?month=2026-08` |
| Month range | Expand Advanced, set From/To | URL has `month_from`/`month_to` only when both set; reversed ranges auto-normalized (helpers at `Index.jsx:35-49`) |
| Collection date range | Expand Advanced, set From/To | `paid_from`/`paid_to` echoed in URL |
| Search | Type `Sim` | Per-keystroke URL update (existing behavior preserved) |
| Reset | Click Reset | URL `?` (no params) |
| Expand a row | Click `View` on a student with both Gurmukhi + Music fees | Row expands; Gurmukhi shows blue title, Music shows palette title |
| Collect | Click `Collect` on an unpaid fee | Modal opens with today pre-filled; Confirm posts; toast on success |
| Un-collect | Click `Un-collect` | `ConfirmDialog` opens (post Phase 5); Cancel/Confirm match prior `window.confirm` flow |
| Generate monthly | Click header button | `ConfirmDialog` opens with the existing prompt text; OK triggers `router.post(admin.fees.generate-monthly)` |
| Custom fee sub-page | `GET /admin/fees/custom` | Table renders; `+ Assign Custom Fee` opens `<Modal>` (post Phase 4) |
| **Phone (375×812)** | Chrome dev-tools | Filter bar single-stacks; table scrolls horizontally inside its container; expanded-row inner collapses to single column; all primary action buttons ≥40×40 |
| **Tablet (768×1024)** | Chrome dev-tools | Sidebar visible; filter bar two columns; table usable |
| **Desktop (1280px)** | – | Sidebar collapse button available; filter bar inline as one row post Phase 6; summary strip sits between filter card and table |

### Automated test gates (must remain green without modification at every PR/commit)

```
php artisan test --filter='AdminDataEndpointSmokeTest|FeesIndexQueryTest|FeeDeCollectTest|FeeUniqueIndexTest|MonthlyFeesGenerationTest|AuditTrailTest|MultiClassBackwardCompatTest|AdminPageSmokeTest|FeePolicyTest|AuthorizationPolicyMatrixTest'
```

Per test, the specific assertions each pins:

- `AdminDataEndpointSmokeTest::test_fees_index_accepts_filter_params` — `fees` length, `filters.class_id/section_id/status`
- `FeesIndexQueryTest::test_fee_shows_current_section_within_same_class` — `fees.0.student_name/section_name/class_name/class_types/fees.0.class_type/fees.0.month`
- `FeesIndexQueryTest::test_fee_falls_back_to_original_section_after_promotion` — same path
- `FeesIndexQueryTest::test_kirtan_and_gurmukhi_fees_keep_their_own_class_type` — `class_types` as array
- `MultiClassBackwardCompatTest:137-175` — `$row['class_types']` + per-fee `class_type`
- `AuditTrailTest:95-241` — `admin.fees.collect/deCollect/custom.store/custom.update/custom.destroy.student/generate-monthly`
- `FeeDeCollectTest:57-68` — `admin.fees.collect/deCollect`
- `MonthlyFeesGenerationTest:206` — `admin.fees.generate-monthly`
- `AdminPageSmokeTest` — `Admin/Fees/CustomFee` renders
- `FeePolicyTest`, `AuthorizationPolicyMatrixTest` — all `FeePolicy::*` paths

### Build gates

```
npm run build       # must succeed (vite)
composer test       # all green
```

### Post-implementation

After all phases land and gates stay green, run `graphify update .` (per CLAUDE.md auto-update rule) to merge the new file/component paths into the codebase graph.

---

## Out of Scope (explicitly deferred)

These are reasonable follow-ups but excluded to keep this PR stability-focused:

1. **Bulk-collect / "Mark all paid" button** — new business flow, crosses policy/audit lines
2. **Server-side pagination** on `/admin/fees` — audit doc chose client-side paging; switching requires new controller method
3. **Search debounce** (P10) — changes timing semantics on slow networks; needs explicit ack
4. **`ConfirmDialog` rollout on Classes/Sections/Users pages** — keep this PR narrow
5. **Migrating filter forms to `DataTable` `globalFilter`** — `globalFilter` is client-side over already-fetched data; current server-side filter restricts row count first. Different semantics
6. **Empty / loading / error boundaries on other admin pages** — same gap exists on Classes/Sections/Users; balloon this PR
7. **Fee-receipt printing / PDF export** — new endpoint + new prop
8. ~~**Default-preset chip ('This Month — Unpaid only')**~~ — **RESOLVED (locked):** Phase 6's default-state seed (`month=<current>&status=unpaid` on canonical URL) replaces the chip idea. A toggle to *clear* the preset is a separate UX feature, deferred.
9. **ag-grid migration for the expanded row grid** — not needed; the custom grid is fine

---

## Related Documentation

- `docs/14-admin-screens-audit.md` §5 — sidebar routes confirmed
- `docs/14-admin-screens-audit.md` §3 line 126 — `Index.jsx:609` uses `divisionMeta()` correctly
- `docs/architecture/13-Module-By-Module-Business-Workflow-Audit.md` Module 4 — Fees admin/accountant business workflow
- `docs/architecture/06-Frontend-Architecture.md:111` — flags `Index.jsx >400 lines` for sub-component extraction
- `docs/architecture/11-Task-Tracker.md` Sprints 2.1 (F3 identity), 4.1 (DataTable migration), 5.1 (GenerateMonthlyFeeAction), 5.2 (COALESCE rewrite)
- `docs/24-students-page-redesign-plan.md` — closest analogue (same decomposition pattern: extract sub-components, restructure, drop dead UI, preserve tests)
- `docs/19-attendance-report-redesign-plan.md` — analogous page-redesign plan from prior sprint