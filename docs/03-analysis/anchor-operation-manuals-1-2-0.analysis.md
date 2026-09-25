# Gap Analysis: anchor-operation-manuals-1-2-0

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-operation-manuals-1-2-0.design.md`

---

## Match Rate: 100%

## Summary

The v1.2.0 manual release matches all planned release, content, versioning, validation, and security requirements. The implementation registers a third immutable release, updates all affected audience procedures, generates all web and distribution artifacts, and preserves the hashes and fixed URLs of v1.0.0 and v1.1.0.

## Implemented Items

- [x] Added the canonical `src/content/manuals/1.2.0.json` snapshot at verified source commit `73dfafbf8e6b80907a5d8cbd01a06568a7309795`.
- [x] Registered 1.2.0 as current while retaining the 1.0.0 and 1.1.0 catalog entries and static loader imports.
- [x] Updated learner guidance for three document tabs, eligibility locks, calculated refund amounts, PDF download, server submission, history, original PDF, and receipt cancellation.
- [x] Updated course-operator and administrator guidance for the learner-document inbox, learner-visible notes, permitted state transitions, stale-revision recovery, additional authentication, and 30-second dashboard refresh.
- [x] Updated finance guidance to separate refund-document review from refund calculation, approval, transfer, and reconciliation.
- [x] Updated certification guidance for the full 16-course list, course-registration gaps, and the scholarship-form completion dependency.
- [x] Updated instructor, course-operator, performance, and administrator guidance for card/list filters, `DB 이관 대기`, schedule printing, result-cover fields, and signature boundaries.
- [x] Updated administrator guidance for task-based menu sections and activation of manually registered staff accounts using the registered email.
- [x] Published eight audience PDFs, eight Markdown files, one combined PDF, and a SHA-256 manifest under `public/manuals/1.2.0`.
- [x] Copied nine final PDFs to `output/pdf/manuals/1.2.0` for delivery.
- [x] Verified all 67 manual integrity, text, metadata, selection, immutability, and search checks.
- [x] Passed ESLint and the optimized Next.js production build.
- [x] Rendered every audience PDF page and inspected contact sheets and dense pages for clipping, blank pages, Korean text, headers, footers, and page numbering.
- [x] Verified local HTTP behavior for the catalog, current redirect, fixed 1.2.0 page, fixed 1.1.0 page, history, and PDF download.

## Missing Items

None.

## Changed Items (Deviations from Design)

None. The implementation kept the planned eight manuals and added content only to the audiences that perform or review the changed workflows.

## Validation Evidence

- `npm run manuals:check`: all three releases valid.
- `npm run test:manuals`: 67 checks passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: production build passed.
- PDF page counts: learner 5, internal instructor 5, external instructor 5, course operator 6, certification 5, finance 5, performance 5, administrator 6.
- HTTP checks: catalog 200, current learner redirect 307 to 1.2.0, fixed 1.2.0 page 200, fixed 1.1.0 page 200, history 200, learner PDF 200 with `application/pdf`.

## Recommendations

1. Have the named operational owners review the released wording before changing the status from `소스 기준 제작본 · 운영 검수 전`.
2. Use v1.2.0 fixed URLs in training material and keep previous fixed URLs for historical records.

## Next Steps

- [x] Proceed to the completion report.
