# Learner instructor summary design

Date: 2026-10-08 (Asia/Seoul). Extends public-course and responsible-instructor designs.

## Data and permissions
- Introduce `InstructorName = { name: string; responsible: boolean }`.
- Add a responsibility boolean to the existing approved/consented public-profile RPC, using an exact offering/person join to `life_operation_responsibilities`. Keep all existing disclosure predicates and profile fields.
- Add a narrow batch RPC `life_course_instructor_names(f uuid[])`, projecting only offering ID, name and responsibility from that existing public-profile query. Private definer implementation uses an empty search path; public invoker wrapper and explicit anon/authenticated grants follow the existing pattern. Null/empty arrays return no rows.
- Add `instructor_roster` to `life_my_learning` for ACTIVE enrollments. Use active assignments and exact person IDs to derive responsibility; sort responsible first and then by name. Preserve all other learning fields, actor checks and the legacy `instructors: string[]` array.
- No new table permissions, changes to assignments, profiles, responsibility records or other course state.

## Application and display
- A shared `InstructorNames` component renders `강사 : A<sup>(책임)</sup>, B, C`. Use native semantic `sup`, comma separation and wrapping text. Empty roster says `배정 안내 예정`; query failure says `정보 확인 중`.
- Course-catalog loading fetches public names once per batch after the offerings load, avoiding a request per card. Merge names by offering ID; unlinked guides have no inferred names.
- Public guide and offering details use the same narrow projection. Course card/list, learner home and learning dashboard share the component.
- Learning UI uses the new roster with an unmarked legacy-name fallback during a compatible migration rollout.
- Administrator fields remain available only in their existing protected management screens.
- The additional operation-menu request changes `CourseActions` in `operations-dashboard.tsx`: remove inline arrow text, use a shared bordered/background button style with wrapping and visible keyboard focus, and put a decorative diagonal ArrowUpRight icon in each button's upper-right corner as subsequently requested. Preserve all destinations and role conditions.
- Keep the card and list action menu to at most two button rows even when the optional evidence action appears. Use three equal columns, compact button text that wraps inside its own cell, and enough width for the list action column; retain the full action labels and destinations.

## Validation and release
- Local database tests cover exact responsibility flags (including duplicate names), responsibility changes, invalid/expired assignment, missing responsibility, active versus withdrawn learner access and public consent/role/state boundaries. Preserve existing public-profile and learner regression checks.
- Render cards/list/details and learner home/dashboard; assert semantic superscript, comma format, no internal staff fields, mobile wrapping and no browser errors. Run lint and production build.
- Apply the tested compatible migration to Preview/Production, check security advisors and narrow RPC output, push and create PR, wait for checks, merge and verify the production commit, health and authentication gate.

References: [Supabase functions](https://supabase.com/docs/guides/database/functions), `anchor-public-course-cards.design.md`, `anchor-responsible-instructor-management.design.md`.
