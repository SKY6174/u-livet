# Auth phone and member category design

2026-09-30 · auth-phone-member-category

## Canonical snapshot
- A service-role-only `life_auth_directory_profile` RPC resolves an Auth user from its ID or person ID. It reads manual membership (including pending invitation claims), account classifications, active role assignments, and mobile contact records.
- Category priority follows the existing login audience rules: office roster/active office role; internal/external instructor roster or classification; otherwise learner. A self-declared external signup remains external until an operator changes its classification. The category is never used to grant access.
- Mobile is `member_profiles.mobile_phone`, then `learner_contacts.phone`, then the validated `user_metadata.mobile_phone`. Office and instructor landlines are excluded.
- The snapshot reports whether the mobile is unique among Auth users' canonical contacts. When shared, the native Auth phone stays empty; the original contact data is preserved. Existing native phone values for a user are cleared if they become stale or shared.

## Sync paths
- A server-only helper compares the snapshot to Auth and updates `phone` and merged `app_metadata.member_category` through `auth.admin.updateUserById`. GoTrue stores phone without the `+` prefix. Its Admin API ignores an empty/null phone, so a service-role-only SQL RPC clears an unverified stale phone when needed. It never marks `phone_confirmed_at` and never sends SMS. It leaves other app metadata untouched.
- Office/internal provisioning and external/learner invitations sync immediately after Auth creation. Manual roster changes and Excel updates sync all linked groups; classification changes sync the linked Auth user.
- Email signup, social activation, invitation acceptance, and successful login/callback sync their users. For email signup, a sync failure does not disclose account existence; the next login retries it.
- An idempotent administrator backfill updates existing Auth users after deployment. It skips shared numbers, reports counts without personal data, and can be rerun.

## Ordering and failure behavior
- Deploy the service RPC before application code that calls it. A completed roster write with failed Auth sync reports partial success. Signup/login should not lose a valid session due solely to directory metadata sync failure.
- Supabase Auth native phone's uniqueness check remains the final race guard; collision errors leave the canonical mobile contact intact and are logged without PII.
