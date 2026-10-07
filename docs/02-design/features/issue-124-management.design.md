# Issue 124 management design

Plan: docs/01-plan/features/issue-124-management.plan.md

## Boundaries and reuse
Next.js server pages use cookie-bound Supabase RPCs, never service keys. Course managers (including researchers assigned COURSE_MANAGER) operate only their granted organizations; office_position alone confers no access. System administrator account deletion remains the existing life_delete_member soft-disable action. Existing instructor pool CRUD, course instructor assignment/responsibility and finance-aware application decisions remain authoritative.

## Database
- Add private application_reviews with application FK (restrict), actor FK, previous/next status, reason, timestamp. Enable RLS, revoke direct table access. No browser INSERT/UPDATE/DELETE path.
- life_review_application(a,decision,reason,expected_status) invokes private review helper. Lock offering then application; verify manager/owner before comparing state. Rejection requires 1–1000 characters. Expected status detects stale decisions. Call existing private.decide to retain tuition/invoice/refund/capacity rules. Append history only when state changes. Public legacy life_decide delegates to helper, preventing rejection-without-reason bypass while preserving learner cancellation.
- life_management_applications(f,q,s,page) returns scoped selectable courses, 40 results/page, count; validate query/status/page and filter by granted organization on every row.
- life_management_learners(f,q,page) returns distinct people with scoped applications, count and enrollment count. Include inactive people with explicit deleted marker so historical rosters remain intelligible.
- life_application_detail(a) permits scoped manager or the application's owner only. Return necessary contact, course, application/enrollment status and review timeline; never resident numbers, bank details or unrelated records. Learners do not receive other applicants.
- life_management_learner(p) requires at least one application in a managed organization; returns necessary contact and all applications/enrollments in those organizations only.
- life_update_offering(f,expected_revision,fields JSONB) requires scoped manager and a non-archived, unsealed offering. Validate all lengths/enums/date ordering/capacity. Lock offering, reject stale academic_revision. Capacity cannot drop below active enrollments plus pending payments. Do not permit selection-method changes after applications exist. DRAFT remains draft (existing publish action validates policies); PUBLISHED/CLOSED may switch only with current approved policies for reopening. Course summary/curriculum edits clone a new course version under course lock, preserving other offerings' snapshots. Increment academic_revision and audit edits. Do not mutate tuition, completion policy or historical result data. Reject education periods excluding existing scheduled sessions.
- Private helpers: SECURITY DEFINER, search_path=''; public wrappers SECURITY INVOKER. Revoke PUBLIC/anon/service_role, grant only authenticated. Helpers validate canonical active identity and roles. No table grants for the new private history table.

## UI
- Add /admin/applications and /admin/applications/[id]: GET filters (course/status/name), result count/pagination, detail contact/history, review form requiring a rejection reason; share review form with existing per-course roster.
- Add /admin/learners and /admin/learners/[id]: scoped participant search/course filter, details with application and enrollment history; account-management deletion link only with SYSTEM_ADMIN, existing protected page handles mutation.
- Add /mypage/applications/[id] for own status/reason/history; link from learner dashboard.
- Add course edit panel inside /admin/offerings/[id]/manage. Keep archived early return unchanged. Display sealed read-only state and expose existing instructor assignment section.
- Navigation: course management, application management, learner management and instructor management explicitly labelled. Preserve other workflows and gates.

## Verification and release
Dedicated uc-life-issues local DB only: migration then real Auth/Next production browser flow. Ten dummy learners use actual life_apply. Test duplicate idempotency, reject missing reasons, stale review/edit, accepted enrollment, paid pending seats, capacity race, invalid transitions, unrelated manager and learner RPC/URL denial, owner reason visibility, course version isolation, instructor assignment/removal protection and account soft deletion retaining history. Record synthetic screenshots and results. Run lint/build/navigation and existing application regression.
Apply reviewed additive migration to project uoebygejgglgiivzgyks before deployment. Create retained production dummy-00..09 Auth users without sending mail, with valid privacy metadata and unique .invalid emails. Current production has no open offering: create one clearly marked verification offering under the existing organization, using approved policies; no certificate eligibility. Store credentials only in a private excluded file; publish only synthetic account names, course ID and cleanup instructions. Verify all ten applications through scoped authenticated DB claims and API access checks. Push PR, checks, merge and verify exact main deployment revision/health.
