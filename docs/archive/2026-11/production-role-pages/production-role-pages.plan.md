# Production role page verification

Date: 2026-11-08 (Asia/Seoul). Feature: production-role-pages.

## Goal and scope

Verify every current page module on https://u-livet.org using real learner, instructor and administrator sessions. Check allowed views and forbidden role crossings, mobile hydration, desktop rendering, redirects and production errors. Correct reproduced defects, open a PR, satisfy the existing review/CI rules, merge and verify production.

## Controls

- Start from current main in a separate worktree; preserve other working copies.
- Prefer existing dedicated synthetic accounts and records. Use production data read-only. Any required new synthetic setup must be narrowly scoped and documented with cleanup; never reset actual users or modify their privileges.
- Do not send email, submit actual applications, issue credentials, publish courses, or record attendance/grades during page verification.
- Keep credentials, tokens, browser state and private page data out of Git, chat and public reports.
- Discover routes automatically. Mark unavailable valid-record states separately; invalid-link checks do not count as valid detail coverage.
- Retain GitHub's required review and CI. Ask for a real external review only after the tested PR is concrete and ready.

## Completion evidence

Per-route, per-role results; browser/server error summaries; reproducible fixes and regressions; final production revision and health. Report any untested state explicitly.
