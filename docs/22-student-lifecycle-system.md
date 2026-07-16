# Student Lifecycle System

> Promotion is not a data tweak. It is part of a student's journey through the school. This document defines the complete lifecycle model — states, transitions, business rules, and effects on fees and attendance.

---

## Philosophy

Every student has a lifecycle arc:

```
Admission → Enrollment → Promotion(s) → Pass Out
                                  ↘ Leave School (at any point)
                    ↘ Inactive (temporary, at any point) → Active (return)
```

Each step is a lifecycle event with:
- A clear before/after state
- Business rules that govern whether the transition is allowed
- Predictable effects on fees, attendance, and historical records

**Repeat is not a lifecycle event.** A student who is not promoted simply stays in their current class. They continue with the same enrollment — no action is taken.

---

## Two-Level State Model

Lifecycle is tracked at two levels that work together:

### Student-level (`students.status`)

Describes the student's overall relationship with the institution.

| State | Meaning | Can transition to |
|---|---|---|
| `active` | Has at least one current enrollment | inactive, passed_out, left |
| `inactive` | Temporarily not attending, may return | active, left |
| `passed_out` | Completed all studies | — (terminal) |
| `left` | Permanently left the institution | — (terminal) |

### Enrollment-level (`student_sections.status`)

Describes each individual enrollment's lifecycle.

| State | Meaning | Can transition to |
|---|---|---|
| `active` | Currently enrolled in this class/section | promoted, passed_out, left, inactive |
| `inactive` | Temporarily paused (student-level inactive) | active |
| `promoted` | Completed this level, moved to next class | — (terminal for this enrollment) |
| `passed_out` | Completed studies from this enrollment | — (terminal) |
| `left` | Left while in this enrollment | — (terminal) |

### Relationship

A student's overall state is derived from their enrollments:

| Enrollment states | Student state |
|---|---|
| At least one `active` | `active` |
| All `inactive`, none `active` | `inactive` |
| All terminal (`promoted`, `passed_out`, `left`) | Set explicitly by the lifecycle action |

---

## State Transition Diagram

```
                    ┌──────────────────────────────────┐
                    │           STUDENT LEVEL           │
                    └──────────────────────────────────┘

                         ┌──────────┐
                    ┌───→│  active  │←──┐
                    │    └────┬─────┘   │
                    │         │         │
                 inactive     │      reactivate
                    │         │         │
                    │    ┌────▼─────┐   │
                    └────│ inactive │───┘
                         └────┬─────┘
                              │ leave
                         ┌────▼─────┐
                         │   left   │ (terminal)
                         └──────────┘

                    ┌──────────┐
         pass_out → │passed_out│ (terminal)
                    └──────────┘

                   ┌──────────────────────────────────┐
                   │        ENROLLMENT LEVEL          │
                   └──────────────────────────────────┘

                         ┌──────────┐
                         │  active  │
                         └────┬─────┘
                    ┌──────────┼──────────┐
                    │          │          │
               promote    student-level   │
                    │     inactive/left   │
                    │          │     pass_out
              ┌─────▼────┐ ┌──▼───┐  ┌──▼────┐
              │ promoted │ │ left │  │passed_│
              └──────────┘ └──────┘  │out    │
                                     └───────┘
```

---

## Lifecycle Events

### 1. Promote

Closes current enrollment, creates a new one in the next class.

**Validation rules:**
- Student must have `student.status = 'active'`
- Current enrollment must have `student_sections.status = 'active'`
- Target class must be the next in progression (auto-detected)
- Target section must be specified
- Outstanding fees: warning, not a blocker

**Effects:**
```
Old enrollment:
  status         = 'promoted'
  transferred_at = now()
  outcome        = 'promoted'

New enrollment:
  status         = 'active'
  transferred_at = null
  started_at     = now()
  class_id       = target class
  section_id     = target section

Student:
  status         = 'active' (unchanged — still has an active enrollment)

Fees:
  Old enrollment: fees preserved, unpaid fees remain collectible
  New enrollment: starts with zero fees, next cron generates monthly fee

Attendance:
  Old enrollment: records preserved
  New enrollment: starts fresh
```

### Not Promoted

A student who is not selected for promotion stays in their current class. No action is taken, no data changes. The enrollment continues as `active` with the same class, section, fees, and attendance.

Repeat does not exist as a concept. There is no separate "repeat" action or status.

### 2. Pass Out

Student has completed all studies. All active enrollments are closed. No new enrollment is created.

**Validation rules:**
- Student must have `student.status = 'active'`
- All active enrollments get closed

**Effects:**
```
All active enrollments:
  status         = 'passed_out'
  transferred_at = now()
  outcome        = 'passed_out'

Student:
  status         = 'passed_out'

Fees:
  All enrollments: fees preserved, unpaid remain collectible
  No future fees generated (no active enrollments)

Attendance:
  All records preserved
  No future attendance marking
```

### 3. Leave School

Student leaves permanently. Can only be done if student is already `inactive`.

**Validation rules:**
- Student must have `student.status = 'inactive'`
- Cannot leave from `active` state — must first be made inactive
- This is a deliberate gate: prevents accidental permanent exits

**Effects:**
```
All enrollments:
  status         = 'left'
  transferred_at = now()
  outcome        = 'left'

Student:
  status         = 'left'

Fees:  preserved, unpaid remain collectible
Attendance: preserved
```

### 4. Make Inactive (temporary)

Student takes a temporary break. Can be reactivated later.

**Validation rules:**
- Student must have `student.status = 'active'`
- At least one enrollment must be active

**Effects:**
```
All active enrollments:
  status         = 'inactive'
  transferred_at = null  (NOT set — they may return)

Student:
  status         = 'inactive'

Fees:
  No future fees generated while inactive
  Existing unpaid fees remain collectible

Attendance:
  No future attendance marking
```

### 5. Reactivate

Student returns from temporary break.

**Validation rules:**
- Student must have `student.status = 'inactive'`

**Effects:**
```
All inactive enrollments:
  status         = 'active'

Student:
  status         = 'active'

Fees:  next cron will generate monthly fees
Attendance: can be marked again
```

---

## Invalid Transitions

| From | To | Reason |
|---|---|---|
| `passed_out` | anything | Terminal, cannot be undone |
| `left` | anything | Terminal, cannot be undone |
| `active` | `left` | Must go through inactive first (safety gate) |
| `inactive` | `passed_out` | Must be active to complete studies |
| `active` | `promoted` (with no target) | Must have a target class |

---

## History Retrieval

Every past enrollment is a complete, self-contained record. A student's full journey can be reconstructed at any time:

```php
$enrollments = StudentSection::where('student_id', $student->id)
    ->with(['schoolClass', 'section', 'fees.payments', 'attendance'])
    ->orderBy('started_at')
    ->get();
```

Each enrollment in the result contains:

| Field | What it tells you |
|---|---|
| `schoolClass.name` | What class they were in |
| `section.name` | What section |
| `started_at` | When this enrollment began |
| `transferred_at` | When this enrollment ended (null = current) |
| `outcome` | Why it ended: `promoted`, `passed_out`, `left` |
| `status` | `active`, `inactive`, `promoted`, `passed_out`, `left` |
| `fees` | All fee records for this period |
| `fees.payments` | All payments made during this period |
| `attendance` | All attendance records for this period |

This data can be used for:

- **Student Profile** — show complete enrollment timeline with outcomes
- **Student Report Center** — generate per-enrollment reports by passing `student_section_id`
- **Master Directory** — search/filter by any lifecycle status
- **Cohort analysis** — group students by pass-out year, promotion patterns
- **Audit trail** — who was in what class, when, and what happened next

No additional tables or logging are required for basic history retrieval. The `student_sections` table itself is the history.

---

## Query Guard

Every query that loads current enrollments uses:

```sql
WHERE status = 'active' AND transferred_at IS NULL
```

`transferred_at` is the ground truth for "is this enrollment current?" It is only set by lifecycle actions, never by manual edits. This makes the system robust against manual status changes.

All 17 locations that currently use `WHERE status = 'active'` must be updated to add `AND transferred_at IS NULL` (listed in `docs/22-promotion-fees-attendance-effects.md`).

---

## Fee Behavior Per Enrollment State

| Enrollment status | Monthly fee generation | Fees visible in default list | Fees collectible |
|---|---|---|---|
| `active` | Yes | Yes | Yes |
| `inactive` | No | Yes | Yes |
| `promoted` | No | No (via student profile) | Yes |
| `passed_out` | No | No (via student profile) | Yes |
| `left` | No | No (via student profile) | Yes |

Fee collection on non-active enrollments: the accountant receive-fee page loads all enrollments for a specific student regardless of status.

---

## Implementation Components

### Lifecycle Controller

```
StudentLifecycleController
├── promote(Request, Student)
├── passOut(Request, Student)
├── leaveSchool(Request, Student)      (in Student Status page)
├── makeInactive(Request, Student)
└── reactivate(Request, Student)
```

Each method validates the transition, executes it in a transaction, and invalidates caches.

### Lifecycle Validation Service

```php
class StudentLifecycleValidator
{
    public function canPromote(Student $student): ValidationResult
    public function canPassOut(Student $student): ValidationResult
    public function canLeaveSchool(Student $student): ValidationResult
    public function canMakeInactive(Student $student): ValidationResult
    public function canReactivate(Student $student): ValidationResult
}
```

Each method checks the current state allows the transition and returns `{ allowed: bool, warnings: string[] }`.

---

## Master Directory

A utility page to browse all students by lifecycle status.

**URL:** `/admin/utilities/master-directory`

**Filters:** Status (Active / Inactive / Promoted / Passed Out / Left), Class, Section, Search by name

**Columns:** Student name, status badge, current class/section (if active), last outcome, last enrollment date, outstanding fees, actions (View Profile, View Report, View Fees)

This serves as the archive for all non-active students.

---

## Status Badge Colors

| Status | Color |
|---|---|
| `active` | Green (`bg-green-100 text-green-800`) |
| `inactive` | Amber (`bg-amber-100 text-amber-800`) |
| `promoted` | Blue (`bg-blue-100 text-blue-800`) |
| `passed_out` | Purple (`bg-purple-100 text-purple-800`) |
| `left` | Gray (`bg-gray-200 text-gray-700`) |

---

## File Change Summary

| Type | Files |
|---|---|
| New controller | `app/Http/Controllers/StudentLifecycleController.php` |
| New service | `app/Services/StudentLifecycleValidator.php` |
| Edit promote action | Set `status = 'promoted'`, `transferred_at = now()`, `outcome = 'promoted'` |
| Edit pass out action | Set `status = 'passed_out'`, `transferred_at = now()`, `outcome = 'passed_out'` |
| Edit leave action | Set `status = 'left'`, `transferred_at = now()`, `outcome = 'left'` |
| Edit inactive/reactivate | Set enrollment `status` + student `status` in tandem |
| Add `transferred_at IS NULL` to queries | All 17 locations |
| Edit receive-fee query | Remove status filter for fee collection |
| New React page | `Admin/Utilities/MasterDirectory.jsx` |
| Edit status badges | Add colors for promoted/passed_out/left |
| Schema changes | None |
| Repeat concept | Removed entirely — not a system action |
