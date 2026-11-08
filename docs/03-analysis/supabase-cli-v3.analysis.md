# Supabase CLI v3 compatibility verification

Date: 2026-11-07. Feature: supabase-cli-v3.

## Implementation and design comparison

| Requirement | Evidence |
| --- | --- |
| Latest stable CLI aligned | npm and GitHub latest both resolve to 3.0.0; exact dependency and lockfile agree |
| Every direct CLI caller aligned | 48 Node scripts use scripts/lib/supabase-cli.mjs; Python importer uses the same local executable |
| v3 hosted targeting/consent | Three administrative scripts use --remote=; reads use --read-only and authorized writes use --yes |
| Config migration | Email/SMS provider enabled keys; no removed OrioleDB key; local_smtp and explicit local project identity retained |
| Exhaustive page discovery | Every src/app/**/page.tsx is discovered; unmapped dynamic parameters and stale test migrations fail |
| Real Auth and data | Synthetic learner/instructor/staff sessions, application RPC and guarded disposable Docker database |
| Error visibility | Browser exceptions, unexpected redirects/status codes, server errors and Next error portals fail the suite |
| Result-document SSR compatibility | Renamed the local process PDF handler that shadowed Next build-injected process.env hook macros |
| Production hydration regression | Next 16.4.5 / React 19.3.1; original loading UI restored; six repeated production admin navigations passed |

## Checks

- Next.js 16.4.5 Webpack production build passed, including explicit lint, TypeScript, manuals and portable Edge assets/function bundles. The supported legacy middleware convention is retained to preserve its runtime/session/header behavior.
- Supabase CLI executable/version/lock/config/help checks passed. A real local read-only SQL query returned the expected result.
- The actual Python query function was run with a fake subprocess to verify target arguments, read/write consent and removal of temporary SQL.
- 53 affected JavaScript modules and the Python source parsed; git diff --check passed.
- Release readiness: 111 checks; hosted Auth preflight: 69; managed Cloud: 28; workspace queries: 8; DB response: 10; DB performance: 16; DB latency: 11. Total: 253.
- Review deployment configuration: 29 additional checks. Migration retry: 10 checks. Total existing regression checks: 292. All 137 repository migration files also replayed in the disposable CLI v3 database.
- GitHub Actions run 42380698954 passed the required PR quality gate with CLI 3 on a fresh Ubuntu runner, including 33 live core Auth/RLS/application checks (325 existing regression checks in total). The core fixture corrections follow existing PR #204: current paused-MFA policy assertions, valid phone metadata, signup settings restored in finally, and supported synthetic offering names.
- npm dependency audit: 0 vulnerabilities after patched transitive packages and a targeted minimatch override for the TypeScript ESLint subtree.
- Final browser run: all 108 page modules covered; 115/115 page cases and 4/4 live authorization boundaries passed (119 total). Every normal page exercised the hydrated header menu at mobile width, then rendered at desktop width; hidden print headers were checked through the same React event handler.

## Scope and limits

Browser coverage checks rendering, hydration, real sessions, route aliases and access boundaries. It does not exercise every form mutation, remote OAuth provider, email delivery or real credential/PDF issuance. Certificate and badge detail fixtures are revoked records in the disposable database; no document is issued. The guest invitation shell and malformed-code rejection are covered; an actual hosted invitation submission is outside this local run.

The older verify-role-navigation script has pre-existing drift (an unresolved date-format alias, followed by outdated menu expectations when that alias was supplied). It is not claimed as passing. The live browser suite and existing workspace/query authorization checks provide the current-route verification. Core/application fixture scripts retain their dedicated u-livet-core/u-livet-issues guards; core ran on a fresh CI database, and no hosted DB was used to bypass these guards.

Initial page runs exposed production-only React #418/parentNode failures on admin and public routes. Six dev repetitions passed. Removing the admin loading boundary did not eliminate the failure in the full suite, so that file was restored. Next 16.4.5 contains the upstream hydration replay restoration logic absent in the old bundled renderer; it and React 19.3.1 are now pinned. Six focused production repetitions passed. The relationship to the published cursor/parser reports is an inference; no React internals were patched and no runtime hydration errors were suppressed.

Next 16 migration changes are limited to the supported renderer/tooling: Webpack remains explicit, lint runs before ordinary/Vercel builds, next.config no longer uses the removed eslint key, and generated TypeScript includes use the automatic JSX runtime. The result-document production test also exposed a private PDF-handler function named process shadowing the compiler-injected process.env macro. It was renamed to processPdfFile with its two callers; PDF parsing/upload semantics are unchanged.

The flat ESLint configuration preserves the prior hooks baseline: three newly enabled React Compiler rules are deferred because Compiler is not enabled; rules-of-hooks and exhaustive-deps remain active.

## References

- https://github.com/supabase/cli/releases/tag/v3.0.0
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://github.com/react/react/issues/37321
- https://github.com/vercel/next.js/discussions/99971
- https://nextjs.org/docs/app/guides/upgrading/version-16

Modern Web Guidance search/list and the HTML guide were checked during hydration diagnosis. No guide-specific UI implementation change was applicable.

## Release handoff

- PR: https://github.com/SKY6174/u-livet/pull/206. Source and CI are pushed to codex/supabase-cli-v3.
- The required PR quality gate and Supabase Preview checks passed. Main requires one approving review from a different account and enforces this for administrators. The normal merge attempt was rejected by that policy; protection was not altered.
- Initial Vercel preview dpl_CXTeDarNxXpxBSrzcUNfdDKZrqQZ was blocked by review-only environment checks: the Supabase integration injected unused credentials and an additional public key name into this task's branch. Only that branch's generated, unused variables were blanked, and the extra public variable was renamed to an unused server name with an empty value. The separate preview URL/anon key were retained. No production or other branch settings changed. Preview rebuild verification is recorded in the PR description.
- Production merge/deployment remains pending the required external GitHub review. After approval, use normal squash merge, verify the Git-triggered production build and read-only health/version checks against the merge commit.

## Complete page inventory

| Page module route | Role | Cases | Expected HTTP | Result |
| --- | --- | ---: | --- | --- |
| / | public | 1 | 200 | PASS |
| /about | public | 1 | 200 | PASS |
| /admin | staff | 1 | 200 | PASS |
| /admin/accounts | staff | 1 | 200 | PASS |
| /admin/accounts/[id] | staff | 1 | 200 | PASS |
| /admin/accounts/new | staff | 1 | 200 | PASS |
| /admin/applications | staff | 1 | 200 | PASS |
| /admin/applications/[id] | staff | 1 | 200 | PASS |
| /admin/classrooms | staff | 1 | 200 | PASS |
| /admin/course-plan | staff | 1 | 200 | PASS |
| /admin/course-plan/opening | staff | 1 | 200 | PASS |
| /admin/course-requests | staff | 1 | 200 | PASS |
| /admin/courses | staff | 1 | 200 | PASS |
| /admin/courses/guides/[id] | staff | 1 | 200 | PASS |
| /admin/development | staff | 1 | 200 | PASS |
| /admin/finance | staff | 1 | 200 | PASS |
| /admin/instructors | staff | 1 | 200 | PASS |
| /admin/instructors/documents | staff | 1 | 200 | PASS |
| /admin/kpi | staff | 1 | 200 | PASS |
| /admin/learner-documents | staff | 1 | 200 | PASS |
| /admin/learners | staff | 1 | 200 | PASS |
| /admin/learners/[id] | staff | 1 | 200 | PASS |
| /admin/messages | staff | 1 | 200 | PASS |
| /admin/messages/[id] | staff | 1 | 200 | PASS |
| /admin/monitoring | staff | 1 | 200 | PASS |
| /admin/offerings/[id] | staff | 1 | 200 | PASS |
| /admin/offerings/[id]/manage | staff | 1 | 200 | PASS |
| /admin/offerings/[id]/reports | staff | 1 | 200 | PASS |
| /admin/offerings/[id]/reports/print | staff | 1 | 200 | PASS |
| /admin/parking | staff | 1 | 200 | PASS |
| /admin/performance | staff | 1 | 200 | PASS |
| /admin/policies | staff | 1 | 200 | PASS |
| /admin/reports | staff | 1 | 200 | PASS |
| /admin/reports/preview | staff | 1 | 200 | PASS |
| /admin/scholarships | staff | 1 | 200 | PASS |
| /auth/accept-invitation | public | 1 | 200 | PASS |
| /auth/complete-signup | public | 1 | 200 | PASS |
| /auth/confirm-email | public | 1 | 200 | PASS |
| /auth/forgot-password | public | 1 | 200 | PASS |
| /auth/invitation-accepted | public | 1 | 200 | PASS |
| /auth/login | public | 1 | 200 | PASS |
| /auth/password-updated | public | 1 | 200 | PASS |
| /auth/reset-password | public | 1 | 200 | PASS |
| /auth/security | public | 1 | 200 | PASS |
| /auth/signup | public | 1 | 200 | PASS |
| /badges/[id] | learner | 2 | 200, 404 | PASS |
| /badges/verify | public | 1 | 200 | PASS |
| /certificate/[id] | learner | 2 | 200, 404 | PASS |
| /completion | staff | 1 | 200 | PASS |
| /completion/[id] | staff | 1 | 200 | PASS |
| /courses | public | 1 | 200 | PASS |
| /courses/[id] | public | 1 | 200 | PASS |
| /courses/[id]/apply | public | 1 | 200 | PASS |
| /credentials | staff | 1 | 200 | PASS |
| /credentials/badges | staff | 1 | 200 | PASS |
| /development | staff | 1 | 200 | PASS |
| /development/[id] | staff | 2 | 200, 404 | PASS |
| /finance | staff | 1 | 200 | PASS |
| /instructor | instructor | 1 | 200 | PASS |
| /instructor-documents/[code] | public | 2 | 200, 404 | PASS |
| /instructor/offerings/[id] | instructor | 1 | 200 | PASS |
| /instructor/offerings/[id]/attendance | instructor | 1 | 200 | PASS |
| /instructor/offerings/[id]/attendance/print | instructor | 1 | 200 | PASS |
| /instructor/offerings/[id]/attendance/qr | instructor | 1 | 200 | PASS |
| /instructor/offerings/[id]/completion | instructor | 1 | 200 | PASS |
| /instructor/offerings/[id]/evaluation | instructor | 1 | 200 | PASS |
| /instructor/records | instructor | 1 | 200 | PASS |
| /instructor/syllabus | instructor | 1 | 200 | PASS |
| /learning/[id] | learner | 1 | 200 | PASS |
| /learning/[id]/attendance | learner | 1 | 200 | PASS |
| /learning/[id]/attendance/checkin | learner | 1 | 200 | PASS |
| /learning/[id]/evaluation | learner | 1 | 200 | PASS |
| /lms | learner | 1 | 200 | PASS |
| /lms/[courseId] | learner | 1 | 200 | PASS |
| /lms/attendance/qr | learner | 1 | 200 | PASS |
| /manuals | public | 1 | 200 | PASS |
| /manuals/[audience] | public | 1 | 200 | PASS |
| /manuals/[audience]/[version] | public | 1 | 200 | PASS |
| /manuals/history | public | 1 | 200 | PASS |
| /mypage | learner | 1 | 200 | PASS |
| /mypage/applications/[id] | learner | 1 | 200 | PASS |
| /mypage/badges | learner | 1 | 200 | PASS |
| /mypage/certificates | learner | 1 | 200 | PASS |
| /mypage/documents | learner | 1 | 200 | PASS |
| /mypage/documents/[type] | learner | 1 | 200 | PASS |
| /mypage/history | learner | 1 | 200 | PASS |
| /mypage/instructor | instructor | 1 | 200 | PASS |
| /mypage/instructor/documents | instructor | 1 | 200 | PASS |
| /mypage/notifications | learner | 1 | 200 | PASS |
| /mypage/payments | learner | 1 | 200 | PASS |
| /mypage/profile | learner | 1 | 200 | PASS |
| /mypage/surveys | learner | 1 | 200 | PASS |
| /offerings/[id] | public | 1 | 200 | PASS |
| /offerings/[id]/apply | learner | 1 | 200 | PASS |
| /operation-documents | staff | 1 | 200 | PASS |
| /operation-documents/[id]/[kind] | staff | 2 | 200 | PASS |
| /operation-documents/[id]/[kind]/print | staff | 2 | 200 | PASS |
| /operation-documents/plan | staff | 1 | 200 | PASS |
| /operation-documents/result | staff | 1 | 200 | PASS |
| /operation-procedure | public | 1 | 200 | PASS |
| /parking | learner | 1 | 200 | PASS |
| /performance | staff | 1 | 200 | PASS |
| /performance/[year] | staff | 1 | 200 | PASS |
| /performance/reports/[id] | staff | 2 | 200, 404 | PASS |
| /privacy | public | 1 | 200 | PASS |
| /quality/[id] | staff | 1 | 200 | PASS |
| /terms | public | 1 | 200 | PASS |
| /verify | public | 1 | 200 | PASS |

Page readiness waits for the expected route and verifies a real React menu state change; it does not wait for unrelated Link prefetch network activity. See https://playwright.dev/docs/api/class-page#page-goto.

A partial-stack db reset stalled during preparation. That invocation was stopped and only the owned test stack was recreated; final migration replay and browser results used a fresh CLI start. The suite itself does not reset existing projects.
