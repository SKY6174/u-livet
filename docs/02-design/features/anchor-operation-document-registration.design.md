# anchor-operation-document-registration — Design

> Date: 2026-09-24 | Status: Approved | Plan: `docs/01-plan/features/anchor-operation-document-registration.plan.md`

## Flow

1. After the authenticated operation list RPC succeeds, the list also reads published 2026 course guides (`source_id`, `offering_id`). Source plan IDs P01–P16 become the stable join keys; actual offering UUIDs from the operation RPC remain the only editable targets.
2. Cards without an offering show “과정 DB 미등록” and, for managers, a link to `/admin/courses?plan=Pxx#offering-draft`. That existing form displays the source plan and requires the manager to confirm year, dates, recruitment, and other mandatory values.
3. The existing `createOffering` server action dispatches source-backed forms to a new authenticated RPC. Manual registrations still use the generic RPC.
4. The new RPC locks the matching guide, checks anchor organization, 2026 project year, active course-manager role and recent MFA, rejects a guide already linked to an offering, invokes the existing draft-offering creation function, links the guide, and logs the action in one transaction. It never publishes an offering or assigns an instructor.
5. Once registered, the list uses the guide's `offering_id` to resolve the operation RPC row. The existing document editor and save/review RPCs retain their access checks.

## Data and API

- Add unique, non-null `life_course_guides.source_id` for the 16 known P01–P16 records. Preserve all existing `offering_id` links.
- `public.life_create_source_offering(source_id, o, y, title, academy, summary, curriculum, mode, location, capacity, selection_method, apply_from, apply_until, starts_on, ends_on) → uuid` uses the same course inputs as `life_create_offering` and a validated source ID.
- Only authenticated managers with recent MFA may call it. Direct table writes remain unavailable to browser roles. Concurrent duplicate requests serialize on the guide row.
- A source-listed `initial_responsible_id` is not an approved login or responsibility assignment. The editor may be used by a manager after registration; instructor review still requires an active, verified instructor role and explicit assignment.

## Failure behavior and verification

- Read errors show the existing load-error panel, never a fallback offering.
- Invalid source, wrong organization/year, or already-linked source fails without partial creation.
- Existing 3 offerings remain linked and editable, all 13 missing offerings retain no editor URL until explicitly registered.
- Verify mapping completeness, SQL duplicate protection, UI link, lint/build, and preview DB before production release.
