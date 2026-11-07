# Production role page verification analysis

Date: 2026-11-08 (Asia/Seoul). Feature: production-role-pages.

## Confirmed defect and correction

The live instructor document portal could not open a document session. `POST session` returned 403 and the preflight did not allow https://u-livet.org. Downloaded deployed function v201 exactly matched main's bundle (SHA-256 `4fa006af2c9d57487e0413a923da8e6939284ec37767daae65fd0315a4646884`). The failure came from the production origin setting.

The existing public origin value `https://uc-life.org,https://www.uc-life.org` matched the provider's existing SHA-256 digest. Only `https://u-livet.org` was appended, after checking that digest had not changed. Both legacy origins still work and an untrusted origin stays denied. No other setting or Preview project was changed. Configuration applies immediately without a function source deployment: [Supabase environment settings](https://supabase.com/docs/guides/functions/secrets).

After correction, the native instructor document session and advisory-intake-context returned HTTP 200. Browser verification waited for the authenticated portal, actual context response and file input. Application and Edge source/bundle are unchanged. This PR records the live configuration repair and adds verification tools, CI checks and operational instructions.

## Final production evidence

Verified production revision: `8f6c5bf18e314fb8785795de162f4c97519dd686` on https://u-livet.org. The ignored `ops/evidence/production-role-pages/matrix-final.json` aggregates completed role stages and focused checks; obsolete probe assumptions are not counted. All 447 unique role/route/path/responsibility cases passed, covering every one of the 108 discovered route modules for every role.

| Role | Cases | Route modules | Render | Denied | Missing | Login |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Learner | 110 | 108 | 50 | 54 | 5 | 1 |
| Instructor | 114 | 108 | 59 | 49 | 5 | 1 |
| Administrator | 113 | 108 | 96 | 11 | 5 | 1 |
| Guest | 110 | 108 | 26 | 0 | 1 | 83 |

Cases include both operation-document kinds, administrator directory groups/detail/history, and four additional responsible-instructor detail/print checks. Render means the expected screen or intentional alias was shown; it does not imply that an official issued-record detail exists.

Native Auth sessions, hydrated mobile-menu state, desktop rendering, expected redirects/not-found views and browser exceptions were checked with at most two pages in flight. There were no browser/hydration exceptions and no attempted blocked mutations. Session creation and token-scoped context reads for the synthetic instructor were the only browser POST exceptions; sessions were revoked afterward. Upload, save, AI, mail, payments and issuance were not executed. The latest production runtime error/fatal log query returned no entries.

The authorized private DRAFT course provided valid learner application/enrollment/classroom/lesson and instructor classroom detail states. Course and version remained DRAFT and absent from the anonymous catalog. The ordinary teacher's official-document denials were checked before designating that same synthetic teacher responsible for only the QA course and verifying plan/result detail/print.

## Design comparison

| Verification control | Evidence/result |
| --- | --- |
| Isolated checkout and current deployed revision | Separate worktree; revision guard matched live production |
| Fixed production host/project and explicit opt-in | Helpers require `--production` and fixed target |
| Discover every route module | 108 unique modules; all covered for each role |
| Native identities and role separation | Learner has no grants, instructor has INSTRUCTOR, administrator has five scoped roles |
| Expectations from source/policies | Directory capabilities, exclusions, responsibility and OAuth completion distinguished |
| Real detail versus missing state | Private classroom positive states; absent official records explicitly labeled |
| Mobile hydration and desktop views | Menu state changes and 1280px rendering in all 447 cases |
| Browser/server failures | No browser/hydration exceptions, error views or 5xx; runtime error/fatal query empty |
| Prevent business mutations | Strict request guard; no attendance, grades, completion, document submission or issuance |
| Document portal readiness | Native session/context 200 and file input attached; own sessions revoked |
| Preserve origin/security settings | One origin appended; legacy origins preserved; unknown origin denied; JWT/RLS unchanged |
| Regression and compilation | 15 offline cases, 4 live CORS probes, 111 release checks, pinned CLI checks, lint and isolated build |
| Temporary setup boundaries | Two synthetic Auth identities, scoped expiring grants, one private course; no real operator changes |
| Cleanup and credential privacy | All eight fixture rows, two Auth users/sessions and six grants removed; private copies redacted |

All 14 verification controls are satisfied. Release acceptance remains separate: the reviewed PR must pass required CI, receive a real external approval, merge normally and produce a verified Vercel production revision.

## Cleanup proof

Before deletion, the owned course was still DRAFT and had zero lesson reads, class sessions, completion runs, certificate requests, badge awards, operation documents or submissions. The eight owned fixture rows were removed. Independent post-cleanup queries returned zero temporary Auth users, Auth sessions, document sessions, role grants, courses and offerings. Both cleanup commands were also verified idempotent.

The original synthetic learner manifest was restored; copied passwords and the fixture backup were discarded. Existing users, staff permissions, designated operators and audit/person history were preserved. Private IDs and credentials remain outside Git. The ignored evidence directory contains final route results and cleanup counts, without private screens or session tokens.

## Existing-data and permission limits

The original issue-124 accounts/course are classified non-operational and their direct application/learning links are intentionally denied. For positive classroom coverage, the newly created administrator was reused as learner with only its own five grants temporarily expired, then restored to their exact original expiry. A separate synthetic instructor remained the teacher. Two temporary Auth identities total were used.

SYSTEM_ADMIN permits directory/read/edit. Manual registration and designated password-reset mail have separate existing capabilities; those designated workflows were not executed and their existing operators were not replaced. Native email `/auth/complete-signup` intentionally ends the session and was tested last.

Production has zero certificate, badge, proposal and performance-report records. Their missing/denied states were tested; valid issued-record details were not tested or fabricated. Valid invitation PIN submission and attendance QR check-in were not executed. This is page/render/access coverage with controlled context reads, not a claim that every production write workflow ran.

Baseline advisors returned no ERROR. Existing warnings (6 authenticated definer functions, paused-MFA configuration, 33 auth-RLS initplan and 234 multiple-permissive-policy notices) predate this work. No schema or security policy was changed to suppress them.

## Release status

The runtime CORS fix is live. Source changes are ready for PR/CI and required external review. Merge and the resulting production deployment are pending; do not bypass main protection or report deployment complete before its revision is observed.
