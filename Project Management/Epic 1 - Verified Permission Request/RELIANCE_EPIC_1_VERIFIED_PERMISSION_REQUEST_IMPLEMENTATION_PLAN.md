# Reliance Epic 1 - Verified Permission Request Implementation Plan

**Planning status:** Awaiting Product Owner approval  
**Implementation status:** Not started  
**Repository reviewed:** `C:\Users\Cesar Olivera\Project Reliance`  
**Current branch:** `cursor-latest-build`  
**Planning baseline commit:** `635a7d22775ec8e52969db241a05ba36168491ba`  
**Roadmap adjustment:** The former Epic 4 is now Epic 1 by Product Owner decision.  

This document is an implementation plan only. No application code, migration, checklist row, frozen document, or repository file was changed while producing it.

## 1. Scope Confirmation

### Complete experience delivered

An authorized vendor manager will be able to send one recording-permission request to the intended authority holder. Email and SMS will be delivery channels for the same request, not separate permission records. The recipient will see an identity-safe summary, verify through a matching signed-in account or one-time code, confirm a role and authority scope, and then allow recording, decline recording, report a wrong recipient, or decide later.

The workflow will provide clear vendor, employee, customer, and read-only admin states for not sent, sending, delivered, delivery failed, pending, allowed, declined, expired, wrong recipient, superseded, and no digital channel. Recording will remain locked unless the canonical permission state is valid. Permission to record will not make media Public, create a review, change a rating, or create a Trust Score input.

### Included

- Consent-request creation, authorization, resend, contact correction, link rotation, supersession, and expiry.
- A single logical request delivered through both available channels.
- Secure hashed link secrets; no raw permission secret in the database, API response, dashboard payload, audit metadata, or booking metadata.
- Matching-account or consent-specific email/SMS OTP verification before allow or decline.
- Authority-role declaration and scope confirmation for customer, authorized representative, customer-business representative, and guardian roles.
- Wrong-recipient reporting that invalidates the action link without recording a customer decline.
- Forty-eight-hour expiry for an undecided request/action link.
- Continued validity of an accepted decision through work-record completion unless a supported material change supersedes it.
- Exact presented permission-content version and reconstructable decision evidence.
- Coordinated request, verification, decision, delivery-failure, resend, and status notifications.
- Persistent vendor and employee status; read-only admin evidence inspection.
- Private-by-default and no-review/no-Trust-Score regression protection.
- Migration treatment for legacy raw-token and incomplete evidence records.

### Explicitly excluded

- Determining every circumstance in which permission is required. The universal subject assessment and all three location-rule branches belong to the next epic.
- New recording-subject assessment screens or new location-selection rules.
- New employee pre-recording certification, geofence rules, capture behavior, upload behavior, stage changes, or manager review behavior.
- Enabling audio. This epic records and displays the current audio state; audio remains off unless a later approved workflow separately enables it.
- Complete minor/guardian evidence rules. A guardian role may be declared, but it cannot by itself unlock minor recording before the later protected-participant epic is complete.
- Exact-media Public approval, publication, moderation changes, withdrawal, disputes, retention, deletion, reviews, Trust Score redesign, customer registration redesign, vendor onboarding redesign, or policy rewrites.
- A broad redesign of customer/vendor/admin session isolation. This epic adds the narrow authorization and account-matching controls required by permission routes only.

### Eligibility boundary

This epic will secure permission requests only for work records that the current implementation already classifies as requiring customer permission and that contain enough current service, location, recipient, and scope data to present a truthful request. Missing or conflicting data will produce a blocked state rather than an inferred permission. The next epic will expand and standardize eligibility using the approved universal assessment.

## 2. Checklist Items Included

| Checklist item | Epic 1 treatment | Expected completion state after Epic 1 |
|---|---|---|
| `CON-01` | Separate permission to perform service, record, and make Public; secure the recording-decision portion. | In Progress until all location/subject gates ship; Epic 1 portion complete. |
| `CON-03` | Capture declared role, authority scope, mismatch, and unsupported-role blocking. | In Progress until universal authority and protected-participant gates ship. |
| `CON-05` | Implement wrong-recipient invalidation, vendor correction, new request, notification, and audit. | Beta Ready for permission requests. |
| `CON-06` | Require matching account or OTP plus role confirmation; link possession alone cannot decide. | Beta Ready for permission requests. |
| `CON-07` | Add channel-bound, expiring, single-use, rate-limited consent OTP and evidence. | Beta Ready for permission requests; publication OTP remains future. |
| `CON-24` | Enforce signed-in active vendor membership and manager/approved permission authority for create/resend/correct/supersede. | Beta Ready for permission requests. |
| `CON-25` | Implement 48-hour pending expiry, link rotation, resend, supersession, and accepted-through-completion behavior. | Beta Ready for current supported material changes; broader assessment changes remain future. |
| `CON-26` | Persist reconstructable request, verification, authority, version, decision, notification, IP, and user-agent evidence without raw secrets. | Beta Ready for permission decisions. |
| `CON-27` | Preserve Private default through request, failure, migration, and decision paths. | In Progress globally; Epic 1 regression coverage complete. |
| `LEG-09` | Store immutable exact permission content/version and link each decision to it. | Beta Ready for permission content. |
| `LEG-10` | Introduce a compatible version registry/reference mechanism without rewriting policy content. | In Progress; full policy archive remains Epic 11B. |
| `LEG-11` | Record signer evidence for this permission decision only. | In Progress; registration acceptance remains Epic 11B. |
| `LEG-12` | Allow authorized retrieval of the permission version and decision summary. | In Progress; full account legal-history retrieval remains Epic 11B. |
| `SEC-04` | Hashed rotating links, OTP/account match, replay controls, expiry, wrong-recipient handling, and audit. | Beta Ready for recording-permission links. |
| `NOT-01`, `NOT-02` | Align email/SMS request and decision delivery for this epic; validate controlled delivery where credentials permit. | Epic 1 templates complete; global/provider operations may remain In Progress. |
| `NOT-03` | Show canonical permission status and next action on affected vendor/employee/customer/admin screens. | In Progress globally; Epic 1 surfaces complete. |
| `NOT-05` | Version and test all permission/OTP/decision templates. | Epic 1 templates complete. |
| `NOT-06` | Store every permission notification attempt, provider result, error, and time. | Beta Ready for Epic 1 notifications. |
| `NOT-07` | Delivery failure never creates permission; alternate-channel and blocked recovery states remain truthful. | Beta Ready for Epic 1 notifications. |
| `NOT-08` | Durable idempotent retry, lease, dead-letter, and manual resend for Epic 1 notifications. | Beta Ready after the production scheduler is validated. |
| `TEST-06`, `TEST-09` | Add the permission and notification matrices listed in Section 12. | Epic 1 coverage complete. |
| `SHOT-01`, `SHOT-02`, `SHOT-07` | Capture the customer, vendor, state, and recovery inventory listed in Section 13. | Epic 1 package complete; rows remain open for later workflows. |
| Related `DOC-*` | Engineering report, UX observations, journey summaries, screenshot index, migration/operations notes, and checklist evidence links. | Epic 1 deliverables complete. |

Checklist rows will be updated only during implementation and only to the evidence-supported state. Shared rows will not be marked fully Beta Ready when later epics still own part of the acceptance criteria.

## 3. Dependencies Verified

### Verified in the active repository

- Signed session and bearer-token user resolution exists in `src/lib/auth.ts`.
- Active vendor membership and roles exist in Prisma `VendorMembership`.
- Admin route authorization exists through `src/lib/admin-auth.ts`.
- The current work-record path already distinguishes customer residence and customer business address for permission creation.
- Existing request, status, token lookup, allow, and decline routes exist under `src/app/api/consent`.
- Existing dual-channel delivery adapters exist for Resend email and Twilio/Telnyx-compatible SMS configuration.
- `BookingNotification`, `ConsentRecord`, and `ConsentEvent` provide a migration base.
- Vendor and employee work-record screens already consume permission state.
- Current media-session creation checks permission state, providing a regression point for recording lock behavior.
- The beta gate currently does not explicitly bypass permission links; this must be corrected narrowly so an invited recipient can reach the permission flow without the general beta password.

### Reordered dependency resolution

The approved roadmap originally listed the full Trusted Accounts and Role Isolation epic as a dependency. Because the Product Owner moved Verified Permission Request ahead of that epic, Epic 1 will implement only the minimum secure boundaries required here:

1. Vendor mutation routes require a signed-in user.
2. The user must have an active membership for the booking's actual vendor.
3. Creation, resend, recipient correction, and supersession require `MANAGER` or a future explicit permission-management capability; no client-supplied vendor ID grants authority.
4. Customer decisions require a matching signed-in customer account or verified OTP session.
5. Admin access is read-only and uses the existing separate admin guard.

No global session-cookie, multi-tab, role-switching, recovery, MFA, or dashboard-auth redesign will be attempted. If the existing auth layer cannot enforce these local guarantees without broader changes, implementation will stop and document the frozen-roadmap conflict for Product Owner review.

### Operational dependencies

- Azure SQL must permit additive Prisma migrations and indexed hash lookups.
- Email/SMS provider configuration must be available for controlled live delivery tests. Missing live credentials will be reported, never simulated as success.
- A production scheduler or Azure scheduled WebJob must invoke the protected notification retry processor. The SQL queue and processor can be implemented in-repository, but Epic 1 is not operationally complete until scheduling is verified.
- The current work record must have one intended recipient with at least one usable digital channel. No channel means recording locked and service may continue without Reliance recording.
- Email and mobile entered for one request must be confirmed by the vendor as belonging to the same intended authority holder. A mismatch requires correction before a decision.

## 4. Frozen Documents Governing This Epic

No document below will be rewritten.

| Document | Governing use in Epic 1 |
|---|---|
| `RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md` | Master tracker, acceptance evidence, status discipline. |
| `RELIANCE_IMPLEMENTATION_ROADMAP_V2.md` | Former Epic 4 scope, repository impact, acceptance criteria, deliverables, demo, and regression requirements, as reordered by Product Owner decision. |
| `RELIANCE_CURRENT_CONSENT_PRIVACY_AND_RECORDING_AUDIT.md` | Current executable implementation baseline and identified bearer-token/evidence gaps. |
| `RELIANCE_CONSENT_ARCHITECTURE_V1.md` | Authority, nondelegation, privacy, neutrality, immutable evidence, disagreement, and Private-outcome principles. |
| `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md` | Sections 1, 2, 5, 6, 14-16, 17, 18, and 20 for request, identity, authority, notification, evidence, failure, and migration behavior. |
| `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md` | `PO-01`, `PO-02`, and `PO-07`; other decisions are protected from regression. |
| `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md` | Permission terminology, Private reassurance, neutral choices, status labels, minimum-data notifications, and no inferred permission. |
| `RELIANCE_CONSENT_UX_SPECIFICATION_V1.md` | Screens 4-8, role status variants, education-before-ask, action hierarchy, state inventory, and UX quality checklist. |
| `RELIANCE_PRODUCT_IDENTITY.md` | Proof-of-service identity and product boundaries. |
| `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md` | Current identity gaps to avoid extending. |

## 5. Files Expected to Change

The final list will be confirmed after a second implementation-time trace. Estimated impact is 35-50 files plus 2 migrations and the evidence package.

### Routes

**Existing routes/pages expected to change**

- `src/app/consent/[token]/page.tsx` - replace bearer-decision page with education, verification, authority, and decision states.
- `src/app/vendor/jobs/page.tsx` - canonical send, pending, resend, delivery, wrong-recipient, contact-correction, expired, allowed, and declined states.
- `src/app/employee/jobs/page.tsx` - consume canonical permission status and show blocked/allowed next action without exposing recipient data.
- `src/app/admin/review-audit/page.tsx` - remove consent evidence dependence if replaced by a dedicated view; review behavior remains unchanged.
- Admin navigation component(s) that expose the new read-only permission-evidence view.

**New route/page expected**

- `src/app/admin/permission-audit/page.tsx` - read-only request, verification, delivery, version, decision, and supersession evidence.

### APIs

**Existing APIs expected to change**

- `src/app/api/bookings/route.ts` - stop creating/storing raw permission tokens; delegate eligible automatic request creation to one canonical service.
- `src/app/api/consent/request/route.ts` - authenticated, membership-bound canonical create action.
- `src/app/api/consent/status/route.ts` - return non-secret canonical state only; never return a token.
- `src/app/api/consent/[token]/route.ts` - hash lookup and identity-safe summary; no raw token response.
- `src/app/api/consent/accept/route.ts` - require verified single-use decision session and immutable evidence.
- `src/app/api/consent/decline/route.ts` - same verification/evidence requirements as allow.
- `src/app/api/vendors/[vendorId]/media/sessions/route.ts` - read canonical permission state; no raw-token authorization.
- `src/app/api/vendors/[vendorId]/dashboard/route.ts` - stop returning tokens and return status/delivery/next-action fields.
- Any booking edit/action route that currently changes recipient, location, service scope, or cancellation state without superseding permission.

**New APIs expected**

- `POST /api/consent/[requestId]/resend` - authorized same-recipient/same-scope link rotation on one logical request.
- `PATCH /api/consent/[requestId]/recipient` - authorized contact correction that supersedes the old request and creates a new request.
- `POST /api/consent/[token]/verification/start` - send channel-bound OTP with anti-enumeration response.
- `POST /api/consent/[token]/verification/verify` - consume OTP or confirm matching account and issue a short-lived decision session.
- `POST /api/consent/[token]/wrong-recipient` - invalidate action without recording a decline.
- `GET /api/admin/permissions/[consentRecordId]` - admin-only read of redacted evidence and history.
- `POST /api/internal/notifications/process` - service-authenticated, lease-based retry worker endpoint.

Endpoint names may be adjusted to established repository conventions, but the authorization and lifecycle boundaries will not change.

### Database

- `prisma/schema.prisma`.
- Two new migration folders under `prisma/migrations/`.
- A controlled backfill/normalization script under `scripts/` if SQL migration alone cannot safely classify active versus completed legacy records.

Expected additions:

- `ConsentContentVersion` - immutable presented permission content, structured scope schema version, effective time, and content hash.
- `ConsentRequestLink` - hashed secret, generation, issuance, 48-hour expiry, revocation, and supersession; raw token is never stored.
- `ConsentVerificationChallenge` - channel, destination hash, code hash, expiry, failed attempts, consumed time, and rate-limit evidence.
- `ConsentDecisionSession` - short-lived hashed session secret bound to one record, verification method, and single decision.
- `ConsentDecisionEvidence` - immutable allow/decline decision actor, verified contact/method, declared role/scope, request/scope/content hashes, time, IP, and user agent.
- `BookingNotificationAttempt` - immutable per-channel provider attempt/result/error/time.
- Additive lifecycle, supersession, recipient snapshot, scope snapshot/hash, current content version, and compatibility fields on `ConsentRecord` and `BookingNotification`.

### Components

Expected new components under `src/components/consent/`:

- `PermissionRequestSummary`
- `PermissionEducation`
- `ContactVerification`
- `AuthorityRoleSelector`
- `AuthorityScopeSummary`
- `PermissionDecisionActions`
- `PermissionStatusBanner`
- `PermissionDeliveryDetails`
- `WrongRecipientConfirmation`
- `PermissionEvidenceTimeline`

Existing shared button, alert, card, form, and status-chip components will be reused where they satisfy the frozen UX. No broad design-system rewrite is included.

### Notifications

**Existing files expected to change**

- `src/lib/notifications/send-consent-link.ts`
- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/notification-audit.ts`
- `src/lib/booking-notification-delivery.ts`
- `src/lib/env/notification-config.ts`

**Expected new files**

- Versioned permission-request email/SMS template.
- Versioned OTP email/SMS template.
- Versioned allow, decline, wrong-recipient, expired, superseded, delivery-failure, and contact-correction templates.
- Durable queue/retry/dead-letter worker and tests.

All request copy will say permission to record, explain Private-to-start, identify audio state, and state that Public sharing is a separate later decision. Existing “record and share” wording will be removed from this workflow.

### Shared Libraries

**Existing files expected to change**

- `src/lib/consent-flow.ts`
- `src/lib/consent-record-state.ts`
- `src/lib/booking-customer.ts`
- `src/lib/job-assignment.ts` only if token-bearing compatibility metadata must be removed.
- `src/lib/vendor-job-media.ts` only to replace raw-token checks with canonical state.

**Expected new files**

- `src/lib/consent/authorization.ts`
- `src/lib/consent/request-service.ts`
- `src/lib/consent/state-machine.ts`
- `src/lib/consent/token.ts`
- `src/lib/consent/otp.ts`
- `src/lib/consent/decision-session.ts`
- `src/lib/consent/evidence.ts`
- `src/lib/consent/content-version.ts`
- `src/lib/consent/material-change.ts`
- `src/lib/consent/public-summary.ts`
- `src/lib/notifications/permission-queue.ts`

The exact structure may consolidate files, but state transitions, authorization, hashing, and evidence will live in shared server-side services rather than be duplicated across routes.

### Middleware

- `src/lib/beta-gate.ts` and its tests - narrowly allow the public permission page and required public permission APIs through the beta-password gate. This does not bypass OTP/account verification.
- Root `middleware.ts` is not expected to change unless the existing bypass helper cannot express the narrow rule.
- Global authentication middleware/session behavior will remain unchanged.

### Tests

Expected updates/additions include:

- Existing consent unit and route tests under `src/app/api/consent/`.
- Existing booking creation and media-session consent integration tests.
- Existing notification delivery/template tests.
- New state-machine, token, OTP, evidence, material-change, and authorization unit tests.
- New request/resend/correction/wrong-recipient/decision/admin-evidence integration tests.
- New notification queue/retry/dead-letter integration tests.
- New `e2e/permission-request.spec.ts` with desktop and mobile projects.
- Trust Score and review regression tests proving no new signal or prompt.
- Beta-gate access tests proving permission links are reachable but decisions remain verified.

### Documentation

Repository documentation created during implementation:

- Epic 1 engineering report with all mandated impact sections.
- Screenshot package index and state manifest. Screenshot image artifacts remain outside Git unless the Product Owner explicitly changes the repository rule.
- UX observations.
- Customer, vendor, employee, and admin journey summaries.
- Migration/backfill and notification-scheduler runbook.
- Product Owner demo results.
- Updated affected rows and evidence links in `RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`.

Frozen design documents remain untouched.

## 6. Database Migrations Expected

### Migration 1 - Add verified permission infrastructure

Add new models and nullable compatibility fields without removing or changing current records. Add indexes for:

- Link-token hash lookup.
- Active logical request per work record and permission type.
- OTP challenge lookup, expiry, channel, and consumption.
- Decision-session lookup and consumption.
- Request status/expiry and supersession.
- Notification queue status/next attempt/lease.
- Admin evidence retrieval by booking, vendor, and time.

This migration is additive and independently rollback-safe at the schema level.

### Migration 2 - Normalize legacy permission data and eliminate raw secrets

After application code supports the new schema:

1. Seed the immutable current permission-content version from the approved rendered content.
2. Preserve all existing decision and event rows as historical facts.
3. Mark existing accepted decisions as legacy evidence, not newly verified evidence.
4. For incomplete/active work records whose only allow decision came from legacy bearer possession, require a new verified request before additional recording.
5. Preserve completed work records and existing Private media; do not fabricate a verified actor or role.
6. Preserve legacy declines as declines; do not reopen them automatically.
7. Invalidate undecided legacy raw-token links and show the vendor a clear “send a new secure link” action.
8. Remove raw token values from `ConsentRecord.token`, `Booking.customerMetadata`, API payloads, and notification/audit metadata after verified reissue or invalidation.
9. Do not create any permission, review, publication choice, rating, or Trust Score event during backfill.

The cleanup will be staged behind compatibility reads and verified on a database copy before beta. The migration will produce counts by legacy state without customer identifiers.

### Migration safeguards

- Preflight counts and uniqueness checks.
- Transactional batches with resumable checkpoints.
- No destructive model or column drop in Epic 1.
- No Public visibility change except prevention of accidental broadening; all affected media remain at least as restricted as before.
- Backup/restore point before normalization.
- Dry-run output with aggregate counts only.
- Post-migration assertions for zero raw tokens, one active request maximum, no duplicate decision, and no visibility widening.

## 7. Security Considerations

- **Authorization:** Derive booking vendor from the database. Require active membership and permission-management role. Ignore client-supplied identity as authority.
- **Anti-enumeration:** Public and unauthorized responses use consistent status/body timing where practical and never reveal whether a contact/account exists.
- **Token storage:** Generate at least 256 bits of randomness, store SHA-256/HMAC hash only, compare by indexed hash, and redact secrets from logs and analytics.
- **Link lifecycle:** Forty-eight-hour expiry, single current generation, explicit revocation on resend, wrong recipient, correction, or supersession.
- **Decision verification:** A link may display only minimum identity-safe context. Allow/decline requires a matching authenticated account or consumed channel-bound OTP.
- **OTP:** Short expiry, single use, cryptographically random code, hashed storage, attempt limit, send limit, IP/request/channel throttling, and generic failure messages.
- **Decision session:** Short-lived, one-time, HttpOnly, Secure, SameSite cookie or equivalent hashed server session bound to one request and verification method.
- **Replay/race:** Database transaction and unique constraints ensure only one terminal decision wins. Replayed requests return the durable result and do not create another event.
- **Wrong recipient:** Invalidates only the current action link/request. It cannot approve, decline, identify the correct customer, or expose additional details.
- **Recipient correction:** Only authorized vendor actors; creates a superseding request and never mutates historical evidence.
- **Minimum disclosure:** Notifications contain vendor, service label/date, requested action, Private-to-start explanation, and secure link only. No sensitive service details or media.
- **Admin:** Read-only evidence access through `requireAdmin`; no admin accept, decline, OTP bypass, revive, or silent override.
- **Logging:** Store contact hashes and masked values where possible. Provider recipients remain only in protected delivery evidence needed for operations. Never log OTPs or raw links.
- **CSRF/origin:** State-changing authenticated vendor/admin endpoints require existing same-site session protection plus origin checks where repository patterns allow. Public decisions use verified one-time decision sessions.
- **Beta gate:** Bypass only the permission page and required APIs; beta access is not treated as identity verification.
- **Safe failure:** Database, provider, queue, or verification uncertainty keeps recording locked and media Private.

## 8. UX Considerations

### Customer

- Education precedes verification and choice.
- The first screen answers why the request exists, what may be recorded, location type, whether people may appear, audio state, three stages, who may initially view, what happens on decline/no action, and that Public is later and separate.
- The request uses “permission,” not schema/legal jargon.
- Allow and decline are visually clear without pressure; “Decide later” remains available.
- Absolute expiry date/time is shown without a countdown.
- Private-to-start reassurance remains visible through OTP, role, decision, and confirmation.
- Wrong recipient and “I am not authorized” are first-class safe actions.
- Verification failures explain the next step without revealing which account/contact exists.

### Vendor

- One status and one next action per work record.
- The send screen shows masked recipient, same-person confirmation for email/mobile, request scope, available channels, and message previews.
- Delivery is channel-specific: delivered, failed, skipped, retrying, or dead-lettered.
- Resend rotates the link on the same logical request; contact correction clearly creates a new request and invalidates the old one.
- No-channel, mismatch, wrong-recipient, expired, and legacy-reverification states explain that service can continue without Reliance recording.

### Employee

- Shows only operational permission status and approved scope needed for the assignment.
- Never displays customer contact, OTP, link, or authority evidence.
- Pending, declined, expired, wrong-recipient, superseded, and no-channel remain blocked.
- Allowed states still identify any remaining current assignment/location gates; “permission confirmed” is not presented as a universal override.

### Admin

- Evidence is factual, chronological, redacted, and read-only.
- Shows request versions, scope hash, contact verification method, declared role, content/policy versions, delivery attempts, decision, supersession, and failures.
- Never provides a control to decide for the customer or revive a request.

### Accessibility and responsive behavior

- Keyboard-complete verification and decision flow.
- Programmatic labels, error summaries, focus movement, status announcements, and non-color status cues.
- OTP supports paste and mobile numeric keyboard without six isolated inaccessible fields.
- Stable responsive layouts at mobile, tablet, and desktop widths; no action or status text truncation.
- Loading never flashes a decision state; terminal confirmations never briefly show the opposite state.

## 9. Backward Compatibility Considerations

- Keep current `ConsentRecord` status/timestamp fields during the compatibility period so existing reads can be migrated incrementally.
- Replace all raw-token consumers before clearing legacy token data.
- Keep existing valid historical accept/decline events unchanged and label incomplete evidence honestly.
- Active legacy bearer-only approvals must be reverified before further capture; this is an intentional privacy hardening, not silent deletion.
- Completed work records and existing Private media remain available under current authorized access rules.
- Existing service, location, assignment, recording, manager review, publication, review, Trust Score, and retention behavior is not redesigned.
- Existing notification provider adapters remain; orchestration and evidence are strengthened around them.
- API responses may temporarily include deprecated non-secret compatibility status fields, but never raw tokens.
- Booking metadata keys will be read during migration only, then removed after canonical consumers are verified.
- Public/private choice stored by old consent flows is preserved as historical metadata but is not treated as new publication authority and is not changed in this epic.

## 10. Risks

| Risk | Level | Mitigation |
|---|---|---|
| Reordered epic precedes full role-isolation work | High | Implement narrow route-level membership/account checks only; stop if secure enforcement requires frozen-scope changes. |
| Two current request-creation paths diverge | High | Consolidate both booking creation and manual send behind one transactional request service. |
| Legacy raw tokens are exposed in DB/metadata/API | High | Staged hash migration, API redaction, pending-link invalidation, active-job reverification, log scan. |
| Legacy accepted decisions lack verified actor/authority | High | Preserve as legacy evidence; do not fabricate; require reverification before additional recording on active work. |
| Resend or concurrent decision creates duplicates | High | One logical request, generation rows, idempotency keys, unique constraints, transactional terminal transition. |
| Email and phone belong to different people | High | Vendor same-person confirmation, masked recipient review, one verified decision channel, wrong-recipient/correction flow. |
| OTP abuse or account enumeration | High | Channel/request/IP rate limits, generic responses, attempt caps, security audit events. |
| Delivery retry sends duplicates | Medium | SQL-backed idempotent jobs, leases, attempt records, provider IDs, dead-letter state. |
| Scheduler is not configured in Azure | High | Treat production scheduler validation as an acceptance gate; document and test protected manual processor. |
| Accept route currently sends employee capture link directly | High | Separate durable decision from notification side effects; re-check all existing recording gates before any employee action becomes available. |
| Beta password blocks invited customers | High | Narrow beta-gate bypass plus OTP/account verification and end-to-end link tests. |
| UI accidentally implies recording equals Public sharing | High | Frozen copy review, snapshot tests, UX checklist, screenshots, manual first-time-user critique. |
| Shared checklist rows are overstated | Medium | Update only Epic 1 evidence and leave later-owned portions In Progress. |
| Existing dirty worktree is overwritten | Medium | Re-check status before edits; stage by explicit file list; never include pre-existing deletions, `tsconfig.tsbuildinfo`, or `output/`. |

## 11. Rollback Strategy

1. **Checkpoint:** Record branch, commit, status, deployed build, migration state, and aggregate permission counts before changes.
2. **Feature flag:** Gate new request issuance and new decision UI behind a server-controlled flag. New schema may deploy dark before traffic switches.
3. **Additive first migration:** Safe to leave in place during code rollback because no existing columns are removed.
4. **Dual-read transition:** New code can read legacy records for status while issuing only new hashed links. No new raw tokens are written.
5. **Traffic switch:** Route request creation through the canonical service after integration tests and controlled staging verification.
6. **Normalization checkpoint:** Back up and run dry-run counts before clearing raw tokens. Once secrets are cleared, rollback target is the compatible intermediate build, not the pre-Epic build that requires raw tokens.
7. **Notification rollback:** Pause queue claims and manual sends. Existing queued jobs remain inspectable; do not mark them successful.
8. **UI rollback:** Disable the feature flag and show a safe blocked/retry state. Never fall back to bearer-only decisions.
9. **Data rollback:** Restore only from the verified backup if normalization corrupts state. Do not restore raw links into active use.
10. **Privacy invariant:** Every rollback keeps recording locked on uncertainty and never widens media beyond Private.

## 12. Test Plan

### Baseline and static gates

- Record the existing focused consent, booking, media-session, notification, auth, review, and Trust Score test results before implementation.
- Run `npx prisma validate` and `npx prisma generate`.
- Run `npx tsc --noEmit --pretty false --incremental false`.
- Run the repository Vitest suites and focused Epic 1 suites.
- Run the production build with `npm run build`.
- Run dependency/security scanning available in the environment and document actionable versus pre-existing findings.
- There is no current lint script or ESLint dependency; this limitation will be reported rather than claiming lint success.

### Unit tests

- Permission state-machine transition matrix.
- Token generation, hashing, constant-time-safe lookup behavior, rotation, and redaction.
- Forty-eight-hour boundary with clock-controlled tests.
- OTP generation, hash, channel binding, expiry, attempt cap, send cap, consumption, replay, and race behavior.
- Matching-account rules for email/phone and nonmatching account fallback.
- Authority-role and scope normalization; unsupported guardian/minor/audio cases remain blocked.
- Material-change classification for currently supported editable fields.
- Immutable content-version hash and exact rendered-content retrieval.
- Public-summary data minimization.
- Notification template snapshots and prohibited-language scan.
- Retry schedule, lease, idempotency, alternate channel, and dead-letter behavior.

### API and integration tests

1. Manager for the booking vendor can create a request.
2. Employee, unrelated vendor, customer, anonymous caller, and forged vendor ID cannot create/resend/correct/supersede.
3. Eligible booking creation and manual send use one canonical request service.
4. Email and SMS delivery reference one logical request.
5. Resend rotates the link, revokes the old link, preserves one decision object, and appends delivery history.
6. Contact correction invalidates the old request and creates a superseding request without rewriting history.
7. No email/mobile creates a blocked no-channel result; no permission or notification success is fabricated.
8. Different-recipient/mismatch path blocks and requires correction.
9. Public link returns only identity-safe request data.
10. Link possession alone cannot allow or decline.
11. Matching account can establish a decision session only for the intended recipient.
12. Email OTP and SMS OTP each verify their own channel; wrong/expired/reused codes fail.
13. Rate limits and anti-enumeration responses work.
14. Allow and decline are single terminal decisions under concurrent requests.
15. Wrong recipient invalidates without creating a decline.
16. Pending request expires at 48 hours and cannot decide.
17. Accepted decision remains valid after the link reaches 48 hours and through completion absent supersession.
18. Supported material change supersedes and re-locks recording.
19. Legacy pending records do not remain actionable; active legacy bearer-only approvals require reverification.
20. Completed historical records remain readable and Private.
21. Decision and delivery evidence can be reconstructed without raw secrets.
22. Admin can read redacted evidence; non-admin cannot; admin cannot decide or revive.
23. Notification failure never changes permission state.
24. Retry processing is idempotent and dead-lettered jobs are visible.
25. Media-session creation remains blocked for pending/declined/expired/wrong-recipient/superseded/no-channel.
26. Valid accepted permission satisfies only the existing permission gate and does not bypass unrelated assignment/location gates.
27. Permission events do not create reviews, ratings, publication approval, Public media, or Trust Score inputs.

### Playwright journeys

- Vendor sends one dual-channel request; customer verifies by email OTP; confirms role; allows; vendor/employee/admin states update.
- Same journey using SMS OTP.
- Matching logged-in customer path.
- Decline path.
- Wrong-recipient and vendor contact-correction path.
- Expired-link and resend path.
- One-channel delivery failure and successful alternate channel.
- All-channel failure and no-channel blocked state.
- Replay old link, OTP, and decision session.
- Unauthorized vendor direct-URL and API substitution attempts.
- Mobile customer permission/OTP/role/decision flow.
- Keyboard-only and screen-reader-name checks for core controls.
- Refresh/reopen continuity for all terminal statuses.

### Controlled provider validation

- Send to approved test email and mobile recipients only.
- Verify sender, subject/body, minimum data, link host/path, OTP delivery, STOP language, message IDs, and stored delivery evidence.
- Inject provider failure and verify alternate channel, retry, status, and no state broadening.
- Do not use real customer data in tests or screenshots.

## 13. Screenshot Plan

Screenshots will use controlled synthetic records and be kept outside Git unless explicitly approved.

### Desktop

1. Vendor request ready/not sent.
2. Vendor sending/loading.
3. Vendor delivered/pending with channel details.
4. Vendor one-channel failure with recovery.
5. Vendor no-channel blocked state.
6. Vendor wrong-recipient/contact-correction state.
7. Customer identity-safe loading state.
8. Customer education-before-ask summary.
9. Customer OTP entry and verification failure.
10. Customer authority-role and scope confirmation.
11. Recording allowed confirmation with Private reassurance.
12. Recording declined confirmation.
13. Wrong-recipient confirmation.
14. Expired/superseded link.
15. Employee pending/blocked state.
16. Employee permission-confirmed state with remaining gates.
17. Admin permission evidence timeline.
18. Admin empty/not-found/unauthorized state.

### Mobile

19. Customer education page.
20. OTP and role selection.
21. Allowed confirmation.
22. Declined confirmation.
23. Wrong-recipient confirmation.
24. Expired/failure recovery.

### Practical before/after comparisons

- Current bearer-only decision page versus verified education/identity/authority flow.
- Current “record and share” request copy versus recording-only/Private-to-start copy.
- Current token-bearing vendor status payload/UI versus non-secret canonical status.
- Current generic failure versus channel-specific recovery.

Every screenshot will be indexed by role, viewport, state, fixture, commit, date, expected result, and any UX concern.

## 14. Product Owner Demo Checklist

| Validate | Exact Product Owner action and expected observation |
|---|---|
| Expected workflow | Sign in as the Electro LLC vendor manager. Open an eligible customer-location work record, review the masked recipient and recording summary, send one request, then open the received link as the intended recipient. Verify by OTP or matching account, select the correct authority role, review the scope, and choose `Allow recording`. Confirm the page says Private to start and does not mention Public approval as part of this choice. |
| Expected notifications | Confirm email and SMS reference the same request and display only minimum service information. Verify one OTP arrives through the selected channel. Confirm the customer and vendor receive accurate allow confirmation. Use `Resend secure link` and confirm the old link stops accepting action while no second permission decision is created. |
| Expected dashboard updates | Keep vendor and employee views open. Observe the vendor work record move from not sent to sending/delivered/waiting/confirmed without a manual refresh where supported. Confirm the employee view stays blocked until valid permission and then shows permission confirmed plus any remaining current gate. |
| Expected database state | Inspect the controlled record: one logical active request, hashed link only, link generation history, one consumed OTP or matching-account verification, declared role/scope, exact content/version/hash, decision IP/user agent/time, per-channel delivery attempts, and one terminal decision. Confirm no raw token or OTP exists in tables or booking metadata. |
| Expected admin state | Sign in separately as admin, open the permission evidence view, and reconstruct request creation, delivery, verification, authority, decision, and versions. Confirm no admin control can allow, decline, resend as the vendor, or revive an expired request. |
| Expected customer state | Repeat with `Decline recording`; confirm no pressure, recording remains locked, service normally may continue, and no Public/review consequence is implied. Repeat `This request is not for me`; confirm it is not recorded as a customer decline and reveals no extra customer information. |
| Expected vendor state | Attempt request creation from an unrelated vendor account and confirm a generic denial. Correct the wrong recipient, send a new request, and confirm the old link is invalid. Create an eligible work record with no email/mobile and confirm recording is unavailable while service can continue without recording. |
| Expected employee state | Open the assignment for pending, declined, expired, wrong-recipient, and no-channel fixtures. Confirm recording is blocked in every case and customer contact/OTP/evidence is hidden. Open the accepted fixture and confirm acceptance does not bypass unrelated current location/assignment checks. |
| Expected Trust Score behavior | Compare the vendor's Trust Score inputs before and after allow, decline, expiry, non-response, resend, and wrong-recipient events. Confirm no score value/input changes. |
| Expected review behavior | Check customer and vendor review areas after every permission outcome. Confirm no review invitation, rating, review record, synthetic opinion, or moderation item is created. |
| Expected audit history | Verify append-only events for authorization, request creation, link issuance, delivery attempts, OTP issue/verify/failure, role/scope, allow/decline/wrong-recipient, resend, expiry, correction, and supersession. Confirm secrets are absent and failed unauthorized attempts are distinguishable. |
| Expected screenshots | Compare the screenshot index against all desktop/mobile loading, success, failure, empty, blocked, expired, wrong-recipient, no-channel, vendor, employee, and admin states listed in Section 13. |

Additional demonstrations:

1. Advance the test clock past 48 hours: undecided request cannot act; accepted permission remains accepted.
2. Replay an old link after resend: no decision control is available.
3. Enter a wrong OTP repeatedly: attempts stop at the configured limit without revealing account existence.
4. Force email failure with SMS success: request stays pending through SMS and the vendor sees truthful channel status.
5. Force both providers to fail: recording remains locked; no decision exists; retry/dead-letter state is visible.
6. Open the link without the beta-access cookie: permission page loads, but allow/decline stays unavailable until verified.

## 15. Regression Statement Plan

The implementation report will contain a mandatory `REGRESSION STATEMENT` with these subsections.

### Existing functionality intentionally preserved

- Work-record creation and current service/location selections.
- Employee assignment and reassignment outside permission status effects.
- Current geolocation and camera/upload behavior.
- Three recording stages and duration rules.
- Manager review and correction workflow.
- Private/Public media filtering and admin moderation.
- Genuine customer reviews and moderation.
- Trust Score calculations and evidence inputs.
- Customer/vendor/admin registration and sign-in outside the narrow permission verification path.
- Existing retention/deletion behavior.

### Existing functionality intentionally unchanged

- The universal rule deciding which vendor-address scenarios require customer permission.
- Subject/risk assessment, minors, guardian proof, audio enablement, fallback media, withdrawal, disputes, publication approval, and legal-policy wording.
- Global role/session isolation and multi-tab account behavior assigned to the later Trusted Accounts epic.
- AI remains advisory and cannot infer, grant, deny, or override permission.

### Areas verified unaffected

- Booking CRUD for non-permission work records.
- Vendor-address current path.
- Media visibility remains Private by default.
- Public media serving/moderation regression suite.
- Review creation/moderation and no synthetic review behavior.
- Trust Score values and inputs.
- Employee capture for fixtures with valid current gates.
- Admin account separation outside the new read-only evidence route.

### Potential regression risks reviewed

- Legacy metadata/token removal.
- Duplicate booking/manual request creation.
- Employee link release side effects.
- Notification retries and duplicate sends.
- Beta-gate bypass scope.
- Permission expiry versus accepted validity.
- Contact correction and customer ownership.
- Existing active work requiring reverification.

### Known unrelated issues

At implementation start and finish, list pre-existing failures and dirty worktree items separately, including evidence that Epic 1 did or did not affect them. Current pre-existing worktree items observed during planning are:

- Deleted files under `docs/legal-consent-audit/`.
- Modified `tsconfig.tsbuildinfo`.
- Untracked `output/`.

These are not part of Epic 1 and will not be staged, restored, or overwritten.

## 16. Estimated Implementation Sequence

The implementation will proceed in this order and stop after Epic 1.

1. **Checkpoint and re-audit**
   - Reconfirm branch, commit, remotes, status, affected checklist rows, active routes, production configuration, and pre-existing failures.
   - Freeze the exact implementation file inventory and baseline test results.

2. **Contract and state-machine tests first**
   - Encode approved request states, transitions, authorization matrix, 48-hour rule, wrong-recipient semantics, accepted validity, Private default, and non-effects on reviews/Trust Score.
   - Add failing tests before changing behavior.

3. **Additive schema migration**
   - Add content version, link generation, OTP, decision session/evidence, notification attempt/queue, and compatibility fields/indexes.
   - Validate Prisma and migration against an isolated database copy.

4. **Shared permission domain services**
   - Implement canonical authorization, state machine, token hashing, OTP, account matching, authority normalization, content versioning, evidence, supersession, and redacted summaries.

5. **Canonical vendor request service**
   - Route booking-time and manual request creation through one transaction.
   - Enforce active membership/role, eligibility, same intended recipient, available channel, idempotency, and one logical active request.

6. **Secure public verification flow**
   - Implement identity-safe lookup, matching-account path, OTP issue/verify, short-lived decision session, rate limits, replay protection, and narrow beta-gate access.

7. **Terminal decisions and correction paths**
   - Implement allow, decline, wrong recipient, resend, expiry, contact correction, and supported material-change supersession transactionally.
   - Remove raw token response/metadata behavior.

8. **Notification orchestration**
   - Add versioned minimum-data templates, delivery attempts, alternate channel, idempotent retries, leases, dead-letter state, protected processor, and Azure scheduler runbook/configuration.
   - Ensure notification failure cannot alter permission.

9. **Customer UX**
   - Build education, verification, role/scope, decision, allowed, declined, wrong-recipient, expired, superseded, empty, loading, failure, and recovery states to the frozen UX specification.

10. **Vendor, employee, and admin UX**
    - Replace token-driven state with canonical statuses and next actions.
    - Add masked delivery details, resend/correction, blocked/allowed employee state, and read-only admin evidence timeline.

11. **Legacy normalization migration**
    - Dry run, back up, classify records, preserve history, require active bearer-only reverification, invalidate pending raw links, clear raw secrets, and verify invariants.

12. **Full validation**
    - Run unit/integration suites, security negatives, Playwright desktop/mobile, controlled provider tests, Prisma validation/generation, type check, build, and available dependency/security checks.
    - Document every command and actual result; never claim an unrun gate.

13. **Visual and UX evidence**
    - Capture Section 13 screenshots.
    - Conduct honest customer, vendor, employee, and admin UX critiques using the frozen quality checklist.
    - Correct Epic 1 defects and rerun affected gates.

14. **Documentation and checklist**
    - Produce engineering report, migration/operations notes, screenshot index, UX observations, four journey summaries, demo record, and Regression Statement.
    - Update every affected checklist row accurately without changing frozen design documents.

15. **Git checkpoint and Product Owner handoff**
    - Recheck diff and status.
    - Stage only Epic 1 code, migrations, tests, approved reports, and checklist update.
    - Exclude secrets, logs, screenshots, generated artifacts, `tsconfig.tsbuildinfo`, `output/`, and unrelated existing changes.
    - Commit with the implementation-scoped message agreed at implementation time, push the current branch after gates pass or an explicitly documented pre-existing blocker, and report commit/evidence paths.
    - Stop. Do not begin the next epic until Product Owner demo and approval are complete.

## Approval Gate

Implementation will not begin until the Product Owner approves this Epic 1 plan. Approval authorizes only the Verified Permission Request epic and does not authorize any later consent, recording, account, publication, legal, review, Trust Score, or release epic.
