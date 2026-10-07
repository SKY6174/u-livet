# Learner document deletion management design

Extends the existing learner-document workflow design and preserves its organization, identity and authentication boundaries.

## Data and authorization
- Add nullable `deleted_at` and `deleted_by` to requests with a paired-null constraint and actor FK.
- New authenticated-only public definer bridge RPC `life_delete_learner_document(r, expected_revision)` calls an unexposed private definer implementation with an empty search path.
- Require person identity, existing `mfa_recent`, organization-scoped `learner_document_staff`, matching revision, and row lock.
- Set deletion metadata and increment revision; append a same-status document event and a `LEARNER_DOCUMENT_DELETED` audit event atomically.
- Preserve the original status, PDF and old events. Do not mutate applications, enrollments, payments or learning.
- Filter deleted requests before limits in both base list queries so batch registration enrichment remains intact.
- Existing file, cancel, decide, link and admission lookups exclude deleted rows, including repeated row-lock lookups to close concurrent-delete races. Reuse of a deleted submission request key returns NOT_FOUND.
- Keep original admission lock order (offering before request); deletion locks only the request.

## UI and action
- Add a tenth `관리` table column with a delete control for all visible requests, including resolved records.
- A small client component opens an accessible native dialog with course/type, clear visibility and retention text, cancel and final delete; use form status to disable repeat submission.
- Keep document ID, revision and current kind/status/query filters in the form. Server action validates UUID and positive integer revision, relies on DB authorization, revalidates existing document/learning routes, and redirects with success/error notice.
- Dialog handles Escape, focuses cancel initially and restores trigger focus on dismissal.

## Verification
Local SQL tests with real native-auth claims and rollback fixtures cover allowed roles, foreign organization, learner, anonymous and unauthenticated denial, stale revision, all original states, repeated deletion, PDF and both list exclusion, archived-mutator rejection, audit retention and unchanged enrollment. UI/action tests cover confirmation, cancelled submission, pending disable, input validation and filter-preserving redirects. Production deployment verification is read-only.
