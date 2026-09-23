# Menu description tooltips — gap analysis

Date: 2026-09-23 · Design: `docs/02-design/features/anchor-menu-description-tooltips.design.md`

## Match rate: 100%

All six designed items are implemented: shared menu hint, exact home sentence removal, office/home menus, learner service links, login audience choices, and report-preview choices. Descriptions remain in link accessibility names through screen-reader-only text. The bubble is hidden at rest and shown on hover or keyboard focus; its computed style in the local login page was gray and 16.8px beside an 18px label.

No API, permissions, or data-model changes. Existing synthetic role/navigation, personal-home and student-learning checks passed; ESLint, TypeScript and production build passed. The local login page was visually inspected with the bubble visible on keyboard focus. Authenticated production pages still require a real user account for final visual inspection.
