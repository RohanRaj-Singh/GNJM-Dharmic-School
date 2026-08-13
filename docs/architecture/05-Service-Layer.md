# Phase 4 — Service Layer Audit

## 1. Service Inventory

| Service | Lines | Responsibility | Patterns | Health |
|---|---|---|---|---|
| `MonthlyFeeResolver` | 131 | Resolve monthly fee amount per enrollment+month | Chain of responsibility, Strategy | ✅ Strong |
| `BackupService` | 465 | DB backup/restore with compatibility checks | Service class | ⚠️ Over-engineering (mysqlndump fallback, formatBytes) |
| `StudentLifecycleValidator` | 163 | Validate student status transitions | Validation service | ✅ Good |
| `StudentReportService` | 235 | Orchestrate student performance report | Orchestrator + Resolver | ✅ Clean |
| `AttendanceResolver` | ~50 | Resolve attendance stats for student+class_ids | Resolver | ✅ Clean |
| `FeeResolver` | ~50 | Resolve fee stats for student+class_ids | Resolver | ✅ Clean |
| `CalendarBuilder` | ~100 | Build calendar month grid from attendance rows | Builder | ✅ Clean |
| `KirtanScoreCalculator` | ~50 | Compute Kirtan score from attendance+lessons | Calculator | ✅ Clean |
| `StudentIdentityResolver` | ~50 | Load student identity + all enrollments | Resolver | ✅ Clean |
| `StudentReportCache` | ~80 | Cache report results per request-key | Cache-aside | ✅ Clean |
| `ValidationResult` | 30 | Value object for validation results | Value object | ✅ Clean |

---

## 2. What Belongs in Services vs Models vs Controllers

### Current Distribution

```
                    Controllers / Closures    Models        Services
                    ──────────────────────    ──────        ────────
Student CRUD        ❌ 300+ lines in routes   Student       StudentLifecycleValidator
Fee listing         ❌ FeesController (562L)   Fee           MonthlyFeeResolver
Attendance mark     ✅ AttendanceController    Attendance    ❌ Nothing
Absentees           ❌ 220 lines in routes     ❌ Inline     ❌ Nothing
Reports             ❌ FeesController          ❌ Inline     ✅ Report resolvers
Backup              ✅ BackupController        BackupEntry   ✅ BackupService
Enrollment history  ❌ route closure           ❌ Queries    ❌ (StudentsReportService has similar)
Status management   ❌ route closure           ❌ Queries    ❌ StudentLifecycleValidator
```

### Recommended Division

| Layer | Should Own |
|---|---|
| **Controllers / Route Actions** | HTTP handling, request validation, response formatting, Inertia rendering |
| **Services** | Business logic, complex queries (2+ joins), orchestration, external integrations |
| **Models** | Scopes, simple accessors, relationship definitions, status constants |
| **Actions** (new) | Single atomic business operations (promote student, collect fee, generate monthly fees) |

### What Currently Violates This

1. **Route closures in `routes/admin.php`** — ~600 lines of business logic in route files. The student CRUD bulk-update (lines 407-537) includes:
   - Name formatting/normalization
   - Enrollment archiving logic
   - Fee deletion for free students
   - Fee creation via `MonthlyFeeResolver`
   - All inside a closure with no testability

2. **Route closures in `routes/attendance.php`** — ~340 lines including:
   - Absentee streak calculation (nested loops with Carbon date manipulation)
   - Status normalization (a/p/l → absent/present/leave)
   - Multi-pass filtering and sorting
   - All inline, all untestable in isolation

3. **FeesController::index()** — 260-line method with:
   - 4 JOINs and 4 COALESCE subqueries in the query builder
   - Complex conditional filtering
   - Grouping and aggregation logic
   - All embedded directly in the controller

---

## 3. Service Quality Assessment

### MonthlyFeeResolver ⭐⭐⭐⭐⭐
- Clean resolution chain with clear precedence
- Well-documented with code comments
- Has a fast path for bulk operations (`resolveBulk()`)
- Single responsibility
- Testable (no HTTP dependencies, pure input→output)

### StudentLifecycleValidator ⭐⭐⭐⭐⭐
- Each transition is a separate method
- Uses `ValidationResult` value object (clean)
- Guards all terminal and invalid states
- Single responsibility

### StudentReportService ⭐⭐⭐⭐
- Clean orchestrator pattern
- Delegates to specialized resolvers
- Good use of value objects
- ⚠️ `loadHistory()` duplicates logic in `routes/admin.php`
- ⚠️ `sumLessons()` uses mutable `$seen` array — could be replaced with a set

### BackupService ⭐⭐⭐
- Comprehensive backup/restore logic
- Good error handling and logging
- ⚠️ Too large (465 lines) — `formatBytes()`, `calculateDbSize()`, `getMigrationCount()` could be extracted
- ⚠️ Tries `mysqldump` then falls back to native — two concerns in one method
- ⚠️ No test coverage for restore failure scenarios

### CalendarBuilder ⭐⭐⭐⭐
- Clean builder pattern
- ⚠️ Coupled to `DayCell` value object and `Division` enum — this is domain-appropriate but limits reuse

### AttendanceResolver / FeeResolver ⭐⭐⭐⭐
- Clean resolvers with clear inputs/outputs
- ⚠️ Very thin — might be over-abstracted for what they do (simple SELECT + GROUP BY)

### KirtanScoreCalculator ⭐⭐⭐⭐⭐
- Pure function: inputs → score
- No side effects
- Perfectly testable

---

## 4. Missing Services

| Service Needed | Why | Priority |
|---|---|---|
| **StudentService** | Centralize student CRUD, bulk-upsert, status changes | High |
| **EnrollmentService** | Centralize enrollment creation, archiving, reactivation | High |
| **AttendanceService** | Handle attendance marking, validation, day checks | High |
| **AbsenteeService** | Streak calculation, absentee categorization | Medium |
| **FeeCollectionService** | Payment recording, receipt generation, de-collection | Medium |
| **ReportBuildService** | Report building logic (extracted from FeesController) | Medium |
| **DivisionTypeResolver** | Normalize Kirtan/Gurmukhi detection (one canonical implementation) | Low |
| **SchoolCalendarService** | Day-type determination (Kirtan Sunday, Gurmukhi weekday) | Low |

---

## 5. Code Smell — The "$isClassType" Function

Defined at the top of `routes/attendance.php`:

```php
$isClassType = function (?string $type, string $needle): bool {
    $normalized = strtolower(trim((string) $type));
    if ($normalized === '') return false;
    return $normalized === $needle || str_contains($normalized, $needle);
};
```

This is an anonymous function stored in a variable used throughout the file. It:
- Is **not reusable** from any other file
- Cannot be unit-tested in isolation
- Has **no type safety** on `$type` (accepts `?string` then casts to string anyway)

Meanwhile, `FeesController::normalizeDivisionType()` does similar work with different logic (checks both `class_type` and `class_name` fields, uses substring matching). These two implementations of "what division is this?" should be unified.

---

## 6. Duplicate Logic Across Services and Closures

| Logic | Service Implementation | Closure Implementation | Gap |
|---|---|---|---|
| Active enrollment filtering | `StudentSection::scopeCurrent()` | `where('status','active')->whereNull('transferred_at')` | scopeCurrent doesn't check status, closures do both |
| Fee amount resolution | `MonthlyFeeResolver::resolveForMonth()` | Inline `Fee::firstOrCreate` in bulk-update | Both call resolver but inline has extra dedup logic |
| Attendance stats | `StudentReportService::loadHistory()` | `routes/admin.php:539-564` enrollment-history | Nearly identical — 2x maintenance |
| Student fee outstanding | `FeeResolver::resolve()` | `routes/admin.php:231-240` subquery in progression data | Different implementations, same goal |

---

*Generated: 2026-07-30*
