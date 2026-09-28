# Adaptive menu hint text — verification

Date: 2026-09-28 · Design: `docs/02-design/features/adaptive-menu-hint-text.design.md`

## Match rate: 100%

The shared hint measures the label size and subtracts 3.2px, replacing the previous 1.2px subtraction. It samples three locations behind the 35%-opaque pink bubble, composites ancestor backgrounds, and chooses slate-900 or white using the higher minimum contrast. Placement and accessibility behavior remain unchanged.

Browser checks on `/auth/login`: an 18px label produced 14.8px hint text; the normal light background selected `rgb(15, 23, 42)`, and a dark background selected `rgb(255, 255, 255)`. The page loaded without an error overlay. ESLint, TypeScript, and the production build passed.
