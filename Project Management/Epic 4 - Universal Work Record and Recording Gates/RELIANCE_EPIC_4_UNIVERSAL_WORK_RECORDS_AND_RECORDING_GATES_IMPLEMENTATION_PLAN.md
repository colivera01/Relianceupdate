# Reliance Epic 4 - Universal Work Records and Recording Gates Implementation Plan

**Epic:** Epic 4 - Universal Work Records and Recording Gates
**Planning status:** Approved by Product Owner
**Implementation status:** Implemented and validated locally; deployment and Product Owner replay pending
**Repository:** `C:\Users\Cesar Olivera\Documents\Codex\worktrees\reliance-epic3-admin-grant`
**Branch:** `codex/epic3-beta-admin-grant-correction`
**Planning baseline commit:** `c40bd55c87d14a783856a113dfdfbde8f7ba6c88`
**Current beta application commit:** `df36f113d37149adab2373964663016e4cd845a6`

This plan translates the frozen consent architecture and workflow into the next complete customer-facing experience. It changes no application code, database, migration, checklist status, deployment, or frozen governing document.

The roadmap file still labels this capability as its former sequence number, `Epic 5`. The Product Owner's approved implementation order and Project Management folder identify it as **Epic 4**. This plan uses the approved current name without rewriting the frozen roadmap.

## 1. Scope Confirmation

### User experience delivered

A vendor manager creates one permission-ready work record by:

1. selecting the actual service location;
2. completing a short branching assessment of what may be recorded;
3. identifying the authority holder for the location, property, person, audio, or minor involved;
4. confirming whether the service can proceed without recording and whether essential Private recording was disclosed before service acceptance or scheduling;
5. sending the correct customer notice or verified permission request;
6. assigning an active employee;
7. showing the employee the exact approved scope and stop conditions;
8. recording a durable employee pre-recording certification;
9. verifying the saved work-record location or obtaining an authorized alternate-location decision; and
10. unlocking recording only when one canonical server-side decision confirms every required gate.

The complete experience must work for:

- Vendor business address.
- Customer residence.
- Customer business address.
- Vendor-owned property/work-area proof.
- Customer-owned property proof.
- Person-centered proof.
- Necessary Private proof involving a verified guardian.
- Audio-off proof and the separately controlled audio path.
- Pending, declined, expired, wrong-recipient, no-channel, superseded, reassigned, location-failed, and unresolved-risk states.

### Included

- Recording-subject assessment and risk level derived from actual planned capture.
- Authority-holder identification and authority-scope evidence.
- Notice-only Level 1 vendor-property path.
- Reuse of Epic 1 verified permission for every customer-controlled scope.
- Three location-specific gate rules using one architecture.
- Immutable work-record address snapshots.
- Durable employee certification tied to assignment and scope version.
- Stage reminders that do not create new customer consent.
- Material-change detection and permission/certification supersession.
- Residence, vendor-business, and customer-business location verification.
- Documented alternate-location request submitted by a manager and decided only by authorized admin/support.
- One canonical server-side recording-access decision used by release, employee camera UI, job start, media-session creation, upload endpoints, dashboards, and admin evidence.
- Consistent reason-specific blocked states and one responsible next actor.
- Relevant notifications, audit evidence, focused AI guidance, tests, screenshots, reports, and checklist updates.

### Explicitly excluded

- Three-stage capture internals, upload recovery, manager correction, and Private proof delivery owned by Epic 5, except preserving and gating the current paths.
- Exact-media Public approval, publication, public moderation, and Public migration owned by Epic 6.
- Withdrawal, disputes, retention, deletion, and final disposition owned by Epic 7, except existing permission withdrawal/supersession blocks must remain respected.
- Trust Score redesign or new Trust Score inputs.
- Review creation or review eligibility changes.
- AI decision-making, AI override, or AI inference of authority.
- Full Vendor Agreement, Employee Agreement, Privacy Policy, Terms, or legal-document governance owned by Epic 11.
- Epic 3 Phase B identity lifecycle work.
- Full RR-1A A2, A4, A6, or A7 replay. Those replays remain deferred until Epic 4 and Epic 5 are complete.

## 2. Success Definition

Epic 4 is successful only when:

1. Location alone never determines whether customer permission is required.
2. A short subject assessment classifies the scope using verified server rules.
3. Vendor authorization alone unlocks only vendor-owned property or a vendor-controlled work area with no customer-controlled property, identifiable person, audio, sensitive information, or protected-person risk.
4. Every customer-residence recording has affirmative verified customer or representative permission.
5. Every customer-business recording has affirmative verified business-representative permission for premises/business property, without treating that authority as permission for every person present.
6. Person-centered recording requires the relevant person's or verified authority holder's permission even at the vendor business address.
7. Audio remains off unless a separately approved audio scope exists for every intentionally identifiable speaker.
8. Necessary Private recording of an identifiable minor remains locked until guardian identity, authority, necessity, and manager review are durable; identifiable-minor Public proof remains prohibited.
9. The employee is the current active assignee and has a current certification for the exact scope version.
10. Location is verified against the immutable work-record snapshot or an authorized admin/support alternate decision.
11. A manager can request but can never approve their own location exception.
12. A material scope change supersedes stale permission and certification without rewriting prior evidence.
13. Every protected recording endpoint reaches the same canonical gate result.
14. Uncertainty fails closed, service may continue without recording under the approved rule, and no permission event creates Public media, a review, rating, or Trust Score input.
15. The Product Owner can execute the full demo checklist on desktop and mobile before Epic 5 begins.

## 3. Checklist Items Included

| Area | Epic 4 responsibility |
|---|---|
| `CON-02` | Distinguish recording permission from later publication and all unrelated decisions. |
| `CON-04` | Apply the least-public, narrow-scope, authority-specific recording model. |
| `CON-08` through `CON-14` | Subject assessment, location branches, authority, employee certification, audio, minors/protected people, and material-change behavior. |
| `CON-22`, `CON-23` | Durable pre-recording evidence and canonical recording lock. |
| `LEG-03`, `LEG-04` portions | Record versioned operational responsibility acknowledgments needed before work-record release/capture; final standalone agreements remain Epic 11. |
| `LEG-11` portions | Preserve actor, version, timestamp, IP, and user-agent evidence for Epic 4 acknowledgments. |
| `PROD-10` through `PROD-12` portions | Synchronize customer, vendor, and employee status/next-action views. |
| `HELP-02`, `HELP-03`, `HELP-06` portions | Explain why recording is blocked and the safe next action without inventing authority. |
| Relevant `SEC-02` | Rebuild actor, ownership, membership, assignment, authority, and permission server-side. |
| `TEST-04`, `TEST-06` | Device/location behavior and the complete three-location decision matrix. |
| `SHOT-01` through `SHOT-03`, `SHOT-07` | Customer, vendor, employee, and non-happy-state evidence. |
| Related `DOC-*` | Engineering report, UX review, demo, journey notes, screenshots, lessons, debt, checklist snapshot, and Git checkpoint. |

No checklist row is promoted during planning. Shared rows remain `In Progress` until every owning epic and evidence gate is complete.

## 4. Dependencies Verified

### Completed dependencies

- Epic 1 verified permission request, OTP, authority declaration, allow/decline, resend, correction, supersession, and wrong-recipient lifecycle.
- Epic 1 canonical permission evidence in `ConsentRecord`, `ConsentDecisionEvidence`, `ConsentRequestLink`, and `ConsentEvent`.
- Epic 2 product identity, proof-first language, role shell, and UX hierarchy.
- Epic 3 Phase A database-derived actor, ownership, vendor membership, employee assignment, admin grant, API protection, and IDOR controls.
- RR-1A A5 customer registration, email verification, optional SMS, service-record claiming, and durable policy evidence.
- Existing three-stage model: Starting Condition, Work in Progress, and Final Result.
- Existing audio-off browser capture behavior.
- Existing assignment, service-order release, location snapshot, media-session, and notification-worker foundations.

### Deferred replay safeguard

The Product Owner deferred full A2, A4, A6, and A7 replays until Epic 4 and Epic 5 are complete. Epic 4 will not execute those broad live replay gates, but it must run focused automated contract tests proving it did not weaken:

- authentication and role isolation;
- vendor onboarding/membership;
- employee onboarding/membership/revocation;
- verified permission identity, lifecycle, and recording lock.

### Dependencies not yet implemented

- Durable recording-subject assessment.
- Durable authority requirements separate from contact verification.
- Notice-only vendor-property workflow.
- Employee certification tied to assignment and scope hash.
- Residence geolocation verification.
- Location attempt evidence and admin/support exception workflow.
- General material-change supersession after a final permission decision.
- Canonical aggregate recording gate across all release/capture/upload/read surfaces.

## 5. Frozen Documents Governing This Epic

No file in this section may be changed.

| Document | Governing sections |
|---|---|
| `RELIANCE_PRODUCT_IDENTITY.md` | Proof-of-service identity; not a booking product or marketplace. |
| `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md` | Current terminology and alignment constraints. |
| `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md` | Plain, human, non-coercive language and status naming. |
| `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md` | Sections 1-6, 9-15, and 17-18: separate permissions, authority, pre-recording gates, immutable evidence, conflicts, protected people. |
| `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md` | Sections 2-8, 13-16, 17, 20: assessment, three locations, verified requests, authority, certification, recording behavior, minors, notifications, evidence, failures. |
| `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md` | `PO-01` through `PO-04`, `PO-07`, `PO-09`, and `PO-10`. |
| `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md` | Screens 1-10 and universal screen anatomy: work-record creation, assessment, authority, notification, permission, employee recording, and blocked states. |
| `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md` | Universal Work Record and Recording Gates capability, acceptance criteria, deliverables, demo, regression, and quality gates. |
| `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md` | Master acceptance tracker. |

If implementation requires changing a frozen business result, work stops and the conflict is presented to the Product Owner.

## 6. Current Repository Audit

### What exists and will be preserved

| Current capability | Active implementation |
|---|---|
| Work-record creation | `src/app/vendor/jobs/page.tsx`; `src/app/api/bookings/route.ts`; Prisma `Booking`. |
| Three location choices | Booking metadata keys parsed by `src/lib/job-assignment.ts`. |
| Immutable-style address snapshot | `vendor_job_recording_location_snapshot`; `src/lib/job-recording-location.ts`. |
| Verified permission lifecycle | `src/lib/consent/*`; `src/app/api/consent/*`; Prisma `ConsentRecord` family. |
| Canonical Epic 1 permission decision | `src/lib/consent/recording-gate.ts`. |
| Assignment and release | `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`; `src/lib/job-assignment.ts`. |
| Employee assigned-work view | `src/app/api/employee/jobs/route.ts`; `src/app/employee/jobs/page.tsx`. |
| Business/customer-business GPS check | `src/lib/job-recording-location.ts`; employee verify-location and media-session routes. |
| Media-session recording block | `src/app/api/vendors/[vendorId]/media/sessions/route.ts`. |
| Vendor dashboard permission state | `src/app/api/vendors/[vendorId]/dashboard/route.ts`; vendor jobs UI. |
| Admin permission evidence | `src/app/api/admin/permissions/*`; `src/app/admin/permission-audit/page.tsx`. |
| Audio-off capture | Current employee browser capture and `ConsentRecord.audioEnabled = false`. |

### Verified gaps

| Gap | Current behavior | Required Epic 4 result |
|---|---|---|
| Subject assessment | No durable subject/risk assessment exists. | Short branching assessment and versioned scope hash. |
| Vendor-address rule | Customer permission is currently skipped for every vendor-address record. | Skip customer decision only for verified vendor-only Level 1 scope; person/customer-property scope requires verified permission. |
| Permission scope | Current `scopeJson` records location, stages, audio off, audience, and customer label only. | Include subject, people, sensitive-data, authority, risk, audio, and immutable assessment version. |
| Authority holder | Consent page records claimed role, but creation does not identify all required authority holders. | Determine required authority before request; block incomplete/mismatched authority. |
| Notice-only path | Not implemented. | Queue one informational customer notice for vendor-only scope; failed delivery is visible but does not become consent. |
| Material changes | Recipient correction/resend rotate links, but general scope changes do not safely supersede a final decision. | New scope generation invalidates stale unlock and preserves prior evidence. |
| Employee certification | No durable certification model or current-scope proof exists. | Certification tied to employee membership, assignment, scope hash, content version, and time. |
| Residence location | Current geolocation helper does not verify residence. | Verify against saved residence snapshot with privacy-minimized attempt evidence. |
| Location exception | No manager-request/admin-decision path exists. | Manager submits evidence; admin/support alone approves or denies; no silent override. |
| Canonical aggregate gate | Permission, assignment/release, location, and UI status are partly separate. | One server decision composes every gate and supplies stable reason codes/next actor. |
| Upload enforcement | Media-session creation is gated, but every upload/start/stage/complete path is not proven to reuse one aggregate decision. | Revalidate canonical access before consequential recording/session/upload operations. |
| Protected people | Guardian allow is conservatively blocked and no durable minor/protected-person workflow exists. | Necessary Private guardian path with heightened evidence; public-identifiable-minor prohibition remains absolute. |

## 7. Target Recording-Gate Model

### Permanent rule

> No component decides independently whether recording may begin.

Introduce one server service conceptually named `resolveRecordingAccessDecision`. It must load current database evidence and return:

- `allowed`;
- current work record and scope generation;
- location type and snapshot status;
- permission basis: `vendor_only_authorization`, `verified_customer_permission`, or `none`;
- permission lifecycle and evidence ID;
- required and satisfied authority holders;
- current assignment and membership status;
- service-order release status;
- current employee certification and matching scope hash;
- location verification or approved exception;
- audio state and audio-authority result;
- guardian/protected-person result;
- incident/dispute block when present;
- stable block reason codes;
- responsible next participant;
- plain next-action key for UI mapping;
- immutable evidence references, never raw tokens or OTPs.

### Required consumers

The exact service result must govern:

1. Vendor service-order release.
2. Vendor and dashboard status.
3. Employee assigned-work status.
4. Employee camera control rendering.
5. Employee job start.
6. Location verification finalization.
7. Media-session creation.
8. Upload initialization.
9. Upload proxy/fallback entry.
10. Upload completion and stage confirmation.
11. Admin evidence and alternate-location decisions.
12. Notification wording and next-action status.

Client metadata may display state but cannot authorize it. `Booking.customerMetadata` may remain as a backward-compatible projection during migration, but authoritative scope, certification, location decision, and permission evidence must come from database records.

## 8. Planned Data Model and Migrations

### Expected migrations

Two additive migrations are expected.

**Migration 1 - Recording scope and authority evidence**

- Versioned recording assessment linked to `Booking`.
- Current/superseded generation and immutable scope hash.
- Location selection and snapshot reference.
- Structured subject/risk facts with SQL Server-compatible storage.
- Audio requested/allowed state.
- Required authority-holder records and status.
- Essential-Private-recording disclosure/purpose evidence when selected.
- Notice requirement and delivery-attempt reference.

**Migration 2 - Employee certification and location evidence**

- Employee certification tied to booking, membership, assignment generation, scope generation/hash, content version, and time.
- Certification invalidation reason/time.
- Location verification attempt with privacy-minimized distance, accuracy, result code, and time.
- Alternate-location review request, manager submitter, evidence reference, admin/support decision, and decision time.
- Indexes supporting current-gate reads and immutable audit reconstruction.

### Data principles

- Additive only; no destructive column removal.
- No raw permission token, OTP, exact device coordinates in ordinary audit output, secret, or unrelated sensitive content.
- Precise coordinates are processed only as required for verification; durable evidence stores the minimum needed to prove result, distance, accuracy, method, and timestamp.
- Existing consent evidence remains unchanged.
- Existing `Booking.customerMetadata` remains readable during rollout but cannot override authoritative records.

### Existing-record treatment

| Existing record | Planned treatment |
|---|---|
| Completed/archived record | Preserve historical behavior and media; do not fabricate a retroactive assessment or customer decision. |
| Active record with no recording started | Require manager assessment before further release/capture. |
| Active record with accepted permission but incomplete legacy scope | Keep prior evidence; require assessment. If the completed scope cannot be proven identical, supersede and request a new verified decision. |
| Active record with uploaded stages | Preserve Private media and prevent broader access; manager/admin review determines the safe continuation path without rewriting history. |
| Vendor-address active record | Do not infer vendor-only scope from address alone; require assessment. |

The migration must be rehearsed against a production-shaped database copy before beta application. Rollback must restore the prior package while leaving additive tables harmless and unread by the prior application.

## 9. Expected Files Affected

The final implementation is estimated at **45-70 files**, including tests and Project Management evidence. Exact paths may narrow after implementation begins; no unrelated file is authorized.

### Routes and pages

- `src/app/vendor/jobs/page.tsx`
- `src/app/vendor/jobs/[jobId]/page.tsx`
- `src/app/employee/jobs/page.tsx`
- `src/app/consent/[token]/page.tsx` only where the approved scope summary must expand
- `src/app/admin/permission-audit/page.tsx`
- A focused admin/support location-review page or panel only if the existing permission-audit surface cannot safely contain it

### APIs

- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- New narrowly scoped assessment/authority/certification/location-review endpoints under the existing booking/vendor/employee ownership boundaries
- `src/app/api/consent/request/route.ts`
- `src/app/api/consent/requests/[requestId]/recipient/route.ts`
- `src/app/api/employee/jobs/route.ts`
- `src/app/api/employee/jobs/[jobId]/start/route.ts`
- `src/app/api/employee/jobs/[jobId]/stage/route.ts`
- `src/app/api/employee/jobs/[jobId]/verify-location/route.ts`
- `src/app/api/employee/jobs/[jobId]/complete/route.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/init/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/proxy/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`
- `src/app/api/vendors/[vendorId]/dashboard/route.ts`
- `src/app/api/admin/permissions/*` and a location-review API if needed

### Database

- `prisma/schema.prisma`
- Two new additive migration directories
- Migration validation fixtures/scripts only where repository conventions support them

### Components

- New focused work-record assessment stepper/components rather than further enlarging the vendor jobs page
- Scope summary card used by vendor, customer, employee, and admin views
- Authority-holder selection and status component
- Employee certification panel and per-stage reminder
- Canonical blocked-reason panel with responsible actor and recovery action
- Location verification/retry and alternate-review status component

### Notifications

- Existing booking notification queue and worker
- `src/lib/notifications/send-consent-link.ts`
- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/send-job-assignment.ts`
- New focused notice-only, material-change, reassignment/certification, and location-review notification helpers
- No SMS handset success claim while Telnyx remains an external dependency

### Shared libraries

- `src/lib/consent/recording-gate.ts`
- `src/lib/consent/request-service.ts`
- `src/lib/consent/content-version.ts`
- `src/lib/job-assignment.ts`
- `src/lib/job-recording-location.ts`
- New recording assessment, authority, certification, material-change, and aggregate-gate services
- Existing actor, membership, ownership, audit, hashing, and notification helpers from Epic 3/Epic 1

### Middleware and authorization

- No broad middleware redesign is expected.
- Existing route guards remain.
- New endpoints must use current database-derived actor, exact vendor membership, manager role, employee assignment, customer ownership, or admin grant as applicable.

### Tests

- Unit tests for assessment, scope hash, material-change detection, aggregate gate, location, certification, and public-summary minimization.
- Integration tests beside every changed route family.
- Playwright tests for vendor, customer, employee, and admin states.
- Migration/backfill validation.
- Focused Epic 1, Epic 2, and Epic 3 contract regression.
- No broad RR-1A A2/A4/A6/A7 live replay until Epic 5 is complete.

### Documentation and Project Management

- `Project Management/Epic 4 - Universal Work Record and Recording Gates/01_Engineering_Report.md`
- `02_UX_Review.md`
- `03_Product_Owner_Demo.md`
- `04_Lessons_Learned.md`
- `05_Technical_Debt.md`
- `06_Checklist_Snapshot.md`
- `07_Git_Checkpoint.md`
- `08_Screenshots/` plus a screenshot index
- `Project Management/PROJECT_DASHBOARD.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md` only after implementation evidence exists

## 10. Security and Privacy Considerations

1. Rebuild actor, ownership, membership, assignment, authority, permission, certification, and location decision from current database state for each protected request.
2. Ignore client claims such as `permissionRequired`, `recordingUnlocked`, role, vendor, authority, scope, and location success.
3. Bind every scope, permission, certification, and exception decision to booking/vendor and immutable hashes/generations.
4. Require manager authority to create/edit assessments and submit exceptions.
5. Require current assigned employee membership to certify or record.
6. Require database-backed admin/support authority to decide alternate-location review.
7. Prevent the requester from approving their own exception.
8. Do not expose raw permission secrets, OTPs, contact values beyond masking, exact coordinates, protected-person details, or private media in status payloads.
9. Use idempotency and transactions for assessment completion, supersession, certification, and exception decisions.
10. Fail closed for stale scope, stale certification, uncertain authority, missing digital channel, failed location, mismatch, dispute, or concurrent changes.
11. Record consequential denial and override attempts without logging sensitive payloads.
12. Preserve Private as a complete outcome and never create Public media from a gate decision.

## 11. UX Considerations

### Vendor

- Use one short branching flow: location, subject, people/sensitive details, audio, frame control, authority, summary.
- Do not display every possible risk question at once.
- Show why each follow-up appears and the exact consequence.
- Show one next action and one current responsible participant.
- Clearly distinguish `Customer notice` from `Customer permission required`.
- Make `Service can continue without recording` visible wherever applicable.

### Customer

- Reuse Epic 1 education-first permission experience.
- Show the new exact planned scope in plain language.
- Explain that videos start Private and public sharing is a separate later decision.
- Do not imply authority over every person at a residence or business.

### Employee

- Show approved subject, approved area, audio state, people to avoid, identifiers to avoid, and stop conditions before camera access.
- Keep certification short and durable; use a three-line reminder before each stage.
- A blocked page names the reason, responsible participant, and whether service may continue without recording.
- GPS failure must distinguish permission denial, poor accuracy, distance mismatch, missing address, and pending admin review.

### Admin/support

- Show failed attempts, accuracy, reason, alternate evidence, scope, actor, and conflict-of-interest controls.
- Approve or deny location evidence only; never infer or replace customer/guardian/person authority.

### Accessibility and cognitive load

- Stable step dimensions and no layout shift.
- Keyboard and screen-reader operation for every decision.
- Mobile-first employee controls with no overlapping text/buttons.
- No page presents more than one primary decision.
- No privacy/audio/decline consequence is hidden behind an expandable section.

## 12. Backward Compatibility

- Preserve existing booking IDs, assignments, permission evidence, links, customer claims, media sessions, and completed records.
- Preserve Epic 1 permission lifecycle and Epic 3 actor/authorization boundaries.
- Preserve current API response fields while adding canonical status fields; deprecate metadata-derived fields only after all consumers migrate.
- Preserve three stage names and audio-off capture.
- Preserve current employee assignment links; reassignment invalidates former access and requires replacement certification.
- Do not convert legacy no-permission states into permission.
- Do not infer vendor-only scope from a legacy vendor address.
- Do not expose existing Private media or change publication state.
- Keep the prior application compatible with additive migrations for rollback.

## 13. Risks and Controls

| Risk | Control |
|---|---|
| Large vendor jobs page creates regression blast radius | Extract focused components/services; characterize current create/assign/release behavior before edits. |
| Duplicate gate decisions drift | One aggregate server service; contract tests compare every consumer. |
| Legacy active records become misleadingly unlocked | Mark assessment required; never infer subject; preserve completed history. |
| Scope change races with upload | Transactional generation/hash check at session and upload boundaries. |
| Residence GPS exposes private location | Store only minimum verification evidence and protect exact address/coordinates by ownership. |
| Manager self-approves exception | Separate requester and reviewer authorization; database constraint/service enforcement. |
| Vendor-address friction becomes excessive | Branch Level 1 vendor-only path to notice and manager reconfirmation without unnecessary customer OTP. |
| Customer/business representative treated as authority over people | Explicit separate-person rule in assessment, scope, UI, and tests. |
| Guardian path is abused | Heightened verification, necessary Private-only scope, manager review, no Public eligibility. |
| Telnyx unavailable | Preserve email channel and truthful queued/failed SMS status; handset validation remains external dependency. |
| Frozen copy conflict | Stop before changing product/legal result; use Language Guide and approved workflow only. |

## 14. Rollback Strategy

1. Package the prior beta commit and new Epic 4 commit as deterministic allow-list artifacts.
2. Apply only additive migrations after restore capability and a production-shaped rehearsal are verified.
3. Deploy behind server-readiness/config gating if needed, with new writes enabled only after schema health passes.
4. If application smoke fails, remount the prior package. Additive tables remain unused by the prior application.
5. Do not roll back by deleting assessment, permission, certification, location, or audit evidence.
6. If a partial workflow produces uncertainty, globally keep new recording unlocks closed while ordinary service records remain available.
7. Record rollback reason, affected records, and reconciliation steps in the Engineering Report and Git checkpoint.

## 15. Test Plan

### Unit and decision matrix

- Four assessment levels and every answer-to-action rule.
- Three locations crossed with vendor property, customer property, person, minor, bystander, interior, sensitive data, identifier, and audio.
- Scope canonicalization and stable hash.
- Material-change list from `PO-01`.
- Permission basis and authority requirements.
- Employee certification validity/invalidation.
- Aggregate gate reason priority and responsible actor.
- Location distance, poor accuracy, missing snapshot, retries, and approved/denied exception.

### API and integration

- Manager-only assessment create/edit/finalize.
- No permission request before complete assessment and authority identification.
- Notice-only vendor-property path.
- Vendor person-centered path requires verified permission.
- Residence and customer-business always require verified permission.
- Wrong customer/vendor/employee/admin IDOR attempts.
- Assignment and reassignment invalidation.
- Material change supersedes accepted permission and certification.
- Certification cannot be created by wrong/revoked employee.
- Manager cannot approve alternate location; admin/support can decide only after complete evidence.
- Canonical gate blocks job start, media session, upload init, proxy, completion, and stage endpoints consistently.
- Permission/certification/location events create no review, rating, Trust Score input, publication approval, or Public media.

### Migration

- Fresh database.
- Current beta-shaped schema/data.
- Completed legacy records unchanged.
- Active legacy records require assessment without losing ownership/assignment/media.
- Re-run/idempotency and rollback package compatibility.

### Playwright and browser

- Vendor creates each location/scope path.
- Customer receives notice or verified request as appropriate.
- Employee sees blocked/allowed states and certifies on desktop/mobile.
- Reassignment removes former employee access.
- Material change returns workflow to blocked.
- GPS success, poor accuracy, mismatch, and pending exception.
- Admin reviews alternate location.
- Browser refresh/reopen preserves truthful state.
- Direct route and role isolation.

### Regression and quality gates

- TypeScript.
- Lint for changed files and full lint where feasible.
- Focused unit/integration suites.
- Epic 1 permission and recording-gate regression.
- Epic 2 shell/language/navigation regression.
- Epic 3 actor/ownership/membership/IDOR regression.
- Current booking, assignment, media-session, upload, notification, and dashboard regressions.
- Playwright desktop/mobile.
- Production build with established heap setting.
- `npm audit --omit=dev` report without unrelated upgrades.
- `git diff --check`.
- Deterministic allow-list package inspection if deployment is later approved.

Only executed results may be reported. Full A2/A4/A6/A7 live replay remains deferred until Epic 5 completion.

## 16. Screenshot Plan

Capture an indexed, redacted package at desktop and mobile viewports. Estimated total: **30-40 screenshots**.

### Vendor

- Location selection.
- Low-risk vendor-only assessment.
- Person-centered vendor-address assessment.
- Residence assessment.
- Customer-business assessment.
- Authority holder and scope summary.
- Notice queued/sent/failed.
- Permission pending/allowed/declined/no-channel.
- Material-change warning and superseded status.
- Reassignment/certification status.

### Customer

- Scope-specific permission summary.
- Notice-only message.
- Guardian/private-minor restriction.
- Allowed, declined, wrong recipient, expired/superseded.

### Employee

- Assigned scope summary.
- Certification.
- Per-stage reminder.
- Recording allowed.
- Permission blocked.
- Certification stale after reassignment/change.
- GPS success, poor accuracy, mismatch, and pending review.

### Admin/support

- Location-review queue.
- Complete evidence.
- Approve/deny and conflict block.

### State coverage

- Loading, empty, success, failure, blocked, retrying, and mobile layouts.
- Before/after comparisons only where the same state/build/viewport can be reproduced.

## 17. Product Owner Demo Checklist

| Validate | Exact action and expected observation |
|---|---|
| Vendor-only property | Create a vendor-address record limited to vendor-owned property/work area. Observe customer notice, no customer decision request, assignment/certification/location gates, and Private-only initial state. |
| Vendor person-centered | Change the vendor-address subject to an identifiable person. Observe verified customer/person permission becomes required and recording remains locked until allowed. |
| Customer property at vendor | Select customer-owned property at vendor address. Observe customer permission is required despite the location. |
| Customer residence | Create a residence record. Observe verified permission, residence authority, immutable address snapshot, employee certification, and residence GPS all required. |
| Customer business | Create a business record. Observe representative premises/property authority and separate people/confidential-content restrictions. |
| Audio | Request audio. Observe default-off warning and recording blocked until every required speaker authority exists; ordinary video remains audio off. |
| Minor | Mark an identifiable minor as necessary. Observe guardian verification and manager review required for Private scope and no Public eligibility. |
| Decline/no channel | Decline or remove both digital channels. Observe recording locked and service can continue without recording unless the approved prior-disclosure exception applies. |
| Assignment | Assign an active employee. Observe no release until current scope/permission gates are satisfied. |
| Certification | As the assigned employee, review scope and certify. Observe durable certification and short stage reminders. |
| Reassignment | Reassign to another employee. Observe old link/access/certification unavailable and new employee must certify. |
| Material change | Change location, subject, planned people, audio, authority, service scope, risk, capture-changing category, or recreate the record. Observe prior permission/certification superseded and recording locked. |
| Location success | Verify each of the three saved locations with controlled coordinates. Observe the same canonical allowed status across vendor and employee views. |
| Location failure | Produce poor accuracy and distance mismatch. Observe truthful retry guidance and no camera/session/upload. |
| Alternate review | Manager submits complete alternate evidence. Observe manager cannot approve; admin/support approves or denies and history is immutable. |
| Canonical enforcement | Attempt vendor release, employee start, camera/session creation, upload init/proxy/complete while one gate is unsatisfied. Every path must return the same block family. |
| Dashboard state | Compare vendor, employee, customer, and admin views. Observe one scope/version/status and one responsible next participant. |
| Database state | Inspect assessment generation/hash, authority, notice/request, consent evidence, assignment, certification, location attempts, exception, and supersession without raw secrets. |
| Notifications | Verify correct notice/request/assignment/material-change/location-review recipients, masked contacts, retry state, and no false SMS success. |
| Trust Score | Confirm assessment, permission, decline, no-channel, certification, location, and exception events create no Trust Score input. |
| Reviews | Confirm no review or rating is created and review availability is unchanged. |
| Public media | Confirm no publication approval or Public media is created; every new recording remains Private. |
| Audit history | Reconstruct each consequential event by actor, authority, scope version, time, and result. |
| Screenshots | Verify the indexed desktop/mobile/loading/success/failure/blocked package is readable and redacted. |

## 18. Regression Statement Plan

The final Engineering Report must include `REGRESSION STATEMENT` with:

### Existing functionality intentionally preserved

- Epic 1 verified permission links, OTP, identity, authority declaration, allow/decline, correction, resend, supersession, and canonical permission evidence.
- Epic 2 public/role shell, language, and navigation.
- Epic 3 Phase A actor, ownership, membership, admin isolation, and IDOR protection.
- A5 customer registration and permission-link onboarding.
- Current assignment, three-stage naming, audio-off capture, Private media, and notification worker.

### Existing functionality intentionally unchanged

- Reviews and ratings.
- Trust Score.
- Exact-media Public publication.
- Retention/deletion/disputes.
- AI decision authority.
- Vendor/employee legal-document governance.
- Epic 3 Phase B identity lifecycle.

### Areas verified unaffected

- Customer, vendor, employee, and admin route isolation.
- Completed/archived records.
- Existing valid permission evidence.
- Public/private media filtering.
- Review ownership/moderation.
- Notification worker authentication.
- Beta packaging and startup.

### Potential regression risks reviewed

- Vendor-address permission behavior.
- Active legacy record migration.
- Assignment/reassignment.
- Residence address privacy and GPS.
- Scope supersession concurrency.
- Upload bypasses.
- Dashboard status drift.

### Known unrelated issues

Record only observed issues with evidence. Do not silently fix them or attribute them to Epic 4.

## 19. Engineering Deliverables

Epic 4 cannot be called complete until all are present:

1. Implemented end-to-end work-record and gate experience.
2. Additive migrations and migration evidence.
3. Unit, integration, Playwright, type, lint, security, build, and regression results.
4. Desktop/mobile screenshot package and index.
5. Four-role UX review.
6. Engineering Report with security/API/database/notification/AI/dashboard/legal/backward-compatibility/rollback sections.
7. Full Regression Statement.
8. Product Owner Demo instructions and recorded results.
9. Lessons Learned and Technical Debt.
10. Updated checklist snapshot and master checklist rows supported by evidence.
11. Updated Project Dashboard.
12. Scoped Git checkpoint and push.
13. Separate migration/deployment approval; no automatic beta deployment.

## 20. Estimated Implementation Sequence

### Step 1 - Characterize and freeze existing contracts

- Add characterization tests for current work-record creation, permission, assignment, release, media session, upload, location, dashboard, and role boundaries.
- Confirm all current consumers of recording state.

### Step 2 - Add scope and authority data foundation

- Create additive migration 1.
- Implement scope schema, assessment rules, authority requirements, generation/hash, and legacy treatment.
- Keep all new active records locked until assessment is complete.

### Step 3 - Implement vendor assessment experience

- Add branching location/subject/people/audio/frame/authority flow.
- Add summary and required notice/request selection.
- Preserve ordinary service creation when recording is unavailable.

### Step 4 - Integrate Epic 1 permission and material changes

- Expand immutable scope content.
- Add vendor-only notice path.
- Add general material-change supersession.
- Preserve 48-hour request rules and accepted-decision validity.

### Step 5 - Add certification and location evidence

- Create additive migration 2.
- Add employee certification and invalidation.
- Extend GPS verification to residence.
- Add attempt evidence and manager-request/admin-decision exception path.

### Step 6 - Build the aggregate canonical gate

- Compose assessment, authority, permission, assignment, release, certification, location, audio, guardian, and incident state.
- Replace metadata/UI-derived authorization with the server decision at every required consumer.

### Step 7 - Complete role UX and notifications

- Vendor next action/status.
- Customer scope summary and notice/permission continuity.
- Employee blocked/allowed/certification/reminder states.
- Admin location evidence/decision.
- Notification queue, retry, and audit updates.

### Step 8 - Validate migration and security

- Production-shaped migration rehearsal.
- Decision matrix, IDOR, concurrency, no-secret, and non-creation tests.
- Focused Epic 1-3 contract regressions without executing deferred full RR replays.

### Step 9 - Visual and experiential validation

- Playwright desktop/mobile.
- Screenshot package.
- Four-role UX and cognitive-load review.
- Fix only Epic 4 defects.

### Step 10 - Quality gates and records

- TypeScript, lint, tests, security audit, production build, and `git diff --check`.
- Engineering Report, Regression Statement, Demo, Lessons, Debt, Checklist Snapshot, Dashboard, and Git checkpoint.
- Stop for Product Owner approval before migration/deployment and before Epic 5.

## 21. Approval Gate

Product Owner approval of this plan authorizes implementation of Epic 4 only. It does not authorize:

- deployment;
- production/beta migration application;
- Epic 5;
- Epic 3 Phase B;
- full A2/A4/A6/A7 replay;
- changes to frozen documents; or
- unrelated fixes.

If approved, implementation begins at Step 1 and stops after the complete Epic 4 evidence package for a separate Product Owner decision.
