# Menu tooltip placement and color — design

Date: 2026-09-23 · Plan: `docs/01-plan/features/anchor-menu-tooltip-right-pink.plan.md`

## Component behavior

Update `src/components/navigation/menu-hint.tsx`, the shared component used by all menu hints. Replace below-label positioning with a bubble whose leading edge sits 12px to the right of the label and whose top aligns with the label. Use Tailwind `pink-200` at 75% opacity for the bubble and matching triangular tail, a pink border, and existing gray text with `font-size: calc(1em - 1.2px)`.

Use a small client-side viewport measurement after mount and on resize. Prefer the right side when at least 192px is available. When right-side space is too narrow, place the bubble left of the label and size it to the available space. This keeps long Korean menu explanations readable without horizontal overflow. Preserve the existing hover/focus classes and screen-reader-only description.

Remove the old `align` prop at its login and report-menu call sites; placement is now based on available viewport space. No menu destinations, data, or permission checks change.

## Verification

Run existing personal-home, role-navigation, and student-learning checks, ESLint, TypeScript and build. In a local browser, inspect rest and focus states at desktop and narrow viewports; verify right-side placement when space permits, the fallback near the viewport edge, and a 0.75 alpha pink background.
