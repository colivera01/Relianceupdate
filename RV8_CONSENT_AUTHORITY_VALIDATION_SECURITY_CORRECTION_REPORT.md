# RV-8 Consent-Authority Validation Security Correction Report

## Root Cause

The recording-scope assessment durably identified the authority expected to decide whether recording was allowed, but the decision endpoint previously validated only control of the intended email/mobile destination and the internal consistency of the recipient's self-selected role and scope. It did not compare that claimed role to the current assessment's expected authority or require independent evidence for representative or guardian authority. A mismatched self-assertion could therefore become accepted consent evidence and satisfy the recording gate.

## Authority Model

The current canonical assessment authority types are:

- `customer`: supported in the current beta flow when the assessment expects the customer, the recipient claims customer authority and its exact scope, and the intended destination is verified through the logged-in account, email OTP, or SMS OTP.
- `authorized_representative`: represented by `authorized_representative` for non-business customer locations. Reliance currently has destination verification and self-assertion, but no independent authority evidence. It cannot authorize recording in this flow.
- `authorized_representative` at a customer business: represented by `customer_business_representative`. Reliance currently has no independent business-representative authority evidence. It cannot authorize recording in this flow.
- `guardian`: Reliance currently has no independent guardian-authority evidence. It cannot authorize recording in this flow.
- `vendor_manager`: not a valid claimant for a customer permission request. Vendor-manager authority remains applicable only to recording scopes where customer permission is not required, such as a qualifying vendor-business workflow.

Email/mobile control proves control of the destination. It does not prove representative, business-representative, or guardian authority.

## Matching Rules

The server now applies these rules:

1. The current complete recording-scope assessment supplies the expected authority, assessment generation, location type, and scope hash.
2. The decision recipient supplies a claimed role and the exact canonical scope associated with that role.
3. The claimed role must be supported and its submitted scope must match the canonical role scope.
4. Expected customer authority matches only claimed customer authority.
5. Expected authorized-representative authority maps to customer-business representative only for a customer-business assessment; otherwise it maps to authorized representative.
6. Expected guardian authority maps only to guardian.
7. Exact non-customer role matches remain blocked until Reliance has independent authority-verification evidence.
8. No alternate-authority substitution is currently permitted.
9. Missing, mismatched, ambiguous, unsupported, stale, or unverifiable authority fails closed.

## Correction

A shared consent-authority validator now governs decision submission, permission-page presentation, consent status, and the canonical recording gate.

The decision service re-reads the current consent record and complete recording-scope assessment inside the serializable decision transaction. It verifies expected authority against claimed authority before consuming the decision session or recording a decision. Direct API submissions therefore receive the same enforcement as the page.

The permission page offers an approving choice only when the current beta flow can establish customer authority. For representative, business-representative, guardian, missing, and vendor-manager customer-request cases, the page explains that additional authority verification or an assessment correction is required, keeps recording locked, and preserves `Decide later` and wrong-recipient handling.

## Recording Gate

The recording gate now loads current consent and assessment evidence from the database and recomputes authority validity. It does not accept UI metadata or a caller-supplied consent status as authority.

Recording remains blocked when:

- expected and claimed authority do not match;
- authority evidence is missing;
- the claimed authority or scope is unsupported;
- identity/destination evidence is missing;
- non-customer authority lacks independent verification;
- authority evidence references an old assessment id, generation, or scope hash;
- durable evidence is absent or ambiguous.

Historical allowed decisions are preserved, but an older decision without current authority evidence cannot unlock recording.

## Durable Evidence

Every decision capable of authorizing recording now stores versioned authority evidence in the existing immutable decision-evidence metadata. It records:

- expected authority and expected claimed role;
- claimed authority and canonical authority scope;
- identity/destination verification basis;
- authority-verification basis;
- expected-versus-claimed match;
- explicit absence of an alternate substitution rule;
- assessment id, generation, and scope hash;
- the existing decision, timestamp, destination hash, and decision-evidence fields.

This uses the existing `ConsentDecisionEvidence` record and requires no schema migration. Prior evidence is not overwritten or rewritten. Material assessment changes continue to supersede the prior permission generation and invalidate stale operational authority.

## Unsupported Authority Cases

Authorized representatives, customer-business representatives, and guardians cannot currently be verified strongly enough to authorize recording. Exact self-selection plus OTP is insufficient. The server rejects those decisions as requiring authority verification, the page does not present a misleading Allow/Decline path, and the recording gate stays locked.

This correction does not invent document upload, relationship verification, business delegation, or guardian verification. Those capabilities require separately approved product design and implementation.

## Tests

- Focused consent/authority/recording-gate and media-session suite: 65 passed.
- Permission management, request, OTP verification, material-scope supersession, resend, wrong-recipient, and state-machine regressions: 25 passed.
- Relevant Epic 4/Epic 5 recording/media regression selection: 55 passed; 1 unrelated existing fixture failure. The positive employee recording-certification fixture lacks the established `geocoded_at` location-snapshot evidence and receives the expected location-gate `409`. This correction did not modify that test or the location rule.
- Customer permission Playwright with isolated mocked routes and no shared database mutation: 8 passed. It exercised the supported customer choice and the blocked unsupported-guardian presentation.
- Prisma schema validation: passed.
- Prisma client generation: passed.
- TypeScript: passed.
- Next.js 15.5.21 production build: passed (206 App Router pages plus 2 Pages Router pages generated).
- `git diff --check`: passed; only repository line-ending warnings were reported.

## Files Changed

- `src/lib/consent/authority-validation.ts`
- `src/lib/consent/authority-validation.test.ts`
- `src/lib/consent/decision-service.ts`
- `src/lib/consent/recording-gate.ts`
- `src/lib/consent/recording-gate.test.ts`
- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/app/api/consent/[token]/route.ts`
- `src/app/api/consent/status/route.ts`
- `src/app/api/consent/consent-flow-routes.test.ts`
- `src/app/consent/[token]/page.tsx`
- `src/app/api/vendors/[vendorId]/media/sessions/media-sessions-consent.integration.test.ts`
- `e2e/verified-permission-request.spec.ts`
- `RV8_CONSENT_AUTHORITY_VALIDATION_SECURITY_CORRECTION_REPORT.md`

## Regression Impact

The correction is limited to consent authority and the authority-dependent recording gate. Wrong-recipient correction, OTP/destination verification, immutable location snapshots, material-scope supersession, audio-off recording, three-stage evidence, manager-review locking, exact-stage correction, stale-upload protection, cancellation, manager-only management authority, and Private Service Video evidence/access remain unchanged.

No reviews, ratings, Trust Score inputs, publication decisions, Public media, AI decisions, retention/deletion actions, or obsolete 72-hour review behavior were introduced.

## Git

- Target branch: `codex/rv8-residence-location-correction`
- Starting commit: `a39b97ec6fd0bf4a0f2315e884232b5a6628e8f6`
- Final commit: this scoped security-correction checkpoint
- Migration status: no migration created or required

## Deployment

Deployment was not performed.

## Existing Product Owner Records

No Product Owner replay record, permission evidence, work record, package, media, or lifecycle state was changed or advanced. Validation used unit/integration mocks and non-destructive mocked Playwright routes.

## Next Recommended Action

Stop at Product Owner security-correction review. Do not deploy, begin the separate UX/session correction package, continue Product Owner replay, start RV-9, or start Epic 8 without Product Owner approval.
