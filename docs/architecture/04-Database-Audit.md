# Phase 3 — Data Model Audit

## 1. Entity Overview

| Table | Purpose | Records Reality? | Health |
|---|---|---|---|
| `students` | Individual student identity | ✅ Yes | ✅ Good |
| `student_sections` | Enrollment (student ↔ class+section) | ✅ Yes — the central pivot | ⚠️ Multiple concerns |
| `classes` | School classes (Gurmukhi/Kirtan levels) | ✅ Yes | ✅ Good |
| `sections` | Class divisions (batches within a class) | ✅ Yes | ✅ Good |
| `attendance` | Daily attendance per enrollment | ✅ Yes | ⚠️ Dual FK linkage |
| `fees` | Fee line items (monthly + custom) | ✅ Yes | ⚠️ Dual FK linkage |
| `payments` | Payments against fees | ✅ Yes | ✅ Clean |
| `users` | System users (admin/accountant/teacher) | ✅ Yes | ✅ Good |
| `section_user` | Teacher ↔ section assignment | ✅ Yes | ✅ Clean |
| `fee_rate_periods` | Time-bound fee rates (class or section level) | ✅ Yes | ✅ Good |
| `academic_sessions` | Academic year definitions | ✅ Partially | ℹ️ Underutilized |
| `batches` | Admission cohorts | ✅ Partially | ℹ️ Underutilized |
| `backup_entries` | Backup records | ✅ Yes | ✅ Clean |
| `report_presets` | Saved report configurations | ℹ️ Stub | ⚠️ May not be used yet |

---

## 2. Schema & Relationship Analysis

### `students`

```sql
id, name, father_name, father_phone, mother_phone, status, batch_id,
enrollment_date, created_at, updated_at
```

**OK/Good:**
- Clean identity model
- `batch_id` links to admission cohort
- `enrollment_date` captures first-join date
- Status constants defined in model

**Issues:**
- ⚠️ No `mother_name` column (only father_name)
- ⚠️ `father_phone` / `mother_phone` are unvalidated strings — no format normalization
- ⚠️ `status` is a string with no DB constraint (`enum` or `check`)
- ⚠️ No `email` or `address` columns (future requirements?)

### `student_sections` — The Central Pivot

```sql
id, student_id, class_id, section_id, student_type, monthly_fee,
assumed_pending_months, status, transferred_at, started_at, outcome,
academic_session_id, created_at, updated_at
```

**OK/Good:**
- Tracks enrollment lifecycle (status, transferred_at, started_at, outcome)
- `academic_session_id` links to sessions
- `student_type` (paid/free) is cleanly separated from status
- Has `scopeCurrent()` / `scopeHistorical()` for convenient filtering

**Issues:**
- ⚠️ **Multiple concerns** — this table is: (a) an enrollment record, (b) a fee rate override via `monthly_fee`, (c) a pending-months tracker via `assumed_pending_months`
- ⚠️ `monthly_fee` on this table is a per-student fee override — but `Section.monthly_fee` is a section-level default. Having both is confusing.
- ⚠️ `assumed_pending_months` is a legacy workaround for catching up unpaid fees — should be replaced by actual fee resolution.
- ⚠️ `outcome` is a free-text string (values: "promoted", "passed_out", "left", null) — should be an enum or reference a status constant.

### `classes`

```sql
id, name, type, default_monthly_fee, created_at, updated_at
```

**Issues:**
- ⚠️ Unique constraint on `name` was added in a later migration (2026_06_07_052345) — defensive dedup in code (routes/admin.php:608-609) exists because duplicates existed before the constraint
- ⚠️ `type` is a free string ('gurmukhi', 'kirtan', or anything) — no DB constraint
- ⚠️ `default_monthly_fee` is an integer but there's no way to distinguish "fee is 0 and correct" from "fee hasn't been set"

### `sections`

```sql
id, class_id, name, monthly_fee, created_at, updated_at
```

**Issues:**
- ⚠️ `monthly_fee` here and `monthly_fee` on `student_sections` — the resolution chain uses section-level first, then class-level. The `student_sections.monthly_fee` field appears unused by `MonthlyFeeResolver` (not in the resolution chain).
- ⚠️ No unique constraint on (class_id, name) — two sections with the same name in the same class is possible
- ⚠️ The `teachers()` / `users()` relationship on Section is duplicated (both return the same relationship via `belongsToMany(User::class)`)

### `attendance`

```sql
id, student_id, student_section_id, date, status, lesson_learned,
lesson_note, created_at, updated_at
```

**Issues:**
- ⚠️ **Dual FK linkage** — has both `student_id` and `student_section_id`. The `student_id` is filled automatically via the boot() closure. This duplication exists because queries need to find attendance across enrollment changes (by student_id) and per-enrollment (by student_section_id).
- ⚠️ **No unique constraint on (student_section_id, date)** — a student could theoretically be marked twice for the same date on the same enrollment. The recent deduplication migration suggests this was a real problem.
- ⚠️ `status` is a string ('present', 'absent', 'leave', 'p', 'a', 'l') — values from the `normalizeStatus` closure show that historical data has single-letter codes. No DB constraint.
- ⚠️ `lesson_learned` is a boolean stored as integer 0/1
- ⚠️ `date` has no default or not-null constraint enforcement at DB level (Laravel handles it, but raw inserts could bypass)

### `fees`

```sql
id, student_id, student_section_id, type, source, batch_id, title,
amount, is_locked, month, created_at, updated_at
```

**Issues:**
- ⚠️ **Dual FK linkage** — same pattern as attendance. `student_id` is filled automatically via boot(). This is needed because fees can be queried by student (across enrollments) or by enrollment.
- ⚠️ **Denormalized `student_id`** — `student_id` is always derivable from `student_section_id → student_id`. This is intentionally denormalized for query performance (avoids JOINs on fee listing pages).
- ⚠️ `month` is a string in "YYYY-MM" format — not a date column. Makes date arithmetic awkward.
- ⚠️ `is_locked` is used only for custom fees after payment — not for monthly fees
- ⚠️ `source` and `type` overlap semantically. `type` = "monthly"|"custom", `source` = "monthly"|"custom" — they're always the same value. One is redundant.
- ⚠️ `batch_id` column exists but no migration shows usage of batch-linking fees

### `payments`

```sql
id, fee_id, amount_paid, paid_at, deleted_at, created_at, updated_at
```

**Issues:**
- ⚠️ Uses SoftDeletes — payments are never truly deleted. This is correct behavior, but there's no enforced rule preventing hard deletes at the DB level.
- ⚠️ No `payment_method` field (cash/cheque/online)
- ⚠️ No `received_by` field (which user collected the payment)
- ⚠️ No `receipt_number` field
- ⚠️ `paid_at` is a datetime, but fees are monthly — a partial month payment can't be tracked (no partial payment support)

### `fee_rate_periods`

```sql
id, scope_type, scope_id, amount, effective_from, effective_to,
created_at, updated_at
```

**Issues:**
- ⚠️ Polymorphic design (`scope_type` = 'class'|'section', `scope_id` = the ID) — works but lacks foreign key enforcement
- ⚠️ No check constraint ensuring `effective_from <= effective_to`
- ⚠️ Overlapping periods are possible — `MonthlyFeeResolver` picks the latest `effective_from`, which may or may not be what the user intended

### `section_user`

```sql
section_id, user_id
```

- ✅ Clean pivot table for teacher-to-section assignment
- ⚠️ No unique constraint on (section_id, user_id) — though Larbel's `sync()` prevents duplicates at the application level

### `academic_sessions`

```sql
id, name, start_date, end_date, is_current, created_at, updated_at
```

- ✅ Clean model
- ⚠️ No unique constraint on `is_current = true` (could have multiple current sessions)
- ⚠️ `currentOrCreate()` auto-creates if none exists — could accidentally create duplicates if two requests race

### `batches`

```sql
id, name, admission_year, created_at, updated_at
```

- ✅ Clean cohort model
- ⚠️ Lightly integrated — only `Student.batch_id` references it

---

## 3. Relationship Mapping

```
students 1──N student_sections N──1 classes
                         N──1 sections
                         N──N users (via section_user)
                         
student_sections 1──N attendance
student_sections 1──N fees

fees 1──N payments

students 1──N fees       ← denormalized (redundant with student_sections→fees)
students 1──N attendance  ← denormalized

classes 1──N fee_rate_periods (scope_type='class')
sections 1──N fee_rate_periods (scope_type='section')

students N──1 batches
student_sections N──1 academic_sessions
```

---

## 4. Redundancy & Inconsistency Risks

| Risk | Description | Severity |
|---|---|---|
| **Attendance duplicate** | No unique constraint on (student_section_id, date) | High — recent migration attempted dedup |
| **Fee duplicate** | Canonical unique index `(student_id, type, month)` — `idx_fees_unique_student_monthly` (migration 2026_07_27_000002) is present in MySQL. Keyed by student, NOT enrollment (F3). | Resolved — data verified clean (0 duplicates) |
| **Class name duplicate** | Only recently added unique constraint | Medium — code has defensive dedup |
| **Student status inconsistency** | `students.status` and `student_sections.status` can diverge | Medium — lifecycle controller keeps them in sync, but inline closures may not |
| **FK not enforced (SQLite)** | SQLite requires `PRAGMA foreign_keys = ON` per connection | Medium — Laravel enables it but raw DB tool access bypasses |
| **Scope_type mismatch** | `fee_rate_periods` has no FK — `scope_id=999` with `scope_type='class'` is valid SQL | Low — application code constrains this |
| **Outcome as free text** | `student_sections.outcome` has no constraint | Low — values are controlled by lifecycle controller |

---

## 5. Key Lifecycle Flows

### Enrollment Lifecycle
```
Created (active) → Promoted   (status=promoted, transferred_at=now, outcome='promoted')
                 → Passed Out (status=passed_out, transferred_at=now, outcome='passed_out')
                 → Left       (status=left, transferred_at=now, outcome='left')
                 → Inactive   (status=inactive, transferred_at=NULL)
                 → Reactivate (status=active)
```

### Fee Lifecycle
```
Fee Created (unpaid) → Payment → Fee Locked (custom fees)
                     → De-collect → Fee Unpaid (payment soft-deleted)
```

### Attendance Lifecycle
```
Attendance Created (status=present|absent|leave)
→ Editable same day (assumed, not explicitly enforced)
→ Historical (read-only — no explicit constraint but no edit UI either)
```

---

## 6. Missing Indexes

| Table | Column(s) | Why Needed |
|---|---|---|
| `attendance` | `(student_section_id, date)` | Unique index + query performance |
| `attendance` | `(student_id, date)` | Query performance for student-wide queries |
| `fees` | `(student_section_id, type, month)` | Performance for fee listing queries |
| `student_sections` | `(student_id, status)` | Active enrollment queries |
| `payments` | `(fee_id, deleted_at)` | Composite for "is fee paid?" checks |

---

*Generated: 2026-07-30*
