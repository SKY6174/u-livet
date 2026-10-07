# Gap analysis: course-completion-filter

Date: 2026-10-08 (Asia/Seoul). Design: `docs/02-design/features/course-completion-filter.design.md`.

## Match rate: 100% (8/8 implementation requirements)

- [x] Default current/upcoming catalogue; completed and all conditions selectable.
- [x] Missing, invalid and repeated state parameters normalize to current.
- [x] State condition combines with text and delivery mode.
- [x] GET form and card/list links retain selected conditions and view.
- [x] Completion and badge use the same archived/end-date criterion, including Korean midnight and inclusive end dates.
- [x] Both catalogue views show completed badges and historical detail links.
- [x] Existing permitted DB catalogue, instructor presentation, admission rules and privacy boundary are preserved; no new query or migration.
- [x] Empty state identifies all available search conditions.

## Validation

- Course catalogue regression: 25 checks pass, including partition, boundary, combined filter, parameter and card/list render cases.
- DB latency/projection follow-up: 11 checks pass. Lint, production build and diff whitespace checks pass.
- Native Chromium against the production build and local Supabase: current 45, completed 7, all 52. Verified real GET submissions, disjoint/complete partition, completed badges, text/mode combination, retained conditions across both views, historical detail HTTP 200 and heading, 390px mobile wrapping, invalid/repeated parameters and no page errors.
- Desktop/mobile screenshots reviewed. Next.js's empty route-announcer alert is excluded from data-error detection; nonempty alerts remain checked.
- No missing implementation items or design deviations. Next: GitHub checks, merge and exact production deployment/revision/health/browser verification.
