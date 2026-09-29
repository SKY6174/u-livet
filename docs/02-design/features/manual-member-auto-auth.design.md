# Manual member Auth provisioning design

2026-09-29 · manual-member-auto-auth

## Save and invite
- Keep `life_create_member` and `life_member_excel_import` as the authoritative roster transaction, including MFA, organization scope, normalized-email uniqueness, and request-ID idempotency.
- Return the created person IDs and normalized emails from Excel import. After a successful DB commit, the trusted server action invokes Supabase Admin `inviteUserByEmail` for each newly registered member with the target organization ID in user metadata. The single-registration action does the same for its one returned person.
- Before saving, require enabled Auth email, a service-role key, and an effective approved `ACCOUNT_PRIVACY` policy for the selected organization. Never put the service-role key in client code.
- A failed invite does not roll back a committed roster transaction. Show counts and affected spreadsheet rows; retain the form/request IDs so retry reuses the same people. Do not state that mail was sent when the Auth API reports failure.
- Existing Excel update rows are not invited. The invitation email link carries its organization ID from Supabase Auth user metadata for policy display; this value never grants authority.
- Immediately before every Admin invite, look up the roster person's Auth link with the service-role client. Skip activation mail if already linked. Existing Excel rows are never invite targets.
- Production roster verification on 2026-09-29 found ten of ten manually registered members linked to confirmed Auth users with passwords. Send zero backfill invitations to them.
- The learner login and signup screens recommend social login for first-time registration. A learner who already received a setup invitation is directed to use that link to retain the existing account.

## Database identity and consent
- GoTrue sets `invited_at` after its initial user insert. The trigger recognizes a matching active manual roster email plus the invitation routing marker and organization in user metadata, and creates only a private pending claim. User metadata never grants access. Acceptance requires the actual `invited_at`, verified email, a live session, and approved consent. All three manual groups are eligible; other signup behavior retains the existing privacy checks.
- `manual_member_claims.policy_id` becomes nullable while the invite is pending. The verified-member linker does nothing until the email is confirmed and a valid organization-specific policy has been accepted. It checks active membership, email equality, unique unlinked person, and the Auth user's state before inserting the existing-person Auth link and audit/consent events. Instructors receive the existing `INSTRUCTOR` role; office members receive no administrative role from their classification; learners receive no new role.
- Insert the Auth link after all other guarded public writes, so the new office member's MFA requirement does not block their own consent record and audit event during activation.
- An authenticated `life_accept_manual_member_invitation(policy, accepted)` RPC validates the invite session and approved policy for the member's organization. It records acceptance, then links the verified Auth user and existing person in one DB transaction. User metadata is not trusted for authorization. The invite acceptance action invokes this RPC after `verifyOtp` and before checking `life_auth_status` or setting a password.
- On the invitation page, display the approved organization policy inside a collapsed disclosure and require explicit agreement. The server validates the selected policy again; changing the URL or form value cannot bypass it.

## Verification
- Inspect generated SQL and run a transactional DB probe for pending claim, consent linkage, wrong-policy rejection, duplicate-link rejection, and all manual groups.
- Run static checks, focused flow tests, and build. Apply migration before deploying the server change, then push and verify deployment.
