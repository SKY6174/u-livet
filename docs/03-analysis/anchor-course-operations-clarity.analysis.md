# Gap Analysis: anchor-course-operations-clarity

Date: 2026-09-24 · Design: `docs/02-design/features/anchor-course-operations-clarity.design.md`

## Match rate: 100% (8/8)

The implementation follows the eight design checks below. No design gaps remain.

1. The canonical anchor organization is the only scope on the course operations page when its grant is present; non-anchor-only grants remain usable. No organization or role data is changed.
2. Organization, year, academy and status filters use the same compact control row as the operation-document screen; the organization filter preserves the existing role-scoped organization navigation.
3. Annual plan status and opening preparation are ordered in one region, while course development/review has its own region.
4. The message-management shortcut is removed from this page, while its route remains intact.
5. The top result-report button and per-course result-report action are removed.
6. A manager-only red registration action sits at the right of the course/budget tab row and keeps the existing create query/hash.
7. Server authorization, parallel data reads, year/plan validation and draft working-copy flow are unchanged; the selected project year now drives the budget/course RPC and budget panel labels.
8. A synthetic render check covers dual-organization and separate-organization users, menu grouping, removed links, and registration placement. Opening and role checks, lint, TypeScript and production build pass.

The legacy `verify-db-response-optimization.mjs` script fails before its first assertion because its baseline mock set omits the already-imported class-question modules. Its unchanged version in `origin/main` has the same omission, so this failure does not indicate a regression in the course operations change. Deployment health is checked separately during release.
