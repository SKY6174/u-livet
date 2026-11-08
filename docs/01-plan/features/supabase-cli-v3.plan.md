# Supabase CLI v3 compatibility

- Date: 2026-11-07
- Scope: pin the current stable CLI (3.0.0), migrate active commands/configuration, exercise every Next.js page and release the reviewed change through GitHub/Vercel.
- Isolate work from existing checkouts and local databases. No production data imports, schema resets or Auth configuration pushes are required.
- Acceptance: exact npm/lockfile version, warning-free config loading, explicit remote targets/consent, meaningful regression tests, production build and an exhaustive page inventory with browser results.
- Resolve the reproducible streaming hydration failures found during the exhaustive page tests using the supported Next 16.4.5/React 19.3.1 renderer; preserve loading UI and existing authorization.
- Release: push a branch, create and merge a PR after validation, verify the resulting production Git deployment and public pages.
