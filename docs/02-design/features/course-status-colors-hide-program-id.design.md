# Course status presentation design

Date: 2026-10-08 (Asia/Seoul). Extends `anchor-course-operations-clarity.design.md`.

## Presentation
- `operations-dashboard.tsx`: static Tailwind tones for DRAFT (amber), PUBLISHED/CLOSED (teal), ARCHIVED (violet), with DRAFT fallback for unlinked courses.
- Apply border/background/dark-text tones to the corresponding summary tiles and both card/list status badges. Keep all status labels so color is supplementary.
- Remove the card's program-ID paragraph and the list's program-ID header/cell. Increase the card-title top margin to retain spacing after the academy/status row. Search placeholder becomes ‘과정명·강사 검색’; existing matching remains available.
- `course-list.tsx`: align its additional-course badges with the same amber/teal/violet palette.
- Budget editing, underlying program IDs, data queries, filters and management links remain intact. No database migration.

## Verification
Inspect desktop and narrow-screen renderings with preparation, public recruitment, closed recruitment, archived and unlinked courses. Confirm hidden IDs in course cards/list, retained labels and action URLs, state/search filtering and budget-tab access. Use existing checks and one-off UI verification; avoid introducing tests for this reversible presentation change. Complete lint/build and verify the deployed commit, health and administrator authentication gate.
