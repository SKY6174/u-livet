# Course operations clarity — plan

Date: 2026-09-23 · Level: Dynamic

## Background

The course-operations page shows two organizations to the current lead account, a result-report shortcut inside operations, and four unrelated actions in one row. The second organization is a real `uc-sanhak` organization with an assigned role but no course offerings; deleting its DB row or role would affect other workflows. The user wants the course page to focus on the anchor organization and clearer distinctions among annual course status, opening preparation, and course development/review.

## Goals

- On this page, show the accessible anchor organization alone when available and avoid a redundant single-choice selector. Preserve the separate organization and its role in the database.
- Remove the result-report shortcut and result-report references from the course-operations surface; the dedicated report menu remains.
- Group annual status and opening preparation as an ordered operational path; show course development/review in a separate area. Remove the message-management entry from this menu without altering historical data.
- Move “새 과정 등록” to the far right of the “과정 목록 / 예산 및 집행현황” row, above the list/card controls, and use a red button.

## Acceptance

- Authorized anchor managers see a single, correctly named anchor organization on the course page, not the second organization as a selectable option.
- Relevant links lead to the same destinations; no report or message-management link appears in the course-operations UI.
- Manual and plan-prefilled registration continue opening the existing form, including org and plan validation.
- Role-gating, parallel data loading, synthetic navigation checks, lint, types, build and preview/production deployment pass.
