# 09 — Dependency Map

A bird's-eye view of who reads/writes what. Useful for impact analysis before any change.

## 9.1 Module ↔ table matrix

| Module | Reads | Writes | Deletes (soft) | Deletes (hard) |
|---|---|---|---|---|
| Authentication & Users | `users`, `sessions`, `password_reset_tokens` | `users` (create/update), `sessions` | `sessions` (logout) | `users` (admin destroy) |
| Students (CRUD) | `students`, `student_sections`, `classes`, `sections` | `students`, `student_sections` | — | `students` (admin delete cascades `student_sections`) |
| Classes / Sections | `classes`, `sections` | `classes`, `sections` | — | `sections` (if no enrollments) |
| Enrollments (bulk) | `student_sections`, `sections`, `classes` | `student_sections` | — | `student_sections` (when section removed from list) |
| Custom Fees | `fees`, `payments`, `student_sections`, `sections`, `classes` | `fees` | — | `fees` (refused if any payment) |
| Monthly Fee Generation | `student_sections`, `classes`, `sections`, `fee_rate_periods` | `fees` | — | `fees` (unpaid monthly for free enrollments) |
| Fee Rate Periods | `fee_rate_periods`, `fees`, `payments`, `classes`, `sections`, `student_sections` | `fee_rate_periods`, `fees`, `classes.default_monthly_fee`, `sections.monthly_fee`, `fee_rate_periods` (zero) | — | `fee_rate_periods` (refused if collected) |
| Fee Receiving | `fees`, `payments` | `payments`, `fees.is_locked` | `payments` (de-collect) | — |
| Late Fees | `fees`, `payments`, `student_sections`, `students`, `classes`, `sections` | — | — | — |
| Pending Fees Setup | `student_sections`, `students`, `classes`, `sections`, `fees`, `payments`, `fee_rate_periods` | `student_sections.assumed_pending_months`, `fees` | — | `fees` (unpaid monthly outside desired set) |
| Attendance (teacher/accountant) | `student_sections`, `students`, `classes`, `sections`, `attendance` | `attendance` | — | `attendance` (status=null in admin save) |
| Attendance (admin grid) | same as above | same as above | — | `attendance` (when status is set to null) |
| Attendance (absentees) | same as above | — | — | — |
| Attendance (streak summary) | same as above | — | — | — |
| Admin Dashboard | `fees`, `payments`, `attendance`, `students`, `student_sections`, `classes`, `sections` | — | — | — |
| Reports — Fees | `fees`, `payments`, `student_sections`, `students`, `classes`, `sections` | — | — | — |
| Reports — Attendance | `attendance`, `student_sections`, `students`, `classes`, `sections` | — | — | — |
| Reports — Student Performa | `students`, `student_sections`, `classes`, `fees`, `payments`, `attendance` | — | — | — |
| Cleanup command | `fees` | — | — | `fees` (duplicate unpaid) |

## 9.2 Service layer

Only one true service class exists:

- **`App\Services\MonthlyFeeResolver`** — used by:
  - `app/Console/Commands/GenerateMonthlyFees.php`
  - `app/Http/Controllers/Admin/PendingFeesController.php`
  - `app/Http/Controllers/Admin/FeeRatePeriodController.php` (in `refreshUnpaidMonthlyFees` and `refreshUnpaidMonthlyFeesForSections`)
  - `app/Http/Controllers/StudentController.php`

Other "services" are static helpers inside controllers (e.g. `FeesController::normalizeDivisionType`, `DashboardController::normalizeDivisionType`, `DashboardController::applyFeeYearFilter`).

## 9.3 Reports module internal dependencies

```
ReportController::build()
  ├─ buildFeesReport()           -> fees, payments, student_sections, students, classes, sections
  ├─ buildAttendanceReport()     -> attendance, student_sections, students, classes, sections
  ├─ buildAttendanceCalendar()   -> same as above
  └─ buildStudentReport()        -> students, student_sections, classes, fees, payments, attendance

ReportController::exportCsv()
  ├─ buildFeesReport()
  └─ buildAttendanceReport()

ReportController::exportPdf()
  ├─ buildFeesReport()      -> reports.fees.blade.php
  ├─ buildAttendanceReport()-> reports.attendance.blade.php
  └─ buildStudentReport()   -> reports.student.blade.php
                              (which includes reports.partials.attendance-calendar.blade.php)

ReportRegistry::all()  -> static metadata only (currently only 'fees')
```

## 9.4 Controller → page map (for navigation)

| Controller method | Inertia page |
|---|---|
| `Admin/DashboardController::summary` | `Admin/Dashboard.jsx` (uses JSON) |
| `routes/admin.php` `/admin/students` (closure) | `Admin/Students/Index.jsx` |
| `routes/admin.php` `/admin/classes` | `Admin/Classes/Index.jsx` |
| `routes/admin.php` `/admin/sections` | `Admin/Sections/Index.jsx` |
| `Admin/AdminAttendanceController::index` | `Admin/Attendance/Index.jsx` |
| `Admin/FeesController::index` | `Admin/Fees/Index.jsx` |
| `Admin/FeesController::customIndex` | `Admin/Fees/CustomFee.jsx` |
| `Admin/PendingFeesController::index` | `Admin/Utilities/PendingFeesSetup.jsx` |
| `Admin/UserController` (via `routes/admin.php` `/admin/users`) | `Admin/Users/Index.jsx` |
| `routes/admin.php` `/admin/reports` | `Admin/Reports/Index.jsx` |
| `routes/admin.php` `/admin/reports/attendance` | `Admin/Reports/Attendance.jsx` |
| `routes/admin.php` `/admin/reports/student` | `Admin/Reports/Student.jsx` |
| `routes/accountant.php` `/` (closure) | `Accountant/Dashboard.jsx` |
| `routes/accountant.php` `/receive-fee` | `Accountant/ReceiveFee.jsx` |
| `Accountant/LateFeeSummaryController::index` | `Accountant/LateFees.jsx` |
| `routes/students.php` `/students` | `Students/Index.jsx` |
| `routes/students.php` `/students/create` | `Students/Create.jsx` |
| `routes/students.php` `/students/{student}` | `Students/Show.jsx` |
| `routes/teacher.php` `/` | `Teacher/Dashboard.jsx` |
| `routes/attendance.php` `/` | `Attendance/Dashboard.jsx` |
| `routes/attendance.php` `/sections` | `Attendance/Sections.jsx` |
| `routes/attendance.php` `/sections/{section}` | `Attendance/Mark.jsx` |
| `routes/attendance.php` `/absentees` | `Attendance/Absentees.jsx` |

## 9.5 Route → middleware chain (selected)

```
POST /admin/reports/build
  -> web group (EncryptCookies, StartSession, VerifyCsrfToken, SecurityHeaders, SubstituteBindings, EnsureSessionAfterCacheClear)
  -> auth
  -> role:admin
  -> ReportController@build

GET /admin/reports/student
  -> web group
  -> auth
  -> role:admin
  -> Inertia::render('Admin/Reports/Student')

POST /admin/reports/export/pdf
  -> web group
  -> auth
  -> role:admin
  -> ReportController@exportPdf

POST /admin/fees/{fee}/collect
  -> web group
  -> auth
  -> role:admin
  -> FeesController@collect  (route model binding Fee $fee)

POST /students
  -> web group
  -> auth
  -> StudentController@store

GET /attendance/sections/{section}
  -> web group
  -> auth
  -> role:teacher,accountant
  -> closure: validates teacher section scope, day rules, renders Attendance/Mark
```

## 9.6 Cross-module coupling hotspots (descriptive)

- **`MonthlyFeeResolver` is the single fee-amount authority** — any change to its precedence order ripples through monthly generation, rate-period refreshes, pending-fees setup, and student creation.
- **`students.status`** is read in `DashboardController` (`active_students_count`) and `StudentController::store` (sets `active`) but is **not** enforced as a filter on `/students` or `/admin/students`. Inactive students are still listed.
- **`payments.deleted_at`** is the only soft-delete in the system; every "is paid" query must filter on it. New payment-related code must replicate this pattern.
- **`student_sections.unique(student_id, class_id)`** means a student can have at most one enrollment per class. The Student Performa correctly assumes this; a future "two sections of the same class" feature would break the assumption.
- **`classes.type`** is referenced from many controllers; a class type rename would require coordinated updates.

## 9.7 Where the Student Performa plugs in

- **Inputs:** `students` (id, name, father_name), `student_sections` (id, class_id, section_id), `classes` (type), `fees` (id, type, month, amount, title), `payments` (deleted_at filter), `attendance` (date, status, lesson_learned).
- **Does not depend on:** `fee_rate_periods`, `MonthlyFeeResolver`, `CustomFee` flows, `is_locked`, `batch_id`, `users`, `sections.monthly_fee`, `classes.default_monthly_fee`.
- **Renderers:** React `Admin/Reports/Student.jsx` + Blade `resources/views/reports/student.blade.php` + partial `partials/attendance-calendar.blade.php`.
- **Single entry controller:** `ReportController::buildStudentReport`. Not registered in `ReportRegistry`.

## 9.8 Graph (text)

```
routes/web.php
  └─ routes/admin.php
       ├─ DashboardController       → Admin/Dashboard.jsx
       ├─ inline closure            → Admin/Students/Index.jsx → Students/* + Admin/Students/*
       ├─ inline closure            → Admin/Classes/Index.jsx   → FeeRatePeriodController (AJAX)
       ├─ inline closure            → Admin/Sections/Index.jsx  → FeeRatePeriodController (AJAX)
       ├─ AdminAttendanceController → Admin/Attendance/Index.jsx
       ├─ FeesController            → Admin/Fees/Index.jsx + Admin/Fees/CustomFee.jsx + Accountant/ReceiveFee.jsx (via FeePaymentController)
       │     ├─ collect (admin) → payments
       │     ├─ deCollect       → payments (soft delete)
       │     ├─ customIndex/store/update/destroy → fees
       │     └─ generateMonthlyFees → Console\GenerateMonthlyFees → fees
       ├─ PendingFeesController     → Admin/Utilities/PendingFeesSetup.jsx → student_sections, fees
       ├─ UserController            → Admin/Users/Index.jsx → users, section_user
       └─ ReportController          → Admin/Reports/Index.jsx + Attendance.jsx + Student.jsx
              ├─ buildFeesReport     → CSV → PDF
              ├─ buildAttendanceReport → PDF
              ├─ buildAttendanceCalendar (JSON)
              └─ buildStudentReport   → PDF

routes/attendance.php (teacher, accountant)
  └─ closure handlers + AttendanceController::store
       → attendance

routes/students.php (any auth)
  └─ StudentController::store
       → students, student_sections, fees (current month)

routes/accountant.php (accountant only)
  └─ LateFeeSummaryController → fees
  └─ AttendanceSummaryController → attendance
  └─ inline closure → ReceiveFee page (Accountant/ReceiveFee.jsx)
  └─ FeePaymentController::store → payments
```
