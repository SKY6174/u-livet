# Course completion filter

Date: 2026-10-08 (Asia/Seoul).

The learner course catalogue currently hides completed courses unconditionally. Learners also want to discover prior offerings when planning for the next year. Add an operation-state filter without changing the default current/upcoming view.

The options are 진행 중·예정 (default), 운영 완료 and 전체 과정. Existing search and delivery-mode filters combine with this condition, and card/list navigation preserves it. Use the existing course-end-date and archived-status criterion, including Korean midnight and the inclusive end date. Public visibility remains governed by the existing DB queries.

Completed items should show 운영 완료 in both catalogue views. Preserve existing course links, admission rules, permissions and instructor presentation. Add focused boundary/render checks, validate real public DB-backed navigation on desktop/mobile, then push/PR/checks/merge/deploy and confirm the production revision and health.
