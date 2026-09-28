# Smart menu hints — verification

Date: 2026-09-28 · Design: `docs/02-design/features/smart-menu-hints.design.md`

## Match rate: 100%

The shared component uses a body portal, card-level measurements, 12px gap, 16px viewport inset, 256px maximum width, collision scoring for above/below placement, and a pointer aimed at the active card. The bubble and pointer use 35% alpha pink. Hover, keyboard focus, and screen-reader text remain available. No API or data code changed.

Browser checks on `/auth/login`: at 390px, the first and third cards' bubbles did not overlap any of the four cards; at 1440px, the fourth card's bubble did not overlap another card. The observed background was `rgba(251, 207, 232, 0.35)`. Keyboard focus displayed the bubble, and no error overlay appeared.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` passed.
