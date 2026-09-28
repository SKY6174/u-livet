# Smart menu hints — plan

Date: 2026-09-28

## Goal

Prevent the shared explanatory speech bubble from covering adjacent menu cards on the login page and elsewhere on the site. Increase the pink bubble background transparency by 20 percentage points, from 45% to 65% transparency.

## Scope

- Update the shared `MenuHint` component used by login, home, admin, report, and learner pages.
- Keep the existing labels, destinations, keyboard focus behavior, and screen-reader description.
- Place each bubble outside its containing menu card, using available viewport space and width constraints.

## Acceptance

- At desktop and mobile widths, the hint remains within the viewport and does not cover an adjacent card in the same row.
- The bubble and its pointer use 35% opacity pink; text remains readable.
- Lint, typecheck, build, and visual interaction checks pass.
