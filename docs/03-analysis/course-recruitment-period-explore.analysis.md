# Gap analysis: course-recruitment-period-explore

Date: 2026-10-08 (Asia/Seoul). Design: `docs/02-design/features/course-recruitment-period-explore.design.md`.

## Match rate: 100% (7/7 implementation requirements)

- [x] Public catalogue title is 과정 탐색 in both views.
- [x] Shared recruitment renderer uses the existing Korean-time formatter and semantic timestamp elements.
- [x] Missing/incomplete windows show 모집 일정 안내 예정 without invented dates.
- [x] 모집기간 is directly below the card status; the duplicate lower 신청기간 row is removed. Each date/time stays together when the range wraps.
- [x] List prioritizes 모집기간 · 비용 before 교육기간, updates the caption, and preserves tuition handling.
- [x] Existing permitted DB windows and public data boundary are reused without migrations or new queries.
- [x] Completion/search/mode/view conditions, instructor names, course links and admission behavior are preserved.

Validation: 25 catalogue regression checks, lint, production build and whitespace checks pass. Native Chromium using the production build and local Supabase verifies 52 permitted courses (45 current, 7 completed), 36 known windows against anonymous public DB timestamps and Asia/Seoul text, 16 missing windows, identical card/list values, title/placement/no duplication, combined search/mode/view conditions, 390px wrapping and no page errors. Final desktop and mobile card screenshots reviewed; React review found no new client state, fetch waterfall or hooks concern.

No missing requirements or design deviations. Next: PR checks, merge and exact production revision/health, live DB-backed browser and runtime-log verification.
