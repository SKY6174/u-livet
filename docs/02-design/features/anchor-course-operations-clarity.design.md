# Course operations clarity — design

Date: 2026-09-23 · Plan: `docs/01-plan/features/anchor-course-operations-clarity.plan.md`

## Organization scope

The canonical anchor organization is seeded as `10000000-0000-4000-8000-000000000001`. On `/admin/courses`, derive all allowed organization IDs from the signed-in role grants as before. If that set contains the anchor ID, scope this page to that ID; otherwise preserve the existing granted IDs for other authorized users. Reject an `org` query value outside the resulting set. For a single anchor organization, show its real name as read-only context; do not show a one-choice dropdown or selection button. Do not mutate organizations or role assignments.

## Page structure

Replace the teal summary and flat four-link row with two distinct regions: (1) “연간 계획에서 개설까지”, containing the ordered “과정 현황” and “개설 준비” destinations and a short explanation of their different purposes; (2) “새 교육과정 기획”, containing “과정 개발·심의”. Remove the message-management shortcut. Remove the top result-report button and per-course result-report action; dedicated report navigation remains elsewhere.

Keep the dashboard's course/budget tabs. Add a manager-only red “새 과정 등록” link at the far right of the same tab row; its existing query/hash opens the unchanged registration `<details>` after navigation. Responsive wrapping must keep the button visible above the card/list controls.

## Security and behavior

Server role gates and client manager checks remain. Keep parallel workspace, year, budget and responsible-instructor reads; no extra DB round trip. Keep plan-ID validation, draft working-copy logic and form year scoping. The message route and historical records remain intact; only this menu entry is removed pending future product decisions.

## Checks

Add a focused synthetic page/dashboard check for two-organization identity, grouped links, removed result/message links and red button placement. Re-run course-opening/working-copy and role checks, lint, TypeScript, build, preview health and production health.
