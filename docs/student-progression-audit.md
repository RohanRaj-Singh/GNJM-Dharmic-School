# Student Progression — Audit & Fix Plan

Date: 2026-07-27
Author: Claude (DeepSeek)

## Executive Summary

The Student Progression feature (`/admin/utilities/student-progression`) has several architectural and UX issues, particularly around the Gurmukhi vs Kirtan class-type distinction. The backend correctly handles class-type-aware promotion, but the frontend uses fragile string heuristics, shows unfiltered target class options, and provides per-student actions instead of per-enrollment actions. This document catalogs all issues and provides a fix plan.

---

## Issues Found

### Issue 1 (Frontend): Class-Type Detection Uses String Heuristic

**File:** `PromoteFlow.jsx` (lines 15-29)

```js
const gurmukhi = leadStudent.enrollments.find(
  (e) => !e.className?.toLowerCase().includes("kirtan")
);
```

**Problem:**
- Uses `className.includes("kirtan")` instead of the actual `schoolClass.type` field
- A Kirtan class named "Tabla Basic" (no "kirtan" in name) would be treated as Gurmukhi
- A Gurmukhi class with "kirtan" in its name would be treated as Kirtan
- The "Will be promoted" / "Will remain" labels use the same heuristic, so the UI can say wrong things even when the backend does the right thing

**Fix:**
- Pass `schoolClass.type` (or derive from class_id) in the enrollment data from the backend
- Use `e.classType` instead of `e.className.includes("kirtan")`

---

### Issue 2 (Frontend): Target Class Dropdown Shows All Classes

**File:** `PromoteFlow.jsx` (lines 196-205)

The target class `<select>` lists **all** classes, not filtered by the same type as the enrollment being promoted.

**Problem:**
- User could select a Kirtan class when promoting Gurmukhi (or vice versa)
- The backend would then close enrollments of the *selected* type, not the intended one
- The "Will be promoted" labels would be misleading

**Fix:**
- Filter the target class options to only the same `schoolClass.type` as the enrollment(s) being promoted

---

### Issue 3 (Frontend): Actions Are Per-Student, Not Per-Enrollment

**File:** `StudentProgression.jsx` (lines 245-261)

Each student row has one "Promote" button and one "Pass Out" button.

**Problem:**
- A student with both Gurmukhi and Kirtan enrollments cannot choose which to promote
- The `suggestedClassId` defaults to Gurmukhi only (non-Kirtan), so Kirtan-only students show an empty suggested class
- In bulk mode, the first selected student's data drives the modal — if students have mixed enrollment types, the suggested target may be wrong for some

**Fix:**
- Show enrollment-type badges in the table
- Provide per-enrollment action buttons (e.g., "Promote Gurmukhi", "Promote Kirtan") when a student has multiple types
- In the modal, let the user select which enrollment type to promote

---

### Issue 4 (Frontend): Bulk Promote Uses First Student's Data

**File:** `PromoteFlow.jsx` (line 8-11, leadStudent pattern)

```js
const leadStudent = selectedStudents[0];
```

**Problem:**
- If the selected students have mixed enrollments, the lead student's data may not represent the group
- `suggestedClassId` comes from the lead student only
- `currentEnrollments` in ImpactSummary only shows the lead student's enrollments

**Fix:**
- For bulk, show a summary of enrollment types across all selected students
- Allow selecting which type to bulk promote
- Or require bulk selections to be homogenous (same enrollment type)

---

### Issue 5 (Frontend): No Class Type in API Response

**File:** `routes/admin.php` (lines 215-236)

The progression data endpoint maps enrollments as:
```php
'className' => $e->schoolClass->name,
'sectionName' => $e->section->name,
```

But does NOT include:
- `classType` (the `schoolClass.type` field)
- `student_type` per enrollment
- Outstanding fees per enrollment

**Fix:**
- Add `classType` to each enrollment in the API response
- Add per-enrollment `studentType` and `outstandings`

---

### Issue 6 (Backend): `Promoted` Status Unused on Student Model

**File:** `Student.php`

`Student::STATUS_PROMOTED` is defined but never set on the student model. Only `StudentSection.status` gets `promoted`. The student's `status` stays `active` after promotion.

**Problem:**
- Misleading constant definition
- No way to query "students who were ever promoted" at the student level

**Fix:**
- Either remove `STATUS_PROMOTED` from `Student` model, or actually set it during promotion (though this would change the data model — promotion is meant to keep the student active)

---

### Issue 7 (Backend): No `academic_session_id` Set on Promoted Enrollment

**File:** `StudentLifecycleController.php` (lines 66-73)

The new enrollment is created without setting `academic_session_id`:
```php
StudentSection::create([
    'student_id'   => $student->id,
    'class_id'     => $targetSection->class_id,
    'section_id'   => $targetSection->id,
    'status'       => StudentSection::STATUS_ACTIVE,
    'started_at'   => $effectiveDate,
    'student_type' => $enrollmentsToPromote->first()?->student_type ?? 'paid',
]);
```

**Fix:**
- Determine the academic session from the effective date and set it on the new enrollment

---

### Issue 8 (Frontend): 3 of 5 Lifecycle Actions Missing UI

**Routes:** `routes/web.php` (lines 62-72)

Only **promote** and **passOut** have frontend modals. The following exist only as backend routes:
- `leave-school` (requires two-step: inactive → leave)
- `make-inactive`
- `reactivate`

**Fix:**
- Add UI for inactivating/reactivating students
- Add "Leave School" flow (only available after making inactive)
- Or integrate these into the existing Master Directory / Student Status pages

---

### Issue 9 (Code Quality): Dead Prototype File

**File:** `resources/js/Pages/Admin/Utilities/StudentPromotion.jsx`

This is an old prototype with mock data. No route points to it. It should be deleted.

---

### Issue 10 (Frontend): Partial Failure in Bulk Operations

**File:** `PromoteFlow.jsx` (line 87-88), `PassOutFlow.jsx` (line 28-30)

```js
await Promise.all(promises);
```

**Problem:**
- If one student's promotion fails, the others still succeeded
- No rollback mechanism
- Error message doesn't show which student(s) failed

**Fix:**
- Show per-student results (success/failure)
- Offer to "retry failed" rather than rolling back successful ones

---

## Fix Plan

### Phase 1 (Immediate Fixes)

| # | File | Change | Effort |
|---|------|--------|--------|
| 1 | `routes/admin.php` (data endpoint) | Add `classType`, `studentType` to enrollment mapping | Small |
| 2 | `PromoteFlow.jsx` | Filter target class dropdown by `classType` | Small |
| 3 | `PromoteFlow.jsx` | Use `e.classType` instead of `className.includes("kirtan")` | Small |
| 4 | `StudentProgression.jsx` | Show class-type badges in table, per-type actions | Medium |

### Phase 2 (UX Improvements)

| # | File | Change | Effort |
|---|------|--------|--------|
| 5 | `PromoteFlow.jsx` | Enrollment selection step: let user pick which type to promote | Medium |
| 6 | `ImpactSummary.jsx` | Show type-specific impact (which enrollments affected) | Small |
| 7 | `PromoteFlow.jsx` | Per-student success/failure display in bulk mode | Medium |

### Phase 3 (Optional / Cleanup)

| # | File | Change | Effort |
|---|------|--------|--------|
| 8 | `StudentLifecycleController.php` | Set `academic_session_id` on promoted enrollment | Small |
| 9 | `Student.php` | Remove unused `STATUS_PROMOTED` constant | Trivial |
| 10 | `StudentPromotion.jsx` | Delete dead prototype file | Trivial |
| 11 | Various | Add UI for `make-inactive`, `reactivate`, `leave-school` | Large |

---

## Verification

1. **Promote Gurmukhi-only:** Close Gurmukhi enrollment, create new one in Gurmukhi class. Kirtan untouched.
2. **Promote Kirtan-only:** Close Kirtan enrollment, create new one in Kirtan class. Gurmukhi untouched.
3. **Student with both:** Can independently promote either type. Only matching type's enrollment closes.
4. **Target class list:** Never shows mixed class types. Only shows the same type as the promoted enrollment.
5. **Bulk promote:** Students with the selected type get promoted. Non-matching type students show a warning.
6. **Existing tests pass:** `php artisan test --filter=StudentPromotion`
