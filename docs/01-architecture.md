# 01 — Architecture

## 1.1 High-level layers

| Layer | Technology | Path | Purpose |
|---|---|---|---|
| HTTP entry / routing | Laravel | `routes/web.php`, `routes/admin.php`, `routes/accountant.php`, `routes/teacher.php`, `routes/students.php`, `routes/attendance.php`, `routes/auth.php` | Mounts public, authenticated, and role-scoped groups |
| Middleware | Laravel Kernel + custom | `app/Http/Kernel.php`, `app/Http/Middleware/*` | Session, security headers, role enforcement, session-stamp guard |
| Controllers | Eloquent + Query Builder | `app/Http/Controllers/*` (with `Admin/`, `Accountant/` subfolders) | Business actions per request |
| Services | PHP | `app/Services/*` | Currently only `MonthlyFeeResolver` |
| Domain/Reports metadata | PHP | `app/Reports/ReportRegistry.php` | Static registry of report types & filter/column shapes |
| Models | Eloquent | `app/Models/*` | 10 domain models |
| Console / batch | Artisan | `app/Console/Commands/*` | `fees:generate-monthly`, `fees:cleanup-monthly` |
| Database | Migrations + seeders | `database/migrations/*`, `database/seeders/*` | Schema + minimal seed data |
| Frontend | Inertia + React | `resources/js/Pages/*`, `resources/js/Layouts/*`, `resources/js/Components/*` | SPA-style pages rendered through Inertia |
| PDF | DomPDF + Blade | `resources/views/reports/*` | Three report templates |
| Session storage | Laravel session driver (`database`) | `sessions` table | Auth + flash |

## 1.2 Directory layout (only paths that matter)

```
app/
  Console/Commands/
    GenerateMonthlyFees.php
    CleanupMonthlyFees.php
  Http/
    Controllers/
      Admin/
        AdminAttendanceController.php
        DashboardController.php
        FeeRatePeriodController.php
        FeesController.php
        PendingFeesController.php
        ReportController.php         <-- subject of the report audit
        UserController.php
      Accountant/
        AttendanceSummaryController.php
        LateFeeSummaryController.php
      AttendanceController.php       <-- global, used by teacher+accountant
      FeePaymentController.php
      LoginController.php
      ProfileController.php
      StudentController.php
    Middleware/
      Authenticate.php
      DebugAuthMiddleware.php        <-- disabled in Kernel
      EnsureSessionAfterCacheClear.php
      FakeAuthForReports.php         <-- disabled in Kernel
      HandleInertiaRequests.php
      PreventCacheMiddleware.php
      RoleMiddleware.php             <-- server-side RBAC
      SecurityHeaders.php
      ...
    Kernel.php
  Models/
    Attendance.php
    Fee.php
    FeeRatePeriod.php
    Payment.php
    ReportPreset.php                 <-- not yet wired into any controller
    SchoolClass.php
    Section.php
    Student.php
    StudentSection.php
    User.php
  Reports/
    ReportRegistry.php
  Services/
    MonthlyFeeResolver.php
database/
  migrations/                        18 files, plus 3 Laravel scaffold
  seeders/
    DatabaseSeeder.php
    DemoFeeSeeder.php
    SchoolSetupSeeder.php
resources/
  js/
    app.jsx                          <-- Inertia root
    Pages/
      Admin/
        Dashboard.jsx
        Reports/                     <-- Index, Attendance, Student (audit subject)
        ...
      Accountant/
        Dashboard.jsx
        LateFees.jsx
        ReceiveFee.jsx
        ...
      Attendance/
        Dashboard.jsx
        Sections.jsx
        Mark.jsx
        Absentees.jsx
      Students/
        Index.jsx, Show.jsx, Create.jsx, FeeSection.jsx
      Teacher/
        Dashboard.jsx, Attendance.jsx
      Auth/, Profile/, Splash.jsx, Welcome.jsx
    Layouts/                          AdminLayout, AuthenticatedLayout, SimpleLayout, GuestLayout
    Components/                       NavLink, Modal, MultiSelect, SearchInput, RoleGate, EditableCell, etc.
    Hooks/                            useRoles, useBackButtonLogoutModal, useUnsavedChangesWarning
    utils/helper.js                   formatPKR, formatMonth, generateMonthOptions
  views/
    app.blade.php                     <-- Inertia root template
    reports/                          <-- PDF Blade templates
      fees.blade.php
      attendance.blade.php
      student.blade.php
      partials/attendance-calendar.blade.php
routes/                               see §1.3
```

## 1.3 Request lifecycle (typical admin action)

```
Browser
  └─ GET /admin/<something>
       └─ web.php group: auth, session.cache_guard
            └─ admin.php group: role:admin, prefix:admin
                 └─ controller in app/Http/Controllers/Admin/*
                      ├─ Eloquent / Query Builder
                      ├─ Inertia::render('Admin/.../Index', props)
                      │     └─ HandleInertiaRequests shares { auth.user, flash }
                      └─ Resources/js/Pages/Admin/.../Index.jsx
                           ├─ Wrapped by AdminLayout
                           │    └─ Sidebar links, LogoutModal, TabSessionTimeout
                           ├─ AG Grid / TanStack Table / react-select
                           └─ Toaster (react-hot-toast)
```

## 1.4 Architectural patterns observed

- **Server-side RBAC.** `RoleMiddleware` is the only authorization gate; there are no Policies or Gates.
- **No REST API.** AJAX endpoints exist for grids and report builds, but they return JSON to Inertia pages, not a public API.
- **Mixed data access.** Some controllers use Eloquent, others use the Query Builder heavily (especially the report and dashboard controllers).
- **Sparse service layer.** Only `MonthlyFeeResolver` is reused across multiple callers. Everything else is inlined in controllers.
- **Inertia, no global store.** Frontend state lives in component hooks. Auth and flash props are pushed from server.
- **PDF + on-screen share one source of truth.** The same `build*Report()` private methods feed both the JSON response and the Blade view passed to DomPDF.
- **Inline closures for routes.** Many admin routes are defined as inline Closures in `routes/admin.php` rather than controller methods. This is a refactor signal, not a bug.

## 1.5 Security & access hardening

- `EnsureSessionAfterCacheClear` — logs out a user if `auth_session_guard_stamp` in `Cache::rememberForever` no longer matches the session stamp.
- `SecurityHeaders` — sets `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block` for any authenticated or protected response.
- `PreventCacheMiddleware` — same cache headers; available for explicit per-route attachment.
- `DebugAuthMiddleware` — disabled in `Kernel.php` (commented out), but exists for log inspection.
- `FakeAuthForReports` — dev-only, disabled. Would auto-login `User::first()` if no user is authenticated.
- `RoleMiddleware` — logs every unauthorized attempt via `Log::warning` before redirecting to the user's role-appropriate landing page.

## 1.6 Notable quirks

- `.env` is checked into the repository. Treat as informational; do not commit secrets.
- `package.json` declares Tailwind 3.2.1 as a `devDependency`, but `@tailwindcss/vite: ^4.0.0` is also present. INSUFFICIENT INFORMATION on which version is actually active.
- `phpunit.xml` exists but `tests/` was not audited in this pass — see [10-open-questions-and-gaps.md](10-open-questions-and-gaps.md).
- The outer `role:admin` middleware is applied in `routes/web.php` wrapping the entire `routes/admin.php` file, not at the top of `admin.php` itself. Confirmed working but implicit.

## 1.7 Environment

- **OS:** Windows 11 Home (10.0.26200), shell is PowerShell with Bash also available.
- **PHP:** 8.2 (from composer.json constraint).
- **Working directory:** `C:\Users\Rohan Raj Singh\Desktop\GNJM Dharmic School`.
- **DB driver:** SQLite default — `database/database.sqlite` (file is empty/0 bytes at the time of discovery; may have been cleared by the `EnsureSessionAfterCacheClear` flow).
