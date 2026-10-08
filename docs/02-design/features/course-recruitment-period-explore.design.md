# Course recruitment period and exploration design

Date: 2026-10-08 (Asia/Seoul). Builds on public-course-enrollment-info and course-completion-filter.

- Change `/courses` PageIntro title to 과정 탐색.
- Within the existing catalogue component, share recruitment-date rendering between card and list. A complete DB window displays Asia/Seoul dates as `YYYY.MM.DD ~ YYYY.MM.DD` on one line and retains semantic `<time dateTime>` elements for each original timestamp. Incomplete/missing windows show 모집 일정 안내 예정.
- Card: a labeled 모집기간 block directly below the existing recruitment status, before instructor names, summary and education details. Remove the old 신청기간 row to avoid duplication. Give the block a light teal background, border, readable label and a date range without wrapping.
- List: rename the column 모집기간 · 비용 and position it before 교육기간. Reuse the same dates/fallback and preserve cost null/free/value handling. Update the accessible caption to identify both periods.
- `getCourseCatalog` and `mergeCatalog` already provide permitted `apply_from`/`apply_until` from linked or additional public offerings. Keep these queries, course-guide fallback, completion filters, search/view URLs, admission rules and public instructor presentation intact. No migration or new query.

Validation: update the existing catalogue render expectation for 모집기간; run catalogue regression, lint and production build. Native browser checks must compare displayed dates against public DB timestamps, verify known and missing windows, placement/no duplicate dates, title in card/list, retained completion/search conditions, historical views, no page errors and a single-line date range at 390px. Review screenshots. GitHub checks precede merge, followed by Vercel READY, exact production revision, DB health, live browser and error-log checks.
