# Task Tracker — GNJM School ERP Architecture Refactor

Generated: **2026-08-13** · Branch: `refactor/architecture` (architecture work never touches `main` directly)

Sources of truth:
- Task list: [`09-Refactoring-Roadmap.md`](./09-Refactoring-Roadmap.md) (Sprints 0–6)
- Completion evidence: git history (`main` + `refactor/architecture`) and the codebase on disk

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Done (verified) |
| 🟡 | Partial — core behavior done, but the roadmap deliverable as written was not fully produced |
| ⏳ | Not started / trivial cleanup pending |
| ❌ | Not done |

Standing constraints throughout: **not a rewrite** (no JS→TS migration), no over-engineering, no unrelated behavior changes, tests→refactor→build→`graphify update .` per task.

---

## Sprint 0 — Quick Wins

| Task | Status | Evidence / Notes |
|---|---|---|
| **0.1** Add unique index `(student_section_id, date)` on attendance | ✅ Done (verified existing) | Migration `2025_12_24_204347_create_attendance_table.php:26` declares it; live DB enforces `attendance_student_section_id_date_unique`. Verified 0 duplicate groups across 140 rows; all write paths use `Attendance::updateOrCreate` on that exact key. **Closed without a new migration.** |
| **0.2** Fix `scopeCurrent()` to check `status = 'active'` | ✅ Done | `StudentSection::scopeCurrent()` now requires `status = 'active'` **and** `transferred_at IS NULL`, matching its docblock. Covered by `tests/Feature/StudentSectionCurrentScopeTest.php` (inactive-but-untransferred rows excluded). Commit `d5f95a3`. |
| **0.3** Remove commented `dd()` in FeesController | ✅ Done | Commented `// dd($fees->count(), $fees->take(5));` removed from `FeesController::index()`. Commit `d5f95a3`. |
| **0.4** Remove duplicate `Section::teachers()` method | ✅ Already satisfied | `app/Models/Section.php:28` — exactly **one** `teachers()` exists. Nothing to remove. |
| **0.5** Add NOT NULL constraint on `fees.student_id` | ✅ Done | Migration `2026_07_22_000001_add_student_id_to_fees_and_attendance.php`: backfill from `student_sections` → orphan cleanup → `nullable(false)->change()` on **both** `fees.student_id` and `attendance.student_id` (+ indexes `idx_fees_student_id`, `idx_attendance_student_id`). |

---

## Sprint 1 — Extract Core Logic from Route Closures

### 1.1 StudentService / StudentController

| Item | Status | Evidence / Notes |
|---|---|---|
| Extract student CRUD from `routes/*.php` closures | ✅ Done | `Admin\StudentController` — commits `bd96b7c` (bulk-update), `5fe25f1` (roster), `2a95e1c` (index/create/show). Routes now delegate, closures removed. |
| Create `App\Services\StudentService` | ❌ Not done | Logic landed **in the controller**, not a service class. No `app/Services/StudentService.php` exists. Roadmap deliverable as written not produced. |
| Feature tests for bulk-upsert | ✅ Done | `tests/Feature/StudentBulkStatusSyncTest.php`, `StudentAdminRoutesTest.php`, `StudentFrontRoutesTest.php`. |

### 1.2 AttendanceService

| Item | Status | Evidence / Notes |
|---|---|---|
| Extract absentee logic into `AbsenteeService` | ✅ Done | `app/Services/AbsenteeService.php` created; `AttendanceController` extracted — commit `8bf046f`. |
| Extract `AttendanceStatus` enum for normalization | ⏳ Not verified | No enum found; normalization handled inside the service. |

### 1.3 DivisionTypeResolver ⭐ (completed in full)

| Item | Status | Evidence / Notes |
|---|---|---|
| Backend canonical resolver | ✅ Done | `app/Support/DivisionTypeResolver.php` — commit `a86347f`. *(Note: landed in `Support/`, not `Services/` as the roadmap wrote.)* |
| Frontend twin util | ✅ Done | `resources/js/utils/divisionType.js` (`division` / `isKirtan` / `isGurmukhi`). |
| Frontend parity — all inline detection sites | ✅ Done | 7 sites migrated to the canonical util: `603f54a` migrated 6 (4 flagged + 2 discovered: `Accountant/ReceiveFee.jsx`, `Accountant/AttendanceSections.jsx`); `d5866bf` migrated the last one — `Admin/Fees/Index.jsx`. Grep confirms **no remaining inline sites**. |
| `DivisionTypeResolverTest` | ✅ Done | `tests/Unit/DivisionTypeResolverTest.php`. |

---

## Sprint 2 — Data Integrity & Model Hardening

### 2.1 Fee Model Hardening

| Item | Status | Evidence / Notes |
|---|---|---|
| `fees.student_id` NOT NULL | ✅ Done | See **0.5** (`2026_07_22_000001`). |
| Canonical unique identity `(student_id, type, month)` — **F3** | ✅ Done | Migration `2026_07_27_000002` → `idx_fees_unique_student_monthly`; verified present in MySQL, data clean (0 duplicates). Code keys by `(student_id, type, month)` in `Admin\StudentController::bulkUpdate`, `StudentController::store`, `Admin\PendingFeesController`. Commits `bec8669`, `6b89a7c`. |
| Remove redundant `source` column | ✅ Done | Migration `2026_08_13_000002` drops the column; removed from `Fee::$fillable`, `collect()` locks via `type === 'custom'`, and every `'source' =>` fee write in controllers/commands/tests is cleaned up. Commit `392523e`. |
| Fix `is_locked` reset on de-collect | ✅ Done | `FeesController::deCollect()` now sets `is_locked = false` after soft-deleting the payment, mirroring the lock applied in `collect()`. Covered by `tests/Feature/FeeDeCollectTest.php`. Commit `5c5f901`. |

### 2.2 StudentStatusMachine

| Item | Status | Evidence / Notes |
|---|---|---|
| Create `App\Services\StudentStatusMachine` (transition matrix) | ✅ Done | `app/Services/StudentStatusMachine.php` — pure matrix keyed on `Student::STATUS_*` exposing `canTransition` / `allowedDestinations`. Full-matrix coverage in `tests/Unit/StudentStatusMachineTest.php` (5 tests / 30 assertions). Commit `1dfb275`. |
| Lifecycle behavior | ✅ Done | `StudentLifecycleValidator` delegates its status gate to the machine while preserving every terminal message and enrollment check (`StudentPromotionLifecycleTest` 9/9). Roster `bulkUpdate` additionally guards against illegal cross-status flips — a terminal status can no longer be silently rolled back via the bulk endpoint; same-status submissions remain no-ops (`tests/Feature/StudentBulkStatusMachineTest.php`, 3 tests). |

### 2.3 Academic Session Enforcement

| Item | Status | Evidence / Notes |
|---|---|---|
| Partial unique index on `academic_sessions` where `is_current = true` | ✅ Done | Migration `2026_08_13_000001` adds a generated column `is_current_singleton` (`CASE WHEN is_current = 1 THEN 1 ELSE NULL END`, nullable, unique) — at most one `1`; every non-current row stores `NULL`. Applied to live DB (confirmed exactly 1 current row before migrating). |
| Transaction+lock in `AcademicSession::currentOrCreate()` | ✅ Done | `currentOrCreate()` now runs in a `DB::transaction`, takes an index-backed `lockForUpdate()` on the singleton column, and on a unique-violation race re-reads the winner instead of failing. Covered by `tests/Feature/AcademicSessionTest.php` (4 tests incl. a two-current-sessions rejection). Commit `96ab3ad`. |

---

## Sprint 3 — Security & Audit

| Task | Status | Evidence / Notes |
|---|---|---|
| **3.1** Policies for Fee, Student, Attendance, Backup + `Gate::authorize()` | ✅ Done | `app/Policies/` — `StudentPolicy`, `FeePolicy`, `AttendancePolicy`, `BackupEntryPolicy`. Super-admin `Gate::before` in `AppServiceProvider`. `Gate::authorize()` wired into `FeesController` (index/generate/collect/deCollect + all 5 custom-fee methods), `Admin\StudentController` (bulkUpdate/enrollmentHistory/destroy/bulkDelete), front `StudentController` (index/create/store/show), `AttendanceController` (store/absentees), `AdminAttendanceController` (grid/save), `FeePaymentController::store`, `StudentLifecycleController` (all 5), `BackupController` (all 7). Enforces **current** role behavior (admin super-user; accountant: student view/create + fee collect/view + attendance; teacher: student view/create + attendance; backup admin-only). Covered by `tests/Feature/AuthorizationPolicyMatrixTest.php` (7 tests / 56 assertions). |
| **3.2** Audit trail (`created_by`/`updated_by`/`collected_by` on payments, `AuditLog`) | ✅ Done | Migrations `2026_08_13_000003` (nullable `collected_by`/`created_by`/`updated_by` FK→users on `payments`) + `2026_08_13_000004` (`audit_logs`: `user_id` nullable FK, `action` indexed, polymorphic `auditable_*`, JSON `payload`, append-only `created_at`). `App\Models\AuditLog` with static `record()` + action constants; `Payment` gains the 3 actor FKs + `collectedBy`/`createdBy`/`updatedBy` relations. Wired: payment writes stamp `collected_by`/`created_by` in `FeesController::collect` + `FeePaymentController::store`; `AuditLog::record()` on fee collect/de-collect/custom-create/update/delete (student+section)/monthly-generate and both attendance saves (`AttendanceController::store`, `AdminAttendanceController::save`). Fixed latent 3.1 bug surfaced here: `FeePaymentController::store` authorized with `Fee::class` (Gate strips class-string arg → `FeePolicy::collect(User, Fee)` broke for non-admin) — now authorizes the resolved `$fee` instance per loop. Covered by `tests/Feature/AuditTrailTest.php` (7 tests / 20 assertions). Commit pending. |
| **3.3** Restore safety (transaction / checksum / post-restore validation) | ✅ Done | `BackupService::restore()` now runs three pre-flight gates **before** any destructive step — `verifyChecksum()` (rejects a file whose sha256 no longer matches the stored checksum), `validateDump()` (rejects empty/non-DDL dumps), plus a clean `RuntimeException` on decompression failure (`@gzdecode`, the old code leaked an `ErrorException` from a PHP warning). The drop+apply+validate run inside `DB::transaction` (real rollback on SQLite; MySQL DDL auto-commits, so the actual protection is the gates + validation — documented in-code). New `validateRestoredDatabase()` asserts migration count matches the backup, required tables exist, and no NULL `student_id` in fees/attendance; on failure the entry is marked `failed` instead of the old misleading `created`. Covered by `tests/Feature/RestoreSafetyTest.php` (5 tests / 13 assertions — prove the gates fire first and the DB is untouched). Commit pending. |

---

## Sprint 4 — Frontend Consolidation

| Task | Status | Evidence / Notes |
|---|---|---|
| **4.1** Shared generic `DataTable` component replacing ad-hoc tables | ✅ Done | `resources/js/Components/DataTable.jsx` — tanstack-backed, every feature opt-in so output is preserved: `sortable` (↑/↓ header indicators), `globalFilter`/`onGlobalFilterChange`/`globalFilterFn` inline search, `emptyMessage`, `loading`, `renderExpandedRow`+`expandedId` (expandable rows), `externalSort` (`{key, dir, onSort}` + per-column `meta.sortKey` — ⇅/↑/↓ indicators, page-owned sorting), per-column `meta.headerClassName`/`meta.cellClassName`, per-page class overrides. Migrated (each build-verified identical): `Admin/Users/Index.jsx`, `Admin/Classes/Index.jsx`, `Admin/Sections/Index.jsx`, `Admin/Fees/CustomFee.jsx` (commits `3001e9a`), `Admin/Reports/Index.jsx` (`a918425`), `Admin/Fees/Index.jsx` (`70ac196`), `Admin/Students/Index.jsx` (`da316ec` — external sort + selection via column defs; page-scoped `Students/Components/DataTable.jsx` deleted). `Accountant/Students/StudentsList.jsx` **deliberately not migrated** — it is a card grid (`<Link>` cards), not a `<table>`; the shared component only consolidates ad-hoc tables. |
| **4.2** Shared generic `FilterBar` component | ❌ Not done | No `Components/FilterBar.jsx`; filter panels are page-scoped (`StudentsFilterBar`, `LateFeesFiltersPanel`, etc.). |
| **4.3** Pagination on all list endpoints + UI | ❌ Not done | Not verified in any list page. |

---

## Sprint 5 — Service Layer Maturity

| Task | Status | Evidence / Notes |
|---|---|---|
| **5.1** `MonthlyFeeService` / `GenerateMonthlyFeeAction` (single fee-generation path) | ❌ Not done | No `app/Actions/` (empty), no `MonthlyFeeService`. `MonthlyFeeResolver` exists (pre-existing) but generation is not consolidated behind a single action. |
| **5.2** Replace 4 COALESCE subqueries in `FeesController::index()` | ❌ Not done | The 4 COALESCE subqueries are still in `FeesController.php:62–99`. |
| **5.3** Student Report consolidation (`StudentReportService::loadHistory()`, dedup endpoints) | ✅ Done | `app/Services/StudentReport/StudentReportService.php` + resolver package; report center switched to `student_id` + history timeline (commits `c7fd399`, `168120d`). Registry R1/R2 ✅. |

---

## Sprint 6 — Integration Testing & Hardening

| Task | Status | Evidence / Notes |
|---|---|---|
| **6.1** Service tests (MonthlyFeeResolver, StudentLifecycleValidator, AbsenteeService, DivisionTypeResolver, StudentStatusMachine, BackupService) | 🟡 Partial | ✅ `tests/Unit/DivisionTypeResolverTest.php` and `tests/Unit/StudentStatusMachineTest.php` exist. ❌ MonthlyFeeResolver / StudentLifecycleValidator / AbsenteeService / BackupService unit tests missing. |
| **6.2** Feature tests (student CRUD, fee collection, attendance marking, progression lifecycle) | 🟡 Partial | Feature tests incl. `AttendanceLifecycleTest`, `StudentPromotionLifecycleTest`, `StudentBulkStatusSyncTest`, `StudentBulkStatusMachineTest`, `AcademicSessionTest`, `FeeDeCollectTest`, `FeeUniqueIndexTest`, `StudentSectionCurrentScopeTest`, `AuthorizationPolicyMatrixTest`, `StudentFrontRoutesTest`, `AttendanceAbsenteesTest`, `AuditTrailTest`, `RestoreSafetyTest` (+ Breeze `ProfileTest`). Full suite: **176 passed / 11 failed** (11 = pre-existing Breeze/Auth/Profile, composition unchanged). |
| **6.3** Smoke tests (pages render, filters, exports) | ❌ Not done | No browser/E2E suite. Frontend verified only via `npm run build` + reasoning over production data (no JS test runner in `package.json`). |

---

## Additional Work Completed Outside the Roadmap

Feature/fix work done on `main` before/around the refactor sprints:

| Area | What shipped | Commits |
|---|---|---|
| **Student Progression** | Class-type-aware promotion (Kirtan independent of Gurmukhi); audit report | `1607646`, `698edc5` |
| **Student show page** | Gurmukhi/Kirtan tabs with lesson data; authoritative `class_type_key` grouping | `48b2e6b`, `5606c40`, `dd06dd7`, `be8e331`, `3f75ef7` |
| **Attendance** | Grid filtered by class type (no Gurmukhi/Kirtan bleeding); `lesson_learned` only on Kirtan tab + dedicated Lesson Notes section | `dd7d114`, `fc59f60`, `8f96890` |
| **Fees listing** | Grouped one row per student; current (not historical) class/section; all fees shown regardless of enrollment status; Gurmukhi/Kirtan properly separated; duplication prevented on section/class change; dedup on `(student_id, type, month)` | `cfa7795`, `97abe24`, `342259b`, `8ad22a0`, `c7699c8`, `196145c`, `bec8669`, `6b89a7c`, `2a95e1c` |
| **Reports** | Report center queries keyed by `student_id` + full enrollment history timeline; `FeePaymentController` optimized | `c7fd399`, `168120d` |

---

## Open / Pending (awaiting your decision)

| Item | Status |
|---|---|
| Merge `refactor/architecture` → `main` | ⏳ Not done (production-branch change; deliberately not merged without approval) |
| `reword.md` | ⏳ Untracked; **unrelated to this repo** (Omantel/Remedy GCC claims-management content — a stray paste). Not committed on purpose; awaiting user decision to delete or move it out of the repo. |
| Docs committed | ✅ Done — `docs/architecture/*` (01, 03, 05, 06, 07, 08, 10, README) + this tracker committed as `7dfe430` on `refactor/architecture`. |

---

## Summary

| Sprint | Status |
|---|---|
| Sprint 0 — Quick Wins | ✅ done |
| Sprint 1 — Extract route closure logic | ✅ done (1.1 service class aside) |
| Sprint 2 — Data integrity & model hardening | ✅ done (source drop, is_locked de-collect fix, status machine + validator + bulk guard, session singleton) |
| Sprint 3 — Security & audit | ✅ done (3.1 policies, 3.2 audit trail, 3.3 restore safety) |
| Sprint 4 — Frontend consolidation | 🟡 in progress (4.1 done, 4.2/4.3 not done) |
| Sprint 5 — Service layer maturity | 🟡 5.3 done, 5.1/5.2 not done |
| Sprint 6 — Integration testing | 🟡 partial (Sprint 1/2 coverage strong) |

**Highest-value next steps** (by roadmap risk ordering): Sprint 4.2/4.3 (shared FilterBar + pagination) → Sprint 5.1/5.2 (fee generation consolidation + COALESCE subqueries) → Sprint 6.1/6.3 (remaining service tests + smoke tests). No architecture change should proceed directly on `main`.
