# Manual member Auth provisioning

2026-09-29 · manual-member-auto-auth · Dynamic

## Goal and scope
- For both individual and Excel manual registration, save each new roster member, create a Supabase Auth user, and send a first-password invitation during the same save request.
- Cover office, internal and external instructors, and learners. Existing Excel rows remain update-only; no unsolicited invite is sent for an edit.
- Reuse the existing person record only after the recipient proves ownership of the email and accepts the approved account privacy policy. Registration alone grants no application access.
- Report invitation failures separately from successful roster saves and support retry using the original request ID.

## Success criteria
- New single and Excel registrations produce Auth users and invite mail automatically, and retries do not duplicate roster people or Auth users.
- Already activated members are checked immediately before invitation and receive no activation mail. First-time learners are guided toward social login, while recipients of an existing setup email use that link first.
- Invite acceptance records consent, links the verified Auth user to the existing person, and permits password setup and subsequent login.
- Invalid, stale, or cross-organization policy choices, unverified addresses, disabled people, and already-linked members cannot gain access.
- Lint, typecheck, build, migration verification, and production push succeed.

## Risks
- Auth API and roster DB are separate transactions; the UI must accurately report partial success and allow retries.
- Email rate limits and batch size may cause partial Excel delivery; each row must be reported without claiming an all-or-nothing email transaction.
- Preview has no manual roster rows. Concurrent provisioning linked all ten production office rows to Auth, but only one completed privacy consent and first-password setup. Send first-password mail to the nine pending members after deployment; never mail the completed member.

## References
- `docs/02-design/features/anchor-member-manual-entry.design.md`
- Supabase Auth invitation and email template documentation.
