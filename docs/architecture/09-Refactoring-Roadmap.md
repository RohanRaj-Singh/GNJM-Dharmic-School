# Phase 8 — Refactoring Roadmap

This roadmap is ordered by risk reduction and architectural impact. Each sprint produces testable, shippable improvements.

---

## Sprint 0 — Quick Wins (Days 1–2)

These are safe, high-confidence changes that build momentum.

### Sprint 0 Tasks

| Task | Effort | Risk Reduced | Dependencies |
|---|---|---|---|
| **0.1** Add unique index `(student_section_id, date)` on attendance | 15 min | 🔴 R1 — duplicate attendance | None |
| **0.2** Fix `scopeCurrent()` to check `status = 'active'` | 15 min | 🟠 R6 — enrollment filtering | None |
| **0.3** Remove commented `dd()` in FeesController | 1 min | 🔵 L5 | None |
| **0.4** Remove duplicate `Section::teachers()` method | 15 min | M4 — confusion risk | None |
| **0.5** Add NOT NULL constraint on `fees.student_id` | 30 min | 🟠 R4 — fee dedup fails | Run backfill verification first |

### Output
- ✅ Attendance unique index migration
- ✅ `scopeCurrent()` updated — verify no callers relied on old behavior
- ✅ Code cleanup

---

## Sprint 1 — Extract Core Logic from Route Closures (Days 3–7)

**Theme**: Move business logic out of `routes/*.php` files into proper controllers and services.

### Sprint 1.1 — Create `StudentService`
- Extract student CRUD from `routes/admin.php` closure (lines 289–537)
- Methods: `list()`, `bulkUpsert()`, `getEnrollmentHistory()`, `delete()`, `getStudentOptions()`
- Create `StudentController` or add to `Admin\StudentController`

**Risk reduced**: C2 (route closure logic), R3 (status divergence)
**Testing**: Write feature tests for bulk-upsert scenarios (add student, remove enrollment, change section)

### Sprint 1.2 — Create `AttendanceService`
- Extract absentee logic from `routes/attendance.php` closure (lines 140–358)
- Create `AbsenteeService` with methods: `getAbsentees()`, `calculateStreak()`, `getTodayAbsentees()`
- Extract status normalization into a dedicated `AttendanceStatus` enum

**Risk reduced**: C2 (route closure logic), C3 (fragile streak logic)
**Testing**: Unit tests for streak calculation with known inputs

### Sprint 1.3 — Create `DivisionTypeResolver` Service
- Unify `$isClassType` (attendance.php) and `normalizeDivisionType()` (FeesController)
- Single canonical implementation in `App\Services\DivisionTypeResolver`
- Exact matching by controlled vocabulary first, substring fallback only as option

**Risk reduced**: H1 (duplicated division detection), R7 (false positive matching)

### Deliverables for Sprint 1
- `App\Services\StudentService`
- `App\Services\AbsenteeService`
- `App\Services\DivisionTypeResolver`
- 3+ new controller files with tests
- Route files reduced by ~500 lines of closures

---

## Sprint 2 — Data Integrity & Model Hardening (Days 8–12)

### Sprint 2.1 — Fee Model Hardening
- Verify and fix `fees.student_id` NOT NULL migration
- Remove redundant `source` column from fees table (consolidate with `type`)
- **DONE (2026-08-13):** Canonical unique index is `(student_id, type, month)` — `idx_fees_unique_student_monthly`, applied by migration `2026_07_27_000002`. The dedup key is the student, NOT the enrollment (see F3). Verified present in MySQL; data was clean (0 duplicates). No new migration needed.
- Fix `is_locked` reset on de-collect (R9)

**Risk reduced**: R4 (fee dedup), R9 (locked after de-collect), M5 (redundant columns)

### Sprint 2.2 — Student Status Machine
- Create `StudentStatusMachine` service that defines ALL transition rules
- Transition matrix:

```
From \ To      active  inactive  promoted  passed_out  left
active          -       ✅        ✅        ✅         ❌
inactive        ✅      -         ❌        ❌         ✅
promoted        ❌      ❌        -         ❌         ❌
passed_out      ❌      ❌        ❌        -          ❌
left            ❌      ❌        ❌        ❌         -
```

- Refactor `StudentLifecycleValidator` to use the status machine
- Add the same validation to `StudentService::bulkUpsert()`

**Risk reduced**: H2 (status enforcement), R3 (status divergence)

### Sprint 2.3 — Academic Session Enforcement
- Add unique partial index on `academic_sessions` where `is_current = true`
- In `AcademicSession::currentOrCreate()`, use a DB transaction with lock
- Link promotions to the current academic session

**Risk reduced**: R8 (session race condition)

### Deliverables for Sprint 2
- `App\Services\StudentStatusMachine`
- Migration for fee column cleanup
- Migration for attendance unique constraint (if Sprint 0 didn't)
- Updated StudentLifecycleValidator

---

## Sprint 3 — Security & Audit (Days 13–16)

### Sprint 3.1 — Authorization Layer
- Create Laravel Policies for: Fee, Student, Attendance, Backup
- Add `Gate::authorize()` calls in all controller methods
- Add `@can` directives in React where applicable (via Inertia props)

**Risk reduced**: R11 (missing authorization)

### Sprint 3.2 — Audit Trail
- Add `created_by` / `updated_by` to Payment table (nullable, for future use)
- Add `collected_by` to payments (who pressed "Collect")
- Create an `AuditLog` model/trait for tracking state changes on fees and attendance

**Risk reduced**: R14 (no audit trail)

### Sprint 3.3 — Restore Safety
- Wrap backup restore in a DB transaction (MySQL) or table-rename approach (SQLite)
- Add pre-checksum verification before restore
- Add post-restore validation (check row counts, migration count, NULL student_ids)

**Risk reduced**: R2 (restore failure), R10 (no model events)

### Deliverables for Sprint 3
- `app/Policies/` — 4+ policy files
- `Payment` migration for audit columns
- Updated `BackupService::restore()` with transaction protection

---

## Sprint 4 — Frontend Consolidation (Days 17–21)

### Sprint 4.1 — Shared DataTable Component
- Build a generic `DataTable` component with:
  - Sortable columns
  - Inline search
  - Pagination controls
  - Empty state
  - Loading skeleton
- Replace ad-hoc table implementations in:
  - `Admin/Fees/Index.jsx`
  - `Admin/Students/Index.jsx`
  - `Accountant/Students/StudentsList.jsx`

### Sprint 4.2 — Shared FilterBar Component
- Build a generic `FilterBar` component accepting filter definitions
- Standardize filter parameter naming across the app
- Centralize debounced search

### Sprint 4.3 — Pagination
- Add `paginate()` to all list endpoints
- Add paginated response type to Inertia pages
- Implement pagination UI in the DataTable component

### Deliverables for Sprint 4
- `resources/js/Components/DataTable.jsx`
- `resources/js/Components/FilterBar.jsx`
- Updated list pages with pagination

---

## Sprint 5 — Service Layer Maturity (Days 22–26)

### Sprint 5.1 — Monthly Fee Generation Overhaul
- Extract fee generation from `routes/admin.php` bulk-update into `MonthlyFeeService`
- Extract fee generation from `FeesController::generateMonthlyFees()` (currently an Artisan call)
- Create single `GenerateMonthlyFeeAction` for the CLI command and the admin button

### Sprint 5.2 — Fee Query Optimization
- Replace the 4 COALESCE subqueries in `FeesController::index()` with:
  - A database view
  - OR a dedicated reporting query with explicit JOINs
  - OR a materialized summary cached per student
- Add pagination to fee listing

**Risk reduced**: H3 (COALESCE performance)

### Sprint 5.3 — Student Report Consolidation
- Have the enrollment-history endpoint call `StudentReportService::loadHistory()` instead of duplicating it
- Remove the redundant closure-based enrollment-history endpoint
- Verify both admin UI and AI Chatbot still work after consolidation

### Deliverables for Sprint 5
- `App\Services\MonthlyFeeService`
- `App\Actions\GenerateMonthlyFeeAction`
- Fee listing with paginated query
- Consolidated enrollment-history

---

## Sprint 6 — Integration Testing & Hardening (Days 27–30)

### Sprint 6.1 — Service Tests
- `MonthlyFeeResolverTest` — test all resolution paths
- `StudentLifecycleValidatorTest` — test all transitions
- `AbsenteeServiceTest` — streak calculation with edge cases
- `DivisionTypeResolverTest` — all input variants
- `BackupServiceTest` — create, restore, compatibility

### Sprint 6.2 — Feature Tests
- Student CRUD via HTTP
- Fee collection workflow
- Attendance marking workflow
- Student progression lifecycle (promote → pass out, etc.)

### Sprint 6.3 — Smoke Tests
- All pages render (Inertia)
- All filters work
- All exports work (CSV, PDF)

---

## Migration Strategy

### Breaking Changes

| Change | Impact | Mitigation |
|---|---|---|
| `scopeCurrent()` now checks status | Callers expecting inactive enrollments break | Audit all `scopeCurrent()` callers before merging |
| `Fee.source` column removed | Any direct DB queries referencing it | Update all queries in migration, add warning in release notes |
| Attendance unique constraint | Existing duplicates prevent migration | Dedup migration first (already done in 2026_07_27_000002) |
| Route closure extraction | URL structure unchanged, method signatures change | Wrap in new controller, keep same route → view contract |

### Non-Breaking Changes

| Change | Strategy |
|---|---|
| New services | Add alongside existing code, migrate callers one by one |
| New policies | Add alongside routes, enforce gradually |
| New frontend components | Build and adopt incrementally |
| Tests | CI-gated, no effect on production |

### Rollback Plan

Each sprint ends with a deployable state. If Sprint N causes issues:
1. Revert the service/repository binding in `AppServiceProvider`
2. Revert the migration (if data-only, write a down migration)
3. Hotfix the route closure that was previously extracted

---

## Expected Impact

| Metric | Before | After (Sprint 6) |
|---|---|---|
| Route closure logic (lines) | ~1000+ | ~50 (only includes route group definitions) |
| Services | 6 | 12+ (StudentService, AbsenteeService, MonthlyFeeService, DivisionTypeResolver, StudentStatusMachine, policies) |
| Unique constraints at DB level | 1 (recently added) | 4+ (attendance, fees, outcome values, fee periods) |
| Test coverage | Near 0% | >60% (service layer) |
| Inline SQL duplication | 6+ instances | 0 (all consolidated into services/scopes) |
| Hardcoded magic numbers/strings | 10+ | 0 (extracted to constants/config) |
| N+1 query risk locations | 4+ | 0 (eager loading enforced) |

---

## Future Architecture (Post-Sprint 6)

```
Routes (thin — definition only)
    ↓
Controllers (HTTP + validation only)
    ↓
Actions (atomic business operations)
    ↓
Services (orchestration, complex queries)
    ↓
Models (relationships, scopes, constants)
    ↓
Database (with constraints, indexes, FKs)
```

```
Frontend:
  Shared Components (DataTable, FilterBar, Modal, etc.)
      ↓
  Layout Components (per role)
      ↓
  Page Components (thin — compose from shared)
      ↓
  Server Props (via Inertia)
```

---

## Business Rule Registry

Documented alongside the code so every business rule has one canonical implementation.

| Domain | Rule # | Rule | Status | Location |
|---|---|---|---|---|
| **Fees** | F1 | Free students pay 0 monthly fee | ✅ Implemented | MonthlyFeeResolver |
| **Fees** | F2 | Fee rate resolution: section period → class period → section default → class default → 0 | ✅ Implemented | MonthlyFeeResolver |
| **Fees** | F3 | Monthly fees are keyed by (student_id, type, month) — deduplication. Canonical identity is the student, NOT the enrollment. | ✅ Implemented | DB unique index `idx_fees_unique_student_monthly` (migration 2026_07_27_000002); code keys by `(student_id, type, month)` in `Admin\StudentController::bulkUpdate`, `StudentController::store`, `Admin\PendingFeesController::generatePendingMonthlyFees` |
| **Fees** | F4 | Custom fees are assigned per-section, not per-student | ✅ Implemented | FeesController::storeCustomFee |
| **Fees** | F5 | Custom fees lock after first payment (cannot edit amount) | ✅ Implemented | FeesController::updateCustomFee |
| **Fees** | F6 | Payments are soft-deleted (de-collect = restore, not delete) | ✅ Implemented | Payment uses SoftDeletes |
| **Fees** | F7 | Fees never move between enrollments | 🔲 Documented only | Architecture principle |
| **Attendance** | A1 | Kirtan attendance can only be marked on Sunday | ⚠️ Hardcoded | routes/attendance.php |
| **Attendance** | A2 | Gurmukhi attendance cannot be marked on Sunday | ⚠️ Hardcoded | routes/attendance.php |
| **Attendance** | A3 | Teachers mark attendance only for their assigned sections | ✅ Implemented | routes/attendance.php + Section::teachers() |
| **Attendance** | A4 | Attendance belongs to the enrollment where it was recorded | ✅ Implemented | attendance.student_section_id FK |
| **Progression** | P1 | Promotion closes enrollment of same class type only (Kirtan independent from Gurmukhi) | ✅ Implemented | StudentLifecycleController |
| **Progression** | P2 | Promotion creates a new enrollment, does NOT modify the student's identity record | ✅ Implemented | StudentLifecycleController |
| **Progression** | P3 | Pass-out closes all enrollments and sets student status to passed_out | ✅ Implemented | StudentLifecycleController |
| **Progression** | P4 | Leave school requires inactive status first (safety gate) | ✅ Implemented | StudentLifecycleValidator |
| **Progression** | P5 | Reactivation restores all inactive enrollments to active | ✅ Implemented | StudentLifecycleController |
| **Reports** | R1 | Student report aggregates across ALL historical enrollments | ✅ Implemented | StudentReportService |
| **Reports** | R2 | Report data is cached, invalidated on student mutations | ✅ Implemented | StudentReportCache |
| **Reports** | R3 | Historical reports are read-only | 🔲 Not enforced | Implicit in Inertia render |
| **Auth** | U1 | Admin, accountant, and teacher roles are mutually exclusive | ✅ Implemented | RoleMiddleware |
| **Auth** | U2 | Teachers can only access data for their assigned sections | ✅ Implemented | Route-level + Section::teachers() |
| **Backup** | B1 | Backup creates compressed SQL dump | ✅ Implemented | BackupService |
| **Backup** | B2 | Restore is destructive (drops all tables first) | ⚠️ No transaction | BackupService::restore() |

---

*Generated: 2026-07-30*
