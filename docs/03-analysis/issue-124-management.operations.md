# Issue 124 migration and administrator verification

## Deployment order
The reviewed migration is `supabase/migrations/20261007104417_issue_124_management.sql`. Apply it before deploying the new pages:

```sh
supabase db push --linked --project-ref uoebygejgglgiivzgyks --skip-vault --dry-run
supabase db push --linked --project-ref uoebygejgglgiivzgyks --skip-vault --yes
```

Only that migration was pending; it was applied successfully on 2026-10-07. No data was deleted and no existing account roles were changed. New private history is append-only through checked RPCs; older public rejection calls now require the new reason-bearing RPC. Deployment should follow the migration immediately.

## Roles and management paths
A researcher/admin needs canonical COURSE_MANAGER for the offering's organization for course, application, learner and instructor operations. An office position label does not grant access. Each route and DB RPC checks this scope. Existing SYSTEM_ADMIN manages accounts and their deletion separately; the current administrator has both roles for the main organization.

- /admin/courses: create course, then manage → edit fields, publish/close, instructor assignment and responsible instructor.
- /admin/applications: filter by course/status/name → detail → approve or reject with required reason → persisted history.
- /admin/learners: name/course filters → contact and scoped application/enrollment history.
- /admin/instructors: existing searchable pool → register/edit/detail; course manage page assigns approved teaching-role accounts.
- Learner /mypage → application detail: own status, reason and history.

## Retained production fixtures
User explicitly requested production retention. Ten account display identifiers are dummy-00 through dummy-09; actual Auth/person/application primary keys remain UUIDs. Emails use @example.invalid and passwords are random. The ten users submitted the course through the actual life_apply API, with no email or payment sent.

Course: `[검증용] Issue124 신청·수강생 관리`
ID: `1420f824-721a-41d7-afd2-9d3d62206406`
Main organization, 2026 project year, free review-based course, capacity 10. Current verification state: 10 SUBMITTED applications, retained for administrator inspection.

[Production application list](https://u-livet.org/admin/applications?course=1420f824-721a-41d7-afd2-9d3d62206406)
[Production learner list](https://u-livet.org/admin/learners?course=1420f824-721a-41d7-afd2-9d3d62206406)

Cleanup: /admin/accounts → learner group → search dummy-00…09 → delete each account with confirmation. Existing strict deletion permission was checked for all ten. This stops access and preserves historical applications. The synthetic course can be switched to recruitment closed in its manage form. Retain its history rather than hard-deleting referenced data.

Credentials and mappings are only in ignored `ops/evidence/issue-124-fixtures.private.json` (0600); never include it, keys, sessions or credentials in PRs/screenshots. The production provisioner requires both --production and the exact reviewed project. Do not rerun after administrators have deleted or processed fixtures unless restoration is explicitly requested.

## Reproduce local acceptance
```sh
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/setup-application-test.mjs
# Apply tracked migrations only to the dedicated local database.
supabase migration up --local --workdir /tmp/u-livet-issues-db
npm run build
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-application-flow.mjs --production
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-management-flow.mjs
node scripts/verify-role-navigation.mjs
```

The local script creates its own synthetic data and cannot target production or the user's other local database. Production fixture script is intentionally separate and uses actual Auth for its administrator and learner RPC checks.
