# Menu tooltip placement and color — gap analysis

Date: 2026-09-23 · Design: `docs/02-design/features/anchor-menu-tooltip-right-pink.design.md`

## Match rate: 100%

The shared menu hint now prefers the right of its label with a 12px gap and pink-200 background at 75% opacity. Its tail points back to the label. When there is insufficient right-side room, it moves left and fits within the viewport. Gray text, the 1.2px smaller font, keyboard focus, hover, screen-reader text, link destinations and permissions are preserved. The unused manual alignment prop was removed from the login and report menus.

Verification passed: personal-home 16 checks, role-navigation 22 checks, student-learning 5 checks, ESLint, TypeScript and production build. Local browser inspection measured the desktop bubble 12px right of its label, background `rgba(251, 207, 232, 0.75)`, and a 16.8px bubble font beside an 18px label. At 375px viewport width, the rightmost login choice flipped left and remained within the viewport.
