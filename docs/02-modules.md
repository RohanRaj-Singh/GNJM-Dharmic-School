# 02 — Modules

Each module is annotated with **status** (Implemented / Stubs / INSUFFICIENT INFORMATION), the **primary owner** role, and the **key paths** (controllers, models, routes, pages). This is the source of truth when an agent asks "is X built yet?".

## 2.1 Implemented

| # | Module | Primary owner | Key paths |
|---|---|---|---|
| 1 | **Authentication & User Management** | Admin (management), self (own profile) | `app/Http/Controllers/Auth/*`, `routes/auth.php`, `app/Models/User.php`, `app/Http/Controllers/Admin/UserController.php`, `resources/js/Pages/Admin/Users/Index.jsx` |
| 2 | **Students (CRUD + bulk + show)** | Admin (CRUD + bulk), Accountant/Teacher (read) | `routes/admin.php` (`/admin/students/*`), `routes/students.php` (global `/students/*`), `app/Http/Controllers/StudentController.php`, `app/Http/Controllers/Admin/DashboardController.php` (referenced), `resources/js/Pages/Students/*`, `resources/js/Pages/Admin/Students/*` |
| 3 | **Classes (curriculum)** | Admin | `app/Models/SchoolClass.php`, `routes/admin.php` (`/admin/classes`), `resources/js/Pages/Admin/Classes/Index.jsx` |
| 4 | **Sections (under classes)** | Admin | `app/Models/Section.php`, `routes/admin.php` (`/admin/sections`), `resources/js/Pages/Admin/Sections/Index.jsx` |
| 5 | **Enrollments** (`student_sections`) | Admin (write via bulk), Accountant/Teacher (read) | `app/Models/StudentSection.php`; embedded in `routes/admin.php` (`/admin/students/bulk-update`) and `StudentController::store`; no dedicated page |
| 6 | **Custom Fees** | Admin | `app/Http/Controllers/Admin/FeesController.php` (`customIndex`, `storeCustomFee`, `updateCustomFee`, `destroyCustomFeeForStudent`, `destroyCustomFeeForSection`); `resources/js/Pages/Admin/Fees/CustomFee.jsx` |
| 7 | **Monthly Fee Generation** | System (Artisan) + Admin trigger | `app/Console/Commands/GenerateMonthlyFees.php` (signature: `fees:generate-monthly`); `FeesController::generateMonthlyFees` |
| 8 | **Fee Rate Periods** (time-bounded overrides per class/section) | Admin | `app/Http/Controllers/Admin/FeeRatePeriodController.php`, `app/Models/FeeRatePeriod.php`; inline panels in `Classes/Index.jsx` and `Sections/Index.jsx` |
| 9 | **Fee Receiving (collect / de-collect)** | Accountant (primary), Admin | `app/Http/Controllers/FeePaymentController.php` (accountant), `app/Http/Controllers/Admin/FeesController.php::collect/deCollect` (admin); `resources/js/Pages/Accountant/ReceiveFee.jsx`, `resources/js/Pages/Admin/Fees/Index.jsx` |
| 10 | **Late Fees view** | Accountant | `app/Http/Controllers/Accountant/LateFeeSummaryController.php`, `resources/js/Pages/Accountant/LateFees.jsx` (+ `LateFeesFiltersPanel.jsx`, `LateFeesSectionCard.jsx`, `utils.js`) |
| 11 | **Pending Fees Setup** (onboarding helper) | Admin | `app/Http/Controllers/Admin/PendingFeesController.php`, `assumed_pending_months` column on `student_sections`, `resources/js/Pages/Admin/Utilities/PendingFeesSetup.jsx` |
| 12 | **Attendance — daily marking** | Teacher (primary), Accountant | `app/Http/Controllers/AttendanceController.php`, `routes/attendance.php`, `resources/js/Pages/Attendance/{Dashboard,Sections,Mark}.jsx` |
| 13 | **Attendance — admin grid** | Admin | `app/Http/Controllers/Admin/AdminAttendanceController.php`, `resources/js/Pages/Admin/Attendance/Index.jsx` |
| 14 | **Attendance — absentees tracking** | All (filtered by access) | `routes/attendance.php` `/absentees`, `resources/js/Pages/Attendance/Absentees.jsx` (+ `Absentees/` subdir) |
| 15 | **Attendance — streak summary API** | Accountant (read), no UI page yet | `app/Http/Controllers/Accountant/AttendanceSummaryController.php` |
| 16 | **Admin Dashboard** | Admin | `app/Http/Controllers/Admin/DashboardController.php`, `resources/js/Pages/Admin/Dashboard.jsx` |
| 17 | **Reports — Fees** | Admin | `ReportController::buildFeesReport`, `ReportRegistry::fees()`, `resources/js/Pages/Admin/Reports/Index.jsx`, `resources/views/reports/fees.blade.php` |
| 18 | **Reports — Attendance (table + calendar)** | Admin | `ReportController::buildAttendanceReport`, `ReportController::buildAttendanceCalendar`, `resources/js/Pages/Admin/Reports/Attendance.jsx`, `resources/views/reports/attendance.blade.php`, `resources/views/reports/partials/attendance-calendar.blade.php` |
| 19 | **Reports — Student Performa** | Admin | `ReportController::buildStudentReport`, `resources/js/Pages/Admin/Reports/Student.jsx`, `resources/views/reports/student.blade.php` |
| 20 | **Fee Cleanup Command** | Admin (manual) | `app/Console/Commands/CleanupMonthlyFees.php` (`fees:cleanup-monthly [--execute]`) |
| 21 | **Splash / Landing pages** | Public | `resources/js/Pages/Splash.jsx`, `resources/js/Pages/Welcome.jsx` |
| 22 | **Profile / Password** | Authenticated users | `routes/auth.php`, `app/Http/Controllers/ProfileController.php` |
| 23 | **Utilities hub (sidebar)** | Admin | `resources/js/Pages/Admin/Utilities.jsx` (mounts Pending Fees Setup) |
| 24 | **Cleanup / session hardening middleware** | System | `EnsureSessionAfterCacheClear`, `SecurityHeaders`, `PreventCacheMiddleware` |

## 2.2 Stubs / placeholders

| # | Module | Notes |
|---|---|---|
| 25 | **Accountant Dashboard** | `Accountant/Dashboard.jsx` is a placeholder. No controller wires data into it. The admin-style `DashboardController` only serves `/admin/dashboard/summary`. |
| 26 | **Teacher Dashboard** | `Teacher/Dashboard.jsx` is a placeholder. Teachers effectively land on `Attendance/Dashboard.jsx`. The teacher routes file has a comment "Phase 1" implying more is planned. |
| 27 | **Accountant students** | `Accountant/Students/*` and `Accountant/Students.jsx` exist but the routes inside `routes/accountant.php` are commented out. Accountants currently use the global `/students` route. |
| 28 | **`FakeAuthForReports` middleware** | Disabled in `Kernel.php`; exists for dev. |
| 29 | **`DebugAuthMiddleware`** | Disabled in `Kernel.php`; exists for log-based debug. |
| 30 | **`ReportPreset` model** | Eloquent model exists, no controller or route persists/loads presets. |

## 2.3 INSUFFICIENT INFORMATION (likely missing modules)

| # | Module | Evidence |
|---|---|---|
| 31 | **Examinations** | No `Exam`, `Subject`, `Mark`, `Result`, `Grade` model or migration. No `exams`, `subjects`, `marks`, `results` tables. |
| 32 | **Notifications** | `Notifiable` trait is used on `User` but no notification classes, mail templates, or queues are defined. No notification routes. |
| 33 | **SMS / parent messaging** | `father_phone` and `mother_phone` are captured on `students`, but no integration exists. |
| 34 | **Exams scheduling & report card printing** | No related model, route, or PDF template. |

## 2.4 Sidebar / navigation map (Admin only)

From `resources/js/Layouts/AdminLayout.jsx`:

```
Dashboard       -> /admin/dashboard
Students        -> /admin/students
Classes         -> /admin/classes
Sections        -> /admin/sections
Attendance      -> /admin/attendance
Fees Management ->
  Manage Fees   -> /admin/fees/
  Fee Categories-> /admin/fees/custom
Reports         ->
  Fees Report   -> /admin/reports/
  Attendance R. -> /admin/reports/attendance
  Student Report-> /admin/reports/student
Users           -> /admin/users
Utilities       -> /admin/utilities
```

Accountant sidebar is defined inside `resources/js/Pages/Accountant/Dashboard.jsx` / `ReceiveFee.jsx` (functional, not a layout file). Teacher has no persistent sidebar — they go straight to attendance.
