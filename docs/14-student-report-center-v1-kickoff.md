# 14 — Student Report Center V1 — Implementation Kickoff

> **Posture.** Senior engineer, pre-implementation. No code yet. Validate the V2 design against the actual codebase, then produce a constrained V1 plan.
>
> **Goal.** Ship a robust Student Report Center V1 covering the **Student Performance Report only**, with academic-session-aware range filtering, a clean service layer, and a single source of truth for screen + PDF.
>
> **Out of scope for V1 (deferred to V2+).** Attendance Report, Fee Report, Annual Progress Report, History Report, custom report builder, parent portal, bulk class reports, SMS/email scheduling, comparison reports, custom field builder.

---

## 1. Current State Analysis

What the codebase actually contains, as of 2026-06-07.

### 1.1 Backend surface

| File | Role | Status |
|---|---|---|
| `app/Http/Controllers/Admin/ReportController.php` | One controller, three engines (`buildFeesReport`, `buildAttendanceReport`, `buildStudentReport`). | Working, broken correctness (audit). |
| `app/Http/Controllers/Admin/AdminAttendanceController.php` | Admin attendance grid (separate from reports). | Untouched by V1. |
| `app/Http/Controllers/Admin/FeesController.php` | Fee listing, collect, de-collect, custom fees. | Untouched by V1. |
| `app/Http/Controllers/Admin/PendingFeesController.php` | Onboarding `assumed_pending_months`. | Untouched by V1. |
| `app/Http/Controllers/Admin/FeeRatePeriodController.php` | Rate periods. | Untouched by V1. |
| `app/Services/MonthlyFeeResolver.php` | Resolves monthly amount for `(enrollment, YYYY-MM)`. | Reused by V1. |
| `app/Reports/ReportRegistry.php` | Metadata for report types. Only `fees` is implemented. | V1 does not extend this. |
| `app/Console/Commands/GenerateMonthlyFees.php` | Runs `fees:generate-monthly`. | Untouched. |
| `database/seeders/SchoolSetupSeeder.php` | Seeds Gurmukhi (`default_monthly_fee=600`) + Kirtan (`default_monthly_fee=0`). | Untouched. |
| `database/seeders/DemoFeeSeeder.php` | Writes `month` in `'F Y'` format. **Latent bug** (audit B-02). | **Fixed in V1 Phase 1** (one-line change). |

### 1.2 Frontend surface

| File | Role | Status |
|---|---|---|
| `resources/js/Pages/Admin/Reports/Index.jsx` | Fees Report UI (separate from Performa). | Untouched. |
| `resources/js/Pages/Admin/Reports/Attendance.jsx` | Attendance Report UI. | Untouched. |
| `resources/js/Pages/Admin/Reports/Student.jsx` | The current Student Performa UI. **To be replaced.** | V1 target. |
| `resources/js/Layouts/AdminLayout.jsx` | Sidebar links: `Reports → Fees Report / Attendance Report / Student Report`. | V1 edits the "Student Report" entry to "Student Center" and points at the new route. |
| `resources/js/Components/MultiSelect.jsx` | `react-select` wrapper. | Reused by V1. |

### 1.3 PDF surface

| File | Role | Status |
|---|---|---|
| `resources/views/reports/fees.blade.php` | Fees PDF. | Untouched. |
| `resources/views/reports/attendance.blade.php` | Attendance PDF. | Untouched. |
| `resources/views/reports/student.blade.php` | Student Performa PDF. **To be replaced.** | V1 target. |
| `resources/views/reports/partials/attendance-calendar.blade.php` | 12-month mini calendar. Reused by the student PDF. | V1 edits this to take a list of months instead of "all 12". |

### 1.4 Database surface

Tables relevant to the Student Report:

| Table | Used by V1? | Notes |
|---|---|---|
| `students` | ✅ | Add `enrollment_date` (V1). `status` remains string. |
| `student_sections` | ✅ | Add `transferred_at` (V1). |
| `classes` | ✅ | `type` ('gurmukhi' / 'kirtan') is the division key. No change. |
| `sections` | ✅ | No change. |
| `fees` | ✅ | Bug fix: `DemoFeeSeeder` writes wrong format. |
| `payments` | ✅ | No change. |
| `attendance` | ✅ | No change. |

**Tables that do NOT exist yet** (per the V2 design but deferred from V1):

- `student_status_history` — deferred.
- `report_presets` — the model exists in `app/Models/ReportPreset.php` but **no migration has ever created the table**. Defer to V2.
- `student_annual_remarks` — only needed for the Annual Progress Report (V2+). Defer.
- Any academic session table — **does not exist** in the codebase today. The V2 design assumed one. V1 must decide how to model this (see §2.3 below).

### 1.5 The audit's confirmed bugs (relevant to V1)

From `docs/12-student-performa-forensic-audit.md`:

| Bug | Status in V1 |
|---|---|
| B-01 free student shows pending monthly fees | **Fixed** in V1 (filter by `student_type` in the engine). |
| B-02 seeder format mismatch | **Fixed** in V1 (one-line `YYYY-MM` change). |
| B-03 screen shows current month, PDF shows full year | **Fixed** in V1 (single source of truth). |
| B-04 Kirtan rating reflects marking discipline | **Improved** in V1 (lessons / present normalisation). |
| B-05 attendance % uses marked days | **Improved** in V1 (add a "marked days" footnote; true fix is out of scope). |
| B-06 month-range filter ignored on screen | **Fixed** in V1. |
| B-07 same engine runs twice for PDF | **Fixed** in V1 (cache). |
| B-08 `console.log` in render | **Fixed** in V1. |
| B-10 dead `LegacyAttendanceCalendar` | **Removed** in V1. |
| B-12 React looks up `attendance.year` (never set) | **Fixed** in V1 (server emits `meta.year` explicitly). |
| B-13 division detection divergence | **Fixed** in V1 (shared helper). |
| B-14 Kirtan SummaryCard for non-Kirtan students | **Fixed** in V1 (engine emits `enrolled` flag; UI hides card). |
| 8.6 missing `date_format` validation | **Fixed** in V1. |

The remaining audit findings (rate-period changes affecting historical amounts, partial payments, archived student hard-deletion) are **deferred** — they are systemic issues that the V2 design partially addresses but V1 will not.

---

## 2. Gap Analysis — Current vs V2 (V1-Scoped)

### 2.1 What V1 keeps from V2

| V2 design recommendation | V1 disposition |
|---|---|
| Single engine, single value object | **Kept.** `StudentReport` value object lives at `app/Support/StudentReport/`. |
| Repository interfaces with Eloquent default | **Kept, but simplified** (see §3). |
| Service class with pure functions | **Kept, but simplified** (one service, four helpers; no separate repository layer). |
| `MonthRange` helper | **Kept.** Pure function, easy to test. |
| Calendar grid in PDF | **Kept.** The existing partial is reused with a small change. |
| PDF and screen share the same JSON | **Kept.** The PDF renders the same `StudentReport` value object. |
| Filter presets (Current Year, Academic Year, etc.) | **Kept.** Lives in the React page. |
| Caching with invalidation hooks | **Kept.** Simple `Cache::remember` + manual `forget` on writes. |
| New `normalizeDivisionType` shared helper | **Kept.** Single file, two callers initially. |
| `ReportCache` class with tag-based invalidation | **Simplified.** A free function `cache_student_report($key, $build)` and a manual `forget_student_report($studentId)` (see §3.4). |
| Inertia value-object → JSON serializer | **Kept.** A single `toArray()` on the value object. |
| Inline SVG trend chart | **Deferred to V1.1.** Not needed for V1's "present, absent, leave, %, monthly trend" scope. V1.1 ships the SVG. V1.0 uses a simple HTML table. |
| Kirtan performance component map | **Kept.** The shape is `{score, rating, components: {attendance, lesson}}` even in V1. |
| Calendar layout that auto-picks orientation | **Simplified.** V1 uses the existing 3-per-row portrait layout for ≤ 12 months, and 3-per-row with smaller font for 13-18 months. Landscape auto-orientation is V1.1. |

### 2.2 What V1 drops (deferred to V1.1, V2, or later)

| V2 recommendation | Reason deferred |
|---|---|
| Attendance Report tab | V1 ships Performance only. The engine is structured to add a tab without rework. |
| Fee Report tab | Same. |
| Annual Progress Report | V2. |
| Student History Report | V2. |
| `student_status_history` table | V1 uses `students.status` directly. The status enum is added in V1 (PHP-level, no DB enum). |
| `students.enrollment_date` column | **Kept** — see §4.1. |
| `student_sections.transferred_at` column | **Kept** — see §4.2. |
| Status history timeline | V2. |
| Principal's remark | V2. |
| Saved presets (`ReportPreset` model) | V1.1 (the model exists; no UI). |
| Free-student fee suppression | V1 implements this. |
| Fee Health Score | V1.1. |
| Consistency Score | Audit said "skip". V1 also skips. |
| Attendance heatmap | V1 skips. |
| "Most missed day of week" | V1.1. |
| Streak analysis (longest present/absent/current) | V1 includes "current streak" only; longest streaks are V1.1. |
| Multi-orientation PDF | V1.1. |
| Page-break controls in PDF | V1 uses simple `<div style="page-break-before: always;">` — good enough. |
| Section transition timeline in History | V2. |
| Attendance % = present / school_days | V1.1. |
| Calendar cell "paid today" dot | V1.1. |

### 2.3 Academic sessions: a design decision the V2 plan did not address

The V2 design's §4.1 listed a filter for "Academic Year" (April–March, configurable). The current codebase has **no academic session concept**. There is no `academic_sessions` table, no `app_settings` table, no concept of "session" anywhere outside of Laravel's session driver.

**Three options for V1:**

| Option | Cost | Benefit |
|---|---|---|
| A. Hardcode April 1 → March 31 as the academic year in code. | 0 schema, 0 config. | Ships today. The school can change it in code if needed. |
| B. Add an `app_settings` table with one row, key/value pairs. | 1 migration, 1 model. | Allows future settings (school name, logo path, fee rate cap). |
| C. Add an `academic_sessions` table (id, name `2025-26`, start_date, end_date). | 1 migration, 1 model, 1 seeder. | True model, supports per-session fee rate periods later. |

**V1 picks Option A + a small concession to Option C.** Concretely:

- `app/Support/StudentReport/AcademicSession.php` is a static helper that takes a year and returns `[start => 'YYYY-04-01', end => '(YYYY+1)-03-31']`. Hard-coded for V1. Trivial to refactor later.
- The React filter offers a preset "Academic Session 2025-26" which resolves to Apr 2025 → Mar 2026.
- The V1.1 follow-up may add a settings table to make the boundary configurable. **Not a V1 concern.**

**Why not Option C in V1:** an `academic_sessions` table with a single seeded row is over-engineering for a school that has one session at a time. The cost of adding it later is small (one migration, one backfill, one refactor of `AcademicSession::forYear()`). The cost of building it now is that it adds two new files, a seeder, a model, and a UI for managing sessions that the admin does not need yet.

**V1 also drops "Configurable session boundary".** If the school needs a different boundary, the V1.1 follow-up adds a single `config('student_report.session_start_month')` setting that defaults to 4 (April).

---

## 3. Recommended Architecture (V1)

### 3.1 File layout (new files only)

```
app/
  Support/
    StudentReport/
      StudentReportRequest.php          # value object: validated filter input
      StudentReport.php                 # value object: the report itself
      StudentIdentity.php               # value object: identity block
      Division.php                      # enum: 'gurmukhi' | 'kirtan'
      MonthRange.php                    # static helper: range → list of months
      AcademicSession.php               # static helper: year → [start, end]
      NormalizeDivision.php             # static helper: class.type + class.name → division
      Enums/
        StudentStatus.php               # 'active' | 'inactive' | 'graduated' | 'transferred' | 'dropped'
        AttendanceStatus.php            # 'present' | 'absent' | 'leave'
  Services/
    StudentReport/
      StudentReportService.php          # the engine (orchestrator)
      StudentIdentityResolver.php       # loads identity
      AttendanceResolver.php            # loads + summarises attendance
      FeeResolver.php                   # loads + summarises fees
      KirtanScoreCalculator.php         # pure function
      CalendarBuilder.php               # pure function: months[] + records → MonthCalendar[]
      StudentReportCache.php            # Cache::remember wrapper
  Http/
    Controllers/Admin/
      StudentReportCenterController.php # replaces the /admin/reports/student routes
    Requests/
      StudentReportCenterRequest.php    # FormRequest: validates the filter
  Models/
    ReportPreset.php                    # already exists; no change in V1 (V1.1)
database/
  migrations/
    2026_06_07_000001_add_enrollment_date_to_students.php
    2026_06_07_000002_add_transferred_at_to_student_sections.php
resources/
  js/
    Pages/
      Admin/
        StudentReportCenter/
          Index.jsx                     # the new screen
          components/
            FilterBar.jsx
            IdentityBlock.jsx
            AttendanceSection.jsx
            FeeSection.jsx
            KirtanSection.jsx
            CalendarSection.jsx
            utils.js                    # month labels, date formatting
  views/
    reports/
      student_center.blade.php          # the new PDF
      partials/
        attendance_calendar.blade.php   # renamed from attendance-calendar.blade.php
                                        # takes `months[]` instead of "all 12"
routes/
  admin.php                              # add new routes, mark old ones deprecated
```

### 3.2 The shape of the engine

`StudentReportService::build(StudentReportRequest $req): StudentReport`

```php
final class StudentReportService
{
    public function __construct(
        private readonly StudentIdentityResolver $identityResolver,
        private readonly AttendanceResolver $attendanceResolver,
        private readonly FeeResolver $feeResolver,
        private readonly CalendarBuilder $calendarBuilder,
        private readonly KirtanScoreCalculator $kirtanScoreCalculator,
        private readonly StudentReportCache $cache,
    ) {}

    public function build(StudentReportRequest $req): StudentReport
    {
        return $this->cache->remember($req, function () use ($req) {
            $identity = $this->identityResolver->resolve($req->studentId);
            $range = MonthRange::from($req);
            $divisions = [];

            if ($req->division === 'gurmukhi' || $req->division === 'all') {
                $divisions['gurmukhi'] = $this->buildDivisionReport(
                    Division::Gurmukhi, $identity, $range, $req
                );
            }
            if ($req->division === 'kirtan' || $req->division === 'all') {
                $divisions['kirtan'] = $this->buildDivisionReport(
                    Division::Kirtan, $identity, $range, $req
                );
            }

            return new StudentReport(
                identity: $identity,
                range: $range,
                divisions: $divisions,
                meta: new StudentReportMeta(
                    generatedAt: now()->toDateTimeString(),
                    year: $req->yearLabel(),
                ),
            );
        });
    }

    private function buildDivisionReport(...): DivisionReport
    {
        // load attendance + fees for this division
        // build calendar
        // compute Kirtan score if Kirtan
        // return value object
    }
}
```

Key property: the service has **no `Request` object in its method bodies**. It accepts a value object and returns a value object. The controller is the only place that touches `Request`.

### 3.3 Value object hierarchy (V1)

```php
final class StudentReportRequest
{
    public function __construct(
        public readonly int $studentId,
        public readonly string $rangeMode,        // 'academic_session' | 'calendar_year' | 'month' | 'range'
        public readonly ?int $singleYear,         // for 'calendar_year' or 'academic_session'
        public readonly ?string $singleMonth,     // for 'month' ('YYYY-MM')
        public readonly ?string $rangeStart,      // for 'range' ('YYYY-MM')
        public readonly ?string $rangeEnd,        // for 'range' ('YYYY-MM')
        public readonly string $division,         // 'all' | 'gurmukhi' | 'kirtan'
    ) {}

    public static function fromArray(array $data): self { /* validation + construction */ }
}

final class StudentReport
{
    public function __construct(
        public readonly StudentIdentity $identity,
        public readonly MonthRange $range,
        /** @var array<string, DivisionReport> */
        public readonly array $divisions,
        public readonly StudentReportMeta $meta,
    ) {}

    public function toArray(): array { /* for Inertia + PDF */ }
}

final class StudentIdentity
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly ?string $fatherName,
        public readonly StudentStatus $status,
        public readonly string $studentType,            // 'paid' | 'free'
        /** @var list<EnrollmentInfo> */
        public readonly array $enrollments,
        public readonly ?string $enrollmentDate,        // 'YYYY-MM-DD'
        public readonly ?string $lastAttendanceDate,    // 'YYYY-MM-DD'
        public readonly ?string $lastPaymentDate,       // 'YYYY-MM-DD'
        public readonly int $outstandingAmount,         // total pending in PKR
        public readonly int $outstandingMonths,         // count
    ) {}
}

final class EnrollmentInfo
{
    public function __construct(
        public readonly string $className,
        public readonly string $sectionName,
        public readonly Division $division,
    ) {}
}

final class MonthRange
{
    public function __construct(
        public readonly string $startLabel,             // '2025-01'
        public readonly string $endLabel,               // '2026-06'
        /** @var list<MonthCell> */
        public readonly array $months,                  // 1..36 entries, chronological
        public readonly int $totalMonths,
    ) {}

    public static function forAcademicSession(int $year): self { /* Apr YYYY → Mar YYYY+1 */ }
    public static function forCalendarYear(int $year): self   { /* Jan..Dec YYYY */ }
    public static function forMonth(string $yyyymm): self     { /* 1 month */ }
    public static function forRange(string $start, string $end): self
    {
        // Cap at 36 months; throw RangeException if exceeded.
    }
}

final class MonthCell
{
    public function __construct(
        public readonly int $year,
        public readonly int $month,
        public readonly string $label,                  // 'Jan 2025'
        /** @var array<int, DayCell>  keyed by day number (1..31) */
        public readonly array $days,
        public readonly int $presentCount,
        public readonly int $absentCount,
        public readonly int $leaveCount,
    ) {}
}

final class DayCell
{
    public function __construct(
        public readonly ?AttendanceStatus $status,      // null = no record
        public readonly bool $lessonLearned,
    ) {}
}

final class DivisionReport
{
    public function __construct(
        public readonly Division $division,
        public readonly AttendanceSummary $attendance,
        public readonly FeeSummary $fees,
        public readonly ?KirtanScore $kirtanScore,      // Kirtan only; null for Gurmukhi
        /** @var list<MonthCell> */
        public readonly array $months,
        public readonly bool $enrolled,                 // false if student not in this division
    ) {}
}

final class AttendanceSummary
{
    public function __construct(
        public readonly int $present,
        public readonly int $absent,
        public readonly int $leave,
        public readonly int $markedDays,                // present+absent+leave
        public readonly float $percentage,              // present / markedDays * 100
        public readonly ?int $currentStreakLength,      // from most recent day backward
        public readonly ?AttendanceStatus $currentStreakStatus,
    ) {}
}

final class FeeSummary
{
    public function __construct(
        public readonly int $totalCharged,
        public readonly int $totalPaid,
        public readonly int $pending,
        public readonly int $outstandingMonths,
        public readonly ?string $lastPaymentDate,
        /** @var list<FeeRow> */
        public readonly array $rows,                    // ordered by month asc
        /** @var list<MonthFeeSummary> */
        public readonly array $monthlyBreakdown,        // one per month with a fee
    ) {}
}

final class MonthFeeSummary
{
    public function __construct(
        public readonly string $month,                  // '2025-04'
        public readonly int $charged,
        public readonly int $paid,
        public readonly int $pending,
        public readonly bool $isPaid,
    ) {}
}

final class KirtanScore
{
    public function __construct(
        public readonly float $score,                   // 0..100
        public readonly string $rating,                 // 'Excellent' | 'Good' | 'Average' | 'Needs Improvement'
        public readonly float $attendanceComponent,     // 0..100
        public readonly float $lessonComponent,         // 0..100
        public readonly int $totalClasses,
        public readonly int $lessonsLearned,
    ) {}
}
```

### 3.4 Cache design (V1)

V1 does **not** use Laravel cache tags (they require a tag-supporting store; SQLite default is "database" which doesn't). V1 uses a **namespaced key** with a manual `forget` on writes:

```php
final class StudentReportCache
{
    private const TTL_SECONDS = 600;
    private const KEY_PREFIX = 'student_report:v1:';

    public function key(StudentReportRequest $req): string
    {
        return self::KEY_PREFIX . sha1(json_encode([
            $req->studentId,
            $req->rangeMode,
            $req->singleYear,
            $req->singleMonth,
            $req->rangeStart,
            $req->rangeEnd,
            $req->division,
        ]));
    }

    public function remember(StudentReportRequest $req, Closure $build): StudentReport
    {
        return Cache::remember($this->key($req), self::TTL_SECONDS, $build);
    }

    public function forget(int $studentId): void
    {
        // SQLite cache driver does not support key listing, so we use a
        // fingerprint: store a per-student generation counter, append to key.
        Cache::forget('student_report:v1:gen:' . $studentId);
    }
}
```

**The fingerprint trick.** V1's cache key embeds a per-student generation counter. When data changes, we bump the counter; all stale cache keys for that student become unreachable (they are orphaned in the cache but will expire naturally). This is the simplest possible tag-based invalidation without tags.

```php
// In the cache key:
public function key(StudentReportRequest $req): string
{
    $gen = Cache::get('student_report:v1:gen:' . $req->studentId, 1);
    return self::KEY_PREFIX . $gen . ':' . sha1(/* ... */);
}

// On write:
public function forget(int $studentId): void
{
    Cache::increment('student_report:v1:gen:' . $studentId);
}
```

When the engine runs, it reads the current generation; cache misses build the report and store it under the new-generation key. On any data write, the generation is bumped, the old key is orphaned, and the next build produces a fresh report.

**TTL is 10 minutes.** The counter approach means a stale cache cannot outlive the data invalidation, so the TTL is a safety net, not the primary mechanism.

**V1 invalidation points** (only the ones that affect report data):
- `FeePaymentController::store` — `StudentReportCache::forget($studentId)`.
- `FeesController::collect` / `deCollect` — same.
- `FeesController::storeCustomFee` / `updateCustomFee` / `destroyCustomFee*` — same.
- `FeeRatePeriodController` mutations that re-price fees — same.
- `AttendanceController::store` — same.
- `AdminAttendanceController::save` — same.
- `StudentController::store` and admin bulk update (new `StudentSection` rows) — same.

The performance win: a typical "Build then Export PDF" flow now hits the cache for the second call, dropping engine time from ~100 ms to ~5 ms.

### 3.5 Controller

```php
final class StudentReportCenterController
{
    public function page(Request $request)
    {
        return Inertia::render('Admin/StudentReportCenter/Index', [
            'students' => $this->loadStudentOptions(),
        ]);
    }

    public function build(StudentReportCenterRequest $request): JsonResponse
    {
        $req = StudentReportRequest::fromArray($request->validated());
        $report = $this->service->build($req);
        return response()->json($report->toArray());
    }

    public function exportPdf(StudentReportCenterRequest $request): StreamedResponse
    {
        $req = StudentReportRequest::fromArray($request->validated());
        $report = $this->service->build($req);
        $pdf = Pdf::loadView('reports.student_center', $report->toArray())
                  ->setPaper('a4', 'portrait');
        return $pdf->stream("student-center-{$req->studentId}.pdf");
    }
}
```

Three lines of business logic in the controller. Everything else is in the service or value objects.

### 3.6 Routes

```php
// In routes/admin.php, under the existing role:admin group:

Route::prefix('student-report-center')->name('student-report-center.')->group(function () {
    Route::get('/', [StudentReportCenterController::class, 'page'])->name('page');
    Route::post('/build', [StudentReportCenterController::class, 'build'])->name('build');
    Route::post('/export/pdf', [StudentReportCenterController::class, 'exportPdf'])->name('export.pdf');
});

// The old /admin/reports/student routes are kept for 2 sprints, then removed.
```

### 3.7 Frontend

A new page at `resources/js/Pages/Admin/StudentReportCenter/Index.jsx`, with a two-pane layout (filter bar at the top, preview on the right). The page consumes the JSON from `POST /admin/student-report-center/build`. The PDF export uses a hidden form POST.

The filter bar offers four range modes:

| Range mode | UI controls | Resolves to |
|---|---|---|
| Academic Session | year dropdown (2024, 2025, 2026) | Apr `year` → Mar `year+1` |
| Calendar Year | year dropdown | Jan `year` → Dec `year` |
| Single Month | year + month dropdown | that month only |
| Custom Range | year + month start + year + month end | the literal range, max 36 months |

Quick presets in a dropdown:

| Preset | Range mode + values |
|---|---|
| Current Academic Session | academic_session, year=current |
| Last Academic Session | academic_session, year=current-1 |
| Current Calendar Year | calendar_year, year=current |
| Last 12 Months | range, start=today-12mo, end=today |
| This Calendar Year So Far | range, start=currentYear-01, end=today |

The preview renders four sections in a tabbed layout inside the right pane:

1. **Student Snapshot** — the identity block.
2. **Performance** — both divisions' attendance + fees + Kirtan (if applicable), in two columns.
3. **Fees Detail** — full fee table + monthly breakdown.
4. **Calendar** — the calendar grid, paginated by 3 months per page.

The PDF combines all four into a single document. The screen tabbing is for navigation; the PDF is sequential.

---

## 4. Database Impact

V1's schema footprint is **deliberately small**.

### 4.1 Required migrations (V1)

| Migration | Table | Change | Risk |
|---|---|---|---|
| `2026_06_07_000001_add_enrollment_date_to_students.php` | `students` | Add `enrollment_date DATE NULL` | Zero. Nullable, no FK. |
| `2026_06_07_000002_add_transferred_at_to_student_sections.php` | `student_sections` | Add `transferred_at DATETIME NULL` | Zero. Nullable, no FK. |

**Backfill for migration 1:** for each student, set `enrollment_date = MIN(student_sections.created_at)`. For students with no enrollments, leave null.

**Backfill for migration 2:** all existing `student_sections` rows get `transferred_at = NULL` (they are current enrollments). V1 does not retroactively split historical section changes.

### 4.2 Deferred migrations (V1.1 or V2)

| Migration | Reason deferred |
|---|---|
| `student_status_history` | Only needed for the History Report (V2). V1 reads `students.status` directly. |
| `app_settings` (for configurable session boundary) | Hardcoded April 1 in V1. |
| `academic_sessions` (full table) | Over-engineering for one session at a time. |
| `report_presets` table | The model exists; the migration does not. V1.1. |
| `student_annual_remarks` | Annual Progress Report (V2). |
| Status enum on `students.status` | Already a string. PHP enum added at the code level (no DB change). |

### 4.3 No data deletion

V1 does not delete any rows. It only adds nullable columns. **Rollback is safe** — drop the two columns, the system returns to its current state.

---

## 5. React Changes

### 5.1 New files

| File | Purpose |
|---|---|
| `resources/js/Pages/Admin/StudentReportCenter/Index.jsx` | The new page. |
| `resources/js/Pages/Admin/StudentReportCenter/components/FilterBar.jsx` | The filter bar (range mode, year, month(s), division, quick presets). |
| `resources/js/Pages/Admin/StudentReportCenter/components/IdentityBlock.jsx` | Renders the Student Snapshot. |
| `resources/js/Pages/Admin/StudentReportCenter/components/AttendanceSection.jsx` | Attendance summary + monthly breakdown table. |
| `resources/js/Pages/Admin/StudentReportCenter/components/FeeSection.jsx` | Fee summary + fee table + monthly breakdown. |
| `resources/js/Pages/Admin/StudentReportCenter/components/KirtanSection.jsx` | Kirtan performance score + components. |
| `resources/js/Pages/Admin/StudentReportCenter/components/CalendarSection.jsx` | Calendar grid (paged 3 per page). |
| `resources/js/Pages/Admin/StudentReportCenter/components/utils.js` | `monthLabel`, `formatPKR`, `formatPercent`, etc. |

### 5.2 Deleted files

| File | Reason |
|---|---|
| `resources/js/Pages/Admin/Reports/Student.jsx` | Replaced by `Admin/StudentReportCenter/Index.jsx`. |

### 5.3 Modified files

| File | Change |
|---|---|
| `resources/js/Layouts/AdminLayout.jsx` | Replace the "Student Report" sidebar link with "Student Center" → `/admin/student-report-center`. Keep the old link for 2 sprints as a "Legacy" link. |
| `routes/admin.php` | Add the new routes; mark old `POST /admin/reports/build` and `POST /admin/reports/export/pdf` for `report=student` as deprecated. |

### 5.4 React component design

- **No new state library.** Plain `useState` and `useEffect`, mirroring the existing pattern.
- **No new dependencies.** `MultiSelect` (existing), `react-hot-toast` (existing) are sufficient.
- **URL state** (via `router.replace` with query string) is **deferred to V1.1.** V1 keeps the current "press Build to render" pattern.
- **The Calendar component** renders only the months in `report.range.months`. It does not look up the current month or any client-side state. Single source of truth.
- **Free student handling:** the engine emits `student.studentType`. The Fee Section checks this and renders a "This student is exempt from monthly fees" panel if `'free'`. No client-side filtering.
- **No enrollment in division:** the engine emits `divisionReport.enrolled = false`. The Attendance, Fee, and Calendar sections for that division render an empty state ("Student is not enrolled in Kirtan").

---

## 6. Backend Changes

### 6.1 New files

| File | Purpose | Lines (est.) |
|---|---|---|
| `app/Support/StudentReport/StudentReportRequest.php` | Value object: validated filter input. | 80 |
| `app/Support/StudentReport/StudentReport.php` | Value object: the report. `toArray()`. | 50 |
| `app/Support/StudentReport/StudentIdentity.php` | Value object: identity block. | 50 |
| `app/Support/StudentReport/MonthRange.php` | Static helper: range → months[]. | 100 |
| `app/Support/StudentReport/AcademicSession.php` | Static helper: year → [start, end]. | 30 |
| `app/Support/StudentReport/NormalizeDivision.php` | Static helper: class.type + class.name → division. | 30 |
| `app/Support/StudentReport/Division.php` | Enum. | 15 |
| `app/Support/StudentReport/Enums/StudentStatus.php` | Enum. | 30 |
| `app/Support/StudentReport/Enums/AttendanceStatus.php` | Enum. | 20 |
| `app/Services/StudentReport/StudentReportService.php` | Orchestrator. | 150 |
| `app/Services/StudentReport/StudentIdentityResolver.php` | Loads identity. | 80 |
| `app/Services/StudentReport/AttendanceResolver.php` | Loads + summarises attendance. | 120 |
| `app/Services/StudentReport/FeeResolver.php` | Loads + summarises fees. | 100 |
| `app/Services/StudentReport/CalendarBuilder.php` | Pure: months[] + records → MonthCell[]. | 100 |
| `app/Services/StudentReport/KirtanScoreCalculator.php` | Pure: attendance + lesson → score. | 40 |
| `app/Services/StudentReport/StudentReportCache.php` | `Cache::remember` wrapper. | 60 |
| `app/Http/Controllers/Admin/StudentReportCenterController.php` | Page + build + pdf. | 70 |
| `app/Http/Requests/StudentReportCenterRequest.php` | FormRequest. | 60 |

**Total new code: ~1,200 lines.** The existing controller method is 280 lines, so the net change is roughly 4x. That is the cost of clean architecture; the benefit is testability and future extensibility.

### 6.2 Modified files

| File | Change |
|---|---|
| `app/Http/Controllers/Admin/ReportController.php` | The `buildStudentReport` method and the `student` report dispatch are kept for 2 sprints (deprecated), then removed. |
| `app/Http/Controllers/Admin/FeesController.php` | Add `StudentReportCache::forget($studentId)` in `collect`, `deCollect`, `storeCustomFee`, `updateCustomFee`, `destroyCustomFeeForStudent`, `destroyCustomFeeForSection`. |
| `app/Http/Controllers/FeePaymentController.php` | Add `StudentReportCache::forget($studentId)` in `store`. |
| `app/Http/Controllers/AttendanceController.php` | Add `StudentReportCache::forget($studentId)` in `store`. |
| `app/Http/Controllers/Admin/AdminAttendanceController.php` | Add `StudentReportCache::forget($studentId)` in `save`. |
| `app/Http/Controllers/Admin/FeeRatePeriodController.php` | Add `StudentReportCache::forget($studentId)` in period mutations. |
| `app/Http/Controllers/StudentController.php` | Add `StudentReportCache::forget($studentId)` in `store`. |
| `routes/admin.php` | Add new routes. |
| `app/Console/Commands/GenerateMonthlyFees.php` | Add `StudentReportCache::forget` for affected students. |

### 6.3 What is NOT changed

- `MonthlyFeeResolver` is reused as-is.
- `ReportRegistry` is **not extended.** The V1 Student Report Center is its own module with its own routes; it does not participate in the registry. V1.1 will register it.
- No new Eloquent models.
- No new database tables.
- No changes to existing controllers' business logic (only cache invalidation hooks added).

### 6.4 Kirtan scoring — proposal before implementation

The current logic in `ReportController.php:820-842`:

```php
$total = $attendance['summary']['present'] + $attendance['summary']['absent'] + $attendance['summary']['leave'];
$lessons = collect($attendance['months'])->sum('lessons_learned');
$percentage = $total > 0 ? round(($lessons / $total) * 100, 2) : 0;
```

**This is wrong.** A Kirtan student whose teacher never ticks `lesson_learned` scores 0% regardless of attendance. The audit's B-04 confirms this.

**Proposed V1 scoring** (re-stated from the V2 design, with a single concrete change for V1):

```php
$present = $attendance['present'];
$absent  = $attendance['absent'];
$leave   = $attendance['leave'];
$lessons = $attendance['lessons_learned'];

$totalClasses = $present + $absent + $leave;

$attendanceComponent = $totalClasses > 0 ? ($present / $totalClasses) * 100 : 0;
//   ↑ "of the days the student was marked, what % were present?"

$lessonComponent = $present > 0 ? ($lessons / $present) * 100 : 0;
//   ↑ "of the days the student was present, what % had a lesson logged?"
//   ↑ Normalised by present, not by total — fixes B-04.

$score = ($attendanceComponent * 0.6) + ($lessonComponent * 0.4);
```

**Rating buckets** (unchanged from V1, same as V2):

| Score | Rating |
|---|---|
| ≥ 85 | Excellent |
| ≥ 70 | Good |
| ≥ 50 | Average |
| < 50 | Needs Improvement |
| `present = 0` | "Not enough data" (defensive, not a rating) |

**What the V1 score does NOT do** (deferred):
- It does not include "participation" or "practice consistency" — no data exists.
- It does not include a "fee health" component — the Kirtan rating is attendance + lesson, not financial.
- It does not normalise by expected Kirtan Sundays in the range. (Kirtan has 52 Sundays/year; the engine could compute expected vs actual. V1.1.)

**Justification for the change:** the new math is defensible. A student who is present 100% but whose teacher logs lessons 0% of the time still gets 60% (Excellent requires 85). A student who is present 50% and logs lessons 50% of presents gets `0.5*60 + 0.5*40 = 50% (Average)`. A student with no attendance at all gets "Not enough data" rather than 0%. The math is not arbitrary.

**Approval needed:** this is a business rule change. The school should confirm the 60/40 weighting and the bucket boundaries before V1 ships. The kickoff recommends presenting the proposed rule to the principal as part of Phase 1.

---

## 7. PDF Changes

### 7.1 New file

`resources/views/reports/student_center.blade.php`. Sections in order:

1. **Header** — school logo, name, "Student Report" title, generated date. (Mirrors the existing `student.blade.php` header.)
2. **Student Snapshot** — a 2-column key-value table. The full identity block.
3. **Attendance — Gurmukhi** — present/absent/leave/percentage cards, then the monthly breakdown table, then the calendar grid (only the Gurmukhi months in range).
4. **Attendance — Kirtan** — same as above, plus the Kirtan score block (score, rating, components).
5. **Fees — Gurmukhi** — total/paid/pending/outstanding/last-payment, then the fee table, then the monthly breakdown.
6. **Fees — Kirtan** — same as above.
7. **Footer** — page number, "Generated on {date}".

Sections 3-6 are **wrapped in a `<div class="division-block">`** with a `page-break-inside: avoid` style. Sections are separated by `<div style="page-break-before: always;">`. Each section has its own H3 heading.

### 7.2 Modified file

`resources/views/reports/partials/attendance-calendar.blade.php` → **renamed** to `resources/views/reports/partials/student_center_calendar.blade.php`. The new partial takes:

```php
@include('reports.partials.student_center_calendar', [
    'months' => $divisionReport->months,    // list<MonthCell>
    'showLesson' => $division === 'kirtan',
])
```

**Key change:** the partial iterates `$months` (variable length) instead of building 12 fixed months. The "3 per row" layout is preserved. The `$showLesson` flag is now a parameter (was a Blade `@include` argument; now still is, but driven by the engine's `$division` instead of hardcoded in the parent).

### 7.3 What is NOT changed

- `resources/views/reports/fees.blade.php` — untouched.
- `resources/views/reports/attendance.blade.php` — untouched.
- The existing `student.blade.php` — kept for 2 sprints as a fallback (the old route is still available).

### 7.4 PDF behaviour parity with screen

The PDF renders the same `StudentReport` value object that the React page receives. **There is one JSON shape, two consumers.** The audit's B-03 (screen and PDF show different time windows) is structurally impossible in V1 because both consumers iterate the same `range.months[]` list.

The PDF is A4 portrait for V1. Landscape auto-orientation is V1.1.

---

## 8. Risk Assessment

What could break, and how V1 mitigates.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Regression in the existing Student Performa** (other admins still use it) | Medium | Medium | Old route stays live for 2 sprints with a deprecation notice in the UI. |
| **Cache invalidation misses a write path** | Medium | High (stale data shown) | The cache TTL is 10 min as a backstop. The integration test "write → bump → build" must pass for every write path. |
| **New columns break existing queries** | Low | Medium | Both new columns are nullable. Existing queries are unchanged. The backfill in the migration is idempotent. |
| **Division detection changes cause a student to appear in the wrong division** | Low | High (correctness) | The new `NormalizeDivision` helper is the **only** division detection logic. A unit test seeds classes with `type='kirtan'`, `type='Kirtan Class'`, `type=NULL`, and verifies the result. The old `LOWER(classes.type) != 'kirtan'` is replaced everywhere. |
| **PDF rendering differs from screen on a school laptop** | Medium | Medium | The PDF uses the same JSON; any divergence is a Blade template bug, not a data bug. Manual smoke test on the school's actual printer/PDF viewer. |
| **36-month cap is too restrictive** | Low | Low | Users who want longer ranges use multiple exports. The cap is documented in the filter bar. |
| **The 60/40 Kirtan weighting is wrong** | Low | Medium | Approval from the principal is required before V1 ships. The weighting is a constant in one file; changing it is a 1-line change. |
| **Performance regression on 5k students** | Low | Low | V1 only changes the per-student engine. No new "build report for class X" query. |
| **The new PDF template breaks DomPDF** | Medium | Medium | The template reuses the existing partial style (no absolute positioning, no flexbox). The smoke test runs `php artisan view:cache` and renders one PDF per edge case (1 month, 12 months, 18 months, free student, no attendance). |
| **A new Eloquent relation change in another PR breaks the engine** | Low | Medium | The engine uses Query Builder for reads (Eloquent is only used for student identity). The risk is contained. |

### 8.1 The single most important test

**Integration test: "build a report, then write a payment, then build again, then verify the second build reflects the payment."** This test must pass before V1 ships. It exercises the cache invalidation path end-to-end. Without this test, the V1 caching layer is unsafe.

---

## 9. Implementation Plan

Three phases, each one small and shippable. Each phase ends with a manual smoke test by the lead engineer + the school principal.

### Phase 1 — Foundation (2-3 days)

**Goal:** the service layer + value objects + cache exist and are unit-tested. The new route returns JSON. The old route still works.

Tasks:
1. Create the two migrations.
2. Create the value object files (`StudentReportRequest`, `StudentReport`, `StudentIdentity`, `MonthRange`, `AcademicSession`, `NormalizeDivision`, `Division`, `StudentStatus`, `AttendanceStatus`).
3. Create the service files (`StudentReportService`, `StudentIdentityResolver`, `AttendanceResolver`, `FeeResolver`, `CalendarBuilder`, `KirtanScoreCalculator`, `StudentReportCache`).
4. Create the `FormRequest` and the new controller. Wire the route. Return JSON.
5. Add the cache invalidation hooks in the 7 write paths.
6. Fix the `DemoFeeSeeder` `month` format bug (1-line).
7. Write the unit tests:
   - `MonthRange` for all four range modes.
   - `NormalizeDivision` for the three `type` variants.
   - `KirtanScoreCalculator` for the four score buckets + the "no data" case.
   - `CalendarBuilder` for the merge rule.
8. Write the integration test for cache invalidation.

**Smoke test:** `php artisan tinker` → `app(\App\Services\StudentReport\StudentReportService::class)->build($req)` returns a populated `StudentReport`. The JSON has the expected shape.

**Rollback:** revert the two migrations (`ALTER TABLE ... DROP COLUMN`), remove the new files. The old route is untouched.

**No UI change yet.** Phase 1 is invisible to admins.

### Phase 2 — UI + PDF (3-4 days)

**Goal:** the React page renders the new report, the PDF generates correctly.

Tasks:
1. Create `resources/js/Pages/Admin/StudentReportCenter/Index.jsx` and components.
2. Create `resources/views/reports/student_center.blade.php` and the renamed `student_center_calendar.blade.php` partial.
3. Update `AdminLayout` sidebar: "Student Center" link, "Legacy: Student Performa" link.
4. Wire the new routes in `routes/admin.php`.
5. Add the cache invalidation in `GenerateMonthlyFees` command.
6. Write the smoke-test checklist:
   - Free student → fees section shows "exempt" + custom fees only.
   - Inactive student → snapshot shows "Inactive", report still generates.
   - Student in only Gurmukhi → Kirtan section shows "Not enrolled".
   - Student in only Kirtan → Gurmukhi section shows "Not enrolled".
   - Range = single month → 1 calendar.
   - Range = academic session (April 2025 → March 2026) → 12 calendars.
   - Range = Jan 2025 → Jun 2026 → 18 calendars, chronological.
   - No attendance in range → attendance section shows empty state.
   - No fees in range → fees section shows empty state.
   - PDF download → opens in browser, all sections render.
7. End-to-end Playwright/Cypress test (optional — manual smoke test is sufficient for V1).

**Smoke test:** the lead engineer and the principal review the new report on a real student and confirm:
- Numbers match the existing Performa for the same year.
- Calendar layout is the same.
- Kirtan rating matches the new math.
- PDF opens and prints.

**Rollback:** remove the new sidebar link. The new page is hidden. The legacy page still works.

### Phase 3 — Decommission (1 day)

**Goal:** the old Performa is gone; the new Center is the only path.

Tasks:
1. Mark the old routes as removed in `routes/admin.php` (return 410 Gone with a redirect to the new route).
2. Mark the old `buildStudentReport` method in `ReportController` as removed (delete the code; the file shrinks from 873 to 595 lines).
3. Delete the old `student.blade.php` template.
4. Delete the old `Reports/Student.jsx` page.
5. Remove the "Legacy" link from `AdminLayout`.
6. Update `docs/02-modules.md` and `docs/06-reports-system.md` to reflect the new module.
7. Add a CHANGELOG entry.

**Smoke test:** navigate the entire admin sidebar; confirm no broken links. Build a report for 5 different students. Open each PDF. All pass.

**Rollback:** git revert. Phase 3 is the only phase that is destructive, and the destructive change is removing a feature that has been deprecated for 2 sprints.

---

## 10. What V1 Ships

Concretely, after Phase 3:

- A new admin page at `/admin/student-report-center` (sidebar: **Reports → Student Center**).
- A filter bar with four range modes, division filter, and quick presets.
- A preview pane with the four sections (Snapshot, Attendance, Fees, Kirtan, Calendar).
- A PDF download that matches the preview.
- A clean service layer with value objects, unit tests, and integration tests.
- A cache layer with TTL + generation-counter invalidation.
- Two new database columns (`students.enrollment_date`, `student_sections.transferred_at`), both nullable, both backfilled.
- One seeder fix (`DemoFeeSeeder` uses `YYYY-MM`).
- All audit bugs from `docs/12` that are in V1's scope are fixed.

## 11. What V1 Does NOT Ship

This is the explicit non-goal list. Each item is either V1.1 (the next iteration) or V2 (the long-term roadmap).

- Attendance Report tab (V1.1).
- Fee Report tab (V1.1).
- Annual Progress Report (V2).
- Student History Report (V2).
- `student_status_history` table (V2).
- Saved presets (the `ReportPreset` model is unused in V1; V1.1).
- `app_settings` table (V1.1, only if a real need emerges).
- Configurable session boundary (V1.1, same).
- Fee Health Score (V1.1).
- Streak analysis beyond current streak (V1.1).
- Most-missed-day-of-week (V1.1).
- True school-days attendance % (V1.1).
- Calendar "paid today" dot (V1.1).
- Inline SVG trend chart (V1.1).
- Landscape auto-orientation (V1.1).
- URL-encoded filter state (V1.1).
- Multi-student bulk export (V2+).
- Parent portal (V2+).
- SMS/email scheduling (V2+).
- Custom report builder (V2+).
- `academic_sessions` table (V2+, only if a real multi-session need emerges).

**Why this list is short and shippable:** every V1.1 item is a small additive change to the V1 engine. None of them require architectural rework. The V1 architecture is the foundation; V1.1 is the first floor; V2 is the second.

---

## 12. Approval Needed Before Phase 1

These three business-rule decisions need a yes/no from the school principal before code is written:

1. **Academic session boundary.** Is April 1 → March 31 correct for the school? (V1 hardcodes this; V1.1 may make it configurable.)
2. **Kirtan scoring 60/40.** Does the proposed weighting (60% attendance + 40% lessons-of-presents) and the four rating buckets (≥85 / ≥70 / ≥50 / <50) match the school's intent?
3. **Free-student fee display.** When a student is `free`, V1 will suppress the "Pending Rs. X" UI and show only custom fees (if any). The school should confirm that "free means no monthly fee liability".

If any of these is "no", Phase 1 starts with a small design tweak, not a code change. If all three are "yes", Phase 1 begins on the schedule in §13.

---

## 13. Timeline

| Phase | Calendar days | Work | Output |
|---|---|---|---|
| 1 | Day 1-3 | Foundation: schema, value objects, service, cache, tests. | New JSON endpoint works; old route untouched. |
| 2 | Day 4-7 | UI + PDF. | New page renders, PDF downloads. Old page deprecated. |
| 3 | Day 8 | Decommission. | Old page removed. |

**Total: 1 sprint (8 working days).** With a school holiday, 1.5-2 sprints.

This is the entire V1. Everything else is V1.1, V2, or later.
