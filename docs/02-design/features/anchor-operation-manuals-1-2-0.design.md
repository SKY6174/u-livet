# anchor-operation-manuals-1-2-0 - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-operation-manuals-1-2-0.plan.md`

---

## 1. Overview

### 1.1 Purpose

Define the immutable v1.2.0 manual release that documents user-facing changes after `manuals-v1.1.0` while retaining v1.0.0 and v1.1.0 as complete historical snapshots.

### 1.2 Design Goals

- Use one versioned JSON file as the source for web, Markdown, and PDF outputs.
- Match current routes, button labels, eligibility rules, status transitions, and role boundaries.
- Separate learner-document receipt and review from academic approval, scholarship payment, refund approval, and bank transfer.
- Reuse the existing release, hash, rendering, and integrity pipeline without rewriting published artifacts.

## 2. Architecture

### 2.1 Release Architecture

```text
src/content/manuals/1.2.0.json
        |
        +--> src/lib/manuals/data.ts --> /manuals web routes
        |
        +--> scripts/build-manuals.mjs
                +--> public/manuals/1.2.0/*.md
                +--> public/manuals/1.2.0/*.pdf
                +--> public/manuals/1.2.0/manifest.json
                +--> output/pdf/manuals/1.2.0/*.pdf
```

`src/content/manuals/releases.json` orders releases and points current-version redirects to 1.2.0. Before writing a new release, the generator validates every already-published release against its manifest.

### 2.2 Content Mapping

| Manual | v1.2.0 additions or revisions |
|---|---|
| Learner | Three document tabs; approval-based form locks; eligible-course selection; refund amount calculation; PDF download versus server submission; request timeline, original PDF, and receipt cancellation. |
| Internal instructor | Operation-document card/list filters, `DB 이관 대기` boundary, and printed schedule/result-cover review points. |
| External instructor | Same operation-document list and print-review guidance where the instructor is assigned as the responsible instructor. |
| Course operator | Learner-document inbox; status transitions and learner-visible notes; dashboard request summary; full 16-course completion list; course registration handoff; operation-document migration labels and print checks. |
| Certification | Full source-course completion list, `과정 등록 필요`, academic approval boundary, and the approved-completion dependency for scholarship documents. |
| Finance | Refund-document original review and handoff to the separate finance refund calculation, approval, transfer, and reconciliation workflow. |
| Performance | Operation-document source data, database registration, status, schedule, result-cover, and source-signature distinctions during evidence review. |
| Administrator | Task-based navigation, 30-second learner-request summary, learner-document access/MFA controls, roster-account linking, stale-update handling, and release management. |

### 2.3 Evidence Priority

1. Current route and component behavior at source commit `73dfafbf8e6b80907a5d8cbd01a06568a7309795`.
2. Feature design and analysis documents for learner documents, access gates, administrator inbox, completion/operation lists, print layout, and member account linking.
3. Database functions and verification scripts that define authorization, eligibility, state transitions, and stale-write rejection.
4. Existing v1.1.0 wording for unaffected procedures.

Conflicts are resolved in favor of the current implementation, with cautious wording when live deployment or institutional policy is not proven.

## 3. Data Model

### 3.1 Release Entity

The v1.2.0 JSON retains the existing `ManualRelease` schema:

- Release metadata: version, release date, title, status, source commit, scope, and changes.
- Shared preparation guidance.
- Eight manuals with stable IDs and document codes.
- Each manual: audience, owner, prerequisites, sections, checklist, FAQ, and source paths.
- Each section: stable ID, title, route, menu entry, preparation, ordered steps, completion check, and caution.

### 3.2 Version Relationships

- v1.0.0, v1.1.0, and v1.2.0 are independent full snapshots.
- Stable manual IDs keep links and distribution filenames predictable.
- `/manuals/{audience}` resolves to v1.2.0.
- `/manuals/{audience}/1.0.0` and `/manuals/{audience}/1.1.0` continue to resolve unchanged.

### 3.3 Workflow Terms

- Learner-document statuses are `접수`, `검토 중`, `승인`, `반려`, `처리 완료`, and `접수 취소`.
- Staff may move a request only along the next states shown by the current request; an explanatory learner-visible note is required.
- A learner may cancel only a request that is still in `접수`.
- Refund-form eligibility requires an approved application for the same offering.
- Scholarship-form eligibility requires an approved application and a valid completion approval for the same offering.
- Document approval records acceptance of that document workflow. Financial and academic systems retain their own approval and completion states.

## 4. Web and Distribution Behavior

No new manual API endpoint is required. Existing App Router pages load the catalog and select the requested version. The release builder writes static distribution files; the manifest stores the canonical-source hash and every generated-file hash.

The history page must show all three versions and identify 1.2.0 as current. Search operates inside the selected current release on the catalog page, while fixed detail URLs render their own snapshots.

## 5. Implementation Plan

### 5.1 Files

- Add `src/content/manuals/1.2.0.json`.
- Update `src/content/manuals/releases.json`.
- Update `src/lib/manuals/data.ts` with a third static JSON import.
- Update `docs/manuals/README.md` and PDCA documents.
- Generate `public/manuals/1.2.0/` and `output/pdf/manuals/1.2.0/`.
- Do not edit any file below the v1.0.0 or v1.1.0 release directories.

### 5.2 Implementation Order

1. Copy v1.1.0 canonical content to the new release and update metadata.
2. Revise affected procedures, checks, FAQs, and source references.
3. Register the release in the catalog and typed loader.
4. Run preflight content and old-release integrity checks.
5. Mark PDF artifact authoring immediately before the first release build.
6. Generate versioned web downloads and delivery PDFs.
7. Validate text, hashes, routes, build output, and rendered pages.
8. Record analysis and completion reports and create the immutable Git release tag.

## 6. Test Plan

### 6.1 Content and Integrity

- Validate schema, unique IDs, paths, source-file existence, and catalog order for all releases.
- Confirm generated Markdown equals canonical content.
- Extract PDF text and assert each section title and procedure step appears.
- Confirm mutation or deletion of any historical release is rejected.
- Confirm current and fixed-version selection returns the correct release.

### 6.2 Web and Build

- Run lint and production build.
- Request all eight v1.2.0 fixed pages, all PDFs, the history page, and representative historical pages.
- Confirm current audience URLs redirect to v1.2.0 and invalid versions return 404.
- Check desktop and narrow viewport layouts for overflow and readable navigation.

### 6.3 Visual PDF Review

- Render all PDF pages to PNG with Poppler.
- Inspect contact sheets for page headers, section starts, wrapping, completion boxes, footers, page numbering, and blank pages.
- Inspect the first page and dense pages at full resolution.
- Reopen all PDFs to verify metadata and page counts.

## 7. Security and Operational Boundaries

- Do not include real names, account identifiers, signatures, resident registration numbers, bank details, or submitted document contents.
- Explain that resident registration numbers, account details, and signatures belong only in the protected document process.
- State that staff notes become visible to the learner and must exclude unnecessary sensitive information.
- State that staff access requires an allowed role, institution scope, and recent additional authentication.
- Treat prefilled 16-course source data as a migration candidate; database identity, authorization, and workflow status remain authoritative.
- Retain the status `소스 기준 제작본 · 운영 검수 전` until the institution completes operational review.
