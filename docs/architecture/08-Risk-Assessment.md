# Phase 7 — Bugs & Risk Assessment

## Risk Rating

| Rating | Color | Meaning |
|---|---|---|
| 🔴 Critical | Will cause data loss/corruption or security breach | Fix immediately |
| 🟠 High | Likely to cause incorrect results or system instability | Fix this sprint |
| 🟡 Medium | May cause issues under specific conditions | Fix this quarter |
| 🔵 Low | Edge cases, usability, or minor inconsistencies | When convenient |

---

## 🔴 Critical Risks

### R1. Attendance duplication race condition
- **Risk**: Two simultaneous requests to mark attendance for the same student+date can create duplicate records.
- **Scenario**: Teacher clicks "Save" twice quickly. Both requests pass the "has attendance today?" check before either inserts, resulting in two attendance rows for the same student+date.
- **Current Mitigation**: None at DB level (no unique constraint). The controller checks `$hasAttendanceToday` but this is read-then-write without a lock.
- **Severity**: 🔴 Critical — duplicates skew attendance rates.
- **Fix**: Add a unique constraint on `(student_section_id, date)` and handle `insert` failures gracefully.

### R2. Restore failure leaves database in undefined state
- **Risk**: The backup restore drops all tables, then re-imports. If the restore fails mid-way (connection lost, memory limit, SQL syntax error), the database is left with partial tables and FK checks disabled.
- **Scenario**: Restore of a large backup times out. Database has tables 1-5 restored but tables 6-12 are missing. `SET FOREIGN_KEY_CHECKS = 1` never runs.
- **Current Mitigation**: The try/catch sets status back to 'created' but cannot re-create the dropped tables.
- **Severity**: 🔴 Critical — complete data loss without manual recovery.
- **Fix**: Wrap restore in a transaction, or create a pre-restore snapshot by renaming tables (not dropping). Add a pre-checksum verification step.

### R3. Student status divergence between students and student_sections
- **Risk**: `students.status` and `student_sections.status` must stay synchronized. The `StudentLifecycleController` keeps them in sync, but the bulk-update closure in `routes/admin.php` does NOT update `students.status` when it archives enrollments.
- **Scenario**: Admin bulk-updates a student to remove all sections. The enrollment is set to inactive, but `students.status` remains 'active'. The student appears as active everywhere but has no active enrollments — undefined behavior.
- **Current Mitigation**: None — the bulk-update closure only updates `student_sections`, not `students`.
- **Severity**: 🔴 Critical — orphaned student records with no valid enrollments.
- **Fix**: In the bulk-update closure, after archiving orphaned enrollments, set `students.status` to 'inactive' if no active enrollments remain.

---

## 🟠 High Risks

### R4. Fee deduplication relies on (student_id, type, month) — but `student_id` was recently added
- **Risk**: Before the migration that added `student_id` to fees, monthly fees were keyed only by `student_section_id`. The new unique index uses `(student_id, type, month)`. If the migration's backfill was incomplete, two fees for the same student+month could exist on different student_section_ids.
- **Scenario**: A student has enrollment A (Jan–Mar) and enrollment B (Apr–present). The migration backfilled `student_id` correctly for most rows but missed a few. Those rows now have `student_id = NULL` but the unique index allows NULLs (MySQL treats NULLs as not-equal, so each is unique).
- **Current Mitigation**: The migration script attempts to backfill, and the `Fee::booted()` handler sets `student_id` on create.
- **Severity**: 🟠 High — duplicate fees for the same month.
- **Fix**: Verify the backfill migration was complete. Add a NOT NULL constraint on `fees.student_id`.

### R5. Bulk-update creates fees before checking if student has no enrollment
- **Risk**: The bulk-update flow in `routes/admin.php` (lines 407-537) creates/updates the student, archives orphaned enrollments, upserts incoming enrollments, then generates fees. If a student is archived (all enrollments removed), the code still generates fees in step 5 if `$enrollmentStatus` is 'active' — but it uses a `firstOrCreate` that may create a fee for an enrollment that was just archived.
- **Scenario**: A student's enrollment is moved from Section A (active) to Section B (through the same update). The Section A enrollment is archived, Section B is created, and a fee for the month is created — twice, if the enrollment ID changed but the month didn't.
- **Current Mitigation**: The `Fee::firstOrCreate` deduplication key `(student_id, type, month)` prevents exact duplicates.
- **Severity**: 🟠 High — correct by accident, not by design.

### R6. `scopeCurrent()` doesn't check `status` — callers must remember to add it
- **Risk**: `StudentSection::scopeCurrent()` only checks `transferred_at IS NULL`. But a student could have an enrollment with `transferred_at = NULL` and `status = 'inactive'`. Any query using `scopeCurrent()` alone would incorrectly include this inactive enrollment.
- **Scenario**: A report runs using `StudentSection::current()->get()` and includes a student whose enrollment is inactive but was never transferred (just made inactive by `makeInactive()`). The report overstates active enrollment counts.
- **Current Mitigation**: Each caller manually adds `->where('status', 'active')`. This is fragile — one missed check causes wrong data.
- **Severity**: 🟠 High — systemic risk across the entire codebase.
- **Fix**: Add `->where('status', StudentSection::STATUS_ACTIVE)` to `scopeCurrent()`.

### R7. Division type detection uses substring matching — false positives
- **Risk**: The `$isClassType` closure checks `str_contains($normalized, $needle)`. A class named "Gurmukhi Kirtan Advanced" would match BOTH 'gurmukhi' and 'kirtan'. The `FeesController::normalizeDivisionType()` has the same issue.
- **Scenario**: A class named "Kirtan Preparatory Gurmukhi" triggers both Kirtan and Gurmukhi checks. The result depends on check order, not semantics.
- **Current Mitigation**: The `FeesController` checks 'kirtan' first, so it wins. But `$isClassType` in attendance is called with explicit context — caller must pick the right needle.
- **Severity**: 🟠 High — classes with ambiguous names are classified incorrectly.
- **Fix**: Use exact matching (`===`) with controlled vocabulary, or add a dedicated `division_type` column to `classes`.

---

## 🟡 Medium Risks

### R8. Academic session resolution race condition
- **Risk**: `AcademicSession::currentOrCreate()` checks for a current session, and if none exists, creates one. Two concurrent requests could both create sessions.
- **Scenario**: A new school year starts. The first request of the day triggers `currentOrCreate()`. Two simultaneous requests both find `is_current = null`, and both create new sessions.
- **Current Mitigation**: Low probability — `currentOrCreate()` is called infrequently.
- **Severity**: 🟡 Medium — duplicate sessions, which cascades to student_sections referencing wrong sessions.
- **Fix**: Use a database unique constraint on `is_current = true` (partial index in MySQL, or application-level lock).

### R9. Payment soft-delete doesn't cascade to fee lock
- **Risk**: When a payment is soft-deleted (de-collect), the fee's `is_locked` flag for custom fees is NOT reset to false. The custom fee remains locked even after de-collection.
- **Scenario**: Admin collects a custom fee, then de-collects it. The fee is no longer paid but remains `is_locked = true`. Attempting to edit or re-collect may fail.
- **Current Mitigation**: The de-collect flow only soft-deletes the payment.
- **Severity**: 🟡 Medium — custom fee becomes uneditable even though unpaid.
- **Fix**: In `FeesController::deCollect()`, reset `is_locked = false` for custom fees.

### R10. Backup and restore bypasses Laravel model events
- **Risk**: The backup service uses raw SQL `DB::unprepared($sql)` to restore data. This bypasses all Eloquent model events (creating, created, updating, updated, saving, saved). The `Fee::booted()` closure that auto-fills `student_id` does NOT run during restore.
- **Scenario**: After a restore, `fees.student_id` is NULL for all restored records because the model event never fired.
- **Current Mitigation**: The backup SQL includes the `student_id` column value as it was at backup time (because it was populated by the model event at creation).
- **Severity**: 🟡 Medium — only problematic if the backup was taken before the `student_id` migration ran, then restored after.
- **Fix**: Add a post-restore validation step that checks for NULL `student_id` values and backfills them.

### R11. Missing authorization checks on fee operations
- **Risk**: The fee routes are under the `admin` group, so only admins can access them. However, no explicit Gate or Policy checks are used. If the route grouping ever changes, fee operations could be exposed.
- **Scenario**: A refactor moves fee routes from `admin.php` to `web.php` and forgets to add the admin middleware. Accountants or teachers could collect, de-collect, or delete fees.
- **Current Mitigation**: Route middleware (`role:admin`).
- **Severity**: 🟡 Medium — defense-in-depth issue.

### R12. `outcome` field is free-text with no constraint
- **Risk**: `student_sections.outcome` stores values like "promoted", "passed_out", "left", etc. Any string can be stored. If a typo occurs ("promotted"), that enrollment won't appear in "promoted" reports.
- **Scenario**: A future controller uses `$enrollment->update(['outcome' => 'promotted'])` (typo). The enrollment is not counted as promoted in downstream reports.
- **Current Mitigation**: The `StudentLifecycleController` controls all outcome-setting paths and uses consistent strings.
- **Severity**: 🟡 Medium — low probability but zero defense at the DB level.
- **Fix**: Add a `CHECK` constraint or use a Laravel enum.

---

## 🔵 Low Risks

### R13. `students.status` has no DB-level constraint
- **Risk**: Valid values are derived from `Student::STATUS_*` constants, but nothing prevents storing "activee" (typo) or "deleted" in the DB.
- **Fix**: Add a `CHECK` constraint or an enum cast.

### R14. No audit trail for fee collection changes
- **Risk**: Collect and de-collect operations leave no audit trail (who collected, who de-collected).
- **Scenario**: A dispute arises over whether a fee was paid. The payment record exists (or doesn't) but there's no record of the action, user, or timestamp beyond what's in the payment table.
- **Fix**: Use Laravel's `Auditable` trait or add `created_by` / `updated_by` to payments.

### R15. No validation that collection_date is within reasonable bounds
- **Risk**: `FeesController::collect()` accepts any valid date for `collection_date`. An admin could set a date in the future or 10 years in the past.
- **Fix**: Add date range validation (e.g., not before student enrollment, not after today).

### R16. Attendance code assumes yesterday as default absentees range
- **Risk**: The absentees endpoint defaults to the last 30 days ending yesterday. If today is Monday and no attendance was taken on Sunday (Kirtan class), yesterday (Sunday) might not have had a valid school day anyway.
- **Scenario**: A Kirtan class views absentees on Monday. Yesterday (Sunday) was a Kirtan day, so the query includes Sunday data. But Sunday may not have been a school day (holiday, exam break). The absentee data is stale.
- **Severity**: 🔵 Low — default range is configurable via query params.
- **Fix**: Use the last N valid school days (by class type) instead of calendar days.

### R17. Report cache grows unbounded
- **Risk**: `StudentReportCache` caches report results by request key. There is no eviction policy, TTL, or size limit.
- **Scenario**: Over a semester, thousands of unique report requests (different students, months, formats) accumulate in the cache store. Depending on the cache driver (file/array), this could exhaust storage.
- **Current Mitigation**: Cache is forgotten on student mutations (lifecycle changes, fee updates). But read-only queries keep accumulating.
- **Severity**: 🔵 Low — file/database cache stores scale fine for a school ERP.
- **Fix**: Add an LRU eviction or TTL-based cache strategy.

---

## Risk Summary

| Severity | Count | Key Risks |
|---|---|---|
| 🔴 Critical | 3 | Attendance dup race, failed restore, student status divergence |
| 🟠 High | 4 | Fee dedup key, bulk-update fee race, scopeCurrent blind spot, division false positives |
| 🟡 Medium | 5 | Session race, de-collect lock, restore no events, auth defense, outcome free-text |
| 🔵 Low | 5 | Status constraint, audit trail, date validation, absentee defaults, cache growth |

**Total: 17 risks identified**

---

## Risk Interdependencies

```
R1 (attendance duplicate) ──────┐
                                ├──→ Both cause data corruption
R3 (student status divergence) ─┘
                                │
                                ├──→ Both are worsened by C1/C2 (no constraints / inline logic)
                                │
R2 (restore failure) ───────────┘
        │
        └──→ R10 (no model events during restore) — same code path, different impact
```

Three critical risks are architectural — removing route closures and adding DB constraints would eliminate them by design.

---

*Generated: 2026-07-30*
