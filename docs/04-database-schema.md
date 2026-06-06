# 04 — Database Schema

Default driver is **SQLite** (`database/database.sqlite`). Migrations live in `database/migrations/`. 18 domain migrations + 3 Laravel scaffold (cache, jobs, sessions).

## 4.1 Table inventory (domain tables only)

| Table | Created by migration | Notes |
|---|---|---|
| `users` | `0001_01_01_000000_create_users_table.php` | Breeze-style; `role` & `username` & `is_active` added later |
| `classes` | `2025_12_24_135759_create_classes_table.php` | Also called `SchoolClass` model |
| `sections` | `2025_12_24_135904_create_sections_table.php` | FK -> classes, cascadeOnDelete |
| `students` | `2025_12_24_135926_create_students_table.php` | `name`, `father_name`, `status` |
| `student_sections` | `2025_12_24_140001_create_student_sections_table.php` | Junction with `student_type` (paid/free) and `monthly_fee` override |
| `attendance` | `2025_12_24_204347_create_attendance_table.php` | `(student_section_id, date)` unique |
| `fees` | `2025_12_24_215610_create_fees_table.php` | `type` (monthly/custom), `title`, `amount`, `month` |
| `payments` | `2025_12_24_215610_create_payments_table.php` | `fee_id`, `amount_paid`, `paid_at`, softDeletes added later |
| `parent_phones` | `2026_01_15_221007_add_parent_phones_to_students_table.php` | adds `father_phone`, `mother_phone` to `students` |
| `attendance_status` | `2026_01_16_193536_replace_present_with_status_in_attendance.php` | replaces boolean `present` with enum `status` |
| `fees_payments_v2` | `2026_01_21_113815_update_fees_and_payments_structure.php` | adds `source`, `batch_id`, `is_locked` to `fees`; softDeletes to `payments`; `assumed_pending_months` to `student_sections` |
| `sections_monthly_fee` | `2026_01_21_161928_add_monthly_fee_to_sections.php` | legacy column kept in sync with active rate period |
| `users_role` | `2026_01_24_134817_add_role_to_users_table.php` | adds `role` |
| `users_username_isactive` | `2026_01_24_135430_add_role_and_username_to_users_table.php` | adds `username`, `is_active`; makes email nullable |
| `users_fix` | `2026_01_24_141955_fix_user_role_columns.php` | idempotent guard for older DBs |
| `section_user` | `2026_01_24_143129_create_section_user_table.php` | teacher-section pivot |
| `fee_rate_periods` | `2026_02_19_000001_create_fee_rate_periods_table.php` | time-bounded amount overrides per class or section |
| `fees_lookup_idx` | `2026_02_19_000002_add_monthly_fee_lookup_index.php` | `fees_monthly_lookup_idx` on `(student_section_id, type, month)` |
| `fee_periods_baseline_2000` | `2026_02_19_000003_shift_fee_period_baseline_to_2000.php` | shifts earliest `effective_from` to `2000-01-01` for backfill |

## 4.2 Per-table detail

### `users`
- Columns: `id`, `name`, `username` (unique), `email` (nullable, originally unique), `email_verified_at`, `password`, `role` (default `teacher`), `is_active` (bool, default true), `remember_token`, timestamps.
- Relationships: `belongsToMany Section` (via `section_user`).
- Casts: `password` => `hashed`, `is_active` => `boolean`.

### `classes` (table: `classes`; model: `SchoolClass`)
- Columns: `id`, `name`, `type` (`gurmukhi` / `kirtan`), `default_monthly_fee` (kept in sync with the active class-level rate period), timestamps.
- Relationships: `hasMany Section`, `hasMany StudentSection` (direct FK), `hasMany FeeRatePeriod` (where `scope_type=class`).

### `sections`
- Columns: `id`, `class_id` (FK, cascade), `name`, `monthly_fee` (legacy, kept in sync with active section-level rate period), timestamps.
- Relationships: `belongsTo SchoolClass`, `hasMany StudentSection`, `hasMany FeeRatePeriod` (scope_type=section), `hasManyThrough Attendance via StudentSection`, `belongsToMany User` (teachers).

### `students`
- Columns: `id`, `name`, `father_name` (nullable), `father_phone` (nullable), `mother_phone` (nullable), `status` (`active` / `inactive`, default `active`), timestamps.
- Relationships: `hasMany StudentSection` (enrollments).
- Note: `father_phone` and `mother_phone` exist but no notification system uses them.

### `student_sections` (enrollments)
- Columns: `id`, `student_id` (FK, cascade), `class_id` (FK, cascade), `section_id` (FK, cascade), `student_type` (`paid` / `free`), `monthly_fee` (per-enrollment override, default 0), `assumed_pending_months` (onboarding helper, 0–255), timestamps.
- **Unique** on `(student_id, class_id)`.
- Relationships: belongs to `student`, `class`, `section`; hasMany `fees`, hasMany `attendance`.
- INSUFFICIENT INFORMATION: a student can theoretically have multiple `student_sections` rows in the same class if the unique is broken. No defensive code is in place.

### `attendance`
- Columns: `id`, `student_section_id` (FK, cascade), `date`, `status` enum(`present`,`absent`,`leave`, default `present`), `lesson_learned` (nullable boolean, used by Kirtan), timestamps.
- **Unique** on `(student_section_id, date)`.
- The model has duplicate `enrollment()` and `studentSection()` relations (both `belongsTo(StudentSection::class, 'student_section_id')`).

### `fees`
- Columns: `id`, `student_section_id` (FK, cascade), `type` (`monthly` / `custom`), `source` enum(`monthly`,`custom`), `batch_id` (uuid, nullable, for custom fee batches), `title` (nullable for monthly), `amount` (int), `is_locked` (bool, set when custom fee is paid), `month` (nullable `YYYY-MM`), timestamps.
- Index `fees_monthly_lookup_idx` on `(student_section_id, type, month)`.
- Relationships: `belongsTo StudentSection`, `hasMany Payment`.
- Note: `title` is technically `string` but allowed `null` after `update_fees_and_payments_structure`.

### `payments`
- Columns: `id`, `fee_id` (FK, cascade), `amount_paid`, `paid_at` (timestamp), timestamps, **`deleted_at`** (soft delete).
- Relationships: `belongsTo Fee`.
- All "is paid" checks across the codebase filter `whereNull('deleted_at')` — un-collecting soft-deletes, never hard-deletes.

### `fee_rate_periods`
- Columns: `id`, `scope_type` enum(`class`,`section`), `scope_id` (unsignedBigInteger), `amount` (unsigned int), `effective_from` (date), `effective_to` (date, nullable = open), timestamps.
- Indexes:
  - `(scope_type, scope_id)` for fast lookup
  - `fee_rate_periods_lookup_idx` on `(scope_type, scope_id, effective_from, effective_to)`
  - **Unique** `fee_rate_periods_start_unique` on `(scope_type, scope_id, effective_from)`
- Backfill on creation: copies `default_monthly_fee` (for classes) and `monthly_fee` (for sections) into baseline rows starting `2000-01-01`.

### `section_user`
- Columns: `id`, `user_id` (FK, cascade), `section_id` (FK, cascade), timestamps.
- **Unique** on `(user_id, section_id)`.

### `report_presets` (model only — no migration, no controller)
- Columns (from `ReportPreset` model `$fillable`): `name`, `report_type`, `filters` (json cast), `columns` (json cast), `user_id`.
- INSUFFICIENT INFORMATION on intended persistence.

## 4.3 ER (text)

```
users ──< section_user >── sections ──> classes
                                │
                                │ (teacher assignments live here)
                                │
classes ──< sections
classes ──< student_sections >── students
sections ──< student_sections
student_sections ──< fees ──< payments (soft delete)
student_sections ──< attendance
classes  ──< fee_rate_periods (scope_type=class)
sections ──< fee_rate_periods (scope_type=section)
```

## 4.4 Indexes worth knowing

- `fees.fees_monthly_lookup_idx (student_section_id, type, month)` — used by every fee/attendance/pending-fees query that filters by month.
- `fee_rate_periods.fee_rate_periods_lookup_idx (scope_type, scope_id, effective_from, effective_to)` — used by `MonthlyFeeResolver`.
- `fee_rate_periods.fee_rate_periods_start_unique (scope_type, scope_id, effective_from)` — prevents overlapping starts.
- `attendance (student_section_id, date)` UNIQUE — supports upsert in `Attendance::updateOrCreate`.
- `payments.deleted_at` (softDeletes index) — every "is paid" check filters on it.

## 4.5 Soft-delete & cascade rules

- Cascade on delete: `sections -> classes`, `student_sections -> students|classes|sections`, `fees -> student_sections`, `payments -> fees`, `section_user -> users|sections`.
- Soft delete: only `payments`. All "un-collect" actions are soft deletes. "Paid" checks filter `whereNull('deleted_at')`.
- Hard delete (conditional): `Fee` rows can be hard-deleted by:
  - `fees:generate-monthly` for `free` enrollments, but only unpaid monthly fees.
  - `FeesController::destroyCustomFeeForStudent` (unpaid only).
  - `FeesController::destroyCustomFeeForSection` (only if **no** student has paid).
  - `fees:cleanup-monthly` (duplicates, only those without payments).
  - Admin `PendingFeesController` when `assumed_pending_months` is set lower than existing, only unpaid monthly fees are removed.
- Hard delete refused: `Fee::destroy` returns 422 if any non-deleted payment exists (`destroyCustomFeeForStudent`).

## 4.6 Legacy columns kept in sync

`classes.default_monthly_fee` and `sections.monthly_fee` are **legacy** columns. Every `FeeRatePeriod` mutation calls `syncLegacyFeeColumn()` to write the active period's `amount` into the legacy column. New code should prefer `MonthlyFeeResolver` over reading these columns directly.
