Fees Redesign — Phased Implementation Plan

Purpose

Redesign the Fees Index into a mobile-first fee collection workspace that supports dynamic classes and students with multiple enrollments, while preserving the existing fee architecture and historical fee integrity.

Primary workflow:

Find a student → see what they owe → collect the fee.

This is a planning/prototyping document. Production implementation must not begin until the plan and prototype are approved.

1. Product Direction

The Fees system must no longer assume that there are only:

Gurmukhi

Kirtan

Classes/divisions are dynamic and the UI must naturally support any future class.

The redesign should be:

Mobile-first

Low-noise

Easy to scan

Focused on fee collection

Friendly to multiple student enrollments

Safe for historical fees

Usable on desktop

2. Main Fees Page

The main page should remain lightweight.

Primary UI

Page header

Student search

Compact primary status/filter control

Filters button

Compact collection summary

Student list/table

Do not permanently display a large filter panel.

Filters

Support:

Month

Fee status

Class

Section

Search

Less-used filters should live inside a filter sheet/modal.

Default workflow

The dominant use case should be:

Unpaid this month

Existing URL/query-state behavior should be preserved unless there is a strong technical reason to change it.

Active filters

Active filters should appear as compact removable chips.

3. Student List

The current large desktop-oriented table should not be the primary mobile experience.

On mobile, use compact student cards/list rows.

Conceptually:

Harpreet Singh
Class 2 · Section A

Unpaid Rs 2,000

View →

The list should make it easy to identify:

Student

Current class/section

Unpaid amount

Primary action

Do not show a redundant per-row Total column when it can be derived from Paid + Unpaid.

4. Student Fee Sheet / Modal

Do not expand the complete fee history underneath every student.

The main flow should be:

Fees list
    ↓
Select student
    ↓
Student Fee Sheet / Modal

The student sheet is the central place for multi-enrollment fee management.

First level: Student overview

The first level should show the student's enrollments/classes rather than dumping all fee records.

Example:

Harpreet Singh

Current Enrollments

Class 2 · Section A
Unpaid: Rs 2,000

Kirtan · Sunday
Unpaid: Rs 500

Music · Section B
Paid

Previous Enrollments

Class 1 · Section A
Previous balance: Rs 3,000

The user can select an enrollment to see its fee details.

Avoid a giant dropdown that hides all enrollment information when cards/list items provide better visibility.

5. Enrollment Fee Details

After selecting an enrollment:

Student
    ↓
Enrollment / Class
    ↓
Fee history

Show a concise fee history.

Prioritize:

Current/relevant fees

Paid/unpaid state

Amount

Fee period

Collection action

Do not dump years of monthly fees into the initial view.

Older records can be accessed through something such as:

View older fees

6. Historical Enrollments and Fees

Historical fee integrity is critical.

When a student changes class:

Old fees remain associated with the historical enrollment.

Old fees must not silently appear as fees of the new class.

Outstanding historical fees remain collectible.

Current enrollment fees remain separate.

The UI should make this distinction understandable:

Current Enrollments
    ↓
Current fee situation

Previous Enrollments
    ↓
Historical fee situation
    ↓
Outstanding historical balance

Do not change the database model merely to achieve this UX. First verify whether the existing enrollment + fee relationships already support it.

7. Collection Flow

Collection should happen in a dedicated focused modal/sheet.

Example:

Collect Fee

Harpreet Singh
Class 2 · Section A

August 2026
Monthly Fee

Amount
[ Rs 2,000 ]

Payment date
[ 17 Aug 2026 ]

[ Cancel ] [ Collect ]

Do not embed a full payment form inside every student row.

Preserve the existing collection behavior, permissions, validation, and fee integrity.

8. Phase 0 — Current Architecture Verification

Before changing anything, inspect the current implementation.

Identify:

Fees Index React/Inertia page

Components used by the page

FeesController/index

Fee query and data transformation

Fee collection endpoint

Fee un-collection endpoint

Monthly fee generation

Custom fee functionality

Existing filters

URL/query state

Permissions

Existing tests

Document which pieces can be reused.

Also inspect the existing current-state document:

docs/architecture/15-fee-ui-ux-redesig.md

Use it as current-state evidence, not as the redesign specification.

9. Phase 1 — UX/Data Contract

Define the exact data required by the new UI.

Conceptually:

Student
 ├── Current Enrollments
 │     ├── Class
 │     ├── Section
 │     ├── Fee Summary
 │     └── Fee History
 │
 └── Previous Enrollments
       ├── Class
       ├── Section
       ├── Historical Fee Summary
       └── Historical Fee History

First determine whether the existing backend response already contains enough information.

If it does not, identify the smallest backend additions required.

Do not redesign the database without evidence.

10. Phase 2 — Main Fees Index Prototype

Create a React-only prototype using mock/current-shaped data.

No Laravel changes.

Prototype:

Mobile layout

Desktop layout

Search

Primary status filter

Filter sheet

Active filter chips

Summary

Student cards/list

Empty state

Loading state

No-results state

The prototype must explicitly include:

Student with one class

Student with multiple classes

Student with current + previous enrollment

Student with unpaid fees

Student with fully paid fees

Student with no fees

The most important stress-test case is a student with three current classes plus historical enrollment.

11. Phase 3 — Student Fee Sheet Prototype

Prototype the student modal/sheet.

It must support:

Student
    ↓
Current enrollments
    ↓
Previous enrollments
    ↓
Select enrollment
    ↓
Fee history
    ↓
View older fees

The sheet must remain usable on a small mobile screen.

Avoid:

Giant accordions

Long nested lists

Showing every monthly fee for every enrollment at once

Hidden multi-class information that requires repeated dropdown interaction

12. Phase 4 — Collection Prototype

Prototype:

Student
    ↓
Enrollment
    ↓
Fee
    ↓
Collect

Use a dedicated modal/sheet.

Include:

Student context

Enrollment/class context

Fee period

Fee type

Amount

Payment date

Validation

Success state

Error state

Do not connect it to the real backend yet.

13. Phase 5 — Backend Compatibility Audit

Compare the prototype's requirements against the current Laravel response.

Explicitly identify:

Reusable

Existing queries, relationships, endpoints, permissions, calculations, and response data that can remain unchanged.

Required additions

Small backend changes needed to support the prototype.

Must remain unchanged

Anything involving:

Existing fee records

Historical fee ownership

Monthly generation

Collection behavior

Un-collection behavior

Permissions

Existing business rules

Do not implement these changes yet.

14. Phase 6 — Production Implementation Plan

Only after the prototype is reviewed and approved, define production changes.

Separate the plan into:

Frontend

Pages

Components

State

Responsive behavior

Modals/sheets

Filters

Backend

Controllers

Queries

Transformers/resources

Endpoints

Validation

Tests

Existing tests to preserve

New feature tests

Multi-class tests

Historical enrollment tests

Filter tests

Collection tests

Permission tests

Database

Only list migrations if genuinely required.

Regression risks

Explicitly assess:

Existing fee records

Historical fees

Monthly fee generation

Fee collection

Fee un-collection

Multi-class students

Historical enrollments

Permissions

Reports

15. Phase 7 — Incremental Rollout

Do not replace the entire Fees page in one giant change.

Prefer:

Prototype

Review/approval

Introduce new UI components

Connect existing data

Connect existing actions

Verify filters

Verify collection

Verify historical enrollment behavior

Regression test

Remove/reduce old UI only after the new flow is proven

The existing system should remain functional throughout the transition.

16. Constraints

The following remain in effect:

No production implementation before plan approval.

No database redesign without evidence.

No hardcoded Gurmukhi/Kirtan assumptions.

No unnecessary refactor.

Preserve existing fee calculations.

Preserve existing collection and un-collection behavior.

Preserve permissions.

Preserve historical fee integrity.

Mobile is the primary UX target.

Desktop must remain usable.

Do not modify unrelated modules.

Prefer parallel/incremental changes over risky replacement.

17. Required Final Planning Output

Before implementation, produce:

Current architecture findings

Current Fees Index problem inventory

Proposed UX architecture

Student → Enrollment → Fee data contract

Phased implementation plan

Files likely to change

Components likely to be created

Backend changes required, if any

Tests required

Risks and regression points

What should be prototyped first

What should explicitly not be changed

Recommended implementation order

Do not write production code.

Do not modify Laravel behavior.

Do not create database migrations.

Do not start implementation until the plan is approved.

18. Decision Gate

The first deliverable is the plan and prototype strategy, not the implementation.

The critical UX validation scenario is:

A student has three current classes and previous enrollment history, with paid and unpaid fees across those enrollments.

If the experience remains clear and usable on mobile in that scenario, the design is likely robust enough to proceed.
