# Course completion filter design

Date: 2026-10-08 (Asia/Seoul). Extends the public course catalogue and learner instructor designs.

- Extend `CatalogSearch`/normalized filters with `state=current|completed|all`. Missing, invalid and array values default to current.
- `filterCatalog` applies the state condition to the existing `courseIsUpcoming` result: current is upcoming, completed is its complement, all ignores this condition. Search and delivery-mode checks continue to apply. This retains archived completion, date-based completion, inclusive end dates, Korean midnight and the existing treatment of unknown dates.
- `catalogHref` retains state when changing view, omitting the default current parameter. The GET form includes an 운영상태 select and retains the selected view, query and mode. Empty-state text refers to all search conditions.
- `recruitmentLabel` uses the same completion criterion before recruitment-window labels, so historically ended guides and offerings show 운영 완료 even when their underlying status has not yet been archived. These display filters do not change DB status or admission eligibility.
- Reuse the existing catalogue card/list, course links and instructor presentation. Existing public guide and course-introduction queries already fetch the permitted historical records. No migration or extra query is needed; private archived courses and unpublished guides remain excluded by the existing data boundary.

Validation: existing catalogue regression plus current/completed/all partition, combined filters, unknown/invalid/repeated state, URL encoding and state retention, midnight/archive classification and completed badges. Native public browser against a production build must verify GET submission, counts, searches, card/list toggles, a historical detail link, mobile wrapping and no page errors. Lint/build and relevant DB projection regression must pass. GitHub PR checks precede merge; verify Vercel READY, exact production revision, DB health and runtime errors after release.
