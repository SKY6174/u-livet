# Gap Analysis: anchor-operation-manuals-1-1-0

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-operation-manuals-1-1-0.design.md`

---

## Match Rate: 100%

## Summary

The v1.1.0 release matches the approved design. It preserves v1.0.0, registers a complete second snapshot, updates all affected role manuals, creates versioned web and distribution outputs, and passes content, integrity, build, route, responsive, and visual PDF checks.

## Implemented Items

- [x] Added `src/content/manuals/1.1.0.json` with source commit `449f6c56b5552ae1e4353713ac868a007310b515`.
- [x] Registered both releases and set 1.1.0 as current in the catalog and typed loader.
- [x] Preserved every v1.0.0 canonical and generated artifact with its original hashes.
- [x] Updated the learner manual for the combined application and scholarship document workspace.
- [x] Updated instructor manuals for split plan/result menus, responsible assignment, schedule fields, photo review, teaching segments, signatures, and QR evidence.
- [x] Updated the course-operator manual for assignment, budget-first submission, PDF-assisted drafting, evidence validation, scholarship rows, attachments, and photo output.
- [x] Updated certification, finance, performance, and administrator manuals with their review and audit boundaries.
- [x] Generated eight Markdown files, eight individual PDFs, one 40-page combined PDF, and a SHA-256 manifest.
- [x] Copied nine final PDFs to `output/pdf/manuals/1.1.0`.
- [x] Verified all 211 expected PDF text items and 64 source paths.
- [x] Rendered all 39 individual pages plus the combined cover; corrected the administrator orphan page and re-rendered the final content.
- [x] Confirmed final published PDFs are byte-identical to the visually reviewed draft.
- [x] Confirmed web search, current redirect, old fixed version, version history, desktop layout, 390px layout, downloads, and invalid-version handling.

## Missing Items

None within the plan scope.

## Changed Items (Deviations from Design)

- The design estimated a new release without a target page count. The final output is 39 individual pages and a 40-page combined PDF.
- Browser validation used a local production server rather than a remote deployment because remote publication was explicitly out of scope.

## Validation Evidence

- `npm run manuals:check`: v1.0.0 and v1.1.0 passed.
- `npm run test:manuals`: 46 checks passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: Next.js 15.5.25 production build passed.
- HTTP: eight fixed pages and eight PDFs returned 200; v1.0.0 returned 200; invalid 9.9.9 returned 404.
- Responsive: 390px viewport had 390px scroll width and no horizontal overflow.
- Combined PDF SHA-256: `23ec8b07658e7ce66eb9069adfa254b7c823351c6eaaadc984f48b607d2c902d`.

## Recommendations

1. Have each institutional workflow owner validate labels, responsibility boundaries, and policy wording on the deployed site.
2. Record reviewer names and approval evidence in a later patch release after operational review.
3. Keep using immutable release folders and a new semantic version for every correction.

## Next Steps

- [x] Proceed to completion report.
