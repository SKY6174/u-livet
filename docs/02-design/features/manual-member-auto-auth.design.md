# Manual member Auth provisioning design

2026-09-29 · manual-member-auto-auth

## Save and invite
- Keep the newer office/internal provisioning path: an approved operator creates a confirmed Auth identity with a temporary unusable credential and a one-time permit. Do not replace it with an invitation. After save, send the first-password reset email only while that identity still requires first setup; a completed identity receives no activation mail.
- External instructors and learners continue through the invite and verified-consent path. The learner UI recommends social signup for first-time learners; an existing invite recipient uses the invite link so their roster record remains attached.
- Keep `life_create_member` and `life_member_excel_import` as the authoritative roster transaction, including MFA, organization scope, normalized-email uniqueness, and request-ID idempotency.
- Return the created person IDs and normalized emails from Excel import. After a successful DB commit, the trusted server action provisions office and internal instructors, then sends first-password recovery mail. It invokes Supabase Admin `inviteUserByEmail` for external instructors and learners. The single-registration action follows the same group-specific path.
- Before saving, require enabled Auth email, a service-role key, and an effective approved `ACCOUNT_PRIVACY` policy for the selected organization. Never put the service-role key in client code.
- A failed invite does not roll back a committed roster transaction. Show counts and affected spreadsheet rows; retain the form/request IDs so retry reuses the same people. Do not state that mail was sent when the Auth API reports failure.
- Existing Excel update rows are not invited. The invitation email link carries its organization ID from Supabase Auth user metadata for policy display; this value never grants authority.
- Immediately before every Admin invite or first-password mail, look up the roster person's Auth link and activation state with the service-role client. Skip mail if activation is complete. Existing Excel rows are never invite targets.
- Production roster verification on 2026-09-29 found ten of ten manually registered members linked to Auth, but only one has approved consent and a final credential. The other nine hold provisional credentials. Send first-password recovery mail to these nine after deployment and skip the completed member.
- The learner login and signup screens recommend social login for first-time registration. A learner who already received a setup invitation is directed to use that link to retain the existing account.

## Database identity and consent
- Preserve the office/internal `member_provisioning_nonce` branch of `handle_new_user` introduced on main while adding the pending-invitation branch. The final migration must keep both paths and the latest first-password policy guard.
- GoTrue sets `invited_at` after its initial user insert. The trusted server first stores a short-lived, one-time nonce against the manual roster person; the Auth insert trigger requires the matching nonce, email and organization before creating only a private pending claim. User metadata alone cannot reserve a roster identity or grant access. Acceptance requires the actual `invited_at`, verified email, a live session, and approved consent. Other signup behavior retains the existing privacy checks.
- `manual_member_claims.policy_id` becomes nullable while the invite is pending. The verified-member linker does nothing until the email is confirmed and a valid organization-specific policy has been accepted. It checks active membership, email equality, unique unlinked person, and the Auth user's state before inserting the existing-person Auth link and audit/consent events. Instructors receive the existing `INSTRUCTOR` role; office members receive no administrative role from their classification; learners receive no new role.
- Insert the Auth link after all other guarded public writes, so the new office member's MFA requirement does not block their own consent record and audit event during activation.
- An authenticated `life_accept_manual_member_invitation(policy, accepted)` RPC validates the invite session and approved policy for the member's organization. It records acceptance, then links the verified Auth user and existing person in one DB transaction. User metadata is not trusted for authorization. The invite acceptance action invokes this RPC after `verifyOtp` and before checking `life_auth_status` or setting a password.
- On the invitation page, display the approved organization policy inside a collapsed disclosure and require explicit agreement. The server validates the selected policy again; changing the URL or form value cannot bypass it.

## Verification
- Inspect generated SQL and run a transactional DB probe for pending claim, consent linkage, wrong-policy rejection, duplicate-link rejection, and all manual groups.
- Run static checks, focused flow tests, and build. Apply migration before deploying the server change, then push and verify deployment.

## Supabase Auth user information
- Store validated name, canonical email, and normalized mobile phone for external instructors and learners in Auth `user_metadata` when they complete email or social registration. Keep `auth.users.email` as the canonical address. For an invited member, collect these fields during acceptance, verify the entered email equals the Auth email, then update Auth metadata after the approved consent and roster link.
- For office/internal registration, read the committed manual roster and copy its current fields to Auth metadata when creating the user. Refresh those fields after single edits and Excel updates and backfill existing linked users without sending email. The roster remains authoritative; Auth metadata does not grant roles or membership.
- Exclude administrative/internal notes from Auth metadata, as requested by the user. Copy the other current manual registration fields. Supabase user metadata can be read in the user's JWT/session; the roster remains the authority for these values.
- Record an explicit partial-success message when roster save succeeds but Auth metadata sync or email delivery fails. Retry must be idempotent and must not email an already activated identity.
