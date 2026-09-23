# anchor-operation-manuals-1-1-0 - Completion Report

> Date: 2026-09-23 | Status: Complete | Match Rate: 100%

## Outcome

U-LIFE operating manuals were updated from v1.0.0 to v1.1.0 for all eight audiences. The website now treats v1.1.0 as current while retaining v1.0.0 at its fixed URLs. PDF and Markdown distributions were generated from the same canonical source and frozen with SHA-256 hashes.

## Delivered Content

- Eight web manuals containing 47 procedure sections and 156 ordered steps.
- Eight individual PDFs totaling 39 pages.
- One 40-page combined PDF.
- Eight Markdown distribution files and one manifest.
- A current release catalog, version-aware loader, updated management guide, and full PDCA record.

The revision covers learner document tabs, responsible-instructor assignment, split plan/result lists, signed teaching and QR attendance evidence, budget-first result submission, PDF-assisted draft import, source-evidence checks, schedule date/time fields, scholarship details, attachments 1-5, and 16:9 operation-photo output.

## Version Management

- Current version: `1.1.0` dated 2026-09-23.
- Previous version: `1.0.0` remains immutable and available.
- Product source baseline: `449f6c56b5552ae1e4353713ac868a007310b515`.
- Final artifacts: `public/manuals/1.1.0` and `output/pdf/manuals/1.1.0`.
- Release integrity: source hash plus every Markdown and PDF hash in `manifest.json`.

## Verification

- Schema and source-path validation passed for both releases.
- 46 automated manual checks passed.
- 211 titles and steps were found in extracted PDF text.
- Final PDF pages were rendered and visually inspected; headers, footers, page numbering, wrapping, Korean glyphs, and section transitions were correct.
- Lint and production build passed.
- Browser verification passed for search, detail, history, current redirect, old version, download routes, invalid-version 404, and a 390px viewport.

## Operational Limit

The release remains labeled `소스 기준 제작본 · 운영 검수 전`. It reflects repository behavior and design evidence, but no remote deployment or institutional policy approval was performed in this task.

## Recommended Follow-up

Assign named reviewers for course operation, instruction, certification, finance, performance, and system administration. After they confirm the deployed screens and institutional policy wording, publish any corrections as v1.1.1 without altering v1.1.0.
