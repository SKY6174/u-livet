# Supabase CLI v3 compatibility design

## CLI and configuration

- Pin `supabase` to `3.0.0` in devDependencies and the root npm lockfile. `npm ci` and `npm exec -- supabase` are the supported entry points; a shared absolute executable path also pins directly invoked Node scripts. Python uses the same local executable.
- Preserve `[local_smtp]`, the explicit project ID and local ports. Replace deprecated email/SMS provider `enable_signup` with `enabled`, keeping the global signup policy and SMS confirmation value unchanged. Remove obsolete empty OrioleDB configuration.
- Migrate hosted SQL calls to `--remote=<ref>` and explicit `--yes` for previously authorized writes. Read-only validation uses `--read-only`; `--apply` continues to gate imports. Preserve project and synthetic-data guards.
- Update executable operating examples to use the pinned CLI, explicit remote targets and noninteractive consent. Historical reports remain historical evidence.

## Verification

- Add a regression check for the installed CLI version, removed target flags in active subprocess calls, and real CLI command/config parsing. Test hosted argument construction through a fake executable without reaching a hosted database.
- Create an isolated test stack with a distinct project name and ports. Apply all migrations there; do not reset or reconfigure existing local stacks.
- Discover `src/app/**/page.tsx` automatically so newly added pages cannot silently escape coverage. Resolve dynamic routes using synthetic local fixtures and explicit negative cases where a valid issued credential is intentionally absent.
- Exercise public, learner, instructor and staff pages with real Auth sessions and browser requests. Use revoked production-shaped certificate/badge records only in the disposable DB to render those detail pages; no file is issued. Check invalid records separately. Fail on server errors, unexpected redirects/not-found responses, browser exceptions or Next.js error boundaries. Record the route, role, expected/actual outcome and aggregate counts without credentials.
- Verify hydration by exercising the header menu's expanded state at mobile width, then render at desktop width. Await page load and web assertions rather than networkidle, which can be held open by unrelated route prefetches. Hidden print headers use DOM click dispatch to exercise the same React handler without changing product CSS.
- Run real Auth/application RPC and authorization checks, existing release/hosted-auth/managed-cloud and query regressions, lint/types and a full production build. Existing older tests with outdated fixtures or menu expectations are recorded separately from this exhaustive current-page browser run.

## Release

- Satisfy the existing `PR quality gate` branch requirement with a GitHub Actions job that runs audit, lint, release checks, the pinned local CLI and real core Auth/RLS/application regressions on a fresh runner. Adapt the existing PR #204 workflow and fixture corrections; retain CLI 3 and do not change branch protection or reduce its review requirement.
- Keep fixture signup changes scoped to tests with restoration in finally; assert the currently deployed security policy rather than enrolling the paused MFA policy. Prepare a preview for review when external approval blocks merge.
- Use Git integration for Vercel deployment after merge, avoiding a duplicate CLI deployment. Verify team `team_4YIBigc2M47U1IrndTo6xlfF`, project `prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0`, merged commit and production READY state.
- Verify production health/public pages read-only. Keep browser state, tokens and raw CLI status out of Git and reports.

## Page regression found during compatibility testing

- Production browser runs intermittently reproduced React #418 (HTML) followed by null `parentNode` exceptions on `/admin` and its aliases. Six development-mode repetitions passed. The symptom matches published streaming hydration reports in the Next 15 bundled renderer; this is an inference, not proof of the internal cursor failure.
- Removing the broad admin loading boundary passed six focused runs but failed to eliminate the error elsewhere in the full suite. Restore that file and use the supported Next.js 16.4.5 renderer instead. Keep React 19.3 compatible packages, existing authorization and loading UI; no React-internal patch or warning suppression.
- Follow the official Next 16 migration: remove the obsolete next.config eslint key, run lint explicitly before builds, use an ESLint 9 flat configuration with matching Next config, and retain Webpack via the documented --webpack switch for local/Vercel builds. Migrate middleware to proxy if the version-matched docs require it; preserve all security headers/session behavior.
- The production result-document page exposed a local function named `process` shadowing the build-injected `process.env` hook macro. Rename that PDF handler and its callers to `processPdfFile`; preserve parsing, validation and upload behavior, then rerun the complete production page suite.

## Sources

- https://github.com/supabase/cli/releases/tag/v3.0.0
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://github.com/react/react/issues/37321
- https://github.com/vercel/next.js/discussions/99971
- https://nextjs.org/docs/app/guides/upgrading/version-16
