# Architecture Documentation — GNJM School ERP

This directory contains the complete architecture assessment and refactoring plan for the GNJM Dharmic School ERP.

## Document Index

| # | Document | Type | Focus |
|---|---|---|---|
| 01 | [Architecture Assessment](./01-Architecture-Assessment.md) | Audit | Module map, boundaries, dependencies, missing concepts |
| 02 | [Business Rule Registry](./09-Refactoring-Roadmap.md#business-rule-registry) | Register | All business rules documented at the end of the roadmap |
| 03 | [Business Logic Audit](./03-Business-Logic.md) | Audit | Duplicated/misplaced logic, business rule registry per domain |
| 04 | [Database Audit](./04-Database-Audit.md) | Audit | Schema, relationships, constraints, risks, missing indexes |
| 05 | [Service Layer](./05-Service-Layer.md) | Audit | Service quality, missing services, layer violations |
| 06 | [Frontend Architecture](./06-Frontend-Architecture.md) | Audit | Component duplication, state management, UX issues |
| 07 | [Technical Debt Register](./07-Technical-Debt.md) | Register | 22 items ranked critical→low with fixes |
| 08 | [Risk Assessment](./08-Risk-Assessment.md) | Audit | 17 risks with severity, scenarios, and fixes |
| 09 | [Refactoring Roadmap](./09-Refactoring-Roadmap.md) | Plan | 6 sprints, quick wins, migration strategy, business rule registry |
| 10 | [Architecture Principles](./10-Architecture-Principles.md) | Guide | 10 principles with rationale and application |

## Summary

- **Critical risks**: 3 (attendance duplicate race, restore failure, student status divergence)
- **High risks**: 4 (fee dedup, bulk-update issues, scopeCurrent blind spot, division false positives)
- **Technical debt**: 22 items (3 critical, 5 high, 6 medium, 8 low)
- **Refactoring sprints**: 6 (30 days total)

## Key Directives

1. **Routes define paths, not logic** — extract ~600 lines of closures into Controllers
2. **One canonical implementation** — consolidate division type detection, enrollment filtering, attendance rollup
3. **Data integrity at DB level** — add unique constraints, FKs, NOT NULL
4. **Shared frontend components** — DataTable, FilterBar for all list pages

---

*Generated: 2026-07-30*
