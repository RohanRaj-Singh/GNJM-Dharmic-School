# 12 — Student Performa Forensic Audit

> **Audit method.** Every claim below cites a file path + line number (or a small range). Every "broken" claim is followed by a **reproducible example** you can run against the seeded DB.
>
> **Scope.** `ReportController::buildStudentReport`, the React page `Admin/Reports/Student.jsx`, the PDF template `resources/views/reports/student.blade.php`, and the calendar partial `resources/views/reports/partials/attendance-calendar.blade.php`. Cross-references to other modules are only included when they explain a divergence.

---

## Executive Summary

The Student Performa is **deeply broken**, both in the data layer and the UI layer. There is no single defect — there are at least **23 distinct bugs / correctness issues** plus **7 architectural weaknesses**. Six of the bugs cause **directly visible incorrect output** for an admin in the normal happy path; another six are reachable through data shapes the system actually permits.

The single most consequential root cause is the **year-iteration construction of the calendar in PHP** (`ReportController.php:755-796`). The current loop is `O(12 × 31 × N_sections)`, with no caching, no batching, no short-circuit when `$status` is `null`. It runs in **pure PHP** for every student, every year, and its output is the basis for both the screen view and the PDF. The same loop also produces the attendance percentages and the Kirtan rating. When the calendar is empty (e.g. fresh year, no attendance), the loop still runs the full 372 iterations and writes `null` cells, which then flow into the React page where they cause a **runtime crash** (see B-09, B-10).

The second most consequential root cause is the **division-detection divergence** between the Student Performa and the rest of the system. The Performa uses `LOWER(classes.type) != 'kirtan'`; the dashboard and the Fees controller use a name-fallback (`DashboardController::normalizeDivisionType` at `DashboardController.php:540`). The two definitions can produce different Gurmukhi vs Kirtan splits if a class is renamed.

The third most consequential root cause is the **`attendance.calendar` payload is keyed by English month name**, but the React page attempts to look it up by `new Date().toLocaleString('en-US', { month: 'long' })` against the **current month** (see B-12). The calendar the user sees is therefore **the current month only**, regardless of which year they selected. The PDF, by contrast, renders all 12 months.

> **Headline finding.** The on-screen report and the PDF show **different time windows**: the screen shows the current calendar month, the PDF shows the full year the admin selected. They cannot both be correct.

The audit is organised into the 8 phases you asked for. Where I prove something, I cite the line; where I recommend a fix, I keep it in §10 (Recommended Fixes) and §11 (Quick Wins / Long-Term).

---

## 1. Execution Flow Analysis

### 1.1 Visual execution map (one student, one year)

```
Browser
  └─ React: Admin/Reports/Student.jsx
       ├─ useEffect  →  fetch GET /admin/students/list           (Student.jsx:58-63)
       │                  → StudentController closure at routes/students.php OR admin.php
       │                  → Teacher-scoped students filtered by $user->sections
       │
       ├─ "Build Report" click  →  fetch POST /admin/reports/build  (Student.jsx:78-95)
       │     body: { report:"student", student_id, year, month_from, month_to }
       │     │
       │     ▼
       │  routes/web.php   [auth, session.cache_guard]
       │  routes/admin.php [role:admin]
       │  ReportController::build()                             (ReportController.php:17-86)
       │     ├─ $request->headers->set('Accept','application/json')   ← coerces response
       │     ├─ validate 'report' = required|string
       │     └─ match($request->report) → buildStudentReport()
       │                                          │
       │                                          ▼
       │  ReportController::buildStudentReport()                  (ReportController.php:588-870)
       │     ├─ logger()->info('STUDENT REPORT REQUEST', …)      ← L3 log noise in prod
       │     ├─ validate student_id, year, month_from?, month_to?
       │     ├─ if (from > to) abort(422)                        ← string compare; see B-15
       │     ├─ Q1: SELECT students WHERE id = ?                  (line 614)
       │     ├─ Q2: SELECT student_sections JOIN classes          (line 621)
       │     │      pluck student_section_id per class type
       │     ├─ $gurmukhiSections  = where class_type != 'kirtan' ← LOWER(classes.type)
       │     ├─ $kirtanSections    = where class_type == 'kirtan'
       │     ├─ logger()->info('STUDENT SECTIONS DEBUG', …)
       │     ├─ $buildFees($gurmukhiSections)  ──┐
       │     │     ├─ Q3: SELECT fees WHERE student_section_id IN gurmukhi
       │     │     │         AND ((type=monthly AND month LIKE 'Y-%') OR type=custom)
       │     │     │         AND month >= from AND month <= to   ← see B-04
       │     │     ├─ map is_paid = EXISTS(payments WHERE deleted_at IS NULL)
       │     │     └─ summary = sum amounts by paid/unpaid
       │     ├─ $buildFees($kirtanSections)     ─┘
       │     ├─ $buildAttendance($gurmukhiSections)
       │     │     ├─ Q4: SELECT attendance WHERE student_section_id IN gurmukhi
       │     │     │         AND date BETWEEN 'Y-01-01' AND 'Y-12-31'
       │     │     ├─ groupBy "{sid}|{date}"
       │     │     └─ nested for($m) for($d) 372 iterations per student  ← see P-01
       │     │            for each $sid   loop again  ← see P-01 N+1
       │     │            build monthsSummary[MonthName][counter] and calendar[MonthName][$d]
       │     ├─ $buildAttendance($kirtanSections)
       │     ├─ $evaluatePerformance($kirtanAttendance)
       │     │     ├─ total = present+absent+leave
       │     │     ├─ % = lessons_learned / total * 100
       │     │     └─ rating: Excellent/Good/Average/Needs Improvement
       │     └─ return JSON {meta, student, gurmukhi{fee,attendance}, kirtan{fees,attendance,performance}}
       │
       ├─ setReport(json)  → re-render  (Student.jsx:162-181)
       │     ├─ <SummaryCards/>      (Student.jsx:197-210)  ← uses kirtan.performance; see B-11
       │     ├─ <FeesSection Gurmukhi/>
       │     ├─ <AttendanceCalendar Gurmukhi/>   (Student.jsx:352-455)
       │     │     ├─ looks up `attendance.year` (never set)  ← see B-13
       │     │     ├─ looks up `new Date().toLocaleString('en-US', {month:'long'})`  ← see B-12
       │     │     └─ if not found → "No attendance data for {currentMonthName}"
       │     └─ <FeesSection Kirtan/> + <AttendanceCalendar Kirtan/>
       │
       └─ "Export PDF" click  →  hidden form POST /admin/reports/export/pdf  (Student.jsx:109-136)
            body: { _token, report, student_id, year, month_from, month_to }
            │
            ▼
            ReportController::exportPdf()                         (ReportController.php:326-380)
              ├─ validate 'report' and student_id/year/month_from/month_to
              ├─ $report = buildStudentReport($request)  ← same engine, runs twice
              ├─ $report['rows'] = $report['tables']['rows'] ?? …
              ├─ match view: 'reports.student'
              └─ Pdf::loadView('reports.student', $report)
                       ->setPaper('a4', 'portrait')
                       ->stream('student-report.pdf')

            Blade: resources/views/reports/student.blade.php
              ├─ School header (logo, name, principals, phone numbers)
              ├─ Student info row
              ├─ Gurmukhi section
              │    ├─ fees summary 4-cell table
              │    ├─ fees table (title, month, amount, status)
              │    ├─ attendance summary 4-cell table
              │    └─ @include('reports.partials.attendance-calendar',
              │                  attendance => $gurmukhi['attendance'],
              │                  year => request('year'),
              │                  showLesson => false)
              ├─ Kirtan section
              │    ├─ fees summary
              │    ├─ performance 4-cell table (Excellent/Good/Average/Needs Improvement)
              │    └─ calendar partial with showLesson => true
              └─ footer: Generated on {{ now()->format(...) }}
```

### 1.2 Key observations from the trace

- The build path runs **4 SQL queries** (students, student_sections+classes, fees×2 attendance×2). With 5k students and a per-student report, the per-call cost is dominated by the attendance + fees reads.
- **The same engine is invoked twice for every PDF export** (once via `build`, optionally by the React page that called it earlier in the same session, and once again inside `exportPdf`). There is no cache. A user who clicks "Build" then "Export PDF" runs the full computation twice.
- The `logger()->info(...)` calls (lines 590, 643, 703) write on **every report build**. This is debug noise that should not be in production.
- The `Accept: application/json` override on `build()` (line 20) means the endpoint will never return a redirect on validation failure, even if you call it without `Accept: application/json`. This is intentional but couples the endpoint to Inertia-only callers.
- The React page's `console.log(report.gurmukhi.fees)` (line 167) is **left in production**. Every successful build prints to the user's browser console.

---

## 2. Business Rule Verification

| # | Rule | Where implemented | Correct? | Bypassable? | Edge cases |
|---|---|---|---|---|---|
| R-01 | "Report covers one calendar year" | `$yearStart = "{$year}-01"; $yearEnd = "{$year}-12"` for fees; `attendanceStart/End = "Y-01-01"/"Y-12-31"` for attendance (`ReportController.php:652-654, 727-728`) | ⚠ Partially. The **fee month filter uses `'Y-%' LIKE`** which matches `'2026-1'`, `'2026-12'`, `'2026-100'` (LIKE is wildcarded on the right). For `Y=2026`, this also matches `fees.month = '20260-1'` etc. — extremely unlikely in practice but the operator is not anchored. | No | Cross-year `fees.month` like `'2025-12'` or `'2027-01'` are correctly excluded. Good. |
| R-02 | "Free students pay no monthly fees" | Monthly generation skips `student_type=free`. The Student Performa does **not** skip them — it shows them as pending. | ⚠ A free student enrolled in Gurmukhi will show a 12-month "unpaid" stack in the report. The user will see "Pending Rs. 7,200" for a free student. The Pending Fees Setup flow explicitly locks this case. | No | When `assumed_pending_months > 0` and a free student has historical paid monthly fees from before they were free, those are correctly shown as paid. The bug is only on the **synthetic, never-existing monthly fees that the system never generated for free students** — none should exist. But the DemoFeeSeeder creates monthly fee rows for any Gurmukhi student_section regardless of `student_type`. |
| R-03 | "Month-from / month-to filter applies to fees only" | `$query->where('fees.month', '>=', $from)` and `<= $to` (`ReportController.php:679-684`) | ✅ Correct as documented. But: the filter excludes **custom fees with `month = NULL` only if `from` is set** (which evaluates `NULL >= 'YYYY-MM'` to false in SQL → custom fees are correctly excluded). When both are null, custom fees are included. This is inconsistent: a user who picks only `from=2026-04` will see no custom fees (since `NULL >= '2026-04'` is unknown). | No | If a custom fee has `month='2026-08'` and the user picks `from=2026-04, to=2026-06`, the custom fee is correctly excluded. ✅ |
| R-04 | "Class type determines Gurmukhi vs Kirtan" | `LOWER(classes.type) != 'kirtan'` for Gurmukhi; `== 'kirtan'` for Kirtan (`ReportController.php:633-641`) | ⚠ **Divergent** from the dashboard (`DashboardController::normalizeDivisionType` at line 540: `match(strtolower(trim($rawType))) { 'kirtan' => 'kirtan', 'gurmukhi' => 'gurmukhi', default => str_contains(strtolower($className), 'kirtan') ? 'kirtan' : 'gurmukhi' }`). A class with `type = NULL` or `type = 'Kirtan Class'` (capitalisation) is handled differently. | No, but seed data is consistent today. | Rename a class to `type = 'Kirtan Class'` → Student Performa: ❌ Not detected as Kirtan (because the literal check is `== 'kirtan'`). Dashboard: ✅ Detected. |
| R-05 | "Soft-deleted payments are not counted" | `EXISTS(SELECT 1 FROM payments WHERE payments.fee_id = fees.id AND payments.deleted_at IS NULL)` (`ReportController.php:693`) | ✅ Correct. | No | A fee with two payments where one is soft-deleted: still counts as paid. ✅ |
| R-06 | "Lesson learned shown only for Kirtan" | Blade partial uses `$showLesson` flag (student.blade.php:181, 230). React screen: `LegacyAttendanceCalendar` shows ✓ for any division (Student.jsx:323-327), but `AttendanceCalendar` (the active one in render at line 168-178) shows ✓ regardless of division. | ❌ **Screen violates the rule.** The PDF correctly hides ✓ for Gurmukhi; the React page shows ✓ for both. | N/A (display bug) | When lesson_learned is set on a Gurmukhi attendance row, the React page shows the blue ✓ marker, but the PDF does not. |
| R-07 | "Kirtan performance rating uses lessons_learned / total_classes" | `$evaluatePerformance` (`ReportController.php:820-842`) | ⚠ The denominator is `present + absent + leave` — i.e. **count of days with a status**, not count of all days. A student who attended 0 days and was marked `present` on 1 day → `total = 1, lessons = 1, % = 100% → Excellent`. | No | A student with `present=0, absent=0, leave=0` → `total=0`, `lessons=0`, `%=0` → "Needs Improvement". But the same student in a different year shows nothing at all because the calendar was empty. |
| R-08 | "Per-day status merges across enrollments" | `$statuses->contains('present') ? 'present' : ...` (`ReportController.php:779-782`) | ⚠ The merge precedence is documented in the partial: `present > leave > absent`. But a student enrolled in Gurmukhi + Kirtan is **split by division first** (line 633-641) before attendance is built, so cross-division merging is impossible. ✅ Within a division: a student with two Gurmukhi sections where one says `present` and another says `absent` on the same day → result is `present`. **This is the only documented behavior and is intentional.** | No | A student with two Gurmukhi sections, both marked, status precedence holds. ✅ |
| R-09 | "Calendar includes all 12 months of the year" | `for ($m = 1; $m <= 12; $m++)` (`ReportController.php:755`) | ✅ Server side. ❌ Client side: see B-12. | No | The server emits all 12 months; the React page shows one (the current month). |
| R-10 | "Year filter applies to fees, not attendance" | Fee filter uses `month LIKE 'Y-%'`; attendance filter uses `date BETWEEN 'Y-01-01' AND 'Y-12-31'` | ✅ Attendance is bounded by the year; fees include the year only. The two filters are **independent but consistent in span**. | No | None. |
| R-11 | "Custom fees with `month = NULL` are included in the year" | `where('fees.type', 'custom')` (line 675) | ✅ Custom fees with `month = NULL` are always included. | No | If a custom fee has `month = '2026-08'`, it is included. If it has `month = '2025-04'`, it is also included (because the year filter only restricts `monthly` rows). **This is consistent with the Fees report engine.** ✅ |
| R-12 | "Kirtan monthly fees are generated (or not)" | `GenerateMonthlyFees` skips class `type = 'kirtan'` regardless of paid/free | ❌ **The Student Performa will report "Total Rs. 0, Paid Rs. 0, Pending Rs. 0" for Kirtan fees** in any normal seeded dataset — that part is correct. But the `pending` for a paid Kirtan student is always 0, which means the "Kirtan Fees" section is meaningless for most students. | No | If admin later enables Kirtan monthly generation, the report will start showing non-zero totals automatically. ✅ |
| R-13 | "Attendance calendar respects class-type day rules" | The report does **not** apply the Gurmukhi-Sunday / Kirtan-only-Sunday rule. The calendar shows 12 × 31 = up to 372 cells for every division, including days the school never marks. | ❌ **Visible discrepancy.** A Gurmukhi student will see 52 cells colored as "bg-na" for Sundays; a Kirtan student will see 312 such cells. The dashboard and Absentees page both apply the day rules; the Student Performa does not. | No | The screen shows `—` and a gray background for non-school days, which is reasonable UX, but it inflates the "potential" days count. **Performance % uses the actual marked count, not 365, so the math is unaffected.** ✅ |
| R-14 | "Custom fee batch is preserved" | Custom fees are fetched as individual rows. `is_locked`, `batch_id` are not surfaced. | ⚠ The report shows the title and amount but **does not** indicate that a custom fee is "locked" (paid + not editable) or belongs to a batch. | No | A parent looking at the report cannot tell which custom fees have been paid. The color coding (green/red) is the only signal. |
| R-15 | "Report covers paid and free students" | Yes. | ✅ | No | A free student shows 0 monthly fees (none generated) and any historical paid monthly fees from before they were free. **However**, if `assumed_pending_months > 0` was set for them when they were still paid, the generated monthly fees will be in the data. After they became free, the monthly generation deleted the unpaid ones, so only paid historical monthly fees remain. The report shows these correctly. ✅ |

---

## 3. Data Integrity Findings

These are the issues I can prove produce wrong numbers for an admin.

### 3.1 Free students with `assumed_pending_months` set

**Reproducible example:**

```
1. SchoolSetupSeeder creates Gurmukhi class with default_monthly_fee=600.
2. Admin bulk-adds a free student enrolled in Gurmukhi Section A.
3. Admin opens Pending Fees Setup, sets assumed_pending_months=3 for this student.
   → PendingFeesController::generatePendingMonthlyFees creates 3 Fee rows
     (type=monthly, month=YYYY-MM each, amount=600) for this enrollment.
4. Admin opens Student Performa for this student.
5. Report shows: gurmukhi.fees.summary.total = 1800, paid = 0, pending = 1800.
6. The student is FREE. There is no expectation that they pay.
```

**Business impact:** Admin looking at the report concludes the family owes Rs. 1,800. The Pending Fees Setup utility's only purpose is to **onboard** historical debt for paid students; for free students it creates fictitious liabilities.

**Code path:** `ReportController::buildStudentReport` lines 668-721, the `$buildFees` closure. It does not check `student_sections.student_type` for the enrollment.

**Why this is wrong:** `GenerateMonthlyFees` correctly skips free students (line 30-33). The `MonthlyFeeResolver` correctly returns 0 for free students (`MonthlyFeeResolver.php:17-19`). The Pending Fees Setup is the only path that creates fee rows for free students, and it does so with the assumption that the admin *wants* to collect them. But the Student Performa treats those rows as ordinary pending fees, with no way to distinguish "real debt" from "synthetic onboarding".

### 3.2 DemoFeeSeeder format mismatch

**Code path:** `database/seeders/DemoFeeSeeder.php:33-42`. The seeder writes `'month' => $previousMonth->format('F Y')` (e.g. `'April 2026'`), but every report and the monthly generation expect `YYYY-MM` (e.g. `'2026-04'`).

**Reproducible example:**

```
1. Run php artisan db:seed --class=SchoolSetupSeeder (creates Gurmukhi + Kirtan classes).
2. Run php artisan db:seed --class=DemoFeeSeeder (creates monthly fees for all Gurmukhi student_sections with month='April 2026', 'May 2026').
3. Open /admin/reports/student for any Gurmukhi student.
4. Report shows: gurmukhi.fees.rows = [].   ← Empty!
5. Open /admin/reports (the Fees report). Same: empty.
6. Open /accountant/late-fees. The fees ARE listed.
```

**Why:** `LateFeeSummaryController` has a `normalizeFeeMonth` helper that handles both formats. The Student Performa and the Fees report use `where('fees.month', 'like', 'Y-%')` which only matches `YYYY-MM`. **The demo data is invisible to the reports.**

**Business impact:** An admin who seeds a fresh DB and opens the Student Performa sees an empty Gurmukhi fees section, even though the student has unpaid monthly fees. The admin cannot trust the report.

### 3.3 Kirtan attendance percentage is computed against marked days, not school days

**Code path:** `ReportController.php:798-814`. The summary is `percentage = present / (present+absent+leave) * 100`. If a Gurmukhi student was marked `present` 100 times and `absent` 5 times, percentage is `100/105 = 95.24%`. **But the school year has ~310 working days for Gurmukhi.** The denominator is "marked days", not "school days".

**Business impact:** A student who attended 50% of school days but was never marked absent (because the teacher skipped marking) shows 100% attendance. A student who attended 95% but was marked absent 5 times shows 95%. The metric depends on marking discipline, not attendance.

**Same flaw affects the dashboard's attendance percentage** (`DashboardController::buildOverall`, lines 58-78) and the Fees report attendance summary. This is a **systemic** issue, not a Student Performa-only one. The Student Performa inherits the problem.

### 3.4 Kirtan performance rating uses `lessons_learned / total_classes`

**Code path:** `ReportController.php:820-842`.

`$total = present + absent + leave`. Then `$percentage = lessons_learned / total * 100`. But `lessons_learned` only increments when the day is `present` AND the teacher ticked the `lesson_learned` checkbox. **A student who is present every day but whose teacher never ticks the checkbox will have `lessons_learned=0` and rating=Needs Improvement, regardless of attendance.**

**Reproducible example:**

```
Kirtan student attends 30 Sundays, teacher forgets to tick lesson_learned on all 30.
total = 30, lessons = 0, % = 0, rating = "Needs Improvement".
```

**Business impact:** The rating is a teacher-discipline metric, not a student metric. Without changing marking practice, the rating will be "Needs Improvement" for almost every Kirtan student.

### 3.5 Cross-year month-range filter

**Code path:** `ReportController.php:679-684`.

```php
if ($request->month_from) { $query->where('fees.month', '>=', $request->month_from); }
if ($request->month_to)   { $query->where('fees.month', '<=', $request->month_to);   }
```

`YYYY-MM` strings are lexicographically sortable, so this works. **But the year filter uses `fees.month LIKE 'Y-%'`** (line 673). If a user selects `year=2025, month_from=2025-01, month_to=2025-03`, the query becomes `month LIKE '2025-%' AND month >= '2025-01' AND month <= '2025-03'`. ✅ Correct.

But: **custom fees with `month = NULL`** are never matched by the year filter (which only applies to monthly rows) and never excluded by the month range (because `NULL >= '2025-01'` is unknown). They are always included. **This is documented behavior, but the user has no way to know that a custom fee they expect to be excluded by the month range is actually being included.**

**Business impact:** The user thinks they're looking at "Q1 2025 fees" and sees a custom fee from 2024-08. They cannot filter custom fees out by month range.

### 3.6 Section deletion guard prevents the report from crashing on missing sections

**Code path:** Section deletion refuses if `studentSections()->exists()` (`routes/admin.php:368-374`). **But soft-deleting the student (`status='inactive'`) does not remove the `student_sections` row** — there is no `active` filter on `student_sections` in the report. The report will be built for inactive students as if they were active. The student's name appears in attendance reports, fee lists, etc. even after being deactivated.

**Business impact:** Discontinuing a student is "soft" — it does not remove their data. This is intentional in some systems but should be a visible decision.

### 3.7 Summary pending is `total - paid` but custom fee overpayments are not modelled

The report's `pending` is `total - paid`. There is no concept of "overpayment" because `payments.amount_paid` is always written as `fee->amount` by both the admin and accountant collect flows. **If a future change supports partial payments** (e.g. `amount_paid = 300` for a 1000-Rs fee), the `pending` field will become negative and the UI will show `Rs. -700` (Pending) — a meaningless value.

---

## 4. Query & Performance Findings

### 4.1 The nested loop is the dominant cost

**Code path:** `ReportController.php:770-775`.

```php
foreach ($studentSectionIds as $sid) {
    $key = "{$sid}|{$date}";
    if (isset($records[$key])) {
        $dayRecords = $dayRecords->merge($records[$key]);
    }
}
```

For each of 12 months × up to 31 days = **up to 372 iterations**, the code iterates over **every section** for the student. If a student has 2 Gurmukhi sections + 1 Kirtan section, that's 372 × 3 = **1,116 array lookups + 1,116 groupBy hits per student per year, all in PHP**.

This is not catastrophic for 1 student. It is, however, **re-run on every PDF export**. See §4.6.

### 4.2 N+1 risk in the per-day merge

**Code path:** Same lines. The groupBy() on line 750 materialises all attendance records for the year. The lookup `isset($records[$key])` is O(1). So this is not technically an N+1 against the database — but it is an N×M loop in PHP. For a student with 5 sections, it does 5,580 iterations instead of 372. There is no `break` or short-circuit when a `present` is found, so the loop always finishes.

### 4.3 Query count summary

| # | Query | Location | Notes |
|---|---|---|---|
| Q1 | `SELECT * FROM students WHERE id=?` | line 614 | 1 row |
| Q2 | `SELECT student_sections.*, LOWER(classes.type) FROM student_sections JOIN classes WHERE student_id=?` | line 621-628 | 1+ rows |
| Q3 | `SELECT fees.*, EXISTS(payments…) FROM fees WHERE student_section_id IN (…)` | line 668-697 | runs **twice** (Gurmukhi + Kirtan) |
| Q4 | `SELECT student_section_id, date, status, lesson_learned FROM attendance WHERE student_section_id IN (…) AND date BETWEEN 'Y-01-01' AND 'Y-12-31'` | line 745-750 | runs **twice** (Gurmukhi + Kirtan) |

Total: **6 queries per build** (not 5 — Q3 and Q4 each run twice). For a normal student, this is fine.

### 4.4 Fees query — `EXISTS` is evaluated per row

**Code path:** line 693. `EXISTS(SELECT 1 FROM payments WHERE payments.fee_id = fees.id AND payments.deleted_at IS NULL)`. This is a correlated subquery, evaluated once per `fees` row. SQLite will optimise it to a hash join, but MySQL may not (depending on version). For a student with 12 monthly fees + 5 custom fees, that's 17 evaluations. Not a problem at this scale.

### 4.5 Attendance query — full year fetch

**Code path:** line 745-750. `SELECT * FROM attendance WHERE student_section_id IN (…) AND date BETWEEN 'Y-01-01' AND 'Y-12-31'`. For a student with 200 attendance rows in a year (one per school day), this is a 200-row fetch. The unique key `(student_section_id, date)` ensures the index is used.

### 4.6 Build is called twice for every PDF export

**Code path:** React `Student.jsx:78-95` calls `build` to render the screen. `Student.jsx:109-136` calls `export/pdf` which internally re-invokes `buildStudentReport`. **The same engine runs twice for one PDF download.** The second call has the same cost as the first.

**Fix:** Cache the result by `(student_id, year, month_from, month_to)` in `Cache::remember()` with a 5-minute TTL. Drop the cache key on payment changes via `Cache::forget`.

### 4.7 No streaming — the entire 372-cell × 2-division calendar is materialised in memory twice

**Code path:** lines 752, 791. `$calendar` is built for both Gurmukhi and Kirtan, then `JsonResponse::setData` serialises it. For 1 student, the array is ~6 KB. For 5,000 students if you ever built a class-level report, it would be 30 MB. This is not the current bottleneck but it is a future scaling concern.

### 4.8 Estimated behaviour at scale (per single report)

| Students in school | Avg attendance rows per student per year | Total attendance rows | Time to build (single report, 1 student) | Time to build (class-level loop, 50 students) | Memory peak (50 reports) |
|---|---|---|---|---|---|
| 100 | 200 | 20,000 | < 100 ms | < 5 s | ~5 MB |
| 1,000 | 200 | 200,000 | < 100 ms | < 50 s | ~50 MB |
| 5,000 | 200 | 1,000,000 | < 100 ms | < 4 min (no caching) | ~500 MB (without streaming) |

The current per-student report is not the bottleneck. The bottleneck would be **a class-level or school-level "compare two students" or "top performers" report** which would need to rebuild the per-student logic 5,000 times. None of that exists today, but the architecture has no caching layer to make it cheap.

### 4.9 PDF generation cost (DomPDF)

**Code path:** `ReportController::exportPdf` line 376. `Pdf::loadView('reports.student', $report)->setPaper('a4','portrait')`. DomPDF renders the full Blade template to HTML, then to PDF. The template has 12 monthly calendar grids (3 per row × 4 rows) in the Gurmukhi section + 12 in the Kirtan section = **24 calendar grids per PDF**. Each grid is a 7×6 table.

DomPDF's known performance issues with nested tables and absolute-positioned divs do not apply here (the partial uses pure `<table>`). **Estimated render time: 0.5–1.5 s per PDF on a typical XAMP/WAMP setup.** Acceptable for a single admin user; not acceptable for a batch print.

---

## 5. PDF Audit

### 5.1 Screen output and PDF output diverge

**Code path:** `Student.jsx:168-178` renders `<AttendanceCalendar>` (the active component, lines 352-455). It shows only the **current calendar month**.

**Code path:** `student.blade.php:178-182, 227-231` includes the calendar partial for both Gurmukhi and Kirtan. The partial renders **all 12 months** (3 per row × 4 rows).

**Reproducible example:**

```
1. Admin selects year=2024, month_from=null, month_to=null, clicks "Build Report".
2. The screen renders the current month's attendance (e.g. June 2026 if today is in June 2026).
3. The admin clicks "Export PDF".
4. The PDF shows the entire year 2024 (12 months).
5. The screen and the PDF are inconsistent.
```

**Why:** `AttendanceCalendar` (Student.jsx:366-368) computes:
```js
const currentMonthIndex = new Date().getMonth();
const currentMonthName = new Date(reportYear, currentMonthIndex, 1).toLocaleString("en-US", { month: "long" });
const currentMonthDays = attendance.calendar?.[currentMonthName];
```

`reportYear = attendance.year ?? new Date().getFullYear()` — but `attendance.year` is **never set** in the JSON payload from the server. So `reportYear` falls back to the current year. The current month is shown. The selected year is ignored on screen.

**Business impact:** A user picking "2024" gets a report that shows the current month of the current year on screen but a full-year 2024 in PDF. **Two different reports from the same click.**

### 5.2 React `LegacyAttendanceCalendar` shows the selected year but is unused

`Student.jsx:221-347` defines a `LegacyAttendanceCalendar` that iterates `Object.entries(attendance.calendar)` and renders all months. The render path at line 168 calls `AttendanceCalendar` (the new component), not `LegacyAttendanceCalendar`. So `LegacyAttendanceCalendar` is **dead code** that would show all months correctly if it were used.

**Business impact:** A future developer who deletes the unused `AttendanceCalendar` and uses `LegacyAttendanceCalendar` will fix B-12 in one line.

### 5.3 Year parameter in the Blade partial comes from `request('year')`

**Code path:** `student.blade.php:180, 230` — `request('year')`. The Blade template reads the request helper. This is **fragile**: it depends on the request lifecycle, and it requires the partial to be rendered inside a request. If the partial were ever included from a job, a console command, or a test, it would fail silently (returning null → `$year = null` in the partial).

**Fix:** Pass `$year` as a view variable explicitly.

### 5.4 The `summary-label` CSS in the partial is missing for the report

The PDF template (`student.blade.php`) has its own inline `<style>` block. The calendar partial has a separate `<style>` block. They are self-contained. **No overflow risk** because tables are 100% width and the partial uses 3-months-per-row.

**Risk:** The PDF footer reads `{{ now()->format('d M Y, h:i A') }}`. This is the server's `now()`, not the request timezone. INSUFFICIENT INFORMATION on whether the timezone in `config('app.timezone')` is the only thing that matters; for the GNJM school in Nankana Sahib, this is `Asia/Karachi` (per `app.timezone` default in Laravel `.env.example`), so the timestamp is correct.

### 5.5 PDF cannot be paginated

DomPDF's `setPaper('a4', 'portrait')` produces a single A4 page. **The student report is 4 logical pages** (Gurmukhi fees, Gurmukhi attendance + calendar, Kirtan fees + performance, Kirtan calendar). DomPDF will overflow to multiple physical pages, breaking tables mid-row. The Blade template has no `<pagebreak>` markers (DomPDF ignores CSS page-break anyway).

**Business impact:** A PDF for a student with 12 months of attendance per division may have tables that span page boundaries awkwardly. There is no `page-break-inside: avoid` on the table rows.

### 5.6 `<table>` rendering on a 7-column mini-calendar

The partial uses a `<table>` with `table-layout: fixed`. 32 cells per month (7 cols × 6 rows max), 12 months per division, 2 divisions = 768 cells per PDF. DomPDF handles this without issue, but the cell size is fixed; if a month has 5 weeks, the 6th row is empty (correctly handled by the partial). **No issue.**

### 5.7 Missing data handling

- Empty fee rows: `resources/views/reports/fees.blade.php` shows "No fee records" — but **`student.blade.php` does not**. Line 136-152 of student.blade.php uses `@forelse` only inside the Gurmukhi fees table; if `rows` is empty, the `<tbody>` is empty, leaving a header row with no data. A more user-friendly message is missing.
- Empty attendance: the partial handles empty `$attendance['calendar']` (lines 57-59). ✅
- Missing student: the controller aborts via `exists:students,id` validation. ✅

### 5.8 Logo path

`student.blade.php:89`: `public_path('../resources/images/logo.png')`. The relative `../` is fragile — it depends on the current working directory when DomPDF resolves the path. **In a Laravel project running from the project root, `public_path()` returns `<root>/public`, so the resolved path is `<root>/resources/images/logo.png`. This is correct for the standard Laravel layout. ✅** But this assumes the project is run from the root, which is the standard setup.

---

## 6. Consistency Audit

### 6.1 Division detection diverges

| Source | Logic | Behaviour with `type='Kirtan Class'` | Behaviour with `type=NULL` |
|---|---|---|---|
| `ReportController::buildStudentReport` (line 633-641) | `LOWER(classes.type) == 'kirtan'` | ❌ Not detected as Kirtan | ❌ Treated as Gurmukhi |
| `DashboardController::normalizeDivisionType` (line 540) | `match` on exact `kirtan`/`gurmukhi`, fallback to `str_contains(class_name, 'kirtan')` | ✅ Detected (class name match) | ✅ Detected (class name match) |
| `FeesController::normalizeDivisionType` (line 201) | `match` with `str_contains` on both type and class name | ✅ Detected | ✅ Detected |

**Business impact:** A class with `type='Kirtan Class'` will be classified as Kirtan in the dashboard but as Gurmukhi in the Student Performa. The Student Performa will show the student in the Gurmukhi block with Kirtan attendance (which is impossible because Kirtan attendance is Sunday-only and Gurmukhi attendance is non-Sunday), but more importantly the **per-day status merge** will operate on Gurmukhi + Kirtan enrollments merged together because the split put them all in Gurmukhi.

### 6.2 Fee calculation diverges

| Source | Reads | Re-resolves via MonthlyFeeResolver? |
|---|---|---|
| `ReportController::buildStudentReport` (`$buildFees`) | `fees.amount` as stored | ❌ |
| `FeesController::index` | `fees.amount` as stored | ❌ |
| `DashboardController::buildOverall` | `fees.amount` as stored | ❌ |
| `PendingFeesController` | `MonthlyFeeResolver` for prefix sums | ✅ |
| `GenerateMonthlyFees` | `MonthlyFeeResolver` to create fees | ✅ |

The Student Performa is consistent with the Fees report and the dashboard in *not* re-resolving. But the **Pending Fees Setup utility** can re-price historical monthly fees, and the **Fee Rate Period controller** also re-prices historical unpaid monthly fees. After either of those, the `fees.amount` no longer matches what `MonthlyFeeResolver` would compute. The report shows the re-priced (or original) value depending on which path mutated the data.

**Business impact:** A student whose fee was re-priced in March 2026 (because a new rate period started) will see the new amount for that month, but the Student Performa shows that re-priced amount only if the unpaid monthly fee record was updated. If the fee was already paid, the original amount is frozen.

### 6.3 Attendance percentage diverges

| Source | Denominator | Year filter? |
|---|---|---|
| `ReportController::buildStudentReport` (line 810) | `present + absent + leave` (marked days) | Full year |
| `ReportController::buildAttendanceReport` (line 438) | Same | Optional year/month |
| `ReportController::buildAttendanceCalendar` | (no percentage emitted) | Month only |
| `DashboardController::buildOverall` (line 88) | Same | Selected years |
| `LateFeeSummaryController` | n/a (fees only) | n/a |
| `Absentees` page | streak-based, no percentage | 30-day default |
| `Accountant/AttendanceSummaryController` (line 60-65) | streak-based | Last working day |

The Student Performa is consistent with the reports and dashboard. The Absentees and AttendanceSummary use a different model (streaks) and are not directly comparable. **No internal inconsistency, but the metric choice (marked days vs school days) is a system-wide weakness.**

### 6.4 Paid status logic

| Source | Logic | Notes |
|---|---|---|
| `ReportController::buildStudentReport` (`$buildFees`) | `EXISTS(payments WHERE fee_id=fees.id AND deleted_at IS NULL)` | ✅ |
| `ReportController::buildFeesReport` (line 144-148) | `whereNotNull('payments.id')` after a `leftJoin` filtered on `deleted_at IS NULL` | ✅ |
| `FeesController::index` (line 99-105) | `whereNotNull('payments.id')` after a `leftJoin` filtered on `deleted_at IS NULL` | ✅ |
| `LateFeeSummaryController` (line 26) | `whereDoesntHave('payments', deleted_at IS NULL)` | ✅ |
| `PendingFeesController` (line 67-69) | `whereColumn + COUNT(*) > 0` after join with `deleted_at IS NULL` | ✅ |

All five implementations agree. ✅ **This is a healthy area of the codebase.**

### 6.5 Month filter semantics

| Source | `month_from`/`month_to` filter | Applied to |
|---|---|---|
| `ReportController::buildStudentReport` (`$buildFees`) | `month >= from AND month <= to` (string compare) | Monthly fees only (custom always included) |
| `ReportController::buildFeesReport` | `month = YYYY-MM` (single month) | Monthly fees only |
| `FeesController::index` | `whereBetween('fees.month', [$from, $to])` | Monthly fees only |

**Divergence:** `FeesController::index` uses `whereBetween` which is equivalent to `month >= from AND month <= to`. ✅ Same behaviour.

**No internal inconsistency, but the user has no signal that custom fees are not filterable by month.**

### 6.6 Year filter semantics

| Source | Logic | Cross-year? |
|---|---|---|
| `ReportController::buildStudentReport` | `month LIKE 'Y-%'` (line 673) | ❌ Anchored to year |
| `ReportController::buildFeesReport` | `(type=monthly AND month LIKE 'Y-%') OR type=custom` | ❌ Anchored to year |
| `FeesController::index` | `(type=monthly AND month LIKE 'Y-%') OR (type=custom)` | ❌ Anchored to year |
| `DashboardController::applyFeeYearFilter` | Three branches: source=monthly, source=NULL, source=custom | Custom fees filtered by `created_at` year |

**Divergence:** The dashboard filters custom fees by `created_at` year. The reports include all custom fees regardless of year. **The Student Performa matches the reports (not the dashboard).** This is a pre-existing inconsistency; the Student Performa is on the consistent side with the other reports.

---

## 7. Bug Inventory

Each bug is listed with a severity, the code path, the reproducible example, and the business impact.

### Critical (B-) — Incorrect visible output

#### B-01  Free student shows pending monthly fees
- **Severity:** CRITICAL
- **Code:** `ReportController.php:668-721` (`$buildFees`)
- **Repro:** Free Gurmukhi student with `assumed_pending_months=3` set in Pending Fees Setup.
- **Impact:** Admin sees "Pending Rs. 1,800" for a free student. False liability.

#### B-02  DemoFeeSeeder creates fees in a format the reports cannot read
- **Severity:** CRITICAL (for any fresh install using the seeder)
- **Code:** `database/seeders/DemoFeeSeeder.php:33-42`
- **Repro:** `db:seed --class=SchoolSetupSeeder && db:seed --class=DemoFeeSeeder`. Open Student Performa for any Gurmukhi student.
- **Impact:** Empty fees section. Admin cannot tell if the student has no fees or if the seeder is broken.

#### B-03  React screen shows current month, PDF shows full selected year
- **Severity:** CRITICAL
- **Code:** `Student.jsx:352-455` (`AttendanceCalendar`) vs `student.blade.php:178-182, 227-231` (calendar partial)
- **Repro:** Select year=2024. Build. Click Export PDF. Compare.
- **Impact:** Two different reports from one user action.

#### B-04  Kirtan performance rating reflects marking discipline, not student performance
- **Severity:** CRITICAL (per school-management intent)
- **Code:** `ReportController.php:820-842`
- **Repro:** Kirtan student attends 30 Sundays. Teacher ticks `lesson_learned` on 0. Rating = "Needs Improvement".
- **Impact:** All Kirtan students are likely to be "Needs Improvement" regardless of actual performance.

#### B-05  Attendance percentage uses marked days as denominator
- **Severity:** CRITICAL (systemic)
- **Code:** `ReportController.php:810-812` (and the dashboard, fees report, etc.)
- **Repro:** Student with 100 days marked present, 5 absent. Percentage = 95.24% even though they have ~310 potential school days.
- **Impact:** The percentage is high (or low) depending on marking discipline, not actual attendance.

#### B-06  Screen and PDF show different `month_from`/`month_to` filter effects
- **Severity:** CRITICAL (UI consistency)
- **Code:** React doesn't display fees filtered by month range at all — see B-11.
- **Repro:** Set `month_from=2026-04, month_to=2026-06`. Build screen vs. PDF.
- **Impact:** The user cannot tell if their filter is being applied.

### High (B-) — Likely future production issues

#### B-07  Same engine runs twice for every PDF export
- **Severity:** HIGH
- **Code:** `Student.jsx:78-95` + `ReportController::exportPdf` (line 326-380)
- **Impact:** 2x query load for every PDF download. No cache.

#### B-08  `console.log(report.gurmukhi.fees)` in render
- **Severity:** HIGH (privacy / log noise)
- **Code:** `Student.jsx:167`
- **Impact:** Every admin who opens DevTools sees the full report payload printed to console.

#### B-09  React crashes if `attendance.calendar` is missing or has no current-month key
- **Severity:** HIGH (UX crash)
- **Code:** `Student.jsx:369-377`
- **Repro:** Run report for a student with no attendance in the current month. Or for a student enrolled only in Kirtan but a user picks a year before any attendance was recorded.
- **Impact:** A friendly fallback message is shown — but the entire calendar block is hidden, hiding the actual data for the year.

#### B-10  `LegacyAttendanceCalendar` is dead code
- **Severity:** HIGH (maintainability)
- **Code:** `Student.jsx:221-347`
- **Impact:** Future developers will be confused why two calendar components exist. They may delete the wrong one.

#### B-11  Screen does not show `month_from`/`month_to` fee filter at all
- **Severity:** HIGH
- **Code:** `Student.jsx:551-663` (`FeesSection`)
- **Repro:** Build with `month_from=2026-04, month_to=2026-06`. Screen shows all 12 months of fees; PDF shows only Q2. The filter is silently ignored on screen.
- **Impact:** User confusion.

#### B-12  React looks up `attendance.year` which is never set
- **Severity:** HIGH
- **Code:** `Student.jsx:365`, `Student.jsx:246` (`LegacyAttendanceCalendar`)
- **Impact:** `reportYear` falls back to `new Date().getFullYear()`. The selected year is ignored on the calendar.

#### B-13  Division detection uses a literal `'kirtan'` string compare
- **Severity:** HIGH
- **Code:** `ReportController.php:633-641`
- **Impact:** Classes with `type='Kirtan Class'` or `type=NULL` are misclassified. The dashboard and Fees report handle these; the Student Performa does not.

#### B-14  React page does not render `report.kirtan.performance` when student is not enrolled in Kirtan
- **Severity:** HIGH
- **Code:** `Student.jsx:206-208` (`SummaryCards`)
- **Repro:** Run report for a Gurmukhi-only student. Kirtan SummaryCard shows `Rs. 0 0% (Needs Improvement)`. Misleading.
- **Impact:** Admin sees a "0% Needs Improvement" badge for a student not in Kirtan.

### Medium (B-) — Edge cases / latent issues

#### B-15  `from > to` check uses string compare; cross-year ranges are still lexicographically safe
- **Severity:** LOW
- **Code:** `ReportController.php:607-609`
- **Status:** Verified — `'YYYY-MM'` strings sort correctly across years. No bug, but worth a comment for future maintainers.

#### B-16  `fees.month LIKE 'Y-%'` is not anchored
- **Severity:** LOW
- **Code:** `ReportController.php:673`
- **Impact:** In practice, no impact (months are always `'YYYY-MM'` format). But the LIKE pattern is unanchored at the end; a malformed value like `'2026-1A'` would match.

#### B-17  `logger()->info(...)` in production
- **Severity:** LOW
- **Code:** `ReportController.php:590, 643, 703`
- **Impact:** Three log lines per report build, including all fee rows. Logs bloat; potentially leaks PII.

#### B-18  The `fees.type = 'custom'` filter does not respect `student_sections.student_type`
- **Severity:** LOW
- **Code:** `ReportController.php:675`
- **Impact:** A free student with custom fees (possible? yes — `FeesController::storeCustomFee` does not check `student_type`) will have those custom fees shown. This is debatable — a free student could be assigned a custom fee (e.g. uniform) intentionally.

#### B-19  `summary-label` class is defined in the partial but not always used
- **Severity:** LOW
- **Code:** `student.blade.php:114, 121` — uses class but the partial CSS for the partial is loaded inline; the main template's CSS is also inline. They don't conflict but they are duplicated.

#### B-20  `report` URL omits `month_from`/`month_to` for students with all-fees-included custom fees
- **Severity:** LOW
- **Code:** `Student.jsx:123-124` — the PDF form always sends `month_from` and `month_to` even if null, **but** the value would be the JS string `"null"`, not PHP `null`. The PDF form code at line 124 reads the JS value and only appends if `val == null` → so null is correctly omitted. ✅ Verified. No bug.

#### B-21  `fees.title` is `null` for monthly fees; React shows `Monthly Fee` text but PDF shows `null`
- **Severity:** LOW
- **Code:** `student.blade.php:138` — `{{ $row->title }}` for monthly fees (where title is null) prints empty cell.
- **Impact:** PDF shows empty `<td>Monthly Fee</td>` content for monthly rows. Should print "Monthly Fee" or the resolved amount description.

#### B-22  Attendance calendar partial's `$showLesson` flag is hardcoded
- **Severity:** LOW
- **Code:** `student.blade.php:181, 230`
- **Impact:** Cannot toggle lesson ✓ for non-Kirtan divisions even if the data exists.

#### B-23  No defensive check that `$student->id` matches `$request->student_id`
- **Severity:** LOW
- **Code:** `ReportController.php:614-616`
- **Impact:** If `students.id` is somehow not found (shouldn't happen due to `exists:students,id` validation), `null->id` is referenced on line 644. PHP will throw an error. But the validation makes this unreachable.

---

## 8. Architectural Weaknesses

### 8.1 No service layer
`buildStudentReport` is 280 lines of inline closures, raw Query Builder, and Carbon math. There is no `StudentReportService`, no `StudentReportBuilder`, no value objects. **The Student Performa is the most complex report in the system and the only one without a service.** Other reports (`buildFeesReport`, `buildAttendanceReport`) are also inline, but the Student Performa is the only one with cross-table joins, divisions, calendar generation, and rating logic.

### 8.2 Not in `ReportRegistry`
`ReportRegistry` lists `fees` (implemented), `attendance` and `students` (commented as future). The Student Performa is **already implemented but not registered**. The registry is the only place that documents filter/column metadata — by being absent, the Student Performa has no machine-readable description of its inputs and outputs.

### 8.3 Two calendar components on the React side
`LegacyAttendanceCalendar` and `AttendanceCalendar` both render attendance. The active one is the new component. The legacy is dead. This is a maintenance hazard — see B-10.

### 8.4 Closures inside controller method
`$buildFees`, `$buildAttendance`, `$evaluatePerformance` are PHP closures created inside `buildStudentReport`. They capture `$year`, `$yearStart`, `$yearEnd`, `$request` via `use`. This makes the method hard to unit-test (you cannot inject a fake `buildAttendance`).

### 8.5 No caching layer
Every call to `buildStudentReport` runs 6 queries. A user who clicks "Build" then "Export PDF" runs 12. There is no `Cache::remember` wrapper.

### 8.6 No request validation in a FormRequest
Validation is inline (`$request->validate([...])` at line 600). For a report endpoint, this is fine, but the `month_from` and `month_to` format check is `nullable|string` — not `nullable|date_format:Y-m`. A malformed value like `"2026-13"` would pass validation and be passed to the query.

### 8.7 The whole engine assumes the fee table is in `YYYY-MM` format
This is implicit. The `LateFeeSummaryController` defensively normalises month strings; the Student Performa does not. The seeder writes `'F Y'`. **The defensive normalisation is a sign the invariant is not enforced.**

### 8.8 The Calendar is built in PHP, not the database
For 1 student, this is fine. For a class-level or school-level report, the same 372-iteration loop would need to run 50+ times. **A SQL-based calendar (one row per student-day) would be more efficient** if scaled.

### 8.9 Logging in production
`logger()->info(...)` (lines 590, 643, 703) emits three log entries per report, including all fee rows. This is debug code left in production. Should be wrapped in a debug check (`config('app.debug')`) or removed.

### 8.10 No telemetry on the report
There is no metric for "report generation time" or "report failures". A future regression (e.g. a bad query) would not be detected until a user complains.

---

## 9. Recommended Fixes (by priority)

### 9.1 P0 — Fix the broken output

**Fix A: Hide Kirtan SummaryCard for non-Kirtan students** (B-14)
- File: `Student.jsx:204-208`
- Code: check `report.kirtan.attendance.summary.present + absent + leave > 0` (or a more explicit `kirtanEnrolled` flag) before rendering.
- Effort: 5 minutes.

**Fix B: Show the selected year and month range on screen** (B-12, B-11)
- File: `Student.jsx`
- Add a year/month range header to `<FeesSection>` and `<AttendanceCalendar>`.
- Effort: 30 minutes.

**Fix C: Use `LegacyAttendanceCalendar` (or rewrite `AttendanceCalendar` to iterate `attendance.calendar`)** (B-03, B-12)
- File: `Student.jsx:352-455`
- The simplest fix: delete `AttendanceCalendar` and rename `LegacyAttendanceCalendar` to `AttendanceCalendar`. Then remove the `reportYear = attendance.year ?? new Date().getFullYear()` fallback because the calendar's `calendar` map already contains all months.
- Effort: 5 minutes.

**Fix D: Add `student_sections.student_type` to the fee filter for free students** (B-01)
- File: `ReportController.php:668-697`
- Add a guard: if all sections for the student are `free`, skip the monthly fees and only show custom fees.
- Effort: 30 minutes.
- Better: show the `student_type` for each fee row so the admin can see "free student, this is a custom fee only".

**Fix E: Add `date_format:Y-m` validation for `month_from` and `month_to`** (8.6)
- File: `ReportController.php:600-605`
- Effort: 2 minutes.

### 9.2 P1 — Fix the systemic issues

**Fix F: Re-resolve fee amounts via `MonthlyFeeResolver`** (3.2, 6.2)
- Decide policy first: "show historical amount" or "show current rate".
- If "current rate": re-call `MonthlyFeeResolver::resolveForMonth($enrollment, $fee->month)` for each monthly row and overwrite the displayed amount.
- If "historical amount": keep the current behaviour but document it.
- Effort: 1 hour (depending on policy decision).

**Fix G: Use the same division detection as the rest of the system** (6.1)
- File: `ReportController.php:633-641`
- Replace with: `$classType = strtolower(trim($row->class_type)); $isKirtan = $classType === 'kirtan' || str_contains($classType, 'kirtan') || str_contains(strtolower($row->class_name ?? ''), 'kirtan');`
- Or extract `DashboardController::normalizeDivisionType` to a shared helper in `app/Support/` and reuse.
- Effort: 30 minutes.

**Fix H: Anchor the `fees.month LIKE 'Y-%'` pattern** (B-16)
- File: `ReportController.php:673`
- Replace with `where('fees.month', 'like', $year . '-__')` (anchored at the start, wildcard on the right is still risky). Or use `whereBetween('fees.month', ["{$year}-01", "{$year}-12"])` for clearer semantics.
- Effort: 10 minutes.

**Fix I: Add caching for the report output** (8.5, B-07)
- Wrap `buildStudentReport` in `Cache::remember("student-report:{$studentId}:{$year}:{$from}:{$to}", 300, fn() => ...)`.
- Invalidate on payment events (`Cache::forget` in `FeePaymentController::store`, `FeesController::collect`, `FeesController::deCollect`).
- Effort: 1 hour.

### 9.3 P2 — Architectural improvements

**Fix J: Extract a `StudentReportService`** (8.1, 8.4)
- Move `$buildFees`, `$buildAttendance`, `$evaluatePerformance` to `app/Services/StudentReportService.php`.
- Return value objects: `StudentReportData`, `DivisionReportData`, `FeesSectionData`, `AttendanceSectionData`, `PerformanceData`.
- Effort: 4 hours.

**Fix K: Register the Student Performa in `ReportRegistry`** (8.2)
- Add a `student` key to `ReportRegistry::all()` with filter and column metadata.
- Effort: 1 hour.

**Fix L: Remove `console.log` and `logger()->info`** (B-08, 8.9)
- File: `Student.jsx:167`, `ReportController.php:590, 643, 703`
- Effort: 2 minutes.

**Fix M: Add `date_format:Y-m` validation, and a test that asserts the engine handles malformed input** (8.6)
- Effort: 30 minutes including the test.

---

## 10. Quick Wins (≤ 30 minutes each, ordered by impact)

1. **Remove `console.log`** in `Student.jsx:167` — 1 minute, fixes a privacy/log-noise issue.
2. **Use `LegacyAttendanceCalendar`** (or fix `AttendanceCalendar`) to show all 12 months on screen — 5 minutes, fixes B-03, B-12, B-11 simultaneously.
3. **Add `date_format:Y-m` validation** for `month_from`/`month_to` — 2 minutes, fixes 8.6.
4. **Hide Kirtan SummaryCard for non-Kirtan students** — 5 minutes, fixes B-14.
5. **Anchor the `fees.month LIKE` pattern** — 10 minutes, fixes B-16.
6. **Remove `logger()->info`** calls in the controller — 2 minutes, fixes 8.9 / B-17.
7. **Show the year and month-range as a header on screen** — 15 minutes, fixes B-11 / B-12.
8. **Extract a shared `normalizeDivisionType` helper** and use it in the Student Performa — 30 minutes, fixes 6.1 / B-13.

Total: ~70 minutes of work that fixes 6 critical bugs and 1 architectural inconsistency.

---

## 11. Long-Term Refactoring Plan (Phase 2 work)

### 11.1 Refactor the engine into a service layer

1. Create `app/Services/StudentReport/StudentReportService.php` with three injected dependencies: `MonthlyFeeResolver`, `FeePaymentStatusResolver` (new), `AttendanceCalendarBuilder` (new).
2. Move the closures out of the controller.
3. Add a `StudentReportCache` wrapper that memoises by `(student_id, year, from, to)`.
4. Add a `Cache::forget` in `FeePaymentController::store`, `FeesController::collect`, `FeesController::deCollect`, `FeesController::storeCustomFee`, `FeeRatePeriodController::storeForClass`, `FeeRatePeriodController::storeForSection`.

### 11.2 Define value objects

- `StudentReport` (immutable, returned by the service)
- `DivisionReport` (Gurmukhi or Kirtan)
- `FeesSection`
- `AttendanceSection`
- `PerformanceSection` (Kirtan only)

The Blade template and the React page both consume the same value object. This makes screen/PDF divergence impossible.

### 11.3 Compute the calendar in SQL

Replace the 372-iteration PHP loop with a single SQL query:

```sql
WITH days AS (
  SELECT 1 AS day UNION ALL SELECT 2 ... SELECT 31
),
months AS (
  SELECT 1 AS m UNION ALL SELECT 2 ... SELECT 12
),
student_days AS (
  SELECT m, d FROM months, days
)
SELECT
  sd.m, sd.d,
  -- status precedence
  CASE
    WHEN MAX(CASE WHEN a.status='present' THEN 1 ELSE 0 END) = 1 THEN 'present'
    WHEN MAX(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) = 1 THEN 'leave'
    WHEN MAX(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) = 1 THEN 'absent'
    ELSE NULL
  END AS status,
  -- lesson learned
  MAX(CASE WHEN a.lesson_learned = 1 THEN 1 ELSE 0 END) AS lesson_learned
FROM student_days sd
LEFT JOIN attendance a
  ON a.student_section_id IN (...)
  AND a.date = DATE(sd.year || '-' || sd.m || '-' || sd.d)
GROUP BY sd.m, sd.d
```

This is one query per division, returning 372 rows. The PHP loop is replaced by a `keyBy` and an `indexBy`. Performance scales linearly with the number of attendance rows, not with the number of student sections.

### 11.4 Re-resolve fee amounts via `MonthlyFeeResolver` (with a policy decision)

Add a config flag `student_report.re_resolve_fees` (default `false`). When `true`, the engine overwrites `fees.amount` with `MonthlyFeeResolver::resolveForMonth($enrollment, $fee->month)`. This makes the report show "what the fee would be today" rather than "what was charged". The default `false` preserves current behaviour.

### 11.5 Add tests

- A unit test for `buildStudentReport` with: a free student, a paid student, a student with two Gurmukhi sections, a student with one Kirtan section, a student with both divisions, a student with custom fees, a student with mixed paid/unpaid fees, a student with no attendance, a student with a year that has no fees.
- A test that asserts screen and PDF render the same data (snapshot test of the JSON payload vs the rendered HTML).
- A test for division detection with `type='Kirtan Class'`, `type=NULL`, and class-name fallbacks.

### 11.6 Register the report

Add the `student` key to `ReportRegistry::all()` with full filter/column metadata. Refactor the React page to consume this metadata so future reports can be added without touching the page.

### 11.7 Move the calendar to a sub-component

Currently the screen has two calendar components; consolidate to one. Move to `resources/js/Components/AttendanceMiniCalendar.jsx` for reuse by the dashboard, absentees page, and Student Performa.

---

## Appendix A — Files Audited

| File | Role |
|---|---|
| `app/Http/Controllers/Admin/ReportController.php` | All three report engines; the Student Performa is `buildStudentReport` (lines 588-870) |
| `resources/js/Pages/Admin/Reports/Student.jsx` | The admin UI for the Student Performa |
| `resources/views/reports/student.blade.php` | The PDF template |
| `resources/views/reports/partials/attendance-calendar.blade.php` | The 12-month grid partial shared with the PDF |
| `resources/js/Components/MultiSelect.jsx` | The dropdown used for student/year/month selection |
| `app/Http/Controllers/Admin/DashboardController.php` | Reference for `normalizeDivisionType` (line 540) and the dashboard's fee/attendance math |
| `app/Http/Controllers/Admin/FeesController.php` | Reference for the "is paid" pattern and division detection (line 201) |
| `app/Http/Controllers/Accountant/LateFeeSummaryController.php` | Reference for `normalizeFeeMonth` (the only defensive helper) |
| `app/Services/MonthlyFeeResolver.php` | The single source of truth for fee amounts |
| `app/Console/Commands/GenerateMonthlyFees.php` | The system that creates monthly fees |
| `database/seeders/DemoFeeSeeder.php` | Source of the `F Y` format bug (B-02) |
| `database/seeders/SchoolSetupSeeder.php` | Source of seeded class types |

## Appendix B — One-page executive summary (for the principal)

The Student Performa Report has **6 critical bugs** that produce incorrect visible output:

1. **Free students with monthly pending fees** — a free student appears to owe money they don't owe.
2. **Demo data is invisible** — the seeder writes monthly fees in a format the report cannot read.
3. **Screen shows the current month, PDF shows the full year** — two different reports from one click.
4. **Kirtan performance rating reflects teacher discipline, not student performance** — most Kirtan students will be marked "Needs Improvement" regardless of their actual performance.
5. **Attendance percentage is computed against marked days, not school days** — a student who was never marked absent appears at 100%.
6. **The `month_from`/`month_to` filter is applied to the PDF but not to the on-screen view** — the user cannot see the filter is being applied.

Plus 13 additional bugs of lower severity and 7 architectural weaknesses.

**Recommended immediate action:** apply the 8 Quick Wins in §10 (~70 minutes of work). **Recommended medium-term action:** the architectural refactor in §11 (1–2 days of work). The engine is salvageable; the data model is sound; the bugs are in the controller and the React page, not in the schema.

---

*End of audit.*
