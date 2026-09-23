# Gap Analysis: anchor-development-menu-separation

Date: 2026-09-24 · Design: `docs/02-design/features/anchor-development-menu-separation.design.md`

Match rate: 100% (4/4).

1. Both workflow cards are absent from `/admin/courses`; its data, authorization, dashboard and registration stay intact.
2. `officeSections` places a manager-only “과정 개발·심의” link directly before “과정 운영 관리”. Shared navigation makes it available on office home and in both header menus.
3. The development route has its own active state and office-home icon. Annual-plan paths still select course operations.
4. Updated synthetic operations/navigation checks pass, including manager-only visibility and menu order. Opening prefill and working-copy checks, lint, TypeScript and the production build also pass.

No design gaps remain. Deployment health is verified during release.
