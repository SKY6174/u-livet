# Gap Analysis: anchor-parking-vouchers

> 2026-09-22 · Design: `docs/02-design/features/anchor-parking-vouchers.design.md`

## Match rate: 100% (12 / 12 planned items)

| Design item | Evidence |
| --- | --- |
| Explicit RCC/ECC/AID-X course mapping | `life_parking_offering_centers`, manager assignment form |
| Applicant eligibility: enrolled learners and external assigned instructors | `parking_applicant`, local authorization test |
| Course-day and contact/quantity validation | `parking_request`, applicant form |
| One active request per person, offering and day | Partial unique index, duplicate test |
| Named reviewer and confirmed school email | `parking_reviewer`, three seeded center records |
| Staff role, MFA and recent authorization for decisions | `parking_staff`, `parking_decide`, wrong-reviewer test |
| Atomic stock deduction and remaining balance | Conditional `UPDATE ... RETURNING`, shortage and balance tests |
| Cancellation/rejection without issuance | Decision and cancel RPCs, local tests |
| Private applicant and staff read boundaries | RPC contexts, table grants revoked, RLS, direct-read test |
| Office settings, queue, history | `/admin/parking` browser check |
| A4 paper ledger with original eight columns | Headless Chrome print to A4, inspected one-page PDF |
| Preview/production rollout | Both migrations applied in both projects; security advisors report no WARN/ERROR |

No implementation gaps found. The three designated reviewers are not yet registered in Preview or Production, so approvals become available after their own accounts receive a valid staff role and MFA. This was planned as a future onboarding dependency rather than a gap in the implemented authorization path. Course-center assignment and physical stock intake are likewise operational setup before the first real issue.
