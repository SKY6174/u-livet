# anchor-operation-manuals-1-1-0 - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-operation-manuals-1-1-0.plan.md`

---

## 1. Overview

### 1.1 Purpose

Define the immutable v1.1.0 manual release that documents all user-facing operational changes made after `manuals-v1.0.0` while retaining v1.0.0 as a complete historical snapshot.

### 1.2 Design Goals

- Use one versioned JSON file as the source for web, Markdown, and PDF outputs.
- Add procedures only when the current route, component, design document, or verification script supports them.
- Explain actor boundaries, save/review/submit states, evidence requirements, and completion checks.
- Reuse the existing generation and integrity pipeline without rewriting published artifacts.

## 2. Architecture

### 2.1 Release Architecture

```text
src/content/manuals/1.1.0.json
        |
        +--> src/lib/manuals/data.ts --> /manuals web routes
        |
        +--> scripts/build-manuals.mjs
                +--> public/manuals/1.1.0/*.md
                +--> public/manuals/1.1.0/*.pdf
                +--> public/manuals/1.1.0/manifest.json
                +--> output/pdf/manuals/1.1.0/*.pdf
```

`src/content/manuals/releases.json` orders the releases and points current-version redirects to 1.1.0. The generator verifies every previously published release before creating the new one.

### 2.2 Content Mapping

| Manual | v1.1.0 additions or revisions |
|---|---|
| Learner | Combined document workspace with application and scholarship tabs; document download checks. |
| Internal instructor | Responsible-course assignment boundary; split plan/result menus; signed teaching record and QR attendance evidence; result schedule, photo, and attachment workflow. |
| External instructor | Same operational document and evidence workflow where the external instructor is assigned as responsible instructor; archived-course assignment note. |
| Course operator | Responsible instructor assignment, plan/result lists, budget-before-submit rule, PDF-assisted draft import, separate schedule date/time fields, 16:9 photo crop and eight-photo continuation pages, scholarship details and report attachments. |
| Certification | Use signed teaching and QR attendance evidence during actual teaching and completion review. |
| Finance | Distinguish editable report finance data from verified source-PDF evidence; preserve approval boundaries. |
| Performance | Review AI-import evidence, operation photos, scholarship details, attachments, and print output before accepting result reports. |
| Administrator | Initial/internal instructor allocation, external-only restrictions where applicable, and operational audit of imports and attachments. |

### 2.3 Evidence Priority

1. Current route and component behavior at source commit `449f6c56b5552ae1e4353713ac868a007310b515`.
2. Feature design and analysis documents created for each change.
3. Verification scripts and database constraints that define state transitions or permissions.
4. Existing v1.0.0 wording for unaffected procedures.

Conflicts are resolved in favor of current implementation, with cautious wording when the live deployment or institutional policy is not proven.

## 3. Data Model

### 3.1 Release Entity

The v1.1.0 JSON retains the existing `ManualRelease` schema:

- Release metadata: version, release date, title, status, source commit, scope, changes.
- Shared preparation guidance.
- Eight manuals with stable IDs and document codes.
- Each manual: audience, owner, prerequisites, sections, checklist, FAQ, and source paths.
- Each section: stable ID, title, route, menu entry, preparation, ordered steps, completion check, and caution.

### 3.2 Version Relationships

- v1.0.0 and v1.1.0 are independent full snapshots.
- Stable manual IDs keep links and distribution filenames predictable.
- `/manuals/{audience}` resolves to v1.1.0.
- `/manuals/{audience}/1.0.0` and all v1.0.0 downloads continue to resolve unchanged.

## 4. Web and Distribution Behavior

No new API endpoint is required. Existing server-rendered App Router pages load the catalog and select the requested version. The release builder writes static distribution files; the manifest stores the canonical-source hash and every generated-file hash.

The history page must show both versions and identify 1.1.0 as current. Search operates only inside the selected current release on the catalog page, while fixed detail URLs render their own snapshot.

## 5. Implementation Plan

### 5.1 Files

- Add `src/content/manuals/1.1.0.json`.
- Update `src/content/manuals/releases.json`.
- Update `src/lib/manuals/data.ts` with a second static JSON import.
- Update `docs/manuals/README.md` and PDCA documents.
- Generate `public/manuals/1.1.0/` and `output/pdf/manuals/1.1.0/`.
- Do not edit any file below the v1.0.0 release directories.

### 5.2 Implementation Order

1. Audit the commit range and map changed workflows to manual audiences.
2. Copy v1.0.0 canonical content to a new v1.1.0 source and update release metadata.
3. Revise affected procedures, checks, FAQs, and source references.
4. Register the release in the catalog and typed loader.
5. Run draft generation, inspect page counts and text, and correct overflow.
6. Run the PDF artifact marker once immediately before release authoring.
7. Publish locally, verify immutable hashes, and copy final PDFs to `output/pdf`.
8. Validate web routes, current redirects, history, search, and downloads.

## 6. Test Plan

### 6.1 Content and Integrity

- Validate the schema, unique IDs, paths, and source-file existence for both versions.
- Confirm generated Markdown equals canonical content.
- Extract PDF text and assert each section title and procedure step appears.
- Confirm mutation and deletion of either release is rejected.
- Confirm current and fixed-version selection returns the correct release.

### 6.2 Web and Build

- Run lint and production build.
- Request all eight v1.1.0 fixed pages, all PDFs, the history page, and representative v1.0.0 pages.
- Confirm current audience URLs redirect to v1.1.0 and invalid versions return 404.
- Check desktop and narrow viewport layouts for overflow and readable navigation.

### 6.3 Visual PDF Review

- Render all PDF pages to PNG with Poppler.
- Inspect contact sheets for page headers, section starts, text wrapping, completion boxes, footers, and blank pages.
- Inspect the first page and any dense or suspicious page at full resolution.
- Reopen all PDFs to verify metadata and page counts.

## 7. Security and Operational Boundaries

- Do not include real names, account identifiers, signatures, bank details, or source-document contents.
- State that PDF import creates a review draft and does not replace human verification.
- State that source evidence, attachments, and finance values require authorized review before final submission.
- Keep responsibility separation for approval, payment, certificate issuance, and final report acceptance.
- Retain the status `소스 기준 제작본 · 운영 검수 전` until the institution completes operational review.
