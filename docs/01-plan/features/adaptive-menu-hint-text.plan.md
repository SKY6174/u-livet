# Adaptive menu hint text — plan

Date: 2026-09-28

## Goal

Make the shared explanatory speech bubbles easier to read across light and dark page backgrounds. Reduce bubble text by exactly 2px from its current size.

## Scope and acceptance

- Update the shared `MenuHint` component, so every existing use inherits the change.
- Preserve bubble position, pink transparency, hover/focus behavior, and screen-reader description.
- Choose a light or dark text color for the page background behind the translucent bubble, favoring the color with stronger contrast.
- Verify both light and dark surfaces in a browser, then pass lint, typecheck, and production build.
