# Gap Analysis: anchor-operation-document-registration

> Date: 2026-09-24 | Design: `docs/02-design/features/anchor-operation-document-registration.design.md`

## Match rate: 100% (8/8 design checks)

The operation list now joins the 16 source plans to actual offerings by stable source ID and the guide's offering UUID. Unregistered cards explain the prerequisite and route managers to the existing reviewable registration form. A source-backed registration creates a draft offering and links its guide in one MFA-protected transaction; the existing document editor remains the sole writing route.

Verified locally: 16 source IDs mapped; SQL migration applied; an authenticated MFA manager created and linked a draft despite changing the title, a second registration was rejected, and the synthetic draft was removed. Operation document authorization/revision checks, source-data checks, role navigation, lint, and build pass. No gaps against the design remain.

Remaining operational step: apply the migration and release the UI on Preview, then main; managers must review and register any of the 13 still-missing courses. Instructor account activation and responsibility assignment remain separate.
