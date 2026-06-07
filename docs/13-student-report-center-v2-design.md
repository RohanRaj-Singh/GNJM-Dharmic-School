# 13 — Student Report Center V2 — Product, Architecture & Implementation Plan

> **Audience.** Engineering leads, product owner, school principal, and any future agent asked to "build V2".
>
> **Posture.** Opinionated. Where the audit found bugs, this document assumes they are addressed. Where the audit found design weaknesses, this document recommends a direction. Where the brief asks me to challenge existing assumptions, I do.
>
> **Scope.** This is a design document, not a patch. Nothing here is "implement this line change" — it is "build this system". Implementation is phased (§16).

---

## Executive Summary

The current Student Performa is a single, year-locked, screen-PDF-divergent report that treats fees, attendance, and Kirtan performance as three independent widgets stitched together. It cannot answer the questions a school actually needs: *"Has this student improved over time? Is this family a consistent payer? What is this student's attendance pattern over the last two years?"*

**V2 replaces the Performa with a Student Report Center** — a single engine that produces a family of report outputs from a shared query layer. The center supports:

- **Five report types** (Performance, Attendance, Fees, Annual Progress, Student History), each as a tab inside the same UI.
- **A unified filter system** (year / multi-year / month / month range / quick presets).
- **A single engine** (`StudentReportCenterService`) that returns a `StudentReport` value object — the same shape is consumed by the React preview and the PDF.
- **A redesigned PDF** with cover page, identity block, division sections, analytics blocks, and a paginated calendar grid.
- **A redesigned React UI** with filter presets, tabbed report types, and inline previews.

The single most important architectural change: **the report engine is read-only and pure**. It takes a `StudentReportRequest` value object and returns a `StudentReport` value object. No closures inside controller methods. No raw Query Builder in controllers. No Eloquent in the engine. The engine is unit-testable in isolation.

The single most important product change: **Gurmukhi and Kirtan are always separate sections, never merged**. A student in both divisions gets both sections side by side. The user never sees a fused view.

The single most important calendar change: **the calendar grid is generated from the selected range, not from "the year"**. A Jan 2025 → Mar 2025 selection produces 3 calendars. A Jan 2025 → Jun 2026 selection produces 18 calendars, chronologically ordered, never grouped by year.

---

## 1. Problems With Current Report

The forensic audit (`docs/12-student-performa-forensic-audit.md`) catalogued 23 bugs and 7 architectural weaknesses. The four that drive this redesign:

| # | Problem | Why it forces a redesign |
|---|---|---|
| 1 | Year-locked, no multi-year, no month-range filter applied to the screen | A modern report must answer historical questions. |
| 2 | Screen and PDF render different time windows | They must share a single source of truth. |
| 3 | Closures inside the controller, no service layer, no caching | Cannot test, cannot scale, cannot extend. |
| 4 | Division detection diverges from the rest of the system | A single helper must own this concept. |

The remaining 19 bugs are all fixable, but fixing them inside the current shape would leave a fragile system. The right move is to replace the shape.

---

## 2. Student Report Center V2 — Vision

### 2.1 Product vision (one paragraph)

A school administrator opens the Student Report Center, picks a student, picks a time range (or a preset), picks a report type, and immediately sees — both on screen and in a PDF — a structured, paginated, analytics-rich report that answers the specific question implied by the report type. The same engine powers all five report types. The PDF is always a faithful rendering of the screen. The engine is cached, the data is consistent, the calendar is generated only for the months in range, and the divisions are always separate.

### 2.2 Naming

- **Product name:** Student Report Center.
- **Internal module:** `StudentReportCenter` (route prefix, controller namespace, service namespace).
- **File location of this design:** `docs/13-student-report-center-v2-design.md`.

### 2.3 Non-goals

- We are **not** building a full BI / OLAP system. No drag-and-drop dimensions, no arbitrary pivots. The five report types below are the entire surface.
- We are **not** building a chart library. A few simple SVG bar charts (status distribution, monthly fee trend) are sufficient; the school does not need D3.
- We are **not** changing the underlying schema. New tables are limited to **report presets** and **report cache invalidation tracking**. The current `students`, `student_sections`, `attendance`, `fees`, `payments` tables are sufficient.
- We are **not** exposing the engine to parents in this phase. The center is admin-only.

---

## 3. Recommended Report Types

Five report types, organised as tabs in the same UI. Each is a different "view" of the same `StudentReport` value object.

### 3.1 Performance Report (default)

The closest analogue to the current Performa, but with the calendar in the right place, the fee analytics block expanded, and the Kirtan rating rebuilt. **Single year** is the default. **Multi-year** is supported. **Month range** is supported (e.g. "Q2 of 2026 only").

Sections inside the PDF:
1. Student identity block.
2. Performance summary (Gurmukhi + Kirtan side by side).
3. Attendance analytics.
4. Fee analytics.
5. Kirtan performance (Kirtan only).
6. Calendar grid (only the months in the selected range).
7. Page footer.

### 3.2 Attendance Report

A focused deep-dive on attendance. **Default range: last 12 months.** The Performance Report's attendance section is a subset of this.

Sections:
1. Student identity block.
2. Attendance summary cards (total, present, absent, leave, %).
3. Streak analysis (longest present streak, longest absent streak, current streak).
4. Monthly trend (12 mini bar charts, one per month in range, showing P/A/L distribution).
5. Day-of-week distribution (which day of the week is most missed).
6. Consistency score (variance-based metric — see §6.4).
7. Calendar grid (full grid for the range).

### 3.3 Fee Report

A focused deep-dive on fees. **Default range: current academic year.** Like the Attendance Report, this is a deep-dive of one block of the Performance Report.

Sections:
1. Student identity block.
2. Fee summary (charged, paid, pending, collection rate, fee health score).
3. Payment timeline (chronological list of payments with running balance).
4. Outstanding months list.
5. Custom fees detail.
6. Monthly fee trend (bar chart of charged vs paid per month in range).
7. Historical rate changes (if any fee rate periods were active during the range).

### 3.4 Annual Progress Report

A **fixed-format** report for a single academic year. Designed to be printed and signed. This is the report the principal will hand to a parent at the end of the year.

Sections:
1. Cover page (school logo, principal signature line, generated date).
2. Student identity block.
3. Year-at-a-glance (one row per month: present, absent, leave, %).
4. Annual fee statement (one row per month: charged, paid, pending).
5. Performance rating (Gurmukhi: attendance-based; Kirtan: attendance + lesson-learned).
6. Principal's remark (free-text, signature line).
7. Parent's acknowledgement (signature line).

The "Principal's remark" is a new field stored in a small `student_annual_remarks` table. See §13.

### 3.5 Student History Report

A **multi-year** report covering a student's full enrollment at the school. **Default range: enrollment date → today.** Designed for the rare case where a student is leaving or transferring.

Sections:
1. Student identity block + enrollment history.
2. Multi-year attendance trend (one bar per year, P/A/L counts).
3. Multi-year fee trend (one bar per year, charged/paid/pending).
4. Section/class history.
5. Status changes timeline (active → inactive, paid → free, etc.).
6. Year-by-year summary (one block per academic year).

### 3.6 What I am NOT recommending

- **Multi-Year Comparison Report.** Tempting, but the same data is reachable via the History Report. Avoid a sixth tab.
- **Transfer Summary Report.** A specific subset of the History Report. Use a filter on the History Report ("only show periods where student was in section X").
- **Custom Report Builder.** Out of scope. The five report types cover all questions the school needs. Adding a builder doubles the surface area and the test matrix.

---

## 4. Filter System Design

### 4.1 Unified filter shape

A single `StudentReportRequest` value object encapsulates all filters. Built once, validated once, passed to the engine.

```php
final class StudentReportRequest
{
    public function __construct(
        public readonly int $studentId,
        public readonly string $rangeMode,         // 'year' | 'month' | 'range'
        public readonly ?int $singleYear,          // for rangeMode='year' (e.g. 2026)
        public readonly ?string $singleMonth,      // for rangeMode='month' ('YYYY-MM')
        public readonly ?string $rangeStart,       // for rangeMode='range' ('YYYY-MM')
        public readonly ?string $rangeEnd,         // for rangeMode='range' ('YYYY-MM')
        public readonly string $divisionFilter,    // 'all' | 'gurmukhi' | 'kirtan'
        public readonly string $reportType,        // 'performance' | 'attendance' | 'fees' | 'annual' | 'history'
    ) {}
}
```

**Why a value object:** the controller, the engine, the cache key, and the React form all consume the same shape. The shape is testable in isolation.

### 4.2 Validation

| Field | Rule |
|---|---|
| `studentId` | required, exists in `students` |
| `rangeMode` | required, in {year, month, range} |
| `singleYear` | required when `rangeMode='year'`, integer, 2000..currentYear+1 |
| `singleMonth` | required when `rangeMode='month'`, format `YYYY-MM`, month 1..12 |
| `rangeStart` / `rangeEnd` | required when `rangeMode='range'`, format `YYYY-MM`, start ≤ end, range ≤ 36 months |
| `divisionFilter` | required, in {all, gurmukhi, kirtan} |
| `reportType` | required, in the five types above |

The **36-month cap** is the most important rule. A user picking Jan 2020 → Dec 2026 will get a 7-year report, which the calendar grid will not render in a single PDF (and the engine will be slow). The cap is enforced server-side and surfaced in the UI as a hint.

### 4.3 React form

The current form is a flat list of `MultiSelect` widgets. V2 replaces it with a **two-row filter bar**:

```
[Student: Gurmukhi · A ] [Range: Quick Preset ▾] [Range: Custom ▾] [Division: All ▾] [Type: Performance ▾] [Build]
```

Quick presets populate the custom range:

| Preset | Resolves to |
|---|---|
| Current Year | `rangeMode='year', singleYear={currentYear}` |
| Last 12 Months | `rangeMode='range', rangeStart={today-12mo.format('YYYY-MM')}, rangeEnd={currentMonth.format('YYYY-MM')}` |
| Current Academic Year | `rangeMode='range', rangeStart='YYYY-04', rangeEnd='(YYYY+1)-03'` (April–March, configurable) |
| This Quarter | `rangeMode='range', rangeStart={quarterStart}, rangeEnd={currentMonth}` |
| Custom | `rangeMode='range'` + free-form pickers |

### 4.4 URL state

The filter is encoded in the query string so a built report is shareable:

```
/admin/student-report-center?student=42&range=range&start=2025-01&end=2026-06&division=all&type=performance
```

The page reads the query string on mount and pre-populates the form. Pressing "Build" updates the query string via Inertia's `router.replace`. This is a major UX improvement over the current state.

---

## 5. Calendar System

### 5.1 The 5-months-or-18-months rule

The audit found that the React page renders the current month while the PDF renders the full year. V2 fixes this by **generating one calendar per month in the selected range, on the server, in the value object**. The React page and the PDF both iterate the same `months[]` list.

For `rangeMode='year'`, `months[]` is 12 entries.
For `rangeMode='month'`, `months[]` is 1 entry.
For `rangeMode='range'`, `months[]` is the literal month count (e.g. 18 for Jan 2025 → Jun 2026).

```php
// app/Support/StudentReport/MonthRange.php
final class MonthRange
{
    /** @return list<array{year:int, month:int, label:string}> */
    public static function expand(string $start, string $end): array
    {
        $startDt = Carbon::createFromFormat('Y-m', $start)->startOfMonth();
        $endDt   = Carbon::createFromFormat('Y-m', $end)->startOfMonth();
        $months = [];
        for ($d = $startDt->copy(); $d->lte($endDt); $d->addMonth()) {
            $months[] = [
                'year'  => (int) $d->year,
                'month' => (int) $d->month,
                'label' => $d->format('M Y'),     // "Jan 2025"
            ];
        }
        return $months;
    }
}
```

This is unit-testable. The same function is used by the calendar builder, the trend charts, the PDF header, and the React `monthOptions` source.

### 5.2 Calendar layout in the PDF

The audit's "3 per row" grid is fine for a single year. For 18 months, "3 per row" gives 6 rows of 3, which is OK in A4 portrait. For 36 months, "4 per row" on A4 landscape is better. **V2 picks the layout dynamically based on the count:**

| Month count | Layout | Orientation |
|---|---|---|
| 1 | 1 × 1 (centered) | A4 portrait |
| 2–3 | 1 row | A4 portrait |
| 4–6 | 2 × 3 | A4 portrait |
| 7–12 | 3 × 4 (current) | A4 portrait |
| 13–24 | 4 × 6 (smaller fonts) | A4 landscape |
| 25–36 | 4 × 9 (smaller fonts) | A4 landscape |

### 5.3 Calendar cell content

The current cell shows: date number, status (P/A/L), and optionally ✓. V2 adds: **the fee status for that day** (a small dot in the cell corner: green = paid that day, yellow = pending, grey = no fee). This is a small change but turns the calendar from a passive attendance log into a **correlation view** — the principal can see "the student was marked absent on the same day the family's payment was due".

This requires a join between attendance and payments. The engine performs a single grouped query:

```sql
SELECT
  date,
  status,
  lesson_learned,
  EXISTS(
    SELECT 1 FROM payments
    JOIN fees ON fees.id = payments.fee_id
    WHERE fees.student_section_id IN (...)
      AND DATE(payments.paid_at) = attendance.date
      AND payments.deleted_at IS NULL
  ) AS paid_today
FROM attendance
WHERE student_section_id IN (...)
  AND date BETWEEN ? AND ?
```

The `paid_today` flag is then mapped to a small colored dot in the cell.

### 5.4 Calendar in the React preview

The audit flagged that the React page shows only the current month. V2 shows **all months in the range, paginated**. A "1 of 3" navigator at the top lets the user move through pages of 3 months each. The PDF still renders all months; the React preview paginates for screen readability.

---

## 6. Attendance Analytics

### 6.1 Metrics to include

I recommend the following eight metrics. Each is a value the engine can compute in a single pass over the attendance rows.

| Metric | Definition | Why it matters | Value or noise? |
|---|---|---|---|
| Total days marked | count of `(student_section_id, date)` rows | raw denominator | ✅ needed |
| Present | count of status='present' | basic | ✅ needed |
| Absent | count of status='absent' | basic | ✅ needed |
| Leave | count of status='leave' | basic | ✅ needed |
| Attendance % | present / (present+absent+leave) | basic, but the audit's complaint stands: it uses marked days, not school days | ⚠ keep, with footnote |
| **School days attendance %** | present / school_days_in_range | the audit's recommended fix | ✅ **new** |
| Longest present streak | max consecutive `present` days in range | a streak metric | ✅ valuable |
| Longest absent streak | max consecutive `absent` days in range | a streak metric | ✅ valuable |
| Current streak | from the most recent marked day backward | parents want this | ✅ valuable |
| Most-missed day of week | the weekday with the highest absent rate | actionable | ✅ valuable |
| Monthly trend | per-month P/A/L bar | visual | ✅ valuable |
| **Consistency score** | 1 - (variance of monthly attendance %) | a single number, 0..100, that captures "stable" vs "erratic" attendance | ✅ **new** |
| Attendance heatmap | a year-as-rows weekday-as-columns grid with cell colors | optional visual | ❌ skip — too much for one report |

The audit recommended an attendance heatmap. I disagree: a 12-month × 7-day grid is information-dense but low-signal. The monthly trend is more useful. Drop the heatmap.

### 6.2 The new "school days attendance %"

The current % uses marked days. The new % uses **school days** as the denominator, where a school day is:

- A non-Sunday day for Gurmukhi (Mon–Sat).
- A Sunday for Kirtan.

The engine computes school-day count by iterating the range and applying the day-type rule. For the Performance Report, the rule is applied per-division. For a multi-division student, the school-day count is per-division.

This is a one-line change in the engine. The downside is that the dashboard and the Fees report still use the old %. **In V2, I introduce a `student_attendance_percentage` helper in `app/Support/`** that returns both numbers, and migrate the other two callers to use it in a follow-up. This is documented in §17.

### 6.3 Streak metrics

The current "absentees" page computes a streak ending at the most recent marked day, going backward, breaking on the first non-matching status. V2 generalises this to:

- **Longest present streak:** scan all marked days, track the longest run of `present`.
- **Longest absent streak:** same, for `absent`.
- **Current streak:** from the most recent day, going backward, breaking on a non-matching status. Returned as `{status, length, start_date, end_date}`.

These are computed in a single pass over the attendance rows. The algorithm is the same as the Absentees page's, but generalised.

### 6.4 Consistency score

A single number (0..100) measuring how stable the student's attendance is. Definition:

```
monthly_percentages = [jan, feb, ..., dec]
mean = avg(monthly_percentages)
variance = avg((m - mean)^2 for m in monthly_percentages)
stdev = sqrt(variance)
consistency = max(0, 100 - stdev * 2)   // simple, tunable
```

A student with 100% every month has `stdev=0, consistency=100`. A student alternating 100%/0% has `stdev=50, consistency=0`. The `×2` scaling is a tunable parameter (default 2, configurable). This is a derived metric; it can be wrong in edge cases (1 month of data → stdev is always 0 → consistency=100). Add a "minimum 3 months" gate.

### 6.5 Most-missed day of week

For each weekday, compute `absent_rate = absent_on_weekday / marked_on_weekday`. The day with the highest rate is the "most missed". Useful for the principal to spot patterns (e.g. "this student is always absent on Mondays → family travel pattern").

### 6.6 Monthly trend

A small inline SVG bar chart per month. 12 charts, one per month in range. Each chart is 4 bars: P, A, L, plus a thin line for the % threshold. Rendered in the React preview as inline SVG; in the PDF as the same SVG, since DomPDF supports inline SVG.

---

## 7. Fee Analytics

### 7.1 Metrics to include

| Metric | Definition | Value or noise? |
|---|---|---|
| Total charged | sum of `fees.amount` for the range | ✅ |
| Total paid | sum of `payments.amount_paid` for non-deleted payments in range | ✅ |
| Pending | charged - paid | ✅ |
| **Collection rate** | paid / charged * 100 | ✅ **new** — the audit called this out |
| Monthly fee count | count of `type='monthly'` rows | ✅ |
| Custom fee count | count of `type='custom'` rows | ✅ |
| Outstanding months | months with `monthly` fee where no non-deleted payment exists | ✅ **new** |
| First unpaid month | earliest outstanding month | ✅ **new** |
| Last unpaid month | latest outstanding month | ✅ **new** |
| Days since last payment | today - max(paid_at) | ✅ **new** |
| **Fee health score** | 0..100 derived from collection rate + recency + outstanding count | ✅ **new** — see §7.4 |
| Payment timeline | list of {date, amount, fee_title} | ✅ **new** |
| Monthly trend | per-month charged vs paid | ✅ |

### 7.2 Custom fees detail

A separate sub-block listing every custom fee in range, with:
- Title, amount, status (paid/unpaid/locked), paid_at (if paid).

This answers the parent's common question: "what are these extra charges for?"

### 7.3 Payment timeline

A chronological list of payments, with a running balance. Useful for "I paid Rs. 600 in March, why does it show unpaid?" — the timeline makes it clear.

```
2025-04-15  Paid Rs. 600  (Monthly Fee — April 2025)
2025-05-10  Paid Rs. 600  (Monthly Fee — May 2025)
2025-06-12  Paid Rs. 600  (Monthly Fee — June 2025)
            ── 1 month outstanding ──
2025-08-01  Pending Rs. 600  (Monthly Fee — July 2025)
```

### 7.4 Fee Health Score

A single 0..100 number. Definition:

```
collection_component = (paid / charged) * 60        // 60% weight
recency_component    = max(0, 40 - days_since_last_payment / 30 * 10)  // 40% weight, decays after 30 days
fee_health_score     = collection_component + recency_component
```

A student whose family pays on time and has no outstanding months scores 100. A family with a 3-month outstanding period scores ~30. A free student with no fees scores 0 (the score is suppressed in the UI for free students — see §11.4).

The score is a "first cut" — not authoritative. It is displayed with the formula visible in a tooltip, so an admin can verify the math.

### 7.5 Historical rate changes

If the range spans a fee rate period change, the report shows a small table:

```
Period            Monthly Rate
2025-01 → 2025-12  Rs. 500
2026-01 → ongoing  Rs. 600
```

This is a transparency feature — it shows the family exactly when the rate changed, so the bill is not a surprise.

---

## 8. Kirtan Performance

### 8.1 The current model is weak

The audit's B-04 finding is correct: a Kirtan student whose teacher never ticks `lesson_learned` scores 0%. The metric is broken.

### 8.2 What we can salvage from existing data

Only two data points are reliably available:

- Attendance (present/absent/leave counts).
- `lesson_learned` boolean per attendance row.

There is no "participation", "practice", or "homework" data in the system. Adding that data requires schema changes (§13) and is **out of scope** for V2's first release.

### 8.3 The V2 scoring model

A weighted combination of two inputs, with a defensive fallback:

```
attendance_score = present / (present + absent + leave) * 100
lesson_score     = lessons_learned / present * 100    // % of presents where a lesson was logged

kirtan_score = (attendance_score * 0.6) + (lesson_score * 0.4)
```

The key change: **the lesson component is normalised by `present`, not by total**. If the teacher ticks 100% of presents, the student gets full marks for lessons. If the teacher never ticks, the lesson component is 0, but the attendance component still counts for 60%. A Kirtan student who attends every Sunday gets at least 60.

### 8.4 Rating buckets

| Score | Rating |
|---|---|
| ≥ 85 | Excellent |
| ≥ 70 | Good |
| ≥ 50 | Average |
| < 50 | Needs Improvement |

(Same as V1, but the math is different.)

### 8.5 Defensive handling for missing data

If `present = 0`, the score is 0, the rating is "Needs Improvement", and the UI shows a footnote: *"No attendance recorded in the selected range."* This is honest and prevents the silent-zero bug.

### 8.6 Future-proofing

A future V3 can extend this model with `participation` and `practice_consistency` columns, both 0..10 ratings entered by the teacher. The model is structured to allow those additions without breaking the V2 contract. The V2 contract is: `{score, rating, components: {attendance, lesson, ...}}` — the `components` map can grow.

---

## 9. Student Identity Section

### 9.1 Redesigned header

The current PDF header is school info + student name + father name. V2 expands it:

```
┌──────────────────────────────────────────────────────────┐
│ STUDENT IDENTITY                                          │
├──────────────────────────────────────────────────────────┤
│ Name           Gurpreet Singh                             │
│ Student ID     42                                         │
│ Status         Active                                     │
│ Student Type   Paid                                       │
│ Division       Gurmukhi + Kirtan                          │
│ Current Class  Gurmukhi (Section A)                       │
│                Kirtan  (Tabla)                            │
│ Father         Jaswinder Singh                            │
│ Enrollment     2023-04-12                                 │
│ Report Date    2026-06-07                                 │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Status values

The audit noted that `students.status` is `active`/`inactive`. The system also has the conceptual statuses "graduated", "transferred", "dropped" but does not store them. **V2 introduces a `student_statuses` enum:**

| Value | Display | When |
|---|---|---|
| `active` | Active | Default |
| `inactive` | Inactive | Admin toggled |
| `graduated` | Graduated | End of academic year, admin-set |
| `transferred` | Transferred | Family moved schools, admin-set |
| `dropped` | Dropped | Stopped attending, admin-set |

The status field becomes an enum on the `students` table. **No new table needed** — the existing `status` string column accepts any of these values. The change is at the application level. See §13 for the migration.

### 9.3 Should we show status history?

**Yes**, but only in the History Report, not the Performance Report. The Performance Report shows current status; the History Report shows a timeline.

```sql
CREATE TABLE student_status_history (
    id BIGINT PRIMARY KEY,
    student_id BIGINT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at DATETIME NOT NULL,
    changed_by_user_id BIGINT,
    reason TEXT,
    INDEX (student_id, changed_at)
);
```

This is the **only new table** V2 needs. Every status change (including paid↔free) writes a row. The History Report reads it.

### 9.4 Enrollment date

V2 stores `students.enrollment_date DATE` (a new nullable column). If null, the engine uses the earliest `student_sections.created_at`. The column is backfilled from existing data in the migration.

---

## 10. PDF Layout Design

### 10.1 Page sequence (Performance Report)

```
┌──────────────────────────────────────────────────────────┐
│ PAGE 1: COVER                                             │
│   - School logo (centered)                                │
│   - School name + motto + address                         │
│   - "STUDENT REPORT" + report type                       │
│   - Generated date + report ID (for audit trail)          │
│   - Principal signature line                              │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ PAGE 2: IDENTITY + DIVISION SUMMARY                       │
│   - Identity block (see §9.1)                             │
│   - For each division:                                    │
│     - Summary cards (attendance, fees, performance)       │
│   - Filter summary (range used, presets, custom range)    │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ PAGES 3..N: GURMUKHI DEEP-DIVE                            │
│   - Attendance analytics block                            │
│   - Fee analytics block                                   │
│   - Calendar grid (only Gurmukhi months in range)         │
│   - Per-month trend (mini bar charts)                     │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ PAGES N+1..M: KIRTAN DEEP-DIVE                            │
│   - Attendance analytics block                            │
│   - Fee analytics block                                   │
│   - Kirtan performance score + components                 │
│   - Calendar grid (only Kirtan months in range)           │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ FINAL PAGE: FOOTER                                        │
│   - Disclaimer ("This report is computer-generated...")   │
│   - Page numbering                                        │
│   - Audit trail (who generated, when, with which params)   │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Section ordering — opinionated

The order above is deliberate:

1. **Cover page** gives the report institutional weight.
2. **Identity + summary** lets a parent scan the headline in 30 seconds.
3. **Per-division deep-dive** is where the detail lives.
4. **Footer** provides audit trail.

I considered putting fee data first (because the school cares about money) and attendance first (because the school cares about learning). I chose **attendance first, fees second, performance third** because attendance correlates with everything else, and a parent who sees a "you owe Rs. 5,400" page before seeing "your child attended 85% of the time" will react to the money. The order nudges the parent to engage with the data, not the bill.

### 10.3 Page breaks

DomPDF does not respect CSS page-break reliably. V2 uses **explicit page-break blocks** via `<div style="page-break-before: always;">` between sections, and `<table style="page-break-inside: avoid;">` to keep calendar grids intact.

### 10.4 Charts

Inline SVG, hand-written. The trend bar chart is a 60-line PHP helper. The same SVG is reused in the React preview (React renders SVG as a component, not a string). This guarantees the screen and PDF render the same chart.

### 10.5 Print quality

- A4 portrait default. Landscape for 13+ month ranges.
- Margins: 15mm.
- Font: DejaVu Sans (already in use).
- Logo: `resources/images/logo.png` (already in use).
- Minimum font size: 8pt (so 18-month calendar grids stay readable).

---

## 11. React UI Redesign

### 11.1 Layout

The current page is a single scroll. V2 introduces a **two-pane layout**:

```
┌──────────────────────────────────────────────────────────┐
│ HEADER: Student Report Center                             │
├──────────────────────────────────────────────────────────┤
│ FILTER BAR                                                │
│ [Student] [Range ▾] [From] [To] [Division] [Type] [Build]│
├────────────────┬─────────────────────────────────────────┤
│ LEFT PANE      │ RIGHT PANE                                │
│ (250px)        │ (flex)                                    │
│                │                                            │
│ Tabs:          │ Preview of selected report type           │
│  · Performance │                                            │
│  · Attendance  │ Same data as the PDF, paginated           │
│  · Fees        │ for screen reading.                        │
│  · Annual      │                                            │
│  · History     │ [Print] [Export PDF] [Save Preset]         │
│                │                                            │
│ Presets:       │                                            │
│  · Current Yr  │                                            │
│  · Last 12mo   │                                            │
│  · Academic Yr │                                            │
│                │                                            │
└────────────────┴─────────────────────────────────────────┘
```

### 11.2 Filter UX flow

1. User picks a student. The right pane shows "Select a student to begin".
2. User picks a range (preset or custom). The right pane shows "Pick a range".
3. User picks a report type. The right pane shows the preview.
4. User clicks "Build". The right pane shows loading; the URL updates with the encoded filter.
5. User clicks "Export PDF". A new tab opens with the PDF.

This is a **lazy build** — the right pane only renders the report after a "Build" click. The current page builds the report automatically on filter change, which is wasteful.

### 11.3 Validation

Client-side validation in the React form:

- `rangeStart` ≤ `rangeEnd`.
- `rangeEnd` - `rangeStart` ≤ 36 months.
- `student` must be selected.

Server-side validation in the form request (defence in depth). The 36-month cap is enforced server-side and the error is shown in the filter bar.

### 11.4 Free student handling

If a student is `free`, the Fees panel shows:
- "This student is exempt from monthly fees."
- Only custom fees (if any) are listed.
- The Fee Health Score is suppressed.
- The Collection Rate is N/A.

If a student is `paid`, all fee analytics are shown.

This is a small but important UX change: **the report respects the student type**.

### 11.5 Empty states

Every section has a deliberate empty state:

- No fees in range: "No fee records in this range."
- No attendance: "No attendance recorded in this range."
- Student not enrolled in selected division: "Student is not enrolled in Gurmukhi."
- Student has no Kirtan enrollment: the Kirtan section is hidden entirely (not "empty").

### 11.6 Quick actions

- **Print** — uses the browser's print dialog on the preview pane, with a print stylesheet that mirrors the PDF.
- **Export PDF** — existing functionality, now uses a stable URL.
- **Save Preset** — saves the current filter as a named preset (e.g. "Q2 2026 only"). Stored in `report_presets` (the existing-but-unused `ReportPreset` model gets its first real use).
- **Load Preset** — dropdown of saved presets.

---

## 12. Edge Case Handling

| # | Edge case | Expected behaviour |
|---|---|---|
| 1 | Student changed section mid-year | History Report shows section transitions. Performance Report uses the **current** section in the identity block. Attendance is split: pre-transition in old section, post-transition in new section. Both segments appear in the calendar. |
| 2 | Student changed class | Same as section change. The identity block shows the current class. History Report shows the transition. |
| 3 | Student changed division (e.g. moved from Gurmukhi to Kirtan) | History Report shows the transition. The old division appears in the historical section; the new division appears in the current section. **Never merged.** |
| 4 | Student became inactive mid-year | The calendar still shows attendance for the active period. The inactive period shows "—" with a footnote: "Student was inactive from {date}." |
| 5 | Student moved from Paid → Free | Fee analytics shows: charged and paid up to the transition date; "Exempt from this date" after. The "Pending" for the post-transition period is suppressed. |
| 6 | Student moved from Free → Paid | Fee analytics shows: no fees during the free period; charged and (potentially) paid after the transition. |
| 7 | Missing attendance (date not marked) | Calendar cell shows "—" in light grey. Not counted in P/A/L. The school-days-attendance-% uses the school-days count as denominator, so missing days are correctly counted as "not present". |
| 8 | Missing fee records (e.g. free student, or no monthly generation) | "No fee records in this range." Section is rendered with the empty state, not omitted. |
| 9 | Historical fee rate change | A small "Rate changes" table shows the periods and amounts active during the range. The fee rows show the amount as charged (the historical value). |
| 10 | Multi-year report (>1 year range) | Range cap is 36 months. The "Academic Year" preset is the longest natural range. If a user really wants a 5-year report, they export it as two PDFs. |
| 11 | Empty months (range covers a month with no school days, e.g. summer break) | Calendar cell shows the month header but no day cells. Footer: "No school days in {month name}." |
| 12 | No attendance in selected range | "No attendance recorded in this range." Performance score is "Not enough data". Calendar is empty. |
| 13 | No fees in selected range | "No fee records in this range." Fee Health Score is suppressed. |
| 14 | Student with both divisions but only one has data | The empty division is rendered with an empty state, not hidden. The user sees the full picture. |
| 15 | Inactive student | The report is generated, but the cover page shows a yellow stripe: "INACTIVE STUDENT — {inactive since date}". The report is still valid historically. |
| 16 | Future-dated range (e.g. end month is in the future) | Accepted. The report shows "—" for future months. This is useful for planning (e.g. "what will the bill look like in 6 months?"). |
| 17 | Range entirely in the past before the student enrolled | "No data — student enrolled on {date}." |
| 18 | Concurrent edits (admin changes a fee while report is open) | The report is built on demand. A new Build click refreshes. The PDF download fetches a fresh report. There is no stale-cache bug because the cache is keyed by filter + invalidated on writes (§15.4). |

---

## 13. Database Changes

V2 is deliberately schema-light. The only mandatory changes:

### 13.1 New table: `student_status_history`

```sql
CREATE TABLE student_status_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_at DATETIME NOT NULL,
    changed_by_user_id BIGINT NULL,
    reason TEXT NULL,
    INDEX idx_student_status_student_date (student_id, changed_at),
    CONSTRAINT fk_student_status_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
```

**Backfill:** for each existing student with `status='active'`, insert a row with `old_status=NULL, new_status='active', changed_at=created_at`. For students with `status='inactive'`, insert two rows (active on creation, inactive on updated_at).

### 13.2 New column: `students.enrollment_date`

```sql
ALTER TABLE students ADD COLUMN enrollment_date DATE NULL AFTER status;
```

**Backfill:** for each student, set `enrollment_date = MIN(student_sections.created_at)`.

### 13.3 New column: `student_sections.transferred_at` (optional but recommended)

```sql
ALTER TABLE student_sections ADD COLUMN transferred_at DATETIME NULL;
```

Allows tracking section transitions. If null, the enrollment is current. If set, it ended at that date. **This is the only way to correctly attribute historical attendance to historical sections.**

**Backfill:** for existing `student_sections` rows, `transferred_at = NULL` (current).

### 13.4 New column: `student_sections.transferred_to_student_section_id` (optional)

For audit trail: "this enrollment ended because the student moved to section X".

### 13.5 Use of the existing `ReportPreset` model

The model already exists. V2 uses it:

```sql
-- The model already declares: name, report_type, filters (json), columns (json), user_id
-- We need a migration to make sure the table exists with the right shape
CREATE TABLE report_presets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    filters JSON NOT NULL,
    columns JSON NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    INDEX idx_report_presets_user (user_id)
);
```

**No change** to other tables. The existing `payments`, `fees`, `attendance`, `student_sections` schema is sufficient.

### 13.6 Status enum

The `students.status` column is a `string`. V2 keeps it as a string (no DB-level enum) but documents the valid values in code:

```php
// app/Support/Student/StudentStatus.php
enum StudentStatus: string
{
    case Active     = 'active';
    case Inactive   = 'inactive';
    case Graduated  = 'graduated';
    case Transferred = 'transferred';
    case Dropped    = 'dropped';

    public function label(): string
    {
        return match($this) {
            self::Active     => 'Active',
            self::Inactive   => 'Inactive',
            self::Graduated  => 'Graduated',
            self::Transferred => 'Transferred',
            self::Dropped    => 'Dropped',
        };
    }
}
```

This is a PHP enum, not a DB constraint. The DB stays flexible.

---

## 14. Backend Architecture

### 14.1 Layered design

```
Routes (routes/admin.php)
  └─ StudentReportCenterController  (thin: parse, validate, dispatch)
       └─ FormRequest (StudentReportCenterRequest)
       └─ StudentReportCenterService
            ├─ IdentityResolver           (loads student + enrollment history)
            ├─ AttendanceResolver          (loads + summarises attendance)
            ├─ FeeResolver                 (loads + summarises fees)
            ├─ CalendarBuilder             (generates month cells)
            ├─ StreakCalculator            (longest streaks, current streak)
            ├─ ConsistencyScoreCalculator  (variance-based)
            ├─ FeeHealthScoreCalculator    (collection + recency)
            ├─ KirtanScoreCalculator       (attendance + lesson)
            ├─ MonthRange                  (utility: expand YYYY-MM range to months[])
            └─ ReportCache                 (Cache::remember wrapper)
       └─ StudentReport value object
            └─ returned to controller
                 ├─ Inertia::render('Admin/StudentReportCenter/Preview', ...)
                 └─ Pdf::loadView('reports.student_center', ...)
```

### 14.2 The value object

```php
final class StudentReport
{
    public function __construct(
        public readonly StudentIdentity $identity,
        public readonly DateRange $range,
        public readonly array $divisions,  // [DivisionReport]
        public readonly array $meta,
    ) {}

    public function toArray(): array { /* for Inertia */ }
}

final class StudentIdentity {
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly ?string $fatherName,
        public readonly StudentStatus $status,
        public readonly StudentType $studentType,        // 'paid' | 'free'
        public readonly array $enrollments,              // [Enrollment]
        public readonly ?Carbon $enrollmentDate,
        public readonly ?string $divisionLabel,          // 'Gurmukhi', 'Kirtan', 'Gurmukhi + Kirtan'
    ) {}
}

final class Enrollment {
    public function __construct(
        public readonly int $studentSectionId,
        public readonly string $className,
        public readonly string $sectionName,
        public readonly Division $division,              // 'gurmukhi' | 'kirtan'
        public readonly ?Carbon $startedAt,
        public readonly ?Carbon $transferredAt,
    ) {}
}

final class DivisionReport {
    public function __construct(
        public readonly Division $division,
        public readonly AttendanceAnalytics $attendance,
        public readonly FeeAnalytics $fees,
        public readonly ?KirtanPerformance $kirtanPerformance,  // Kirtan only
        public readonly array $months,                          // [MonthCalendar]
    ) {}
}

final class MonthCalendar {
    public function __construct(
        public readonly int $year,
        public readonly int $month,
        public readonly string $label,                // 'Jan 2025'
        public readonly array $days,                  // [day => DayCell]
    ) {}
}

final class DayCell {
    public function __construct(
        public readonly int $day,
        public readonly ?AttendanceStatus $status,    // null = no record
        public readonly bool $lessonLearned,
        public readonly bool $paidToday,
    ) {}
}
```

### 14.3 Pure service contract

The service has **no Laravel facades** in its method bodies. It accepts a `StudentReportRequest`, returns a `StudentReport`. Database access is via constructor-injected repositories (interfaces). This makes the service testable with in-memory fakes.

```php
interface AttendanceRepositoryInterface {
    /** @return list<AttendanceRow> */
    public function forStudentInRange(int $studentId, DateRange $range, Division $division): array;
}

interface FeeRepositoryInterface {
    /** @return list<FeeRow> */
    public function forStudentInRange(int $studentId, DateRange $range, Division $division): array;
    /** @return list<PaymentRow> */
    public function paymentsForFees(array $feeIds): array;
}
```

The default implementations are Eloquent-backed. Tests inject in-memory fakes.

### 14.4 Caching strategy

```php
final class ReportCache
{
    public function key(StudentReportRequest $req): string
    {
        return sprintf(
            'student-report:%d:%s:%s:%s:%s:%s',
            $req->studentId,
            $req->rangeMode,
            $req->singleYear ?? 'null',
            $req->singleMonth ?? 'null',
            $req->rangeStart ?? 'null',
            $req->rangeEnd ?? 'null',
        );
    }

    public function remember(StudentReportRequest $req, Closure $build): StudentReport
    {
        return Cache::remember($this->key($req), now()->addMinutes(10), fn() => $build());
    }

    public function forget(int $studentId): void
    {
        // Tag-based forget: would need a cache tag system; for now, flush by pattern.
        // Pragmatic: just flush all student-report:* keys for the student.
        // A real implementation uses Redis SCAN with MATCH, or Laravel cache tags.
    }
}
```

**Cache invalidation points:**

- `FeePaymentController::store` — `ReportCache::forget($studentId)`.
- `FeesController::collect` — same.
- `FeesController::deCollect` — same.
- `FeesController::storeCustomFee` / `updateCustomFee` / `destroyCustomFee*` — same.
- `FeeRatePeriodController` (any period mutation that re-prices fees) — same.
- `AttendanceController::store` — `ReportCache::forget($studentId)`.
- `AdminAttendanceController::save` — same.
- `StudentSection` create/update/delete (transitions, type changes) — same.

The current system has **none** of this invalidation. Adding it is one of the highest-impact, lowest-effort improvements.

### 14.5 Logging

The audit flagged `logger()->info(...)` calls. V2 removes all three and replaces with a single `Log::info` at the engine boundary, gated by `config('app.debug')`. Production logs are clean.

---

## 15. API Design

### 15.1 One endpoint, multiple response types

The current `ReportController::build` is a single endpoint with a `report` discriminator. V2 keeps the same shape but tightens it:

```
POST /admin/student-report-center/build
  Body: {
    student_id: int,
    range_mode: 'year' | 'month' | 'range',
    single_year: ?int,
    single_month: ?'YYYY-MM',
    range_start: ?'YYYY-MM',
    range_end: ?'YYYY-MM',
    division: 'all' | 'gurmukhi' | 'kirtan',
    report_type: 'performance' | 'attendance' | 'fees' | 'annual' | 'history',
  }
  Response: 200 OK
  {
    identity: {...},
    range: {...},
    divisions: [...],
    meta: {generated_at, cache_key, ttl_seconds}
  }
```

Errors: 422 with field-level errors, 403 (wrong role), 404 (student not found), 413 (range too long).

### 15.2 PDF endpoint

```
POST /admin/student-report-center/export/pdf
  Body: same as build, plus optional `orientation: 'portrait' | 'landscape'`
  Response: application/pdf, streamed inline
```

### 15.3 Preset endpoints

```
GET    /admin/student-report-center/presets         -> list user's presets
POST   /admin/student-report-center/presets         -> save a preset
DELETE /admin/student-report-center/presets/{id}    -> delete a preset
```

The existing `ReportPreset` model is used as-is.

### 15.4 Cache invalidation webhook (optional)

For external systems that need to know a report has been invalidated:

```
POST /internal/cache/invalidate
  Body: { student_id: int }
  Headers: X-Internal-Token: {shared secret}
```

This is out of scope for V2's first release.

---

## 16. Migration Strategy

### 16.1 Phase 0 — Foundation (1 week)

1. Add `students.enrollment_date` and backfill.
2. Add `student_status_history` table and backfill.
3. Add `student_sections.transferred_at` and `transferred_to_student_section_id` (nullable).
4. Create `ReportCache` class.
5. Add cache invalidation hooks to existing controllers (FeePayment, FeesController, FeeRatePeriod, Attendance, Student bulk update).
6. Wrap `buildStudentReport` in `Cache::remember` (5-minute TTL).
7. **No UI change yet.** The existing Student Performa continues to work; the cache makes it faster.

### 16.2 Phase 1 — Service layer (1 week)

1. Define the value objects (`StudentReport`, `StudentIdentity`, `DivisionReport`, `MonthCalendar`, `DayCell`, etc.).
2. Define the repository interfaces.
3. Implement the Eloquent-backed repositories.
4. Implement `StudentReportCenterService` with pure logic.
5. Write unit tests for the calculators (Streak, Consistency, FeeHealth, Kirtan).
6. Add a feature test: build a report for a seeded student, snapshot the JSON output.

The existing controller continues to work; the new service is the new code path.

### 16.3 Phase 2 — New React page (1 week)

1. Create `resources/js/Pages/Admin/StudentReportCenter/Index.jsx` (the new UI).
2. Implement the filter bar, two-pane layout, and lazy build.
3. Implement the preview components: identity block, summary cards, attendance analytics, fee analytics, calendar grid.
4. Add preset save/load.
5. Add a navigation entry in `AdminLayout` sidebar: "Reports → Student Center".
6. Keep the old `/admin/reports/student` page **live in parallel** for 2 weeks.

### 16.4 Phase 3 — PDF rewrite (1 week)

1. Create `resources/views/reports/student_center/cover.blade.php`, `identity.blade.php`, `division_summary.blade.php`, `attendance_analytics.blade.php`, `fee_analytics.blade.php`, `kirtan_performance.blade.php`, `calendar_grid.blade.php`, `footer.blade.php`.
2. Update `ReportController::exportPdf` to use the new service and the new view.
3. Test the PDF on edge cases: 1 month, 12 months, 18 months, 36 months, free student, no-attendance student, multi-division student.

### 16.5 Phase 4 — Decommission (1 day)

1. Remove the old `/admin/reports/student` route and React page.
2. Remove the old `buildStudentReport` method.
3. Update `ReportRegistry` to register the new "Student Report Center" with the five report types.
4. Update `AdminLayout` sidebar to remove the old "Student Report" link and add "Student Report Center".

### 16.6 Phase 5 — Annual Progress + History (1 week)

1. Add the `student_annual_remarks` table.
2. Implement the Annual Progress Report end-to-end.
3. Implement the Student History Report end-to-end.
4. Add a "remark" UI in the admin student page (one textarea per academic year).
5. End-to-end test for both reports.

### 16.7 Phase 6 — Hardening (1 week)

1. Cross-year fee rate change tests.
2. Multi-division student tests.
3. Free student tests.
4. Inactive student tests.
5. Load test: 100 concurrent report builds.
6. Documentation update: `docs/13-...` (this file) becomes the new architectural reference; `docs/12-...` is archived as "v1 audit".

---

## 17. Quick Wins (1-2 day scope, before the full V2)

The full V2 is 6-8 weeks. The Quick Wins are the highest-impact changes that can ship in 1-2 days and that the audit identified as critical.

| # | Quick win | Effort | Fixes |
|---|---|---|---|
| QW-1 | Use `LegacyAttendanceCalendar` as the active component (or rewrite `AttendanceCalendar` to iterate the full calendar map) | 30 min | B-03, B-12, B-11 |
| QW-2 | Add `date_format:Y-m` validation for `month_from`/`month_to` | 5 min | 8.6 |
| QW-3 | Remove `console.log` in `Student.jsx:167` | 1 min | B-08 |
| QW-4 | Remove `logger()->info` calls in `ReportController.php:590, 643, 703` | 2 min | 8.9 |
| QW-5 | Hide Kirtan SummaryCard when student has no Kirtan enrollment | 30 min | B-14 |
| QW-6 | Add `student_sections.student_type` check in the fee filter (skip monthly fees for free students, show only custom) | 1 hr | B-01 |
| QW-7 | Anchor the `fees.month LIKE 'Y-%'` pattern with `whereBetween('fees.month', ['Y-01', 'Y-12'])` | 10 min | B-16 |
| QW-8 | Extract `normalizeDivisionType` to a shared helper and use it in the Student Performa | 1 hr | 6.1, B-13 |
| QW-9 | Fix the `DemoFeeSeeder` to use `YYYY-MM` format | 5 min | B-02 |
| QW-10 | Add `Cache::remember` around `buildStudentReport` and invalidate on payment/attendance changes | 2 hrs | 8.5, B-07 |
| QW-11 | Add an empty-state message for empty fee rows in the PDF | 15 min | 5.7 |
| QW-12 | Add a server-side cap of 36 months on the range filter | 30 min | n/a (forward-looking) |

**Total: 1-2 days of focused work, fixes 12 critical issues.**

---

## 18. Long-Term Roadmap (post-V2)

After V2 ships, the following are natural follow-ups. I list them in priority order.

### 18.1 Multi-student bulk reports (3-6 months)

- "Generate report cards for the entire class" — picks all students in a class, generates one PDF per student, zips them.
- Performance: requires the per-student caching from §14.4 to be solid; without it, generating 30 reports takes 30× the time.

### 18.2 Parent portal (6-12 months)

- Expose the Performance Report (read-only) to parents via a tokenised link.
- The same engine powers both admin and parent views. Parent views hide admin-only fields.
- Requires an auth layer separate from the current session auth.

### 18.3 Scheduled email reports (6-12 months)

- "Email every parent their child's monthly report on the 1st of the month."
- Uses Laravel's queue + scheduler + a `student_report_jobs` table.
- Builds on the engine without changing the engine.

### 18.4 Comparison reports (12+ months)

- "Compare this student's progress to the class average."
- Requires aggregating attendance/fee data at the class level. The current engine is per-student; a comparison would be a different engine.
- Not on the V2 critical path.

### 18.5 Custom field builder (12+ months)

- School-specific fields (e.g. "Gurmukhi exam score", "Kirtan competition participation").
- A schema-versioned `student_extension_data` table with JSON values.
- This is a major schema change and should not be done in V2.

### 18.6 SMS / WhatsApp notifications (12+ months)

- The `father_phone` and `mother_phone` columns are already there.
- "Your child was absent today" → SMS via Twilio.
- "Your fee is overdue" → WhatsApp via the WhatsApp Business API.
- This is a feature, not a report, but the report is the natural UI for the admin to trigger it.

---

## 19. Opinionated Decisions — Where I Challenged the Brief

The brief asked me to challenge assumptions. I did, in five places:

### 19.1 "Custom Report Builder" — declined

The brief listed a "Custom Report Builder" as a possible report type. I am not building one. The five report types in §3 cover every question the school will ask. A builder would multiply the test matrix, the UI surface, and the support burden, for no clear product gain. If a future need emerges (e.g. "show me a report with the columns these parents want"), V3 can add it.

### 19.2 "Multi-Year Comparison Report" — declined as a separate type

Same reasoning. The History Report covers multi-year data. A "Comparison" report is a subset of the History Report with a filter. Not worth a sixth tab.

### 19.3 "Attendance Heatmap" — declined

The audit recommended a year-as-rows weekday-as-columns heatmap. I disagree. The monthly trend is more useful (one bar per month, not 52 rows). The heatmap is information-dense but low-signal. If a future user asks for it, the data is already in the engine.

### 19.4 "Multi-year report = years grouped" — rejected

The brief's example said "Jan 2025 → Jun 2026 = 18 calendars". I confirmed this in §5.1. The implementation must **not** group by year. The user picks a range; the engine produces a flat list of months in chronological order. The PDF layout engine handles the visual grouping.

### 19.5 "Status: graduated / transferred / dropped" — implemented as enum, not migration

I considered a separate `student_statuses` table with a foreign key. The existing `students.status` column is a `string` and already accepts any value. The new statuses are added at the application level via a PHP enum. The schema stays clean; the type safety is in the code. If a future need requires status metadata (e.g. "graduated on date X"), the `student_status_history` table covers that.

---

## 20. Closing

V2 is a 6-8 week project with a clear shape. The Quick Wins (§17) deliver 80% of the visible quality improvement in 1-2 days. The architecture (§14) is testable, cacheable, and extensible. The five report types (§3) cover the school's needs without overbuilding. The PDF (§10) feels institutional. The React UI (§11) is modern, shareable, and preset-driven. The edge cases (§12) are enumerated, not assumed away. The migration (§16) is phased and reversible.

The single most important thing V2 does that V1 does not: **it makes the data shape authoritative, not the controller**. The value object is the contract. The screen and the PDF are consumers. The cache is a layer. The repository is the boundary. The math is in pure functions. Every layer is independently testable.

That is the report system this school should have.
