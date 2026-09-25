# anchor-operation-manuals-1-2-0 - Completion Report

> Date: 2026-09-23 | Status: Complete | Match Rate: 100%

## Outcome

U-LIFE operating manuals were updated from v1.1.0 to v1.2.0 for all eight audiences. The website now treats v1.2.0 as current while retaining v1.0.0 and v1.1.0 at their fixed URLs. PDF and Markdown distributions were generated from the same canonical source and frozen with SHA-256 hashes.

## Delivered Content

- Eight web manuals containing 50 procedure sections and 179 ordered steps.
- Eight individual PDFs totaling 42 pages.
- One 43-page combined PDF.
- Eight Markdown distribution files and one manifest.
- A current release catalog, version-aware loader, updated management guide, and full PDCA record.

The revision covers three learner-document forms, eligibility gates, server submission and timelines, staff review and learner-visible notes, refund-finance handoff, the administrator request summary, the 16-course completion and operation-document lists, member account activation, and printed schedule/result-cover checks.

## Version Management

- Current version: `1.2.0` dated 2026-09-23.
- Previous versions: `1.0.0` and `1.1.0` remain immutable and available.
- Product source baseline: `73dfafbf8e6b80907a5d8cbd01a06568a7309795`.
- Final artifacts: `public/manuals/1.2.0` and `output/pdf/manuals/1.2.0`.
- Release integrity: source hash plus every Markdown and PDF hash in `manifest.json`.

## Verification

- Schema and source-path validation passed for all three releases.
- 67 automated manual checks passed.
- Canonical source, Markdown, and extracted PDF text matched for all eight manuals.
- Final PDF pages were rendered and visually inspected; headers, footers, page numbering, wrapping, Korean glyphs, and section transitions were correct.
- ESLint and the optimized production build passed.
- Local HTTP checks passed for the catalog, current 307 redirect, fixed v1.2.0 page, fixed v1.1.0 page, history, and PDF download.

## Operational Limit

The release remains labeled `소스 기준 제작본 · 운영 검수 전`. It reflects repository behavior and design evidence, but no remote deployment or institutional policy approval was performed in this task.

## Recommended Follow-up

Assign named reviewers for course operation, instruction, certification, finance, performance, and system administration. After they confirm the deployed screens and institutional policy wording, publish wording corrections as v1.2.1 without altering v1.2.0.
