# 06 — Reports System

Three report types are exposed under the admin sidebar. They share a single controller (`App\Http\Controllers\Admin\ReportController`) and a Blade template folder (`resources/views/reports/`). Only the **Fees** report participates in the `ReportRegistry`; the other two are wired directly.

## 6.1 Surface

| Report | UI page | Build route | Export routes | PDF template | Registry |
|---|---|---|---|---|---|
| Fees | `resources/js/Pages/Admin/Reports/Index.jsx` | `POST /admin/reports/build` (report=fees) | `POST /admin/reports/export/csv`, `POST /admin/reports/export/pdf` | `resources/views/reports/fees.blade.php` | ✅ `ReportRegistry::fees()` |
| Attendance | `resources/js/Pages/Admin/Reports/Attendance.jsx` | `POST /admin/reports/build` (report=attendance) | `POST /admin/reports/export/pdf` | `resources/views/reports/attendance.blade.php` (table) | ❌ Not registered (commented as future) |
| Student Performa (legacy — removed in V1) | n/a | n/a | n/a | n/a | n/a |
| **Student Center (V1)** | `resources/js/Pages/Admin/StudentReportCenter/Index.jsx` | `POST /admin/student-report-center/build` | `POST /admin/student-report-center/export/pdf` | `resources/views/reports/student_center.blade.php` + `partials/student_center_calendar.blade.php` | ❌ Not in `ReportRegistry` (V1.1) |

Sidebar entries (from `AdminLayout.jsx`):
```
Reports
  Fees Report     -> /admin/reports/
  Attendance R.   -> /admin/reports/attendance
  Student Report  -> /admin/reports/student
```

## 6.2 `ReportRegistry` (`app/Reports/ReportRegistry.php`)

Static metadata describing filter inputs, available columns, default visible columns, and the Eloquent model the report queries. The only implemented key is `fees`.

Shape (fees):
```php
[
  'key'   => 'fees',
  'label' => 'Fees Report',
  'model' => \App\Models\Fee::class,
  'filters' => [
    'year'        => ['type' => 'year', 'label' => 'Year'],
    'class_ids'   => ['type' => 'multi-select', 'label' => 'Class', 'source' => 'classes'],
    'section_ids' => ['type' => 'multi-select', 'label' => 'Section', 'source' => 'sections'],
    'student_ids' => ['type' => 'multi-select', 'label' => 'Students', 'source' => 'students'],
    'paid_status' => ['type' => 'checkbox', 'label' => 'Payment Status',
                      'options' => ['paid' => 'Paid', 'unpaid' => 'Unpaid']],
  ],
  'columns' => [
    'student_name'  => ['label' => 'Student', 'source' => 'students.name'],
    'class_name'    => ['label' => 'Class',   'source' => 'classes.name'],
    'section_name'  => ['label' => 'Section', 'source' => 'sections.name'],
    'fee_title'     => ['label' => 'Fee',     'source' => 'fees.title'],
    'fee_type'      => ['label' => 'Type',    'source' => 'fees.type'],
    'month'         => ['label' => 'Month',   'source' => 'fees.month'],
    'amount'        => ['label' => 'Amount',  'source' => 'fees.amount', 'format' => 'currency'],
    'is_paid'       => ['label' => 'Paid',    'source' => 'payments.id', 'format' => 'boolean'],
    'paid_at'       => ['label' => 'Paid Date','source' => 'payments.paid_at', 'format' => 'date'],
  ],
  'default_columns' => ['student_name','class_name','section_name','month','amount','is_paid'],
]
```

INSUFFICIENT INFORMATION: the registry is read by `ReportController` indirectly — `buildFeesReport` re-implements the join and filter logic instead of using the registry as a single source of truth.

## 6.3 `ReportController` entry points

- `build(Request)` — dispatcher. Validates `report` and dispatches by string match. Returns `response()->json(...)`.
- `exportCsv(Request)` — supports `fees` and `attendance`. Emits a `text/csv` `StreamedResponse`.
- `exportPdf(Request)` — supports `fees`, `attendance`, `student`. Loads Blade view via `Barryvdh\DomPDF\Facade\Pdf::loadView(...)->setPaper('a4','portrait')`, returns `$pdf->stream("{$report}-report.pdf")`.

If `$report['tables']['rows']` is set, the controller copies it to `$report['rows']` so Blade can iterate over either shape.

## 6.4 Fees Report — engine

`buildFeesReport(Request)` (`app/Http/Controllers/Admin/ReportController.php`):

1. Base query joins `fees` -> `student_sections` -> `students` -> `classes` (left join `sections` and `payments` where `payments.deleted_at IS NULL`).
2. `whereIn` on `student_sections.class_id` (required).
3. Year filter: `(type=monthly AND month LIKE 'YYYY-%') OR type=custom`.
4. Month filter: `(type=monthly AND month = 'YYYY-MM') OR type=custom`.
5. Optional filters: `section_ids`, `student_ids`, `paid_status` (paid|unpaid — only when **single** value passed).
6. **Summary** KPI:
   - total_students (distinct), paid_students, unpaid_students, total_fees, total_collected, total_pending, collection_percentage.
7. **Breakdown by class** with totals/collected/pending/percentage.
8. **Detail rows** including `is_paid` (boolean) for each `(student, class, section, fee_title, fee_type, month, amount)`.

CSV export emits a friendly header (`Student Name, Father Name, Class, Section, Fee Title, Month, Amount (PKR), Paid Status`) and `Carbon`-formatted month labels.

## 6.5 Attendance Report — engine

`buildAttendanceReport(Request)`:

1. Base query joins `attendance` -> `student_sections` -> `students` -> `classes` (left join `sections`).
2. Filters: `class_ids` (required), `section_ids`, `student_ids`, `status[]`, `year`, `month` (uses `whereMonth('date', substr(month,5,2))`).
3. Summary: total_records, present, absent, leave, attendance_percentage.
4. Breakdown by class.
5. Detail rows with `lesson_learned`.

`buildAttendanceCalendar(Request)`:

1. Derives month/year (defaults to now).
2. Iterates each day in the month.
3. Selects students for the chosen class/section ids.
4. Loads all attendance rows in the month for those students.
5. Returns a 2D `students[].records[date] = {status, lesson_learned}` matrix.

## 6.6 Student Performa Report — engine

See [07-student-report-deep-dive.md](07-student-report-deep-dive.md). It is the audit subject.

## 6.7 PDF rendering pipeline

```
Controller (exportPdf)
  -> match($request->report) -> build*Report($request)   // returns associative array
  -> $report['rows'] = $report['tables']['rows'] ?? $report['rows']  // shape alignment
  -> Pdf::loadView('reports.<key>', $report)->setPaper('a4','portrait')
  -> $pdf->stream("<key>-report.pdf")
```

Blade templates:
- `resources/views/reports/fees.blade.php` — header (school info + logo), KPI summary table, class breakdown, detailed rows table, footer with generation timestamp.
- `resources/views/reports/attendance.blade.php` — header, summary, status-colored detail table, lesson ✓ marker.
- `resources/views/reports/student.blade.php` — header, student info, then split Gurmukhi (fees + attendance + calendar without lessons) and Kirtan (fees + performance rating + calendar with lessons) sections. Includes `partials.attendance-calendar`.
- `resources/views/reports/partials/attendance-calendar.blade.php` — month grid (3 months per row) with `bg-present` / `bg-absent` / `bg-leave` / `bg-na` cell classes; optional `✓` when `showLesson && lesson_learned`.

PDF notes:
- `setPaper('a4', 'portrait')` is hard-coded; there is no parameter for landscape or other paper sizes.
- All templates read `now()` (server time) for the footer timestamp; not the timezone passed in the request.
- The student report pulls `request('year')` inside the Blade view (uses the global `request()` helper) — relies on the same request object that triggered the export. INSUFFICIENT INFORMATION on whether this works correctly when exported programmatically.

## 6.8 React pages (UI)

### `Admin/Reports/Index.jsx` (Fees)
- Fetches `/admin/students/list`, `/admin/classes/data`, `/admin/sections/data` for filter options.
- State: `filters`, `columns`, `rows`, `summary`, `byClass`, year, month.
- Uses `MultiSelect` + TanStack Table (`getCoreRowModel`, `flexRender`).
- Submit handler: `POST /admin/reports/build` with `report='fees'`.
- Export CSV/PDF: `POST /admin/reports/export/{csv,pdf}` via a hidden form.

### `Admin/Reports/Attendance.jsx`
- Tabs for Table vs Calendar.
- Table view: standard summary + AG Grid-style table.
- Calendar view: posts to `build` with `view='calendar'`, then renders a `students × days` grid.

### `Admin/Reports/Student.jsx`
- Two card layout: filters (left), preview (right).
- Filters: student (`/admin/students/list`), year (5-year window), month_from, month_to.
- Build: `POST /admin/reports/build` with `report='student'`.
- Export PDF: hidden form POST to `/admin/reports/export/pdf` opening in a new tab.

## 6.9 Build vs. export — what differs

`build*` returns JSON; `exportPdf` returns a streamed PDF; `exportCsv` returns a streamed CSV (fees only). All three reuse the same private `build*` methods, so the data shape on screen matches the data shape printed to PDF (modulo template-level transformation).

## 6.10 Open questions about the report system (descriptive, not prescriptive)

- The `ReportRegistry` is metadata-only and not consulted at runtime by `ReportController`. It is also not consulted by the React filter UI (each page hard-codes its filter options).
- The Attendance report has a comment in `ReportRegistry::all()` listing `attendance` and `students` as future additions. The Student Performa is already fully implemented but never registered.
- There is no caching layer for report outputs; every request re-runs the queries. For a small school this is fine; for larger datasets the dashboard-style `clone $query` pattern would be the first optimization to consider.
- The report controller swallows `Accept: application/json` overrides at the top of `build()` — every Inertia POST will be coerced to JSON, regardless of the original `Accept` header.
