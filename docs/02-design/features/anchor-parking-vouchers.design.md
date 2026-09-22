# anchor-parking-vouchers - Design

> 2026-09-22 · Dynamic · plan: `docs/01-plan/features/anchor-parking-vouchers.plan.md`

## Flow

1. Office staff selects a center for each offering and adds physical voucher stock per center.
2. An enrolled learner or assigned, explicitly classified external instructor chooses that offering, a day within its course period, a phone, and 1-10 vouchers. The requester and recipient are the authenticated person; reason snapshots the course title. Pending requests are visible to the requester and office staff.
3. The reviewer assigned to the request's center approves or rejects. Approval locks stock row, checks the remaining balance, deducts quantity, writes the new balance and reviewer identity in one transaction. Rejection requires a reason. Applicant may cancel pending requests.
4. Office page shows center settings, stock receipts, pending queue, decision history and an A4 print table using the original eight columns. The date column is the issue date for approved rows; non-issued requests appear only in on-screen queue.

## Data and authorization

- `life_parking_centers`: fixed code/name/reviewer email: RCC / 이연향 / yhlee4@uc.ac.kr; ECC / 이은주 / ejlee7@uc.ac.kr; AID-X / 임은애 / jslover85@uc.ac.kr.
- `life_parking_offering_centers`: one center per offering. Mapping stays explicit because academy does not identify the responsible center. Changing a mapping with pending requests is blocked.
- `life_parking_stock`: one balance per organization and center, initialized zero. `life_parking_stock_events` records every addition.
- `life_parking_requests`: applicant ID, offering/org/center snapshot, kind, use date, phone, quantity, status, requested/reviewed timestamps, reviewer ID, rejection reason, and `remaining_after`. Unique active request per person, offering and use day.
- Tables have RLS enabled and no browser table grants. Private `SECURITY DEFINER` functions with fixed search path own every read/write. Authenticated-only public invoker RPC wrappers are the Data API interface.
- Applicant operations check `life_private.person_id()` and current enrollment or `life_private.teaches()` plus external classification; offering must be active, center assigned, and use day inside the course period. Phone and quantity validated at SQL boundary.
- Office reads/configuration require current `COURSE_MANAGER` or `SYSTEM_ADMIN` role and MFA; writes require recent MFA. Approval additionally requires exact confirmed `auth.users.email` for the center and a staff role in that request's organization, plus recent MFA. Display name alone never authorizes. The reviewer has no access before their account/role is created.
- A request's center, recipient and quantity are frozen after submission. Approved rows are never modified or deleted. Stock additions and decisions create audit events.

## Application

- Server-rendered `/parking` applicant page, linked from learner dashboard and external instructor My Room.
- Server-rendered `/admin/parking` office page with responsive queue, center assignment, stock receipt and print section.
- Server actions use authenticated Supabase RPCs; no service key in application code. Input is validated in UI and SQL; action failures surface human-readable messages.
- Year and center are explicit admin filters. The printable ledger only includes approved rows. CSS print hides controls and repeats table header per page.

## Verification

- Apply migration to local DB first and test registered learner, external/internal instructor, wrong-center staff, named reviewer, zero/adequate stock, duplicate active request, cancellation, and direct table access denial.
- Run lint/build, inspect the pages and print layout, then apply migration to preview and production before pushing application code.
