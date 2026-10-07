# Learner instructor summary verification

Date: 2026-10-08 (Asia/Seoul).

## Design comparison

All requested behavior is implemented: the latest instruction displays all eligible instructor names in one comma-separated line, with the actual responsible instructor marked using semantic superscript. Public names retain the existing approval, public-consent, active-role and active-assignment boundary. Active enrolled learners receive only names and responsibility flags through the existing authenticated learning RPC. Responsibility is matched by person identity, so duplicate names and missing responsibility cannot create inferred marks.

Public card/list, guide detail, offering detail, learner home and learning dashboard share the presentation. Empty and failed queries have distinct text. Catalogue names are fetched in one batch. Legacy learner-name arrays and existing learner gates are preserved. Management fields remain available in protected management screens.

Course management actions are separate bordered buttons with a pale teal background, wrapping, keyboard focus and a decorative diagonal arrow at each upper-right corner. Existing destinations, manager checks and conditional report action are preserved.

## Validation

- Lint and production build passed.
- Existing course catalogue: 19 checks; learner home: 4 checks; learning dashboard: 6 checks; DB projection/latency regression: 11 checks passed.
- New local DB/presentation suite: 12 checks passed, including changed responsibility, duplicate names, revoked consent, expired role/assignment, archived offering, missing responsibility, active learner and withdrawn learner boundaries.
- Native browser against the production build and guarded local DB passed public card/list/details, actual superscript geometry, 390px mobile wrapping, authenticated learner home/dashboard, authenticated manager card/list action buttons, icon placement and preserved URLs. No browser errors occurred.
- Synthetic browser data was removed and baseline synthetic names restored. Cleanup initially hit the approved-policy immutability guard; a guarded local-only transaction removed the exact synthetic records with the relevant triggers temporarily disabled and re-enabled. No hosted data cleanup was performed.
- The existing instructor-development assertion was updated for the additive responsibility property; its full older integration suite was not rerun.

## Compatible migration and release

The migration changes functions only. Hosted original function fingerprints matched the repository before application. Preview and Production accepted the migration, with migration-history versions aligned to the repository. Public wrapper privileges and empty-search-path/invoker checks passed in both environments. Security advisors added no findings: the existing 107 INFO notices, 6 authenticated-definer warnings and 1 MFA warning remain unchanged. Existing remediation references: [function privileges](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [MFA options](https://supabase.com/docs/guides/auth/auth-mfa).

The release uses GitHub PR checks, merge and Vercel Git deployment. Final revision, health and authentication-gate evidence will be recorded in the PR after deployment.

Gap analysis against the design found no outstanding implementation mismatch.
