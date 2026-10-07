# Application document course linking and enrollment handoff

2026-10-07. User requests resolving the approved but course-unlinked application document and retains authorization to push, PR, merge and deploy.

## Evidence and dependency
The approved legacy document has no offering_id. Its uniquely named published guide currently points to a DRAFT offering dated 2026-07-01–07-16, whereas the guide says December planned. The draft has no enrollment/completion policies. Existing document approval changes only the civil-service request; life_apply and life_review_application control actual applications/enrollments. The user has been asked for the actual offering or confirmed education/recruitment dates; do not invent dates, policy approval or learner consent.

## Deliverables
- Scoped manager course-linking control for unlinked application documents, including approved legacy documents, guarded by revision and immutable history.
- Return actual linked offering/application/enrollment state in document context; show the remaining actionable step instead of a generic warning.
- Approved linked documents with an existing eligible online application can be admitted by the scoped course manager through existing finance-aware application review.
- Future approvals of existing eligible online applications complete the admission together; unlinked documents require course selection before approval.
- New submissions with a unique public guide mapping retain the real offering connection; published-guide linked drafts remain valid for document preparation without inventing enrollment.
- Backfill uniquely identified legacy guide/offering links, preserving original PDF, document course title/decision and guidance. No automatic enrollment or fabricated consent from this repair.
- Learners use existing recruitment/policy-consent application flow when no actual application exists. Unpublished/ended offerings show their state and require corrected operational setup.

## Acceptance and release
Real Auth/RPC/browser tests for legacy approved linking, exact revision history, same-org scope, no linked-course reassignment, unlinked approval rejection, optional note, actual application admission, free capacity/paid pending behavior, learner own state and unsigned/missing application blocking. Production repair must leave real decision/PDF unchanged and not enroll into an expired unpublished course. Run lint/build, checks, merge and verify deployed revision and the real repaired record. Complete actual enrollment only when a valid offering and learner consent exist.
