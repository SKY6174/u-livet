# Learner document deletion management

## Request
Add a management column and a delete button to the administrator's received-document table, then create a PR, merge, push and deploy.

## Scope
- Delete requires explicit confirmation showing the course and document type.
- Remove a deleted request from administrator and learner document lists and normal PDF access.
- Retain the submitted PDF, disposition history and deletion actor/time for audit.
- Preserve actual applications, enrollments, payment and learning records.
- Require the existing organization-scoped document staff role and recent additional authentication, with optimistic revision checking.
- Verify against synthetic local fixtures; do not delete production test documents.

## Verification
Exercise authorized deletion, foreign organization and learner rejection, stale revisions, repeated deletion, retained original/history, list/PDF exclusion, and existing enrollment retention. Check the confirmation UI, server boundaries, build, migration and production release.
