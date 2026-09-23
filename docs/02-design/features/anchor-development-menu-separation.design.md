# Course development menu separation — design

Date: 2026-09-24 · Plan: `docs/01-plan/features/anchor-development-menu-separation.plan.md`

1. Remove the entire two-card workflow block from `/admin/courses`, leaving its business-unit context directly above the operations dashboard. Preserve data reads, authorization and registration.
2. Add `/admin/development` as its own `officeSections` link immediately before `/admin/courses`. Grant this menu link only to `COURSE_MANAGER`, matching the route layout. The office home and desktop/mobile header use this shared model.
3. Map `/admin/development` to its own active menu entry and an office-home icon. Keep `/admin/course-plan` and `/admin/course-plan/opening` routed as existing operations subpages.
4. Update synthetic page/navigation checks for absent cards, menu order, manager-only visibility and active selection. Run relevant navigation/operations checks, lint, TypeScript and build; then verify preview and production releases.
