# Issue 124: course, applications, learners and instructor management

## Requirements and authorization
Resolve https://github.com/SKY6174/u-livet/issues/124. User authorizes push, PR, merge and production deployment, and explicitly requests dummy-00 through dummy-09 accounts and applications be retained in production for administrator inspection/deletion. Do not send emails. Production currently has 3 archived and 15 draft offerings, no open offering; create a conspicuously marked synthetic verification offering instead of altering an existing offering's recruitment dates.

## Existing implementation audit
- Course list/detail/create/publish and recruitment state display exist under /admin/courses and /admin/offerings. Course editing is missing.
- Applications originate in life_apply and appear in life_roster; finance-aware life_private.decide owns capacity checks and transitions. Global search/detail, rejection reasons and accessible review history are missing.
- /admin/accounts already supplies system administrator member list/search/edit/soft deletion with retained history. Course managers lack a scoped participant directory.
- /admin/instructors already supports list/search/register/edit/dossier/activity and safe removal; course instructor assignment and responsible-instructor switching already exist. Reuse these screens and RPCs.
- Researcher office_position is presentation, not permission. Operational management requires COURSE_MANAGER for the offering's organization. SYSTEM_ADMIN controls account management separately.

## Implementation scope
1. Scoped searchable application list/detail, required rejection reason and immutable review history, with learner access to their own detail.
2. Scoped learner list/detail, course roster and application/enrollment histories; system administrators use existing soft-delete workflow.
3. Revision-protected course editing with date/capacity validation and safe version cloning; preserve archived/sealed course history.
4. Explicit application, learner and instructor navigation beside existing course management.
5. Additive migration; real Auth/browser/DB acceptance, cross-organization and unauthorized access tests, ten synthetic applicants; production migration and retained fixtures.

## Acceptance and release
Test create/edit/publish/assign/search/review/history/roster/contact scope, duplicate applications, capacity races, stale edits, forbidden transitions, missing reasons and unauthorized URL/RPC access. Verify instructor and member deletion retain referenced course/application history. Record screenshots, migrations and role instructions. Push reviewable PR, pass checks, squash merge, verify exact production revision and health.
