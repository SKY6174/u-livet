# Menu description tooltips — design

Date: 2026-09-23 · Plan: `docs/01-plan/features/anchor-menu-description-tooltips.plan.md`

## Component

`MenuHint` is a server-compatible, reusable inline component in `src/components/navigation/menu-hint.tsx`. It receives a label and a description. Its visible label inherits the menu typography; the description lives in an absolutely positioned white speech bubble. The bubble appears when the containing `group` link is hovered or keyboard focused. An `sr-only` copy leaves the hint available to screen readers while the visual bubble is `aria-hidden`.

Use `font-size: calc(1em - 1.2px)` on the bubble, where the `1em` is the label's computed size. Use gray text, border, shadow and a CSS speech-bubble tail. Give the link/card relative positioning and a raised stacking order on hover/focus. Do not clip overflow. The bubble is non-interactive and does not alter document layout.

## Integration

- `src/app/page.tsx`: delete the exact office heading sentence; replace descriptions below signed-in hero shortcut and office navigation labels.
- `src/app/admin/page.tsx`: replace navigation card descriptions; preserve the featured card artwork inside its own clipped decoration layer.
- `src/components/student-learning/dashboard.tsx`: replace service menu item descriptions only. Keep section introductions and course data visible.
- `src/app/auth/login/page.tsx`: replace audience choice descriptions.
- `src/app/admin/reports/preview/page.tsx`: replace report-template navigation descriptions.

All menus retain their existing `href`, label, access control and ordering. No API or data model change.

## Verification

Check rendered markup for the deleted sentence and visible text structure; run role-navigation and learner-home verification, lint, TypeScript and production build. Inspect resulting pages at desktop and narrow widths for tooltip clipping and keyboard focus.
