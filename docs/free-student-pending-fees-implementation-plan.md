# Implementation Plan: Clear Pending Fees When Enrollment Is Marked Free

## Objective
Add a fee-generation-side rule so that when an enrollment is `student_type = free`, all unpaid monthly fees are cleared, while already paid fee records remain unchanged.

## Current State (Observed)
- Monthly fee generation command (`app/Console/Commands/GenerateMonthlyFees.php`) already skips `student_type = free` enrollments, but it does not clear historical unpaid monthly fees.
- Admin bulk student update route (`routes/admin.php`) has partial cleanup only when changing from paid to free, and only for future months (`month > currentMonth`).
- Pending fees utility (`app/Http/Controllers/Admin/PendingFeesController.php`) already avoids creating monthly fees for free enrollments (resolver returns `0`), but does not proactively enforce cleanup globally.

## Proposed Rule
For any enrollment marked `free`:
- Delete monthly fee rows that have no non-deleted payment records.
- Keep monthly fee rows that have at least one non-deleted payment record.
- Do not alter payment records.

## Implementation Approach
1. Create a reusable cleanup helper in the monthly generation command context:
   - Add a private method in `GenerateMonthlyFees`:
     - `clearUnpaidMonthlyFeesForFreeEnrollment(StudentSection $enrollment): int`
     - Query: `Fee::where('student_section_id', $enrollment->id)->where('type', 'monthly')->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))->delete();`
2. Apply the rule inside generation loop before normal generation checks:
   - If enrollment is free:
     - call cleanup helper
     - skip generation (`continue`)
3. Keep existing paid flow unchanged:
   - Kirtan skip behavior remains the same.
   - Existing month-duplication guard remains the same.
4. Optional consistency tightening (recommended in same PR):
   - In `routes/admin.php` paid->free section, replace the current future-only deletion with the same unpaid-monthly cleanup so admin actions and scheduled generation enforce identical behavior.

## Files To Change
- `app/Console/Commands/GenerateMonthlyFees.php`
- Optional consistency update:
  - `routes/admin.php`

## Data Safety
- Paid records are preserved because only fees without active payments are deleted.
- Deletion scope is limited to `type = monthly` and the specific `student_section_id`.

## Test Plan
1. Free enrollment with unpaid monthly fees:
   - Run `php artisan fees:generate-monthly`
   - Expect unpaid monthly fees removed.
2. Free enrollment with paid monthly fee history:
   - Run command
   - Expect paid monthly fee records retained.
3. Paid enrollment:
   - Run command
   - Expect normal generation behavior unchanged.
4. Regression check:
   - Late fees screen should not show free enrollments with previously unpaid monthly rows.

## Rollback Plan
- Revert the command/helper change.
- No schema changes are required.

## Open Question
- Should this cleanup run only in generation command, or also be centralized in a shared service used by admin enrollment updates and any future free/paid transitions? Recommended: shared service for consistency.
