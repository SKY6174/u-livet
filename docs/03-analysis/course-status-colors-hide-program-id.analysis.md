# Course status presentation verification

Date: 2026-10-08 (Asia/Seoul).

Manual design comparison: 8/8 requirements met (100%); no unresolved gaps.

| Requirement | Evidence |
| --- | --- |
| Preparation is amber | Rendered DRAFT and unlinked card badges; summary tile uses the same tone. |
| Recruitment/operation is teal | Rendered PUBLISHED and CLOSED badges share the teal background. |
| Completed/archive is violet | Rendered ARCHIVED badge; summary tile and additional-course badges use the same palette. |
| Status labels remain explicit | Preparation, public recruitment, closed recruitment and archived labels remain present. |
| Course cards/list hide program IDs | Browser assertions found no program ID in cards or list; list has eight columns. |
| Search and state filters work | Search narrowed synthetic local courses; active filter returned PUBLISHED/CLOSED only. |
| Existing workflows remain available | Management URLs and budget tab verified; underlying budget program IDs remain present. |
| Desktop/mobile layouts work | Screenshots inspected; 390px viewport has no page overflow; no browser page errors. |

Validation: `npm run lint`, `npm run build`, and all 12 checks in `node scripts/verify-course-budget.mjs` passed. One-off Playwright checks used synthetic records in the guarded local Supabase database and removed them afterward. No production data was changed and no database migration is needed.

Screenshots: `/tmp/u-livet-course-status-desktop.png`, `/tmp/u-livet-course-status-list.png`, `/tmp/u-livet-course-status-mobile.png`.

Release gate: required PR checks, exact merged-commit production deployment, version/health endpoints and administrator authentication redirect.
