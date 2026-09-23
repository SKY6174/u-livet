# Annual course plan introduction — design

Date: 2026-09-24 · Plan: `docs/01-plan/features/anchor-course-plan-intro-one-line.plan.md`

In `CoursePlanView`, replace the two long introduction sentences with one concise sentence: “아카데미별 연간 계획의 과정·인력·일정·예산을 확인하세요. 실제 운영은 과정 운영 관리에서 확인합니다.” Remove `max-w-3xl` from this paragraph so it can use the available page width. Keep normal wrapping on small screens; do not force horizontal overflow. No data, navigation, or authorization changes.

Verify the rendered copy and class, then run lint and TypeScript checks. At the reference desktop width, the shortened text should fit on one line.
