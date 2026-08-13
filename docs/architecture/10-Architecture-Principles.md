# Architecture Principles

These principles guide all future development and refactoring. Every feature, bug fix, and refactor should align with them.

---

## 1. One Canonical Implementation

> Every business rule has exactly one implementation in the codebase.

**Why**: Duplicate logic means fixing a bug in one place doesn't fix it everywhere. It means two features can give different answers for the same input.

**How**: 
- Before implementing a business rule, check if it already exists.
- Extract shared rules into Services (not models, not controllers).
- If you find a duplicate, consolidate it immediately.

**Violations found**: Division type detection (3 implementations), active enrollment filtering (8+ inline variations), attendance stats rollup (3 implementations).

---

## 2. Routes Define Paths, Not Logic

> Route files contain only route definitions and middleware. Zero business logic.

**Why**: Route closures cannot be unit-tested, cannot be reused, and are invisible to static analysis.

**How**:
- Every route points to a Controller method.
- Controllers handle HTTP concerns only (validation, response format, Inertia render).
- Business logic lives in Services or Actions.

**Current state**: ~600 lines of business logic in `routes/admin.php` and `routes/attendance.php` closures. Target: 0 lines.

---

## 3. Controllers Are Thin Co-ordinators

> Controllers validate the request, call a service, and return a response. Nothing more.

**Why**: Fat controllers hide business logic behind HTTP concerns, making it hard to test and reuse.

**How**:
- Controllers should not contain SQL queries, complex array transformations, or calculations.
- A controller method should be readable in ~30 seconds. If it takes longer, extract logic.
- Use Form Requests for validation when the rules are complex.

**Current state**: `FeesController::index()` at 260 lines violates this. Target: max 60 lines per controller method.

---

## 4. Services Own Business Logic

> All business logic belongs in Service classes, not in models, controllers, or route closures.

**Why**: Services are testable, reusable, and have clear boundaries.

**How**:
- Services are stateless (or their state is explicitly scoped, like `BackupService`).
- Services accept primitives or models and return primitives or value objects.
- Services do not call `redirect()`, `back()`, `session()->flash()`, or `Inertia::render()`.
- Services may call other services.

**Good**: `MonthlyFeeResolver`, `StudentLifecycleValidator`, `StudentReportService`.
**Bad**: 300-line route closure with inline `DB::transaction()` and `Fee::firstOrCreate()`.

---

## 5. Actions for Atomic Operations

> Complex write operations that span multiple models are encapsulated in Action classes.

**Why**: Actions are the "commits" of your domain — they make a single conceptual change, fully and correctly.

**How**:
- An Action class has one public method: `execute()` (or `handle()`, `run()`).
- An Action wraps its work in a DB transaction.
- An Action validates preconditions, performs the operation, and returns a result.
- Actions can be called from controllers, CLI commands, and other services.

**Examples** (to create): `PromoteStudentAction`, `CollectFeeAction`, `GenerateMonthlyFeesAction`, `BulkUpsertStudentAction`.

---

## 6. Models Define Data Access, Not Business Logic

> Eloquent models own relationships, scopes, accessors, mutators, and constants. Business rules go in Services.

**Why**: Models are already responsible for persistence. Adding business logic breeds fat models and unclear boundaries.

**How**:
- Scopes are for frequently-used query filters (`scopeCurrent()`, `scopeHistorical()`).
- Accessors are for simple formatting (`$user->name` → title case).
- Relationships define the data graph.
- Static constants define enumerations (`STATUS_ACTIVE`, `STATUS_PASSED_OUT`).
- Model events (`booted()`, `creating()`, etc.) are for data integrity, not business rules.

**Good**: `Student::STATUS_ACTIVE`, `StudentSection::scopeCurrent()`.
**Bad**: A model method that calculates fee aggregates across multiple relationships (belongs in a Service).

---

## 7. Value Objects for Immutable Data

> Report results, aggregated stats, and configuration bundles are value objects, not arrays.

**Why**: Value objects are type-safe, self-documenting, and prevent "stringly-typed" data.

**How**:
- Value objects are readonly (PHP 8.1+ readonly properties).
- Value objects have named constructors for complex creation.
- Value objects don't have relationships or database access.

**Good**: `StudentReport`, `DayCell`, `MonthRange`, `FeeSummary`, `AttendanceSummary`, `ValidationResult`.
**Target**: Replace inline `collect()->map()->groupBy()` array pipelines with value objects where the shape is reused.

---

## 8. Database Constraints Enforce Integrity

> Every data integrity rule is enforced at the database level, not just the application level.

**Why**: Application-level checks can be bypassed (direct DB access, race conditions, future code paths).

**How**:
- Add UNIQUE indexes for all unique business key combinations.
- Add FOREIGN KEY constraints for all relationships.
- Add CHECK constraints (or enums) for status/type columns.
- Add NOT NULL constraints for all required columns.
- Use migrations for all schema changes, no raw SQL.

**Current gaps**: Attendance (no unique constraint), `students.status` (no CHECK), `fee_rate_periods` (no FK enforcement).

---

## 9. Frontend Components Are Reusable

> Shared UI patterns exist once in a shared component.

**Why**: 5 filter panels with different code means 5x maintenance, 5x opportunity for bugs.

**How**:
- DataTable, FilterBar, Pagination, ConfirmDialog, and DateRangePicker are shared components.
- Page-level components compose from shared components.
- Feature-specific logic stays in page-level components (or custom hooks).
- Avoid prop drilling beyond 3 levels — use context or extract a layout component.

**Current state**: 5+ filter panel implementations, 3+ table implementations. Target: 1 each.

---

## 10. Explicit Over Implicit

> Code communicates intent. Magic numbers, inline closures, and undocumented behavior are technical debt.

**Why**: Code is read far more often than it's written. Future developers (including your future self) should understand the intent without running the app.

**How**:
- No magic numbers. Extract to named constants.
- No inline closures for business logic. Extract to named functions/methods.
- No implicit assumptions (like "Kirtan = Sunday, Gurmukhi ≠ Sunday"). Make them configurable or documented.
- Every DB query has a clear purpose. Complex queries have a comment explaining what they return.
- Every migration has a clear up/down and explains the schema change.

---

## Principle Interaction

These principles reinforce each other:

```
Routes are thin (P2)
    ↓
Controllers are thin (P3)
    ↓
Services contain logic (P4)   Actions for writes (P5)
    ↓
Models define data access (P6)   Value objects for shape (P7)
    ↓
Database enforces integrity (P8)
```

And on the frontend:

```
Pages compose from shared components (P9)
    ↓
Each reusable component is explicit in its API (P10)
```

---

## Migration Rule

When adding a new feature:
1. Can a principle from P1–P10 tell you where it goes?
2. If the codebase doesn't have the right place for it yet, create it (don't clone an existing bad pattern).
3. If you touch a file that violates a principle, leave it 10% better than you found it.

When refactoring:
1. Start with P2 (extract route logic) and P8 (add constraints) — highest ROI.
2. Then P3 (thin controllers) and P4 (service creation) — structural improvement.
3. Then P9 (frontend components) — UX consistency.

---

*Generated: 2026-07-30*
