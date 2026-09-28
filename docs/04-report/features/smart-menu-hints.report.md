# Smart menu hints — completion

Date: 2026-09-28

The shared menu hint now chooses a viewport-safe position with less overlap with other menu links. The login card tooltip no longer covers the neighboring cards on desktop or mobile. Its pink fill and pointer changed from 55% to 35% opacity, increasing transparency by 20 percentage points. The change applies to every page using `MenuHint`.

Verification: desktop and mobile browser hover, keyboard focus, computed color, error overlay, ESLint, TypeScript, and production build passed. Design match: 100%.
