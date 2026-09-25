# anchor-operation-manuals-1-3-0 - Plan Document

> Version: 1.0.0 | Date: 2026-09-25 | Status: Approved
> Level: Dynamic

## 1. Purpose and background

Refresh the eight audience-specific U-LIFE manuals after the v1.2.0 release. The current branch has retained v1.0.0 and v1.1.0 but lacks the v1.2.0 release commit; restore that immutable release from `manuals-v1.2.0` before publishing v1.3.0. Changes since the tag include learner and instructor class questions, learner home, QR checkout and attendance print, course registration and operation document filters, annual monitoring/PDCA, completion attendance and refund indicators, member Excel, development filters, and account security presentation.

## 2. Goals

- [x] Restore v1.2.0 source, PDF, Markdown, manifest, and fixed URLs without changing its bytes.
- [x] Publish v1.3.0 as current for eight audiences in web, Markdown, and PDF formats.
- [x] Explain new steps only for actors who perform or review them, using current routes and labels.
- [x] Preserve 1.0.0, 1.1.0, and 1.2.0 as full historical snapshots.
- [x] Record the source baseline, change list, integrity hashes, checks, and Git tag.

## 3. Scope

In scope: the canonical v1.3.0 JSON, release catalog, typed loader, manual management guide, generated downloads, and PDCA documents. The most material workflow changes concern the learner, both instructor types, course operator, completion, performance, and administrator. Finance text changes only where refund status has a new handoff or indicator.

Out of scope: production deployment, changing application workflows, institutional policy approval, and editing historical release files.

## 4. Success criteria

- [x] All four versions appear in the catalog, 1.3.0 is current, and older fixed pages and downloads resolve.
- [x] Every added procedure has an entry route, prerequisites, ordered steps, completion check, and caution.
- [x] Manual integrity tests, lint, build, local HTTP checks, extracted text, and rendered PDF review pass.
- [x] Eight individual PDFs, one combined PDF, eight Markdown files, and a manifest are produced.
- [x] Unrelated untracked duplicate files in the working tree are untouched.

## 5. Risks and controls

| Risk | Control |
|---|---|
| Current branch diverged from the v1.2.0 tag | Restore only the tag's manual release files, inspect the diff, and validate old hashes. |
| New operational and finance states are conflated | Check current UI, RPC and feature designs; explicitly separate application, document, completion, and payment decisions. |
| Draft or sample data are presented as live records | Label completion sample preview and source-linked draft registration correctly. |
| PDF content or layout is incomplete | Compare JSON, Markdown and PDF text; render all pages and inspect contact sheets and dense pages. |

## 6. References

- `manuals-v1.2.0` and current source commit `aac72cbd9841a5980790eb24a94c52c3da17a06c`
- `docs/manuals/README.md`
- Feature plans and designs for class questions, course monitoring, learner documents, completion, member Excel, operation document registration, and QR session grid
