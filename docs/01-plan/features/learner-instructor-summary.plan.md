# Learner instructor summary

Date: 2026-10-08 (Asia/Seoul).

## User requirement
Show learners `강사 : A(책임), B, C`, with `(책임)` rendered as a superscript. The user's subsequent clarification replaces the earlier request to show only the responsible instructor.

## Scope and criteria
- Apply one compact name line to public course cards/list/detail and learner home/learning cards.
- Mark only the actual assigned responsible instructor; show that instructor first. Keep other eligible instructor names.
- Keep public-profile approval, consent, valid assignment and role conditions. Enrolled learners retain their existing access to active assigned names.
- Exclude internal recommendations, verification status and support staff from learner presentation.
- Retain administrative instructor management and the legacy learning RPC name array.
- Course-operation action links become independent buttons without directional arrows, as additionally requested.
- Verify responsibility changes, absent/expired assignments, consent boundaries and semantic superscript rendering, then lint/build and desktop/mobile flows.
- Push, PR, merge and deploy with the compatible migration; verify production version and DB health.
