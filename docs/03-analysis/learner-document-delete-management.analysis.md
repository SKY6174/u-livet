# Gap analysis: learner document deletion management

Date: 2026-10-07. Design: `docs/02-design/features/learner-document-delete-management.design.md`.

Match: 12 / 12 requirements implemented (100%).

1. Management column and delete controls, including terminal states.
2. Course/type confirmation with clear visibility, retention and enrollment explanation.
3. Cancel, Escape, initial cancel focus and trigger focus restoration.
4. Pending form disables duplicate submission.
5. Server identity, UUID/revision validation and filter-preserving redirects.
6. Existing organization-scoped document staff role and authentication checks.
7. Row lock, optimistic revision and repeat-delete rejection.
8. Paired deletion metadata and deletion actor reference.
9. Atomic retained status/event/audit; original PDF preserved.
10. Deleted-row filtering before administrator/learner limits; batch enrichment preserved.
11. Deleted PDF, cancel, decide, link, admission and submission-key access blocked.
12. Actual application and enrollment rows preserved; affected pages revalidated.

## Evidence
- Six local SQL suites with native-auth claims and rollback fixtures: all states, authorization, revision, original/history/audit, unchanged business records, and 505 deleted rows before list limits.
- Four action boundary suites: invalid input, unauthenticated user, RPC failure and secured successful delegation.
- Four real local Next/browser → action → RPC → DB checks, including 390px mobile dialog and pending submission.
- ESLint and Next production build passed. Local security advisors: no errors. Production dry-run includes only the new deletion migration.
- All eight replaced function definitions matched the production database before changes.

No unresolved design gaps. The public RPC uses the existing definer bridge convention; private execution remains revoked and authorization lives in its private implementation. Operational course-readiness criteria are documented separately from visibility rules.
