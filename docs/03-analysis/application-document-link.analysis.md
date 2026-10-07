# Gap analysis: application-document-link

Date: 2026-10-07. Design: docs/02-design/features/application-document-link.design.md.

## Implementation match
12/12 implementation requirements delivered: scoped linkage, revision/idempotency guards, immutable PDF/decision preservation, owner/staff registration state, scoped offering choices, finance-aware admission, approval handoff, link-required approval, exact guide resolution, safe legacy backfill, server guide validation, and manager/learner forms with cache revalidation. Ended drafts are intentionally excluded from repair candidates. No consent or historical course dates are fabricated.

## Evidence
- Dedicated uc-life-issues DB only; complete migration first-apply replay passed in a rollback transaction.
- verify-document-link.mjs: 10 actual Auth/RPC/browser checks passed. Includes legacy approved document repair, optional note, PDF hash preservation, scope/ended/stale/duplicate/immutable guards, real enrollment, capacity race rollback, paid invoice/pending payment, missing consent and draft rejection, exact migration backfill preservation.
- verify-document-resolution.mjs: 6 actual Auth/browser regression checks passed.
- verify-student-learning.mjs: 6 checks passed.
- Production build, TypeScript and lint passed. Four manual artifact versions verified by prebuild.
- React review: no new effects or client fetch waterfalls; state helper is shared and pure; staff forms are independent, labeled and revision-bound; learner links derive from authoritative state.
- Browser screenshots remain local synthetic evidence under artifacts/document-link and are not committed.

## Operational dependency
The real orphan document's published guide points to an expired July draft without enrollment/completion policies, while the guide says December planned. The user was asked for the actual offering or confirmed educational/recruitment dates. The feature supports repairing it, but that real record is deliberately left unchanged until the target is confirmed. This is outstanding data setup, not an implementation match claim for actual enrollment.

## Release verification
Record the PR, production migration and exact deployment SHA in the completion report after delivery. Actual legacy registration remains pending confirmed course setup.
