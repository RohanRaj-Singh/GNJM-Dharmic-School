# 11 — Conventions & Style

How the surrounding code is written. Match these when you add code so the next agent can read it fluently.

## 11.1 PHP / Laravel

### Naming
- Models: singular PascalCase (`Student`, `Fee`, `StudentSection`, `FeeRatePeriod`).
- Tables: snake_case plural (`students`, `fees`, `student_sections`, `fee_rate_periods`). The `SchoolClass` model maps to the `classes` table — explicit `protected $table = 'classes'`.
- Controllers: PascalCase with role suffix where relevant (`AdminAttendanceController`, `FeePaymentController`).
- Routes: `kebab-case` URIs, `dot.notation` route names (`admin.students.bulk`, `attendance.mark`, `accountant.receive-fee`).
- Variables: snake_case in PHP, camelCase in JS.

### Controllers
- Most controller methods are short and return either `Inertia::render(...)`, `back()->with(...)`, or `response()->json(...)`.
- Validation lives inline in the method via `$request->validate([...])` (no Form Request classes observed beyond what Breeze ships).
- Long, complex controllers (e.g. `ReportController`) keep multi-step logic in private helper methods rather than services.
- Query Builder is used in heavy-read paths (`ReportController`, `DashboardController`, `LateFeeSummaryController`, `PendingFeesController`).
- Eloquent is used in write paths and where relations are needed (`FeesController::index` with `with('enrollment.student', ...)`).

### Models
- `$fillable` is explicitly declared.
- Relations are defined as methods (e.g. `studentSection()`, `payments()`).
- No `$casts` other than the date casts and `password => 'hashed'`.
- No observers, no model events, no accessors/mutators beyond `casts()`.
- Some models have legacy duplicate relations (see [04-database-schema.md](04-database-schema.md) for `Attendance`).

### Query Builder style
- `(clone $baseQuery)->selectRaw(...)->...` is the dominant pattern for derived aggregates (see `ReportController::buildFeesReport`).
- `whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))` is the standard "is unpaid" predicate.
- `whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))` is the standard "is paid" predicate.
- Date filtering on `fees.month` uses string comparison (`'YYYY-MM'`). String comparison on `'F Y'` is fragile and is only handled in `LateFeeSummaryController::normalizeFeeMonth`.
- `DB::transaction(function () { ... })` is used for multi-write operations (e.g. admin bulk update, user bulk update, pending fees bulk).

### Logging
- `Log::info(...)` for debugging the Student Performa engine.
- `Log::warning(...)` for unauthorized role-middleware access.
- `logger()->info(...)` is also used (alias of `Log::info`).

### Errors
- `back()->withErrors([...])` for form-style errors.
- `back()->with('success', '...')` for flash success.
- `abort(404, '...')`, `abort(403, '...')`, `abort(422, '...')` for HTTP errors.
- `throw ValidationException::withMessages([...])` for validation errors inside helpers.

## 11.2 Blade

- Inline `<style>` blocks at the top of each PDF template (no shared CSS file).
- Tables with `border-collapse: collapse; border: 1px solid #ccc` is the standard PDF table style.
- Currency format: `Rs. {{ number_format($x) }}` in templates; `formatPKR` in JS.
- Date format: `{{ \Carbon\Carbon::parse($x)->format('d M Y') }}` (en locale, hard-coded).
- Month format: `{{ \Carbon\Carbon::createFromFormat('Y-m', $row->month)->format('F Y') }}`.
- The `partials.attendance-calendar.blade.php` partial uses `array_chunk($calendar, 3, true)` to render 3 months per row.
- No shared header/footer partial for the school info — each template repeats the block. INSUFFICIENT INFORMATION on whether this is intentional or a refactor opportunity.

## 11.3 JavaScript / React

### Imports
- `@inertiajs/react` for `Head`, `Link`, `usePage`, `router`.
- `@/Components/...` for shared components.
- `@/Layouts/...` for layouts.
- `@/utils/helper` for `formatPKR`, `formatMonth`, `generateMonthOptions`.
- AG Grid Community + `@tanstack/react-table` for tabular UI; `react-select` for `MultiSelect`-like behaviour.
- `lucide-react` for icons (in newer files).
- `react-hot-toast` for toasts (registered globally in `app.jsx`).

### State
- `useState` / `useEffect` / `useMemo` / `useCallback`. No global state library.
- API calls are `fetch(...)` with `Accept: 'application/json'` and CSRF token from `meta[name="csrf-token"]`.
- Form submissions for downloads use hidden `<form method="POST" target="_blank">` patterns (e.g. CSV/PDF export in `Admin/Reports/Index.jsx`, PDF export in `Admin/Reports/Student.jsx`).
- POST JSON to API-style endpoints; standard form POST for non-AJAX flows.

### Components
- `AdminLayout.jsx` is the most complex layout: it tracks protected history in `sessionStorage`, intercepts `popstate` to show a `LogoutModal`, and renders a collapsible sidebar.
- `SimpleLayout.jsx` and `AuthenticatedLayout.jsx` are simpler alternatives used elsewhere.
- `RoleGate.jsx` exists for role-conditional rendering; read it before extending.
- `useRoles` hook exposes `isAdmin` / `isAccountant` / `isTeacher` from `usePage().props.auth.user.role`.
- `useBackButtonLogoutModal` hook provides back-button-aware logout.
- `useUnsavedChangesWarning` hook is available for form-leave warnings.
- `MultiSelect.jsx` wraps `react-select` for filter dropdowns.
- `SearchInput.jsx`, `TabSessionTimeout.jsx`, `LogoutModal.jsx` are reusable.

### Naming & structure
- One component per file (default export).
- Local helper components live in the same file as the page that uses them (e.g. `Stat` inside `Admin/Reports/Index.jsx`).
- Sub-folder components in `Admin/Reports/`, `Admin/Students/`, etc. are used for page-specific building blocks (e.g. `EnrollmentsCell.jsx`, `StudentRow.jsx`, `SectionPicker.jsx`).
- Per-page utility files exist: `Accountant/Students/utils.js`, `Accountant/LateFees/utils.js`.

### Helper conventions
- Currency: `formatPKR(amount)` → `"Rs. 1,234"`.
- Month: `formatMonth("2026-04")` → `"April 2026"`.
- Month options: `generateMonthOptions(year)` → `[{value:"2026-01",label:"January 2026"}, ...]`.
- Date utilities are mostly native `Date` + `toLocaleString`. Carbon helpers are server-side only.

## 11.4 Date / time conventions

- Server: `config('app.timezone')` is the project default (read in `app/Console/Commands/GenerateMonthlyFees.php`, `MonthlyFeeResolver`, `PendingFeesController`, `LateFeeSummaryController`, etc.).
- The Student Performa engine uses `Carbon::create($year, $m, $d)` without explicit timezone for the year loop — INSUFFICIENT INFORMATION on whether this is intentional.
- DB date columns: `attendance.date` is `date`, `payments.paid_at` is `timestamp`, `fee_rate_periods.effective_from/to` are `date`, `fee_rate_periods.created_at/updated_at` are timestamps.
- JavaScript: native `Date` only. There is no dayjs or moment.

## 11.5 Naming for the Student Performa specifically

When touching the Student Performa, match the existing variable names:

- Server: `$student`, `$gurmukhi`, `$kirtan` (top-level shape passed to Blade).
- Server: `$request->student_id`, `$request->year`, `$request->month_from`, `$request->month_to`.
- React: `studentId`, `year`, `monthFrom`, `monthTo`, `report`, `loading`, `error`.
- Section IDs in the engine: `$gurmukhiSections`, `$kirtanSections` (Collections of `student_section_id`).

## 11.6 When you add code

- **Place a new module** in `app/Http/Controllers/<Role>/<Name>Controller.php` if it's role-scoped, or `app/Http/Controllers/<Name>Controller.php` if global.
- **Place a new model** in `app/Models/`, declare `$fillable` explicitly, define relations as methods.
- **Place a new migration** in `database/migrations/` with the timestamped prefix.
- **Place a new page** in `resources/js/Pages/<Role>/<Sub>/<Page>.jsx`. Sub-folders are common.
- **Place a new shared component** in `resources/js/Components/`. Use `Admin/Components/` for admin-only widgets.
- **Place a new helper** in `resources/js/utils/helper.js` (or a new file under `utils/` for larger surfaces).
- **Place a new PDF template** in `resources/views/reports/`. Reuse the school header block by copy-paste unless you intentionally refactor it into a shared partial.
- **Place a new service** in `app/Services/`. Resolve via constructor injection (`__construct(private readonly MyService $svc) {}`).
- **Add a new route** to the appropriate `routes/<role>.php` file. Use `name('...')` and keep the dot-notation style.
- **Wire authorization** by placing the route inside the `role:<roles>` middleware group; do **not** rely solely on `RoleGate` or `useRoles` on the frontend.

## 11.7 Things to NOT do

- Do not introduce a new state management library without first surveying whether plain `useState` is enough.
- Do not add new tables to `ReportRegistry` unless you also wire them into `ReportController::build` and the React filter UI.
- Do not add new payment flows without honoring `payments.deleted_at IS NULL` in every "is paid" check.
- Do not add a `student_sections` row outside of a `(student_id, class_id)`-unique key.
- Do not introduce a second "is paid" definition. The canonical one is `EXISTS(SELECT 1 FROM payments WHERE fee_id=fees.id AND deleted_at IS NULL)` or its `leftJoin` equivalent.
- Do not hard-delete `payments`. Always `delete()` (soft) or refuse.
- Do not write to `fees.title = 'Monthly Fee'` from a place other than `GenerateMonthlyFees`; the Student Performa relies on `fees.title` being `null` for monthly fees.
