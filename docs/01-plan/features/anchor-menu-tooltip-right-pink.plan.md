# Menu tooltip placement and color — plan

Date: 2026-09-23 · Level: Dynamic

## Goal

Move shared menu-description speech bubbles from beneath their labels to the right of the labels. Use a light pink background at 75% opacity. Preserve gray description text, the 1.2px font-size difference, hover and keyboard-focus behavior.

## Scope and acceptance

- Update the shared `MenuHint` used throughout the site, including the business-office menu shown in the screenshot.
- Prefer right-side placement. If the right side has too little room on a narrow screen, keep the bubble inside the viewport by placing it on the left.
- Keep the speech-bubble tail pointing toward its label, accessible description, navigation behavior, and existing permission logic.
- Verify desktop and narrow widths, lint, type check, build, and relevant navigation tests before pushing.
