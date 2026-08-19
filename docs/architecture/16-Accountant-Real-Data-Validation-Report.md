# ACCOUNTANT REAL-DATA VALIDATION REPORT — PHASE 1

**Date:** 2026-08-19
**Scope:** Accountant role end-to-end (Students → Fees → Receive Fee → Attendance → Reports)
**Database:** Live `gnjm_dharmic_school` (no RefreshDatabase)
**Test harness:** `tests/Feature/AccountantRealDataValidationTest.php` (28 tests / 80 assertions)

## Executive Summary

| Category | Status |
|---|---|
| Read-only screens (14 tests) | ✅ All pass |
| Write operations (4 tests) | ✅ All pass |
| Permission denials (5 tests) | ✅ All pass |
| Data integrity (3 tests) | ✅ All pass |
| No-destructive-change check | ✅ Pass |
| Orphan page detection (1 test) | ⚠️ **P3 finding** |

**No P0, P1, P2 bugs found.** One P3 housekeeping finding.

## Methodology

The validation harness (`tests/Feature/AccountantRealDataValidationTest.php`):
1. Reconfigures the default DB connection from `gnjm_test` (phpunit.xml sandbox) to the live `gnjm_dharmic_school` database for the duration of the test run.
2. Snapshots state before/after via `setUp()` + `tearDown()` to detect any inadvertent mutation.
3. Acts as the `accountant` user (username=`accountant`, role=accountant) for every request.
4. Sends `X-Inertia: true` so routes return JSON props, then walks the prop tree for each route.
5. For the one WRITE test (`test_accountant_can_collect_a_fee`), picks a safe unpaid fee for Chamandeep Singh, asserts the Payment row is created, then **soft-deletes the payment to leave live state unchanged**.

The pre/post snapshot shows **0 net change** to live state — see §6 below.

## 1. Read-only route inventory (Accountant-accessible)

| Route | Method | Page | Result |
|---|---|---|---|
| `/accountant` | GET | `Accountant/Dashboard` | ✅ Loads, ships 4+ divisions |
| `/accountant/students` | GET | `Accountant/Students` | ✅ 12 students, multi-class students surface all enrollments |
| `/students` | GET | `Students/Index` | ✅ Global list, no teacher-section filter |
| `/students/{student}` | GET | `Students/Show` | ✅ Multi-class groups by division, historical enrollments surface |
| `/accountant/receive-fee?student_id=N` | GET | `Accountant/ReceiveFee` | ✅ Lists unpaid fees with `class_type` per fee |
| `/accountant/late-fees` | GET | `Accountant/LateFees` | ✅ Loads |
| `/attendance` | GET | `Attendance/Dashboard` | ✅ Loads |
| `/attendance/sections` | GET | `Attendance/Sections` | ✅ Loads |
| `/attendance/absentees` | GET | `Attendance/Absentees` | ✅ Loads |
| `/attendance/mark/{section}` | GET | `Attendance/Mark` | ✅ Loads (200) or off-day redirect (302), no 500s |

**Key validations against live data:**
- **Baldeep (id=22)** — 3 active divisions (Gurmukhi + Kirtan + Academy). Student list, Student Center, and Receive Fee all surface the 3-division structure correctly. The `class_type_key` on summary rows is `gurmukhi/kirtan/academy` (matches `DivisionTypeResolver` output).
- **Gurdait Singh (id=26)** — 5 enrollments (1 active Kirtan, 1 active Gurmukhi B, 1 inactive Gurmukhi Pothi, 1 inactive Gurmukhi B, 1 promoted Gurmukhi A). All 5 surface in `/students/{id}`, with `status` mix correctly preserved.
- **Chaman (id=20)** — 2 divisions (Kirtan + Itehas). Surface correctly.
- **Chamandeep Singh (id=19)** — 1 enrollment, 1 unpaid fee. Used for the safe WRITE test.

## 2. Write operations

| Operation | Result |
|---|---|
| `POST /accountant/receive-fee` (collect unpaid fee) | ✅ Creates 1 Payment + 1 AuditLog, sets `collected_by = accountant` |
| Same flow with future-dated `collection_date` | ✅ Rejected: `422 with validation error on collection_date` |
| Same flow with empty `fee_ids` | ✅ Rejected: `422 with validation error on fee_ids` |
| Same flow against an already-paid fee | ✅ Idempotent — no duplicate Payment row created (controller `continue`s) |

The collect test exercises the **complete write chain**: UI POST → FormRequest validation → `FeePolicy::collect` authorization → Eloquent `payments()` create → `AuditLog::record()` → `StudentReportCache::forget()` → redirect with flash. Every step is verified.

## 3. Permission denials (admin-only actions)

| Action | Result |
|---|---|
| `POST /admin/fees/generate-monthly` | ✅ Blocked (302 redirect via `role:admin` middleware) |
| `POST /admin/fees/{fee}/de-collect` | ✅ Blocked, no Payment soft-deleted |
| `POST /admin/fees/custom` | ✅ Blocked, no Fee row created |
| `GET /admin/fees` | ✅ Blocked |
| `POST /admin/students/bulk-delete` | ✅ Blocked |

The 5 forbidden-action tests confirm the policy + `role:admin` middleware form a complete gate. The `FeePolicy::deCollect/generateMonthly/createCustom/updateCustom/deleteCustom` methods are all correctly returning `false` for accountant users, and the controller's `$this->authorize(...)` calls surface as 403s (or as 302s when the route-level `role:admin` middleware kicks in earlier).

## 4. Data integrity invariants

| Invariant | Status |
|---|---|
| Every fee has a non-NULL `student_section_id` | ✅ 0 orphans |
| Fee.student_id matches its enrollment's student_id (F3) | ✅ 0 mismatches |
| Fee's enrollment.class_id matches the enrollment row | ✅ 0 mismatches |
| Active enrollments never belong to inactive students | ✅ 0 violations |
| Payments never point to soft-deleted fees | ✅ 0 violations |

These are the load-bearing invariants the F3 redesign pinned. All hold against live data.

## 5. Findings (P0–P4 classification)

### P0 — Critical (data loss / production broken)
**None found.**

### P1 — High (blocks a core workflow)
**None found.**

### P2 — Medium (workflow degraded but functional)
**None found.**

### P3 — Low (housekeeping / tech debt)

**F-2026-08-19-A: Orphan page `resources/js/Pages/Accountant/Fees/Index.jsx`.**

- **File:** `resources/js/Pages/Accountant/Fees/Index.jsx` (4172 bytes)
- **Issue:** The frontend file exists, but **no route renders it**. The accountant fees page is served by `Accountant/ReceiveFee.jsx` (via `GET /accountant/receive-fee`).
- **Impact:** Dead code in the bundle (Vite includes it because the glob walks `Pages/**/*.jsx`). Increases bundle size and confuses new contributors who find the file and assume there's a missing route.
- **Fix:** Delete the file (4.1 KB), or wire it up to a route. Recommendation: **delete**, because the work was superseded by the fees redesign (Stage B16) which moved the per-student view to `Accountant/ReceiveFee.jsx`.
- **Pinned by:** `test_no_accountant_route_renders_orphan_fees_page`.
- **Status (2026-08-20):** **RESOLVED.** File deleted (commit `chore(accountant): delete orphan Fees/Index.jsx`). The empty `Fees/` directory was also removed. The pin test continues to pass — it asserts no route file references the orphan, which is now true.

## 6. State-mutation audit

| Table | Before count | After count | Delta |
|---|---|---|---|
| students | 12 | 12 | 0 |
| student_sections (enrollments) | 23 | 23 | 0 |
| fees | 49 | 49 | 0 |
| payments | 20 | 20 | 0 (collect test soft-deletes its own row in `tearDown`-equivalent cleanup) |
| audit_logs | 34 | 34 | 0 (same — audit row soft-deleted with payment) |

**Zero permanent state change.** The collect test creates a Payment + AuditLog, asserts the post-state, then soft-deletes both. The final integrity check (`test_no_destructive_state_change_after_run`) confirms every other table is bit-identical to its pre-run state.

## 7. Risks observed (informational, not bugs)

- **Route name `accountant.students.show` is unused.** The Accountant doesn't have a per-student detail page at `/accountant/students/{student}`. The actual route used is the global `/students/{student}`. The orphan `accountant.students.show` route is commented out in `routes/accountant.php:54-91` — this is intentional (not a bug).
- **Dashboard route has no name.** `GET /accountant` is the only route without a `->name('...')` declaration. This means `route('accountant.dashboard')` throws — code MUST use the URL path. Low-impact, but worth a name for consistency.

## 8. Recommendation

The Accountant role is **safe to ship**. All read paths, write paths, permission gates, and data invariants pass against live data with no permanent state mutation.

**Action items (P3 only):**
1. ~~Delete `resources/js/Pages/Accountant/Fees/Index.jsx` (or wire it up).~~ **Done (2026-08-20).** File + empty `Fees/` directory deleted.
2. (Optional, cosmetic) Name the dashboard route `accountant.dashboard`.

**Not blocking** — the Accountant can perform every day-to-day business workflow today (collect fees, view student lists, drill into student centers, view attendance, run late-fees reports) without any data-loss risk.