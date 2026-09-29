# Auth phone and member category plan

2026-09-30 · auth-phone-member-category

## Goal
- Put a normalized mobile number in Supabase Auth's native `phone` field when it can be assigned to exactly one user.
- Give every Auth user one descriptive `app_metadata.member_category`: `office`, `internal_instructor`, `external_instructor`, or `learner`.
- Synchronize existing users and all signup, activation, roster edit, Excel import, and classification paths.

## Constraints
- Supabase Auth's Users table has a fixed set of columns; the category is visible in each user's App Metadata rather than a new table column.
- Native Auth phone is unique. Existing shared mobile numbers remain in the existing contact records and must not be assigned arbitrarily to one account.
- Entered mobile numbers are not SMS verified. Do not mark phone confirmed or enable phone login.
- Account category is descriptive; database roles and membership remain the authorization source.

## Verification
- Check canonical category and mobile mapping in production without exposing personal information.
- Exercise the Admin Auth phone API on Preview, run type/lint/build checks, and verify production counts after rollout.
