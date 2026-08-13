# Phase 1 — Architecture & Domain Assessment

## Executive Summary

GNJM School ERP is a Laravel+Inertia+React application with ~99 PHP files serving admin, accountant, and teacher roles. The codebase shows clear signs of organic growth: a few well-structured domains (Student Report Center, Backup, Student Progression) coexist with others where business logic is embedded in route closures, the query builder is used fluently inline, and responsibilities blur across module boundaries.

---

## 1. Module Map

| Module | Primary Files | Responsibility | Health |
|---|---|---|---|
| **Student Management** | `routes/admin.php` closures, `StudentController`, `Student.php`, `StudentSection.php` | CRUD, bulk upsert, list, enrollment history, delete | ⚠️ Logic in route closures |
| **Class / Section** | `routes/admin.php` closures, `SchoolClass.php`, `Section.php` | Class/section CRUD, fee period linkage | ⚠️ Logic in route closures |
| **Attendance** | `AttendanceController.php`, `routes/attendance.php` closures, `Attendance.php` | Mark attendance, view, absentees | ⚠️ Dual: controller + closures |
| **Monthly Fees** | `MonthlyFeeResolver.php`, `GenerateMonthlyFees.php` (cmd), `FeeRatePeriod.php` | Fee resolution (period-based + legacy fallback) | ✅ Well-structured service |
| **Fees / Payments** | `FeesController.php`, `FeePaymentController.php`, `Fee.php`, `Payment.php` | Collection, custom fees, aggregation | ⚠️ Controller is large (562 lines) |
| **Student Report Center** | `StudentReportService.php`, resolvers, value objects (14 files) | Aggregated student performance reports | ✅ Clean orchestrator + resolver pattern |
| **Student Progression** | `StudentLifecycleController.php`, `StudentLifecycleValidator.php` | Promote, pass out, leave, reactivate | ✅ Good separation of concerns |
| **Backup & Restore** | `BackupService.php`, `BackupController.php`, `BackupEntry.php` | Database backup/restore with compatibility checks | ✅ Clean service |
| **User / RBAC** | `UserController.php`, `User.php`, `RoleMiddleware.php`, `RoleGate.jsx` | User CRUD, password reset, role gating | ⚠️ Section assignment mixed |
| **Reports** | `ReportController.php`, `ReportRegistry.php` | Build/export attendance & fee reports | ⚠️ Tightly coupled to build logic |
| **Academic Sessions / Batches** | `AcademicSession.php`, `Batch.php`, migrations | Session tracking, cohort identification | ✅ Simple value models |

---

## 2. Domain Ownership & Boundary Analysis

### Clear Ownership

| Domain | Owner | Entry Point |
|---|---|---|
| Student lifecycle | `StudentLifecycleController` + `StudentLifecycleValidator` | `/students/{id}/promote`, etc. |
| Student reports | `StudentReportService` + 6 resolver classes | `/admin/student-report-center/` |
| Backup/restore | `BackupService` + `BackupController` | `/admin/utilities/backup/` |
| Fee rate periods | `FeeRatePeriodController` | `/admin/classes/{id}/fee-periods` |

### Blurred Ownership

**Student Data Management** — the student CRUD (bulk upsert, listing, deletion, enrollment history) lives entirely in anonymous route closures inside `routes/admin.php` (lines 287–588). This is ~300 lines of business logic — including fee generation, enrollment archiving, and student deletion — that belongs in a controller or service class.

**Attendance** — the attendance module is split between:
- `AttendanceController.php` (store/save)
- `routes/attendance.php` closures (index, sections, mark, absentees — ~340 lines)
- `AdminAttendanceController.php` (admin grid views)

**Fees** — `FeesController.php` (562 lines) handles fee listing, custom fee CRUD, collection/de-collection, and division-type normalization. The `normalizeDivisionType()` method (lines 270–300) duplicates logic that also appears in attendance (`$isClassType` closures defined in `routes/attendance.php`) and the student report center.

---

## 3. Module Dependency Analysis

### Healthy Dependencies
- `StudentReportService` → `IdentityResolver` + `AttendanceResolver` + `FeeResolver` + `CalendarBuilder` + `KirtanScoreCalculator` → clean separation.
- `StudentLifecycleController` → `StudentLifecycleValidator` → validation separated from execution.
- `MonthlyFeeResolver` → `FeeRatePeriod` → single-purpose resolution chain.

### Problematic Dependencies

| Dependency | Issue |
|---|---|
| `routes/admin.php` closures → `DB::table()`, `Fee::firstOrCreate()`, `MonthlyFeeResolver` | Logic in route files breaks testability and discoverability |
| `routes/attendance.php` closures → `Attendance::where()`, `Carbon` parsing, streak calculation | Heavy business logic (absentee streak computation) embedded in route definition |
| `FeesController` → inline `COALESCE` subqueries (lines 61–98) | Complex SQL embedded in controller; hard to test and reuse |
| `Student` model → no `schoolClass()` or `section()` accessor | Callers must go through `enrollments()` and join manually — repeated across codebase |

---

## 4. Missing Business Concepts

| Concept | Current State | Impact |
|---|---|---|
| **Enrollment as aggregate root** | `StudentSection` acts as pivot but has no dedicated service | Enrollment status changes are scattered across controllers and closures |
| **Fee Payment as transaction** | `Payment` is a simple model with no transaction/audit wrapper | No payment receipt, no payment method, no partial payment support |
| **Attendance as domain event** | Simple CRUD record | Cannot track attendance corrections, audit trail, or late marking |
| **Student Status Machine** | Status constants exist but transitions are enforced in `StudentLifecycleValidator` only | Duplicated status checks appear in closures (bulk-update, progression data) |
| **Academic Session** | Exists as model but lightly integrated | Promotion doesn't use sessions; fee periods don't reference sessions |
| **School Calendar** | No calendar abstraction | Sunday rules for Kirtan/Gurmukhi are hardcoded in `routes/attendance.php` |

---

## 5. Duplicated Concepts

| Concept | Location 1 | Location 2 | Location 3 |
|---|---|---|---|
| Division type normalization (kirtan/gurmukhi) | `FeesController::normalizeDivisionType()` | `$isClassType` closure in `routes/attendance.php` | Kirtan detection in Student Report Center |
| Active enrollment filter | `StudentSection::scopeCurrent()` | Inline `where('status','active')->whereNull('transferred_at')` in ~8 route closures | `StudentLifecycleValidator` queries |
| Fee resolution chain | `MonthlyFeeResolver` | `routes/admin.php` bulk-update inline (lines 515–531) | `FeesController::generateMonthlyFees` → Artisan call |
| Attendance stats rollup | `StudentReportService::loadHistory()` | `routes/admin.php` enrollment-history endpoint (lines 539–564) | `AdminAttendanceController` |

---

## 6. Folder Structure Assessment

```
app/
├── Console/Commands/          # 2 commands: fee generation, cleanup
├── Http/
│   ├── Controllers/           # 15 controllers (some role-scoped)
│   │   ├── Admin/             # 8 controllers
│   │   ├── Auth/              # 8 auth controllers
│   │   ├── Accountant/        # 2 controllers
│   │   └── ...                # 5 top-level controllers
│   ├── Middleware/             # 6 middleware
│   └── Requests/              # 3 form requests
├── Models/                    # 12 models
├── Providers/                 # 1 provider
├── Reports/                   # 1 report registry
├── Services/                  # 10 files across services and sub-directories
└── Support/StudentReport/     # 14 value objects + enums (well-organized)
```

### Observations

- **No Repository or Action pattern** — all data access is through Eloquent models directly.
- **Services are inconsistently placed** — `MonthlyFeeResolver`, `BackupService`, `StudentLifecycleValidator` are directly in `Services/`, while Student Report resolvers are in `Services/StudentReport/`.
- **Value objects are in `Support/StudentReport/`** — good organization but tightly scoped to one feature.
- **No `Actions/` directory** — worth considering for atomic business operations.

---

## 7. Recommendations (Ranked)

### Immediate (Quick Wins)

1. **Extract inline route closures into Controllers** — `routes/admin.php` student CRUD (300+ lines), `routes/attendance.php` absentees (220+ lines)
2. **Consolidate division-type normalization** — one service class instead of the 3+ current implementations
3. **Move `$isClassType` closure into a reusable utility** — defined inline in `routes/attendance.php` but referenced in multiple places

### Short-Term

4. **Create a `StudentService`** — centralize bulk-update, status changes, enrollment management (currently spread across closures and controllers)
5. **Extract absentee streak logic** from `routes/attendance.php` into a dedicated service
6. **Create an `EnrollmentService`** — owning the enrollment lifecycle (create, archive, reactivate, transfer)

### Medium-Term

7. **Introduce Action classes** for atomic operations: `PromoteStudentAction`, `CollectFeeAction`, `GenerateMonthlyFeesAction`
8. **Introduce a StudentStatusMachine** — formalize and centralize the status transitions
9. **Move repeated subquery patterns** (`COALESCE` blocks in FeesController) into model scopes or query builders

---

## 8. Architecture Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Routes                           │
│  web.php ├── auth.php                                       │
│          ├── admin.php    (closures ≈ 600 lines) ────╮     │
│          ├── attendance.php (closures ≈ 340 lines) ───┤     │
│          ├── accountant.php                            │     │
│          ├── teacher.php                               │     │
│          ├── students.php (closure-heavy) ─────────────┤     │
│          └── admin/users (UserController)              │     │
└──────┬──────────────────────────────────────┬──────────┘     │
       │                                      │                │
       ▼                                      ▼                │
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐       │
│ Controllers  │  │ Route Closures   │  │ Console Cmds │       │
│ (well-bounded)│  │ (inline logic) ──╯  │ (2)          │       │
└──────┬───────┘  └──────────────────┘  └──────┬───────┘       │
       │                                       │               │
       ▼                                       ▼               │
┌─────────────────────────────────────────────────┐            │
│              Services Layer                      │            │
│  MonthlyFeeResolver · BackupService              │            │
│  StudentLifecycleValidator · StudentReportService│            │
│  AttendanceResolver · FeeResolver · ...          │            │
└──────────┬──────────────────────────┬────────────┘            │
           │                          │                         │
           ▼                          ▼                         │
┌──────────────────┐    ┌────────────────────────┐              │
│    Models         │    │ Support/Value Objects   │              │
│  Student, Fee,    │    │ StudentReport, DayCell,  │              │
│  Attendance ...   │    │ MonthRange, Enums ...    │              │
└──────┬───────────┘    └────────────────────────┘              │
       │                                                        │
       ▼                                                        │
┌──────────────────────────────────────────────────────┐        │
│                   SQLite / MySQL                      │        │
│  students, student_sections, fees, payments,           │        │
│  attendance, classes, sections, users, ...            │        │
└──────────────────────────────────────────────────────┘        │
                                                                 │
  ═══ Arrows showing inline closures bypassing ══════════════════╝
      service layer, calling models/DB directly
```

---

*Generated: 2026-07-30*
