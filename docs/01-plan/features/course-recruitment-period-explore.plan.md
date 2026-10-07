# Course recruitment period and exploration title

Date: 2026-10-08 (Asia/Seoul).

Rename the public catalogue heading from 교육과정 찾기 to 과정 탐색. Learners should see the recruitment window immediately when comparing courses, rather than finding 신청기간 below the description and education period.

Promote 모집기간 next to the existing recruitment status in cards and prioritize the corresponding list column. Use the already permitted DB `apply_from`/`apply_until` dates, displaying Korean date/time as before. Missing windows must say 모집 일정 안내 예정; no schedule is inferred from education dates.

Preserve existing current/completed/all filters, search, view navigation, instructor names, course links and admission eligibility. No data model, permission or query change is required. Validate existing catalogue checks, lint/build and actual desktop/mobile DB-backed rendering, then push, open PR, pass checks, merge and verify production deployment/revision/health.
