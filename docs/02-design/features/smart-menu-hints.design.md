# Smart menu hints — design

Date: 2026-09-28 · Plan: `docs/01-plan/features/smart-menu-hints.plan.md`

## Shared component

Change only `src/components/navigation/menu-hint.tsx`. Render the tooltip in a body portal so section clipping and animated cards cannot cut it off. Show it while the closest `.group` link is hovered or contains focus; keep the screen-reader-only description in the link.

Measure the whole link and bubble when opened, on viewport resize, and on scroll. Use a 12px gap and 16px viewport inset. Compare above and below positions by their overlap with other menu links, including a preceding row on narrow screens. Choose the position with less overlap, preferring above on a tie; penalize placements that must be clamped into the viewport. Center the bubble over the link, clamping horizontal position to viewport insets. Keep its width at most 256px and point the triangle at the link center. This moves the bubble outside the card row instead of over another card.

Set bubble and triangle fill from 55% to 35% alpha, equivalent to raising transparency from 45% to 65%. Preserve the border, font sizing, and keyboard behavior. No API or database changes.

## Verification

Check hovered and focused hints on login and another page at desktop and mobile widths, including the first and last cards. Confirm bubbles do not cover sibling cards or extend beyond the viewport. Run lint, TypeScript, and build.
