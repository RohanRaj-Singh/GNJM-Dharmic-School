# GNJM Dharmic School — Context Index

> **Read this first.** This `docs/` directory is the canonical discovery/audit reference for the GNJM Dharmic School Management System. Every file here was written from a first-hand read of the codebase, not inferred from training data.
>
> If you are an AI agent picking up work on this repo, read this index, then read `01-architecture.md`, then jump into the topic-specific file relevant to your task.

---

## Project Identity

- **Name:** Guru Nanak Ji Mission Dharmic School (GNJM), Nankana Sahib.
- **Purpose:** School management — students, classes/sections, fees (monthly + custom + rate periods), attendance, and three report types.
- **Domain split:** Two class **types** drive most of the business logic: `gurmukhi` (academic, Mon–Sat) and `kirtan` (spiritual, Sunday-only).

## Quick Stack

| Layer | Tech | Notes |
|---|---|---|
| Backend | Laravel 12 (PHP 8.2) | Eloquent + raw Query Builder mixed |
| Frontend | Inertia.js 2 + React 18 + Vite 7 + Tailwind 3/4 | No global state store |
| Auth | Laravel Breeze 2 (session) | `auth` + `role` middleware chain |
| PDF | barryvdh/laravel-dompdf 3.1 | Three Blade templates |
| Tables | AG Grid Community 35, TanStack Table 8, react-select 5 | |
| DB | SQLite by default (`database/database.sqlite`) | |

---

## Doc Map

| # | File | Read it when you need to… |
|---|---|---|
| 01 | [01-architecture.md](01-architecture.md) | understand the directory layout, request lifecycle, or where to put new code |
| 02 | [02-modules.md](02-modules.md) | see the full module inventory and which module owns which controller |
| 03 | [03-roles-and-rbac.md](03-roles-and-rbac.md) | check who is allowed to do what, or wire up new authorization |
| 04 | [04-database-schema.md](04-database-schema.md) | look at the ER, table columns, indexes, or soft-delete semantics |
| 05 | [05-business-workflows.md](05-business-workflows.md) | trace an admission, fee generation, fee collection, attendance, or rate period change end-to-end |
| 06 | [06-reports-system.md](06-reports-system.md) | understand the `ReportRegistry`, `ReportController`, and the three report types |
| 07 | [07-student-report-deep-dive.md](07-student-report-deep-dive.md) | **audit, refactor, or extend the Student Performa report** |
| 08 | [08-business-rules.md](08-business-rules.md) | recall a cross-cutting rule (free vs paid, day rules, fee locks, soft-deletes) |
| 09 | [09-dependency-map.md](09-dependency-map.md) | see which module reads/writes which tables, or which controllers depend on which services |
| 10 | [10-open-questions-and-gaps.md](10-open-questions-and-gaps.md) | find `INSUFFICIENT INFORMATION` markers and known staleness signals |
| 11 | [11-conventions-and-style.md](11-conventions-and-style.md) | match the surrounding code style (naming, query builder vs Eloquent, controller shape, React layout) |
| 12 | [12-student-performa-forensic-audit.md](12-student-performa-forensic-audit.md) | the 8-phase forensic audit of the Student Performa report — bugs, repros, fixes, refactor plan |
| 13 | [13-student-report-center-v2-design.md](13-student-report-center-v2-design.md) | the V2 product, architecture, and implementation plan — five report types, value-object engine, redesigned PDF, phased migration |
| 14 | [14-student-report-center-v1-kickoff.md](14-student-report-center-v1-kickoff.md) | the **V1 implementation kickoff** — current state, gap analysis, V1 architecture, schema footprint, 3-phase plan, business-rule approvals needed |
| 15 | [15-authentication-audit-and-migration.md](15-authentication-audit-and-migration.md) | the full auth audit — root-cause analysis of 419, security review, migration plan |
| 16 | [16-auth-cleanup-final-report.md](16-auth-cleanup-final-report.md) | the auth cleanup execution — files removed/modified, test results, security improvements |
| 20 | [20-student-promotion-v2-architecture.md](20-student-promotion-v2-architecture.md) | promotion V2 architecture — batch removal, enrollment-centric model, historical data, reporting reuse |
| 21 | [21-student-progression-prototype.md](21-student-progression-prototype.md) | React prototype — Student Progression page, four workflow modals, Academic History on Student Profile |
| 22 | [22-student-lifecycle-system.md](22-student-lifecycle-system.md) | Full student lifecycle system — two-level state model, transition matrix, lifecycle events, business rules, effects on fees and attendance, master directory |
| 23 | [23-lifecycle-ui-plan.md](23-lifecycle-ui-plan.md) | Lifecycle UI plan — every frontend change: shared StatusBadge, Master Directory page, Student Status filters, Academic History timeline, IdentityBlock vocabulary update |
| 24 | [24-students-page-redesign-plan.md](24-students-page-redesign-plan.md) | Students page redesign — split monolithic 711-line TanStack spreadsheet into directory + editor modal, responsive cards/table, remove inline editing |

---

## Conventions Used in These Docs

- **`INSUFFICIENT INFORMATION`** is used as a tag the next agent can grep for. It marks claims that should not be taken as ground truth without verification.
- **Path references** use the absolute repo-relative form (e.g. `app/Http/Controllers/Admin/ReportController.php`). Open them with your editor, not your shell.
- **No fixes or recommendations** appear in this directory. The discovery phase stops at understanding. Refactor proposals belong in a separate change-set or PR.
- **Lineage.** Every claim in this folder traces to either a file read during discovery, the migration history, or a route file. If you find a claim without a path, treat it with suspicion.

---

## How to Use These Docs

1. **Onboarding a new agent.** Point it at `00-index.md` → `01-architecture.md` → the topic file for the task.
2. **Auditing the Student Performa.** Start with `07-student-report-deep-dive.md` and cross-reference `06-reports-system.md`, `04-database-schema.md`, and `08-business-rules.md`.
3. **Resolving an authorization question.** Read `03-roles-and-rbac.md`, then trace the route through `routes/*.php` to confirm the middleware chain.
4. **Planning a migration or schema change.** Read `04-database-schema.md` to see which existing columns/indexes already cover the new need.

---

## Change Log

- **2026-06-07** — Initial discovery pass. Discovery was read-only; no source files were modified. All docs grounded in first-hand reads of the codebase at the audit time.
