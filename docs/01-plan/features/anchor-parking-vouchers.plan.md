# anchor-parking-vouchers - Plan

> 2026-09-22 · Dynamic · approved for implementation by the user request

## Purpose

Replace the attached blank `무료 주차권 사용대장` with an auditable course-linked request, approval, stock, and print workflow. The source form's columns are date, requester, specific reason, recipient, phone, issued quantity, remaining quantity, and checker.

## Scope and outcomes

- A learner enrolled in a course or an external instructor assigned to one can request 1-10 vouchers for a course day from their own workspace, enter a contact number, and follow the decision.
- Staff map each course offering to RCC, ECC, or AID-X. Do not infer a center from an academy name.
- The exact designated reviewers are 이연향 (RCC), 이은주 (ECC), 임은애 (AID-X). Center and email must be verified against authenticated staff, not user-entered names. They may approve/reject their center's pending requests only after their own accounts and staff roles exist. Other staff can inspect records and configure course center/stock; no approval bypass.
- Approval deducts available center stock atomically and records the post-issue balance. Rejection and cancellation do not use stock. Issued rows remain immutable evidence.
- Admin page lists pending/decided requests, stock and course-center settings, and a print layout matching the original ledger columns.
- Direct table reads/writes cannot bypass RPC authorization or leak phone numbers. Verify local, preview, and production database rollout before push.

## Non-goals

No QR parking gate integration, automatic vehicle plate recognition, email/SMS dispatch, or retrospective import of paper rows. The attached form's example person is reference content and is not seeded or published.

## Success criteria

- Eligible applicants can request only their own active course; internal instructors and unrelated accounts cannot.
- No account except the named, verified, MFA-authenticated reviewer with an active staff role can decide a request for that center.
- Concurrent approval cannot produce a negative stock balance or duplicate issuance.
- Printout shows all eight original columns with accurate totals/balances, filtered by center.
- Build/lint and database authorization tests pass, migrations apply to all environments, and main is pushed.
