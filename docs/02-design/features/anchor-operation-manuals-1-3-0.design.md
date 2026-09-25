# anchor-operation-manuals-1-3-0 - Design Document

> Version: 1.0.0 | Date: 2026-09-25 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-operation-manuals-1-3-0.plan.md`

## 1. Release architecture

The immutable v1.2.0 tag is the base snapshot. Restore its canonical JSON, fixed PDF/Markdown downloads, manifest, and PDCA record into the current branch without editing their contents. Add `src/content/manuals/1.3.0.json` as a new full snapshot. Register 1.0.0 through 1.3.0 in `src/content/manuals/releases.json` and static imports in `src/lib/manuals/data.ts`, with 1.3.0 current. The existing builder generates `public/manuals/1.3.0/` and `output/pdf/manuals/1.3.0/` and verifies previous manifests before writing.

## 2. Audience content map

| Audience | New guidance |
|---|---|
| Learner | Home current classes and next session; attendance snapshot; class questions with private or course visibility; QR start/end confirmation and limits; document status access. |
| Internal and external instructor | My Room class status/unanswered questions; reply workflow; QR start/end phases and per-session print; source course assignment boundary. |
| Course operator | Source-linked draft registration, organization/year operation-document filters, learner-document table filters, course monitoring signals, 2026–2027 PDCA dates/progress/evidence, and operation procedure guide. |
| Certification | Submitted plan attendance threshold, real attendance-based provisional/completed rates, refund markers, sample-data caveat, compact per-learner review and separate approval. |
| Finance | Distinguish refund document, finance request, approval, and payment statuses when reconciling completion and refund records. |
| Performance | Course monitoring PDCA evidence and annual evaluation handoff. |
| Administrator | Member Excel template/upload-preview-confirm/download, year filters, account activation, two-hour recent MFA window, and operational handoff. |

## 3. Evidence and boundaries

Use current source at `aac72cbd9841a5980790eb24a94c52c3da17a06c`, then relevant approved feature designs and database constraints. Keep stable manual IDs and document numbers. Each section retains `id`, `title`, `path`, `entry`, `prepare`, `steps`, `done`, and `note`. Preserve unaffected v1.2.0 wording. The printed manual must explain that a QR timestamp is separate from accepted attendance, completion examples are read-only samples, monitoring percentages derive from specific evidence, and a refund application or document is separate from a paid refund.

## 4. Files and generation

1. Restore the v1.2.0 release commit or its release-only files from the tag; verify its source and artifact hashes.
2. Copy canonical v1.2.0 content to a new v1.3.0 source, update metadata, then edit only the affected audiences.
3. Register v1.3.0 and update the management README; retain all old imports and files.
4. Build draft files, inspect text and rendered pages, then locally release nine PDFs, eight Markdown files, and a manifest.
5. Validate historical hashes, manual tests, lint/build, routes, PDFs, and a clean release diff.
6. Record analysis/report and commit/tag the new release.

No manual API is added. Existing App Router pages render the selected release and static public paths serve the downloads.

## 5. Verification

- Confirm every source reference path exists, IDs are unique, version order is correct, and previous release hashes match.
- Compare canonical section titles and steps with generated Markdown and extracted PDF text.
- Render every audience PDF page and the combined PDF cover/boundaries; inspect legibility, wrapping, pagination, and glyphs.
- Check current redirects, v1.3.0 and historical fixed URLs, history, search, downloads, and an invalid version.
- Run `npm run manuals:check`, `npm run test:manuals`, lint, and production build.

## 6. Security and operational accuracy

Do not include actual personal information, signatures, QR secrets, account identifiers, or bank details. Explain role, institution, and recent MFA conditions where staff actions require them. Keep the release status `소스 기준 제작본 · 운영 검수 전` until named operational owners validate the wording against their deployed environment and approved policies.
