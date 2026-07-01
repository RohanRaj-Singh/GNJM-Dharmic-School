# Attendance Report Redesign — Implementation Plan

> v1 currently shows a day-by-day calendar grid for **one section, one month**.
> Too narrow. Hard to scan. No cross-class view. No multi-month range.
>
> The goal: a **student-summary report** for one or more classes, over a flexible
> date range, with totals per student, top absentees, and a printable PDF.

---

## 1. What's Changing

### Current (broken)

| Feature | Status |
|---|---|
| Multi-class filter | UI allows single-class only (backend supports array) |
| Date range | Single month only |
| Per-student totals | Not shown — only per-day cells |
| Top absentees | Not shown |
| Student order | Not alphabetical |
| Summary cards | Yes (total/present/absent/leave) |
| PDF | Yes, but limited to single month |

### New (planned)

| Feature | Status |
|---|---|
| Multi-class + section filter | ✅ Using `FeeFilterSelect` (multi-select, same as Fee Report) |
| Year + month range (From → To) | ✅ Same pattern as Fee Report |
| Per-student summary row | ✅ Total P/A/L per student in range |
| Top absentees list | ✅ Top 10/20 students by absent count |
| Alphabetical order | ✅ Sorted by student name |
| Summary cards | ✅ Same, plus student count |
| PDF | ✅ Same data, same layout |

---

## 2. Files to Create / Modify

| File | Change |
|---|---|
| `resources/js/Pages/Admin/Reports/Attendance.jsx` | Full rewrite — same route, new UI |
| `app/Http/Controllers/Admin/ReportController.php` | Keep `buildAttendanceReport` — already returns row-level data. Modify to add `per_student` aggregation and `top_absentees`. |
| `resources/views/reports/attendance.blade.php` | Rewrite — same layout as screen, not per-day grid |

---

## 3. New Filter Bar

Same layout as the Fee Report page:

```
[Class(es)] [Section(s)] [Student(s)] [Status ▼]
[From Year] [From Month] → [To Year] [To Month]
[Quick Range: This Year · Last 12 Months · All Time]
[Build Report] [Export PDF]
```

All existing `FeeFilterSelect` components are reused. The date range pattern is the same.

---

## 4. Summary Cards (top)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Students │ │ Present  │ │ Absent   │ │ Leave    │ │ Attendance % │
│   42     │ │   1,245  │ │   87     │ │  23      │ │   92.3%      │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

---

## 5. Per-Student Table (main content)

```
┌──────────┬──────────┬─────────┬────────┬──────────┬──────────┐
│ Student  │ Father   │ Class   │ Present│ Absent   │ Attend % │
├──────────┼──────────┼─────────┼────────┼──────────┼──────────┤
│ Baldeep  │ Jaswin.  │ Gurmukhi│  15    │   2      │  88.2%   │
│ Jatinder │ Sarbat   │ Gurmukhi│  13    │   1      │  94.7%   │
│ Rohan    │ Rohan    │ Gurmukhi│  10    │   5      │  66.7%   │  ← red %
└──────────┴──────────┴─────────┴────────┴──────────┴──────────┘
```

- One row per student
- Columns: Name, Father, Class/Section, Present, Absent, Leave, Attendance %
- Sorted alphabetically by name
- Attendance % colored: green ≥ 85%, amber ≥ 70%, red < 70%
- Kirtan students show "Lesson ✓" count separately if available

---

## 6. Top Absentees (bottom section)

```
┌─ Top Absentees ────────────────────────────────────────┐
│ #  Student        Class       Section     Absent Days  │
│ 1  Rohan Raj Jr   Gurmukhi    Section B          10   │
│ 2  Sunaina        Kirtan      Tabla               8   │
│ 3  ...                                                │
└────────────────────────────────────────────────────────┘
```

- Shows up to 20 students with the highest absent count
- Can be collapsed or hidden if not needed

---

## 7. Backend Changes

The existing `buildAttendanceReport` already returns per-row data. I'll add two new derived arrays:

```php
// Per-student aggregation
$studentsSummary = (clone $query)
    ->select(
        'students.id',
        'students.name',
        'students.father_name',
        'classes.name as class_name',
        'sections.name as section_name',
        DB::raw('COUNT(*) as total'),
        DB::raw("SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) as present"),
        DB::raw("SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) as absent"),
        DB::raw("SUM(CASE WHEN attendance.status = 'leave' THEN 1 ELSE 0 END) as `leave`"),
    )
    ->groupBy('students.id', 'students.name', 'students.father_name', 'classes.name', 'sections.name')
    ->orderBy('students.name')
    ->get();

// Top absentees (sorted by absent desc, limited to 20)
$topAbsentees = $studentsSummary->sortByDesc('absent')->take(20)->values();
```

Returned alongside existing `summary` and `breakdowns`.

---

## 8. PDF Changes

The PDF template `resources/views/reports/attendance.blade.php` currently shows a per-row detail table. I'll replace it with:

- Header + meta strip (same as Student Center PDF)
- Summary cards (4-column table)
- Per-student table (same columns as screen)
- Top absentees sub-table
- Footer

Same font, same layout style as the Student Center PDF.

---

## 9. Implementation Steps

### Step 1: Backend
- Add `$studentsSummary` and `$topAbsentees` to `buildAttendanceReport()` return array
- ~15 lines of new code

### Step 2: Frontend
- Rewrite `Attendance.jsx`:
  - Replace single-class select with `FeeFilterSelect` multi-select
  - Add From/To year+month with `FeeFilterSelect` (same pattern as Fee Report)
  - Replace calendar grid with student summary table
  - Add top absentees list at bottom
  - Reuse quick presets from Fee Report
  - ~200 lines new, ~100 removed

### Step 3: PDF
- Rewrite `attendance.blade.php`:
  - Same header + meta strip
  - Summary table
  - Per-student table (name, class, section, P, A, L, %)
  - Top absentees
  - Footer
  - ~80 lines

### Step 4: Remove dead code
- Remove `buildAttendanceCalendar()` from `ReportController` (used by old calendar view, no longer needed)
- ~60 lines removed

---

## 10. What's Preserved

- Same route (`/admin/reports/attendance`)
- Same export endpoint (`POST /admin/reports/export/pdf` with `report=attendance`)
- Same sidebar link
- Same role access (admin only)

---

## 11. What's Removed

- The per-day calendar grid (replaced by student totals)
- The `view=calendar` handler in `build()` (no longer needed)
- Single-month restriction

---

## 12. Effort

| Step | Files | Lines | Time |
|---|---|---|---|
| Backend | `ReportController.php` | +15 | 20 min |
| Frontend | `Attendance.jsx` | ~200 | 1.5 hrs |
| PDF | `attendance.blade.php` | ~80 | 1 hr |
| Cleanup | `ReportController.php` | -60 | 10 min |
| **Total** | | **~230 added** | **~3 hrs** |
