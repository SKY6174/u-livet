# Adaptive menu hint text — design

Date: 2026-09-28 · Plan: `docs/01-plan/features/adaptive-menu-hint-text.plan.md`

## Component behavior

In `src/components/navigation/menu-hint.tsx`, change the measured text size from `label font size - 1.2px` to `label font size - 3.2px`. This is exactly 2px smaller at every breakpoint.

Once the bubble position is chosen, sample the DOM backgrounds behind its left, center, and right text areas. Composite transparent ancestor background colors over white, then composite the existing pink bubble at 35% alpha. Calculate WCAG contrast for slate-900 and white text on the three resulting colors. Choose the text color with the higher minimum contrast; use a subtle opposite-color shadow for image or mixed backgrounds. Recalculate on opening, resize, and scroll, alongside placement. Keep the bubble color, size, pointer, and accessibility behavior otherwise unchanged.

This is client-side presentation only; there are no API or database changes.

## Verification

In a browser, compare the computed bubble font size to its previous formula, and check dark text on the normal light login surface plus light text on a dark surface. Confirm hover/focus and placement still work. Run lint, TypeScript, and production build.
