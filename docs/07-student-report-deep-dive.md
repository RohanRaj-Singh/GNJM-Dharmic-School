# 07 — Student Report (Performa) — Deep Dive

The audit subject. Read [06-reports-system.md](06-reports-system.md) first for cross-report context, [04-database-schema.md](04-database-schema.md) for the underlying tables, and [08-business-rules.md](08-business-rules.md) for cross-cutting rules.

## 7.1 Surface

- **Page:** `resources/js/Pages/Admin/Reports/Student.jsx`
- **Blade template:** `resources/views/reports/student.blade.php` (+ `partials/attendance-calendar.blade.php`)
- **Engine:** `App\Http\Controllers\Admin\ReportController::buildStudentReport` (private)
- **Build entry:** `POST /admin/reports/build` with body `{report: "student", student_id, year, month_from?, month_to?}`
- **PDF entry:** `POST /admin/reports/export/pdf` with the same body
- **Access:** Admin only (parent route group is `role:admin`)

## 7.2 Inputs

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `report` | string | ✅ | `required\|string` | value must be `student` |
| `student_id` | int | ✅ | `required\|integer\|exists:students,id` | Loaded from `/admin/students/list` |
| `year` | int | ✅ | `required\|integer` | UI offers currentYear-3..currentYear+1 |
| `month_from` | `YYYY-MM` | ❌ | `nullable\|date_format:Y-m` | UI dropdown |
| `month_to` | `YYYY-MM` | ❌ | `nullable\|date_format:Y-m` | server checks `from ≤ to` |

Server returns `422 Invalid month range` when `from > to`.

## 7.3 Data sources

The engine reads **only** the following tables/views:

| Source | How it's read | Used for |
|---|---|---|
| `students` | `DB::table('students')->where('id',$id)->first()` | student name + father name |
| `student_sections` (joined `classes`) | `DB::table('student_sections')->join('classes', ...)->where('student_id',$id)->select('student_sections.id as student_section_id', 'LOWER(classes.type) as class_type')` | Splitting Gurmukhi vs Kirtan enrollments |
| `fees` (where `type='monthly'` OR `type='custom'`) | `whereIn('fees.student_section_id', $sectionIds)` + year/month range | Fee rows (with `is_paid` derived) |
| `payments` (indirect via `EXISTS`) | `EXISTS(SELECT 1 FROM payments WHERE payments.fee_id = fees.id AND payments.deleted_at IS NULL)` | `is_paid` flag |
| `attendance` | `whereIn('student_section_id', $studentSectionIds)->whereBetween('date', [start,end])->select('student_section_id','date','status','lesson_learned')` | Per-day status + lesson flag for the full year |

The engine does **not** call `MonthlyFeeResolver`. It reads historical `fees.amount` directly.

## 7.4 Output shape (assembled by the engine)

```php
[
  'meta' => [
    'report'       => 'student',
    'generated_at' => now()->toDateTimeString(),
  ],
  'student' => [
    'id'          => int,
    'name'        => string,
    'father_name' => string,
  ],
  'gurmukhi' => [
    'fees' => [
      'summary' => ['total' => int, 'paid' => int, 'pending' => int],
      'rows'    => [Fee rows: id, title, type, month, amount, is_paid],
    ],
    'attendance' => [
      'summary' => ['present' => int, 'absent' => int, 'leave' => int, 'percentage' => float],
      'months'  => [
        'January' => ['present' => int, 'absent' => int, 'leave' => int, 'lessons_learned' => int],
        ...
      ],
      'calendar' => [
        'January' => [1 => ['status' => 'present|absent|leave|null', 'lesson_learned' => bool], ...],
        ...
      ],
    ],
  ],
  'kirtan' => [
    'fees' => [...same shape as gurmukhi.fees...],
    'attendance' => [...same shape as gurmukhi.attendance...],
    'performance' => [
      'total_classes'    => int,
      'lessons_learned'  => int,
      'percentage'       => float,
      'rating'           => 'Excellent' | 'Good' | 'Average' | 'Needs Improvement',
    ],
  ],
]
```

## 7.5 Business rules the engine enforces

- **Multi-enrollment aware.** A student may be enrolled in multiple classes; the engine splits by class type via `LOWER(classes.type)`. Sections that are not `kirtan` go to the `gurmukhi` block.
- **Per-day status merge.** Within a single division, multiple `student_section_id`s are walked and the day's `status` precedence is: `present > leave > absent > null`. `lesson_learned` is `true` if **any** record for that day has `lesson_learned=1`.
- **Performance rating (Kirtan only).** Buckets:
  - ≥ 85% → Excellent
  - ≥ 70% → Good
  - ≥ 50% → Average
  - < 50% → Needs Improvement
  - `% = lessons_learned / total_classes * 100` (rounded to 2 decimals). `total_classes = present + absent + leave`.
- **Soft-deleted payments are ignored.** `is_paid` only counts payments where `deleted_at IS NULL`.
- **Year loop.** Always full year (`YYYY-01-01` to `YYYY-12-31`). Month range filters apply only to fees, not attendance.
- **`month_from`/`month_to` semantics.** Lexicographic comparison on `YYYY-MM` strings (which is correct because the format is sortable). Applied via `where('fees.month', '>=', $from)` and `where('fees.month', '<=', $to)`. Custom fees (which have `month = NULL`) are included regardless of the range.

## 7.6 Output rendering

- **On-screen (`Student.jsx`):** Preview pane renders both division blocks with summary stats, fee tables, attendance month summary, and a custom mini-calendar. PDF export uses a hidden form POST that opens `/admin/reports/export/pdf` in a new tab.
- **PDF (`student.blade.php`):**
  - Header table with school info, principals' phone numbers, and the school logo at `resources/images/logo.png`.
  - Student info table.
  - `Gurmukhi (Academic)` section: fees summary, fees table, attendance stats, calendar (without lesson ✓).
  - `Kirtan (Spiritual)` section: fees summary, performance stats, calendar (with lesson ✓ when `lesson_learned`).
  - Footer: `Generated on {{ now()->format('d M Y, h:i A') }}` (server time).

## 7.7 Calendar partial (`partials/attendance-calendar.blade.php`)

- Receives `$attendance` (the attendance array) and `$year` (an `int`).
- Renders three months per row in mini grid form.
- Each cell color is `bg-present` / `bg-absent` / `bg-leave` / `bg-na` based on the day's `status`.
- `$showLesson` toggles the `✓` marker for `lesson_learned=1` cells (used by the Kirtan calendar).
- The partial computes `$firstDay` and `$daysInMonth` from the `monthName` string using `Carbon::parse("1 $monthName $year")`. INSUFFICIENT INFORMATION on locale handling for non-English month names (the engine emits English month names from `Carbon::create($year, $m, 1)->format('F')`).

## 7.8 Observations (descriptive only)

These are facts about the existing code, not change requests. The next agent should weigh them against the requirements.

1. The Student Performa is **not** in `ReportRegistry`. Filters/columns are hard-coded in the React page and in the engine.
2. The engine reads historical `fees.amount` rather than re-resolving via `MonthlyFeeResolver`. If a fee was created at a wrong amount and later corrected by a rate period change, the report will show the original amount for that month. The Pending Fees Setup flow can mutate historical monthly fees, so the report's amount can drift from `MonthlyFeeResolver`'s view.
3. The engine's class-type split uses `LOWER(classes.type) != 'kirtan'` for Gurmukhi. The same condition elsewhere is `str_contains(lower(class_name), 'kirtan')` — both produce the same answer on seeded data but may drift if classes are renamed.
4. `is_paid` is computed as a per-fee boolean. The summary `paid` / `pending` amounts assume `payments.amount_paid == fees.amount` (which is true in the current collect flow but is not enforced if partial payments are ever introduced).
5. `is_locked` and `batch_id` from the `fees` table are not surfaced in the report.
6. The year/month loop uses `Carbon::create($year, $m, $d)` without explicit timezone; the resolver uses `config('app.timezone')` explicitly. INSUFFICIENT INFORMATION on whether the report honors the application timezone for day counts near month boundaries.
7. The PDF page reads `request('year')` inside the partial. This couples the partial to the request lifecycle; if a future caller wants to render the partial outside of a request, the partial will need a `$year` argument (it already accepts it, so the request helper is redundant but currently used).
8. `month_from` / `month_to` are applied as `>=` / `<=` regardless of whether they are flipped. Validation pre-checks `from > to` server-side, so the inversion is impossible by the time the query runs.
9. The Student Performa is admin-only. There is no in-page "preview as another user" or impersonation flow.
10. The Blade template assumes `$student`, `$gurmukhi`, `$kirtan` are all present. The engine always provides them; if a future refactor allows partial data, the template will fail.

## 7.9 Open questions specific to the Student Report

- Should the report re-resolve historical fee amounts via `MonthlyFeeResolver` (to show the *current* rate for each month) or stick to *historical* amounts (current behavior)?
- Should the report show `is_locked` and `batch_id` for custom fees?
- Should `payment.amount_paid ≠ fee.amount` (partial payments) be reported distinctly?
- Should the report support a **multi-year** range, like the Fees report?
- Should the calendar highlight `lesson_learned` for Gurmukhi as well (currently hidden by `showLesson: false`)?
- Should the report be available to **Accountant** (read-only) so they can answer parent queries without admin involvement?
- Should the report register itself in `ReportRegistry` so the filter/column definitions become data-driven and the React page could be re-skinned using a generic builder?
- Should the report be cached per `(student_id, year, month_from, month_to)` to reduce re-computation?

## 7.10 Tests / data sanity (INSUFFICIENT INFORMATION)

- No test file specifically for the Student Report was discovered in the audit pass. A regression test that seeds a student with a Gurmukhi + Kirtan enrollment, two months of fees (one paid, one unpaid), and 30+ attendance days would be a reasonable first test to write.
- `phpunit.xml` exists. `tests/` was not catalogued.
