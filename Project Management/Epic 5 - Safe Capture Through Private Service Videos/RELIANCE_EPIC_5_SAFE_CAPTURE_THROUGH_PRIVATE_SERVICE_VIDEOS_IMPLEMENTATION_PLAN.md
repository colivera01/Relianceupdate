# Reliance Epic 5 - Safe Capture Through Private Service Videos Implementation Plan

**Status:** Approved and implemented; Product Owner replay pending
**Planning baseline:** `98c50ae727839d353f0eb357b39ca5c5761bf7ac`
**Planning date:** 2026-08-05
**Implementation authorization:** Product Owner approved implementation on 2026-08-05. Deployment and production-data changes remain unauthorized.

## 1. Scope Confirmation

Epic 5 will deliver one complete, testable experience:

> An assigned and certified employee records the three approved service stages, safely recovers from capture or upload problems, submits the package, responds to a manager correction when required, and delivers manager-approved Private proof to the authorized customer.

The experience begins only after the Epic 4 canonical recording gate returns an allowed decision. It ends when the customer can view the manager-approved Private proof. Private is a complete outcome.

### Included

- Starting Condition, Work in Progress, and Final Result capture.
- Audio off by default.
- Thirty-second maximum per stage.
- Live preview, retake, retry, replacement, and accurate stage progress.
- Assigned-employee and current-work-record enforcement at every media mutation.
- Server-verified media type and duration.
- Durable content identity, provenance, stage version, replacement lineage, and package state.
- Recoverable upload behavior without duplicate accepted assets.
- Safe handling of accidental capture, material scope change, reassignment, and interrupted recording.
- Employee package submission.
- Vendor-manager review, stage-specific correction, resubmission, and Private approval.
- Customer access to all manager-approved Private stages.
- Approved Private download roles and notices.
- Submission, correction, and Private-proof-ready notifications.
- Audit evidence, diagnostic observability, real-device validation, screenshots, and role-journey documentation.

### Explicitly excluded

- Exact-media Public approval or Public publication.
- Admin Public moderation changes.
- Withdrawal, disputes, retention, legal hold, or physical deletion redesign.
- Minor or guardian workflow redesign beyond enforcing existing Epic 4 restrictions.
- Recording-permission redesign, new permission authority, or weaker recording gates.
- Authentication, session, account-switching, or role-isolation redesign.
- Reviews, ratings, synthetic activity, or review deadlines.
- Trust Score redesign or new Trust Score inputs.
- AI analysis of raw video.
- Policy or agreement rewrites.
- Epic 3 Phase B, Epic 6, or any later roadmap epic.

If implementation requires any excluded capability or conflicts with a frozen requirement, work stops for Product Owner review.

## 2. Success Definition

Epic 5 is complete only when all of the following are true:

1. Only the currently assigned, active, authorized employee can capture media for an unlocked work record.
2. Every capture and upload boundary uses the Epic 4 canonical recording decision and fails closed when the decision is uncertain or blocked.
3. All three stages support preview, confirm, retake, retry, and replacement without losing confirmed stages or creating duplicate current assets.
4. Audio is absent by default and cannot be enabled by an accidental browser default.
5. Every accepted asset has server-verified type, duration, content hash, provenance, stage, version, lineage, and storage identity.
6. Prerecorded fallback media, when allowed, is clearly identified, receives enhanced manager review, and remains permanently ineligible for Public proof.
7. Manager correction names the affected package version and stage or stages; unrelated accepted stages remain intact.
8. Manager approval creates customer-visible Private proof without creating Public media or requiring Public moderation.
9. The authorized customer can view all approved Private stages and use only the approved customer download path.
10. The vendor manager may use the approved Private download path; the employee cannot download the package after submission.
11. Notifications arrive once per consequential state transition, use working secure links, and do not imply publication or review activity.
12. No permission event, recording event, or Private approval creates a review, rating, Public media item, publication approval, or synthetic Trust Score input.
13. The supported physical-device and weak-network matrix passes or returns truthful, recoverable failures.
14. Required engineering, UX, screenshot, checklist, dashboard, technical-debt, lessons-learned, and Git evidence is complete.

## 3. Checklist Items Included

The approved roadmap names this experience as `Epic 6: Safe Capture Through Private Proof` because it predates the approved reordering. The permanent Project Management sequence names it `Epic 5 - Safe Capture Through Private Service Videos`. These names refer to the same experience. This plan does not rewrite the frozen roadmap.

The roadmap also references `VID-*` rows that do not exist as literal identifiers in the current master checklist. No checklist rows will be invented. During implementation, the Epic 5 checklist snapshot will map the roadmap requirements to the current master rows below.

| Current checklist area | Epic 5 contribution |
|---|---|
| `PROD-05` | Complete the employee recording, manager review/correction, and customer Private-proof UX states in scope. |
| `PROD-06` | Verify labels, focus, announcements, contrast, and media controls for the affected journey. |
| `PROD-10` | Show customer Private-proof readiness and access from one confirmed source. |
| `PROD-11` | Keep manager-review cards, counts, correction states, and Private approval synchronized. |
| `PROD-12` | Show approved scope, audio state, stage, block reason, recovery action, and submission state. |
| `PROD-13` | Preserve admin role boundaries and ensure Private proof does not enter Public moderation. |
| `ADM-04` | Preserve canonical admin authorization on any affected evidence view. |
| `SEC-02`, `SEC-03`, `SEC-06`, `SEC-09` | Preserve database-derived authority, IDOR protection, minimized responses, and durable evidence. |
| `TEST-01` through `TEST-07` | Add rule, integration, role-journey, device, accessibility, gate, and media-integrity coverage. |
| `TEST-09` through `TEST-11`, `TEST-14` | Validate notifications, authorized decisions, regressions, and the affected security surface. |
| `SHOT-01` through `SHOT-05`, `SHOT-07` through `SHOT-10` | Produce controlled customer, vendor, employee, responsive, state, comparison, indexed, and UX evidence. |
| `DOC-01` through `DOC-07` | Complete the required engineering and four-role experience package for this epic. |

Shared checklist rows will move only as far as the evidence supports. Epic 5 completion will not incorrectly mark release-wide accessibility, security, legal, or operational rows Beta Ready.

## 4. Dependencies Verified

| Dependency | Required state before implementation or deployment |
|---|---|
| Epic 1 permission lifecycle | Permission decisions and their canonical recording effects remain authoritative and unchanged. |
| Epic 3 Phase A | Every protected request rebuilds actor, membership, ownership, and authority from current database state. |
| Epic 4 canonical recording gate | The same server-side decision controls release, camera availability, session creation, uploads, and status. |
| Epic 4 schema | Both approved additive migrations must be applied before an Epic 5 package that depends on their fields is mounted. |
| Employee certification | Current certification must be valid; reassignment or material change invalidates stale authority as already designed. |
| Location evidence | Existing location requirements remain enforced and cannot be bypassed by upload or fallback paths. |
| Capture rules | Three stages, thirty seconds per stage, audio off by default, preview before save, and stop-on-change behavior remain frozen. |
| Private/Public model | Version 1 has only Private and Public audience states. Epic 5 produces Private only. |
| Fallback rule | Prerecorded fallback is disclosed, enhanced-review, and permanently Public-ineligible. |
| Download rule | Customer/representative and vendor manager may use approved Private download paths; employee access ends after submission. |
| Storage | Azure blob operations, signed access, server-side probing, and idempotent completion must be operational in beta. |

## 5. Frozen Governing Documents

Implementation must follow, not rewrite, these baselines:

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`, especially Sections 7 through 10, 14 through 18, and the Final Workflow Verdict
- `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`, especially Product Owner decisions PO-04 through PO-08
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`, especially employee recording, manager review, customer video, and Private video states
- `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`

## 6. Current Repository Audit

The repository already contains substantial capture behavior. Epic 5 will consolidate and harden that implementation rather than replace it wholesale.

| Area | Current implementation | Epic 5 gap |
|---|---|---|
| Employee capture | Browser `MediaRecorder`, `getUserMedia`, native file fallback, preview, retry, and three stage cards exist. | Complete device behavior, contextual stop guidance, durable provenance, and stale-state recovery. |
| Stage limits | Client checks and server duration probing use the thirty-second rule. | Make all accepted paths consistent and prove boundary behavior with controlled media. |
| Recording gate | Epic 4 gate protects camera/session/upload boundaries. | Preserve it across every new replacement, package, fallback, and correction mutation. |
| Upload | Direct blob upload plus proxy fallback, MIME checks, duration declaration, and server probe exist. | Add durable hash/version/provenance, idempotency proof, orphan cleanup strategy, and truthful retry state. |
| Media identity | `MediaAsset` stores storage and moderation data; `MediaSession` stores stage/status. | No complete content hash, accepted-version lineage, replacement lineage, or capture provenance contract. |
| Package state | Three-stage completion and manager review behavior exist. | Package-version identity and correction targeting are not yet durable enough for later exact-media approval. |
| Manager review | Vendor can inspect stages, approve completion, or reject/request correction. | Make correction stage-specific, preserve unaffected stages, reconcile status fixtures, and separate Private delivery from Public moderation. |
| Customer proof | Customer pages and media/download APIs exist. | Manager-approved Private proof is currently entangled with visibility/moderation checks in some paths. It must be customer-visible without becoming Public. |
| Downloads | Customer and vendor media access paths exist. | Enforce the frozen post-submission employee denial and show clear Private-use notices. |
| Notifications | Submission, correction, and video-ready templates/workers exist. | Ensure one event per transition, correct secure link, retry evidence, and Private language. |
| Audit | Media/session and workflow evidence exists in several models/logs. | Consequential capture, replacement, approval, access, and download evidence is inconsistent. |
| Screenshots/devices | Historical phone captures exist. | Controlled Android/iOS, weak-network, denied-permission, role, and state packages remain open Epic 4 debt. |

## 7. End-to-End Experience Delivered

1. **Employee opens assigned work.** The page resolves current actor, assignment, certification, location, permission, scope, and gate decision.
2. **Recording is either unlocked or specifically blocked.** A block states why, who must act, what resolves it, and whether service may continue without recording.
3. **Employee selects the current stage.** The page restates the approved subject scope, audio-off state, stop rules, and stage objective.
4. **Employee records live media.** A visible indicator and elapsed time remain present; the browser does not request audio.
5. **Employee previews.** They confirm, retake, or discard. No upload is represented as saved before server confirmation.
6. **Media uploads.** The server rechecks gate, actor, assignment, stage, MIME, duration, storage identity, and duplicate/idempotency state before accepting it.
7. **Failure is recoverable.** A failed upload preserves the local preview where browser capabilities allow and offers a truthful retry. Refresh/reopen reconciles against server-confirmed stages.
8. **Employee completes all stages.** Progress is calculated from current accepted assets, not optimistic UI metadata.
9. **Employee submits the package.** The package version becomes manager-reviewable; employee download is no longer allowed.
10. **Manager reviews exact stages.** The manager may approve Private delivery or request correction for one or more named stages with a reason.
11. **Employee corrects only requested stages.** Replacement creates a new current version while preserving lineage and protected prior evidence according to existing retention boundaries.
12. **Manager approves Private proof.** This makes the approved package customer-visible and sends one proof-ready notice. It does not create Public media or admin Public moderation work.
13. **Customer opens Private proof.** The customer can view all three approved stages, understands that the proof is Private, and can use the approved download path and notice.

## 8. Expected Repository Impact

The exact file list will be finalized after baseline tracing. Expected areas follow.

### Routes and UI

- `src/app/employee/jobs/page.tsx`
- `src/app/vendor/jobs/page.tsx`
- `src/app/(user)/my-bookings/[bookingId]/page.tsx`
- Affected route-level loading, error, and empty-state components
- Shared media player, status, banner, stage, and action components if an established component already owns the behavior

### APIs

- Employee job start, stage, completion, and current-state routes
- Recording certification and location routes only if required to preserve current gate behavior
- Vendor media-session creation and session state routes
- Upload initialization, proxy, and completion routes
- Media detail and download routes
- Vendor manager approve, correction, and job-action routes
- Customer booking media and download routes

### Database

- `MediaAsset`
- `MediaSession`
- Existing work-record/package state models
- Additive media-version, decision, incident, or access-evidence models only where current models cannot safely represent the frozen rules

### Shared Libraries

- Canonical recording gate and reason mapping
- Vendor job media/package state
- Media visibility and Private access policy
- Stage guidance
- Azure blob storage
- Server duration probing
- New narrowly scoped media content-identity/version service if required

### Notifications

- Employee submission to manager
- Manager correction to employee
- Manager-approved Private proof to customer
- Existing worker/retry and delivery evidence paths

### Middleware and Authentication

- No planned behavior changes
- Regression-only verification of actor, membership, ownership, customer access, and admin boundaries

### Tests

- Unit and service tests for content identity, versions, package state, and access
- Route integration and authorization tests
- Browser capture/retry/reconciliation tests
- Real-device validation
- Epic 1 through Epic 4 regressions
- Production build and package verification

### Documentation

- Epic 5 Engineering Report
- Four-role UX Review
- Product Owner Demo and results
- Lessons Learned
- Technical Debt
- Checklist Snapshot
- Git Checkpoint
- Screenshot index and role journey summaries
- Project Dashboard and master checklist evidence updates after implementation

## 9. Database Migration Strategy

Expected: one or two additive migrations. No destructive cleanup is planned.

### Required durable concepts

- SHA-256 content hash computed or verified server-side.
- Capture provenance: live capture, approved prerecorded fallback, or legacy/unknown.
- Stage version number and current-version marker.
- Replacement lineage to the superseded asset.
- Package version and current review state.
- Manager correction targets and decision evidence.
- Capture/upload timestamps and immutable storage identity.
- Accidental-capture or quarantine state when required by the frozen workflow.

### Compatibility rules

- Existing valid media remains intact.
- Historical assets are not assigned invented provenance; they are labeled legacy/unknown where evidence is unavailable.
- Existing Public/approved media is not silently rewritten.
- Existing rejected or correction states are reconciled through a tested state transition, not bulk fabricated customer or manager activity.
- New nullable fields or additive records must permit safe rollout before application mounting.
- Migrations must be tested against a beta-like data snapshot, and rollback must preserve blobs and existing evidence.

The exact schema design will be documented before the first migration patch. Any requirement for destructive migration or retroactive evidence fabrication stops implementation for Product Owner review.

## 10. Security and Privacy Considerations

- Rebuild actor, active user, assignment, membership, ownership, and authority from the database on every protected request.
- Apply the canonical Epic 4 recording gate to session creation, upload initialization, proxy upload, upload completion, stage replacement, and package submission.
- Never trust client-reported stage completion, duration, MIME, role, assignment, visibility, or permission.
- Do not expose raw blob URLs. Use authorized server access or short-lived scoped delivery consistent with current architecture.
- Bind uploads to the correct work record, stage, assigned employee, session, package version, and idempotency key.
- Compute or verify content identity server-side after upload.
- Fail closed when assignment, permission, certification, location, scope, storage, or media verification is uncertain.
- Make prerecorded fallback permanently Public-ineligible at the data and policy layers, not only in UI copy.
- Restrict customer access to the authorized work record and manager-approved Private package.
- Restrict vendor access to the current vendor and manager authority.
- Deny employee download after submission.
- Audit consequential media creation, replacement, submission, correction, approval, access, and download without storing secrets or unnecessary personal data.
- Preserve the no-side-effect guarantees for reviews, ratings, Trust Score, publication approval, and Public media.

## 11. UX Considerations

### Employee

- Mobile-first controls with stable dimensions and no stage-card layout shifts.
- One obvious current stage and one primary action.
- Visible audio-off state and recording indicator.
- Short scope reminder before each stage; expandable detail only when helpful.
- Clear choices after capture: Use Recording, Retake, or Discard.
- Progress reflects server-confirmed stages.
- Upload failure explains whether the recording is still available locally and what retry will do.
- Every block uses the Epic 4 reason, responsible participant, resolution, and service-continuation rule.

### Vendor Manager

- One package version at a time, with three clearly labeled stages.
- Correction requires a reason and named stage or stages.
- Private approval explains that the customer can view the proof and that nothing becomes Public.
- Cards and counts refresh after every mutation without manual page reload.

### Customer

- The page immediately identifies the service, vendor, completion state, and Private audience.
- All three stages are easy to play without implying they are Public.
- Download notice explains the Private context in plain language.
- No publication prompt is added in Epic 5.
- Review remains optional and separate at its currently approved eligibility point.

### Admin

- Private proof does not enter Public moderation queues.
- Existing support/safety access remains role-limited, purpose-bound where supported, and audited.
- Admin views never suggest that Private approval authorizes Public use.

## 12. Notification Plan

| Trigger | Recipient | Required behavior |
|---|---|---|
| Package submitted | Vendor manager | One notice with the correct work record and manager-review destination. |
| Correction requested | Assigned employee | One notice identifying the service order and correction reason; secure link opens the current assigned work. |
| Corrected package resubmitted | Vendor manager | One notice for the new package version. |
| Private proof approved | Authorized customer/representative | One proof-ready notice with a secure customer destination and clear Private language. |
| Delivery failure | Vendor/operations as currently supported | Visible and audited retry state; no false success. |

Notifications must not mention Public publication, imply customer review activity, create deadline pressure, or reveal raw storage links. Provider delivery attempts and retries must be idempotent.

## 13. Backward Compatibility

- Preserve current work records, valid stages, genuine reviews, moderation history, and existing role relationships.
- Keep supported employee email links and customer service-record links working.
- Reconcile UI from server state after refresh, browser restart, or another actor's update.
- Treat old assets without sufficient provenance as legacy rather than inventing facts.
- Preserve existing manager decisions unless a tested compatibility rule requires a new package-version record.
- Do not change existing Public visibility or customer authorization as a side effect of Private-proof implementation.
- Do not require Epic 6 exact-media approval for Private customer delivery.

## 14. Risks and Controls

| Risk | Control |
|---|---|
| Duplicate assets after retry | Idempotency key, content identity, atomic current-version transition, and concurrency tests. |
| UI says saved before server acceptance | Server-confirmed progress only; pending and failed states remain distinct. |
| Stale assignment or permission during upload | Re-evaluate canonical gate at every media boundary. |
| Direct upload bypasses API policy | Bind signed upload to server-issued scope and require verified completion before acceptance. |
| Private proof accidentally enters Public moderation | Separate Private approval transition and explicit no-Public assertions/tests. |
| Fallback media later becomes Public | Durable provenance and permanent Public-ineligible policy. |
| Replacement loses evidence | Version/replacement lineage and non-destructive transition. |
| Browser refresh loses the stage state | Rehydrate from server-confirmed package state and preserve local retry only where safe. |
| Mobile browser camera differences | Physical Android/iOS matrix and truthful unsupported/denied states. |
| Large or malformed media harms availability | Size/type/duration controls, streaming/probe limits, and controlled failure tests. |
| Manager correction changes unrelated stages | Explicit targeted stages and package-version tests. |
| Customer sees another customer's proof | Ownership/representative checks and IDOR suite. |

## 15. Rollback Strategy

1. Use additive, backward-compatible schema changes before mounting new application code.
2. Keep old columns and records readable during the rollout window.
3. Build a deterministic allow-list Azure package and retain the previous known-good package.
4. If smoke tests fail, remount the previous package without reversing evidence-bearing migrations.
5. Disable only the newly introduced mutation path with an approved feature/configuration gate if rollback cannot safely remove accepted media versions.
6. Never delete blobs or accepted audit evidence during rollback.
7. Reconcile orphaned uploads through an audited maintenance operation after stabilization, not an emergency destructive script.

## 16. Test Plan

### Unit and service tests

- Stage and package transition matrix.
- Content-hash generation and duplicate behavior.
- Live/fallback/legacy provenance rules.
- Thirty-second boundary and malformed duration evidence.
- MIME and storage identity validation.
- Replacement lineage and current-version selection.
- Private visibility and approved download roles.
- No Public/review/rating/Trust Score side effects.

### API and integration tests

- Only assigned, active, certified employee may create a session or upload.
- Every Epic 4 blocked reason prevents every media mutation.
- Reassignment invalidates the former employee and enables only the newly assigned employee after all gates pass.
- Upload init, proxy, and completion enforce the same actor/resource/gate contract.
- Duplicate retries return one accepted current result.
- Interrupted upload and storage failure do not fabricate a saved stage.
- Three current stages are required for submission.
- Stage-specific correction preserves unaffected stages.
- Resubmission creates the expected package version.
- Manager Private approval exposes only the approved package to the authorized customer.
- Customer and vendor manager download succeed with notices; employee post-submission download fails.
- Private approval does not create admin Public moderation work.
- Notification transitions are idempotent and delivery failures remain visible.

### Browser and device tests

- Desktop manager and customer journeys.
- Android Chrome and iOS Safari employee capture where supported.
- Camera denied, GPS denied, poor accuracy, slow upload, interrupted network, retry, refresh, browser close/reopen, and expired local preview.
- Front/back camera selection only if already supported without changing the frozen workflow.
- Longest text, zoom, keyboard, focus, status announcements, and no horizontal overflow.

### Regression packages

- Epic 1 permission and canonical-decision regressions.
- Epic 2 proof-first shell and language regressions.
- Epic 3 actor, role, ownership, IDOR, admin-session, and direct-route regressions.
- Epic 4 location, authority, certification, scope-change, exception, and canonical-gate regressions.
- Existing review and Trust Score no-side-effect tests.
- TypeScript, lint where configured, Prisma validation/generation, production build with established heap setting, dependency audit, and `git diff --check`.

Only tests actually run will be reported as passed.

## 17. Screenshot Plan

All screenshots use synthetic data and are indexed/redaction-reviewed.

| Role/state | Desktop | Mobile |
|---|---:|---:|
| Employee assigned scope and unlocked stage | Optional context | Required |
| Recording active with audio off | Not applicable where camera is mobile-only | Required |
| Preview/retake/confirm | Optional | Required |
| Uploading, success, failure, and retry | Required | Required |
| Blocked with reason/owner/resolution | Required | Required |
| Three-stage progress and ready-to-submit | Required | Required |
| Manager review, correction, and Private approval | Required | Required |
| Customer Private proof loading, ready, empty, and failure | Required | Required |
| Authorized and denied download states | Required | Required |
| Before/after contextual capture copy | When a comparable baseline exists | When a comparable baseline exists |

The index will name commit, viewport, role, synthetic fixture, state, expected behavior, and redaction result.

## 18. Product Owner Demo Checklist

### Expected workflow

1. Sign in as the vendor manager and open a synthetic work record whose permission, assignment, certification, and location requirements are satisfied.
2. Open the employee link on a supported phone and confirm the correct service, scope, location, audio-off state, and Starting Condition stage.
3. Record Starting Condition, preview it, retake once, confirm it, and observe server-confirmed progress.
4. Record Work in Progress, interrupt the upload safely, retry, and confirm that only one current asset exists.
5. Record Final Result and submit all three stages.
6. Return to the manager account and observe the record move to manager review without manual refresh.
7. Request correction for one named stage and provide a reason.
8. Return to the employee link, confirm only the requested correction is actionable, replace it, and resubmit.
9. Approve the corrected package as Private proof.
10. Open the customer notice/link and confirm all three approved stages are visible and clearly Private.
11. Exercise the approved customer and vendor-manager download paths; confirm employee download is denied after submission.

### Expected notifications

- Manager receives one submission notice per submitted package version.
- Employee receives one correction notice with the current secure assignment link.
- Customer receives one Private-proof-ready notice with the correct secure customer link.
- A controlled delivery failure is visible and retryable without duplicate successful notices.

### Expected dashboard updates

- Employee stage progress changes only after server acceptance.
- Vendor record moves through Active Work, Manager Review, Correction Required, Manager Review, and Private Completed consistently.
- Customer service record shows Private proof ready after manager approval.
- Admin Public moderation count does not change.

### Expected database state

- Exactly three current approved stage assets exist for the final package.
- Retaken/replaced media has durable version and replacement lineage without becoming current twice.
- Every accepted asset has stage, provenance, server-verified duration, content hash, and storage identity.
- Package submission, correction, resubmission, and manager Private approval identify actor and version.

### Expected admin state

- Private proof does not enter Public moderation.
- Existing support/safety access remains limited and audited.
- Admin cannot convert the package to Public from any Epic 5 path.

### Expected customer state

- The authorized customer sees the correct work record and all three manager-approved stages.
- The page states that the proof is Private.
- Another customer and a signed-in wrong account cannot access the proof.

### Expected vendor state

- The manager sees the current package version, all stages, provenance warnings, and correction history.
- Private approval makes the proof customer-visible without creating Public media.
- Vendor-manager download uses the approved notice and authorization path.

### Expected employee state

- The assigned employee can record only while the canonical gate is allowed.
- The former employee is blocked after reassignment.
- Camera denial, location failure, permission decline, upload failure, and scope change each provide a specific recovery path.
- Employee download is denied after submission.

### Expected Trust Score behavior

- No synthetic Trust Score input is created by capture, correction, Private approval, download, or customer silence.
- Any existing approved operational input remains governed by the unchanged Trust Score implementation.

### Expected review behavior

- No review or rating is created automatically.
- Review remains optional and separate from media visibility.
- No deadline, countdown, or publication pressure appears.

### Expected audit history

- Reconstruct actor, assignment, gate decision, location, stage, recording/upload time, content identity, provenance, version, replacement, submission, correction, manager approval, access, and download.
- Confirm audit data contains no raw permission token, OTP, storage credential, or signed download secret.

### Expected screenshots to verify

- Employee mobile scope/unlocked, active recording, preview, uploading, failed/retry, all stages complete, correction, and blocked states.
- Vendor desktop/mobile review, correction, resubmission, and Private approval.
- Customer desktop/mobile loading, Private proof ready, playback, download notice, and denied access.
- Admin confirmation that no Public moderation item was created.

## 19. Regression Statement Plan

The final Engineering Report will include a dedicated `REGRESSION STATEMENT` that distinguishes:

- **Existing functionality intentionally preserved:** Epic 1 permission decisions, Epic 2 proof-first language/navigation, Epic 3 actor and role isolation, Epic 4 canonical gates, existing genuine reviews, current Public records, and current notification providers.
- **Existing functionality intentionally unchanged:** customer permission pages, account/session lifecycle, location policy, publication approval, withdrawal/dispute/retention, Trust Score formula, AI behavior, and legal documents.
- **Areas verified unaffected:** direct-route authorization, customer ownership, vendor membership, employee reassignment, admin isolation, review neutrality, Public filtering, and unrelated dashboards.
- **Potential regression risks reviewed:** upload retries, package status mapping, customer media visibility, fallback provenance, downloads, notifications, stale caches, and migration compatibility.
- **Known unrelated issues:** carried separately with owner, evidence, and target epic; none will be silently fixed or attributed to Epic 5.

## 20. Accepted Technical Debt Entering Epic 5

The following Product Owner-accepted Epic 4 items are in scope for evidence or correction:

1. Physical Android/iOS camera, GPS, upload, denied-permission, and weak-network matrix.
2. Complete customer/vendor/employee/admin screenshots for the affected journey.
3. Reconciliation of rejected-correction lifecycle fixtures with the frozen manager-review behavior.
4. Contextual capture copy that currently uses overly broad manager-review language in some blocked states.

Existing dependency advisories remain release-hardening work and will be observed but not broadly upgraded in Epic 5 without separate approval.

## 21. Estimated Implementation Sequence

1. **Baseline checkpoint.** Record repository, branch, commit, status, active migrations, Azure package baseline, and unrelated worktree items.
2. **Contract trace.** Freeze the current media/session/package transition table and enumerate every mutation/access boundary.
3. **Schema design review.** Propose the additive content identity, provenance, version, replacement, package, and incident evidence contract; stop for Product Owner review if destructive behavior is required.
4. **Shared media-state service.** Centralize current-version selection, package completeness, Private visibility, and no-side-effect rules without weakening the Epic 4 gate.
5. **Upload integrity.** Add server content identity, idempotent acceptance, consistent direct/proxy validation, and recoverable failure behavior.
6. **Employee capture UX.** Align mobile recording, preview, retake, retry, refresh/reopen, contextual stop guidance, and confirmed progress.
7. **Submission and package versioning.** Create an atomic three-stage submission contract and deny post-submission employee downloads.
8. **Manager correction and Private approval.** Implement stage-targeted correction, replacement lineage, resubmission, and customer-visible Private approval.
9. **Customer Private proof.** Align secure access, playback, Private labels, loading/empty/failure states, and approved downloads.
10. **Notifications and audit.** Make submission, correction, resubmission, approval, access, and download evidence consistent and idempotent.
11. **Automated regression.** Run focused tests, Epic 1 through Epic 4 regressions, security checks, type check, build, and package inspection.
12. **Physical-device validation.** Execute supported Android/iOS and failure matrices with synthetic records.
13. **Evidence package.** Capture screenshots, four-role UX review, journey summaries, technical debt, lessons learned, and Product Owner Demo results.
14. **Checklist and dashboard.** Update only evidence-supported rows after successful implementation and review.
15. **Scoped Git/deployment checkpoint.** Commit only Epic 5 work; deploy only with separate Product Owner authorization and verified migration ordering.

No later step begins when an earlier privacy, authorization, migration, or media-integrity gate fails.

## 22. Acceptance Criteria

- [ ] Current assigned employee and all Epic 4 gate requirements are enforced at every capture/upload mutation.
- [ ] Three stages each support preview, confirm, retake, retry, and replacement.
- [ ] Audio remains off by default and is absent from ordinary capture requests.
- [ ] Thirty-second maximum is enforced server-side for all accepted upload paths.
- [ ] Every accepted asset has durable content hash, provenance, stage, version, lineage, and storage identity.
- [ ] Upload retries and concurrent requests cannot create duplicate current assets.
- [ ] Refresh/reopen displays the server-confirmed state without unlocking an invalid action.
- [ ] Reassignment immediately blocks the prior employee.
- [ ] Fallback media receives enhanced manager review and is permanently Public-ineligible.
- [ ] Submission creates one manager-reviewable package version.
- [ ] Correction targets named stages and preserves unaffected stages.
- [ ] Manager approval creates customer-visible Private proof without Public moderation.
- [ ] Authorized customer sees all three approved Private stages; wrong customer is denied.
- [ ] Customer/representative and vendor manager have approved Private download paths and notices.
- [ ] Employee download is denied after submission.
- [ ] Notifications are accurate, idempotent, and use secure destinations.
- [ ] No review, rating, synthetic Trust Score input, publication approval, or Public media is created.
- [ ] Accessibility, responsive, physical-device, weak-network, and failure-state evidence is complete for the supported matrix.
- [ ] Epic 1 through Epic 4 regressions, type check, production build, and affected security tests pass.
- [ ] Engineering report, UX review, demo results, lessons, technical debt, checklist snapshot, Git checkpoint, screenshots, and dashboard updates are complete.

## 23. Expected Deliverables

1. Implemented Epic 5 experience.
2. Additive migrations and migration evidence.
3. Unit, integration, browser, device, security, regression, and build results.
4. Indexed desktop/mobile screenshot package.
5. Customer, vendor, employee, and admin UX review.
6. Engineering Report with the complete Regression Statement.
7. Product Owner Demo instructions and recorded results.
8. Customer, vendor, employee, and admin journey summaries.
9. Lessons Learned and Technical Debt records.
10. Updated Epic 5 Checklist Snapshot, master checklist, and Project Dashboard.
11. Scoped Git checkpoint and, only after separate approval, deterministic deployment evidence.

## 24. Approval Gate

No Epic 5 code, schema, migration, configuration, notification, test-fixture, deployment, or application-document change begins until the Product Owner approves this plan.

After implementation, Epic 5 stops for Product Owner review. Epic 6 does not begin automatically.
