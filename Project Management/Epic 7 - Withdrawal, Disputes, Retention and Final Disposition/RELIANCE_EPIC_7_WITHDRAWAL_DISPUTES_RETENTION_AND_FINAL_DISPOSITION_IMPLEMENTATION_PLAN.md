# Reliance Epic 7 Implementation Plan

## Withdrawal, Disputes, Retention and Final Disposition

**Status:** Product Owner review required; implementation is not authorized

**Prepared:** 2026-08-05

**Repository:** `colivera01/Relianceupdate`

**Branch reviewed:** `codex/epic3-beta-admin-grant-correction`

**Baseline commit:** `946ee5d2b981bf63afb93a5f0a30ddd528d3747c`

## 1. Scope Confirmation

Epic 7 will deliver one complete lifecycle experience after recording and publication:

1. An authorized participant can stop future recording.
2. An authorized participant can remove an eligible exact-media version from Reliance-controlled Public access immediately.
3. A participant can open a categorized concern about privacy, authority, identity, accuracy, service evidence, publication, or retention.
4. Reliance narrows access before investigating when the concern could create privacy, safety, identity, or integrity harm.
5. An admin can conduct a neutral, evidence-bound review without widening authority or rewriting prior decisions.
6. A materially affected participant can appeal a final case decision once through a separate reviewer path.
7. Private media, Public media, decision evidence, replaced/quarantined media, and held evidence receive truthful lifecycle deadlines.
8. A deletion request moves through requested, restricted, queued, attempted, verified, failed/retrying, held, denied, or completed states.
9. The platform reports physical deletion only after storage confirms the blob is absent.
10. The final disposition remains reconstructable without preserving Public exposure.

Epic 7 will not redesign or implement:

- recording permission identity or OTP;
- work-record assessment or recording gates except consuming an active withdrawal/dispute restriction;
- employee capture, stage upload, package submission, or manager review;
- exact-media proposal or approval rules;
- reviews, ratings, or Trust Score calculations;
- AI authority, automated dispute decisions, or AI legal conclusions;
- broad notification/help copy alignment assigned to Epic 10;
- legal-document rewriting or policy-version governance assigned to Epic 11;
- minor/guardian/public-redaction policy beyond enforcing existing Epic 6 eligibility restrictions;
- account/session lifecycle work deferred from Epic 3 Phase B; or
- Epic 8 dashboards and metrics redesign.

### Roadmap mapping

The frozen roadmap originally labels this experience as Epic 8 because Verified Permission Request was later moved to the first implementation position. The permanent Project Management workspace and approved current sequence name it **Epic 7**. Scope is unchanged: withdrawal, disputes, retention, deletion, holds, appeals, and final disposition.

## 2. Success Definition

Epic 7 succeeds only when all of the following are true:

- Authenticated Public withdrawal makes every Reliance-controlled public route and media link fail closed before any notification is attempted.
- Withdrawal adds a new immutable event and does not mutate or erase an earlier valid approval.
- No retained, held, disputed, archived, or soft-deleted media remains publicly available.
- A dispute restricts only the affected resource and audience unless evidence proves a broader restriction is required.
- Every case shows who is responsible, what happens now, and the next action.
- A hold identifies exact covered evidence, purpose, authority, start, review date, and release; it never becomes an indefinite unscoped flag.
- The approved retention rules are enforceable: Private media for 12 months after completion, Public media only while valid approval remains active, and listed durable decision/audit evidence for seven years.
- Physical deletion is queued, attempted, verified, retried on transient failure, and never reported complete while the blob remains.
- A failed purge is visible to authorized operations staff without exposing blob credentials or private media.
- Admin decisions, restrictions, appeals, notices, and final disposition are reconstructable.
- Withdrawal or dispute creates no review, rating, synthetic activity, Trust Score input, new publication approval, or Public media.
- Existing valid Private proof and Public evidence chains remain intact unless a valid lifecycle event narrows their access.

## 3. Checklist Items Included

Primary rows from the approved roadmap:

- `CON-16` through `CON-21`
- `VID-12`, `VID-16`, and `VID-18`
- `ADM-03`, `ADM-05`, and `ADM-06`
- `HELP-07`
- applicable portions of `SEC-05` and `SEC-08`
- `DEP-03`
- `TEST-13`
- `SHOT-01`, `SHOT-02`, `SHOT-04`, and `SHOT-07`
- applicable `DOC-01` through `DOC-08`

Shared rows receiving regression evidence but not automatically becoming Beta Ready:

- `PROD-10` through `PROD-13`
- `ADM-04`
- `TEST-09` through `TEST-11` and `TEST-14`
- `SHOT-05`, `SHOT-06`, `SHOT-09`, and `SHOT-10`

No row will be marked Beta Ready from local implementation alone.

## 4. Dependencies Verified

### Required engineering dependencies

| Dependency | Current evidence | Epic 7 use |
|---|---|---|
| Canonical actor, membership, ownership, and admin isolation | Epic 3 Phase A completed and deployed | Authorize every lifecycle request from current database authority |
| Canonical recording gate | Epic 4 completed and frozen | Stop future capture when recording permission is withdrawn or a blocking dispute is active |
| Exact package/version/content hash and Private access | Epic 5 completed and frozen | Scope retention, deletion, and evidence holds to exact media |
| Exact-media Public eligibility | Epic 6 completed and frozen locally | Invalidate Public service immediately and prevent stale links from serving |
| Durable notifications and attempts | Existing `BookingNotification` pipeline | Queue lifecycle notices after access restriction succeeds |
| Blob deletion primitive | Existing `deleteBlob(blobKey)` | Perform physical purge with independent verification and retries |
| Existing content reports | `ContentReport` and admin reported-content queue | Migrate or bridge active reports into the canonical dispute case without losing history |

### Release dependency boundary

Epic 6 migration/deployment/live replay remains a release gate. Epic 7 may be implemented against the approved Epic 6 schema, but Epic 7 cannot be deployed before all prerequisite migrations are applied in order and the Epic 6 Public path is operationally verified.

### Frozen product decisions

- Private media retention: 12 months after work-record completion.
- Public media: retained only while valid Public approval remains active, subject to platform limits.
- Listed consent, authorization, publication, withdrawal, audit, notification, moderation, deletion-outcome, and content-hash evidence: seven years.
- Authenticated publication withdrawal ends Reliance-controlled Public access immediately.
- Reliance does not promise deletion of copies made outside Reliance.
- Holds preserve only covered evidence and never preserve Public visibility.
- Verified customers/representatives and vendor managers have the approved Private download rights; employees do not download after submission.

## 5. Frozen Governing Documents

The following documents govern implementation and will not be modified:

1. `RELIANCE_PRODUCT_IDENTITY.md`
2. `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
3. `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md`
4. `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
5. `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
6. `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
7. `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
8. `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
9. `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`

If executable constraints conflict with a frozen rule, implementation stops and the conflict is presented to the Product Owner.

## 6. Current Repository Audit

### Current capabilities to preserve

- `PublicServiceVideoEligibility` already supports active status, invalidation time, and invalidation reason.
- `resolveCanonicalPublicAssetIds` revalidates the complete Epic 6 publication chain at read time.
- `/api/public/media/[assetId]` fails closed unless current canonical Public eligibility exists.
- `MediaAsset.deletedAt` and `archiveStatus` support current reversible soft archive behavior.
- `deleteBlob(blobKey)` provides an Azure deletion primitive and treats an already-absent blob as success.
- `ContentReport` records authenticated reports for a review or media asset and creates an admin notification.
- The admin reported-content queue supports first-pass status handling and AI summary assistance.
- Booking notification records already retain channel attempts and can support post-restriction notice delivery.
- Epic 5/6 evidence models preserve exact package, stage, manager, publication, and actor decisions.

### Current gaps

| Gap | Current behavior | Required Epic 7 correction |
|---|---|---|
| Publication withdrawal | No participant withdrawal route or durable withdrawal record | Authenticated scoped event that immediately invalidates canonical Public eligibility |
| Future recording withdrawal | Recording decisions exist, but no complete later-withdrawal lifecycle | New withdrawal event consumed by the canonical recording gate |
| Dispute model | `ContentReport` is a basic report queue | Canonical case, restriction, reviewer, evidence, decision, notification, and appeal history |
| Immediate restriction | Reports set `autoHidden: false` and do not consistently restrict Public media | Risk-based transactional restriction before notification or review |
| Deletion request | Vendor media DELETE soft-archives immediately and may be restored | Role-authorized request with truthful queue/hold/final states |
| Physical purge | Blob utility exists, but no durable job/attempt/verification lifecycle | Idempotent worker, scoped retries, verification, and final outcome |
| Retention | Policy copy is general; no canonical per-asset deadline scheduler | Material-specific retention deadline and active-approval rules |
| Holds | No scoped hold model | Minimum-scope hold with authority, reason, covered evidence, review, and release |
| Appeal | Admin page states appeals are not implemented | Neutral appeal record and separate authorized reviewer decision |
| Link revocation | Public route revalidates eligibility, but no dedicated withdrawal linkage | Eligibility invalidation plus cache-safe no-store/short-lived serving behavior |
| Audit integrity | Several local logs exist but no unified lifecycle chain | Immutable lifecycle event stream tied to actor, exact asset/version, and case |
| Storage truth | `deletedAt` reduces reported storage before blob deletion | Separate logical restriction from physical deletion and verified storage accounting |

### Existing behavior that must not be mistaken for final disposition

- Soft deletion is not physical deletion.
- Archive status is not a retention decision.
- A content report is not a resolved dispute.
- Notification creation is not notification delivery.
- Eligibility invalidation is not deletion of Private evidence.
- Blob delete invocation is not verified final purge unless post-delete absence is confirmed.

## 7. Canonical Lifecycle Model

Epic 7 will introduce one server-side lifecycle resolver for every media access decision.

```text
Current actor and authority
        |
Exact work record, package, version, and media
        |
Active withdrawal or audience restriction?
        |
Active dispute restriction?
        |
Active minimum-scope hold?
        |
Retention deadline and deletion state
        |
Epic 5 Private grant / Epic 6 Public eligibility
        |
Allowed audience, blocked reason, responsible participant, next action
```

No route or component may infer access from `visibilityStatus`, `deletedAt`, `archiveStatus`, a URL parameter, cached UI state, or notification metadata.

### Withdrawal states

`REQUESTED -> APPLIED` for immediate operational withdrawal. A withdrawal may later be `SUPERSEDED` only by a new separately authorized decision; the prior event remains immutable. Publication cannot silently reactivate.

### Dispute states

`DRAFT -> SUBMITTED -> RESTRICTED/UNDER_REVIEW -> INFORMATION_NEEDED -> DECIDED -> APPEALED -> FINAL`

Privacy, identity, authority, safety, and material-misrepresentation disputes restrict the affected Public audience immediately. Service-quality disputes do not automatically destroy or hide accurate Private evidence; the resolver applies the narrowest defensible restriction.

### Deletion states

`REQUESTED -> ACCESS_RESTRICTED -> RETENTION_REVIEW -> HELD | QUEUED -> ATTEMPTING -> VERIFYING -> COMPLETED`

Retryable failures use `RETRY_REQUIRED`; permanent or policy-bound outcomes use `DENIED` with a recorded reason and appeal path. `COMPLETED` requires verified blob absence.

### Hold states

`ACTIVE -> REVIEW_DUE -> RELEASED | EXTENDED`

Each hold applies only to listed evidence. It cannot preserve Public access and cannot prevent unrelated eligible evidence from following normal disposition.

## 8. Expected Files Affected

Exact paths may narrow during implementation. New files use the existing App Router, canonical actor, evidence, and notification patterns.

### Routes and pages

- `src/app/(user)/my-bookings/[bookingId]/page.tsx`
- new customer withdrawal/deletion/dispute status pages under `src/app/(user)/my-bookings/[bookingId]/`
- `src/app/vendor/jobs/page.tsx`
- new vendor lifecycle case/status surface under `src/app/vendor/jobs/[jobId]/`
- `src/app/employee/jobs/page.tsx`
- `src/app/admin/reported-content/AdminReportedContentClient.tsx`
- new admin lifecycle case/appeal queue and detail pages
- public service-video pages that must render withdrawn/restricted/not-found outcomes without leaking details

### APIs

- new participant withdrawal endpoint scoped to work record, recording, publication, or personal likeness
- new dispute create/read/status endpoint
- new deletion request/read/status endpoint
- new admin case decision, hold/release, purge retry, and appeal endpoints
- internal retention/deletion worker endpoint protected by the existing worker-secret pattern
- updates to `/api/public/media/[assetId]`
- updates to booking/vendor/customer media access and download routes
- updates to employee stage/session creation routes to consume active recording withdrawal/dispute restrictions
- bridge or compatibility updates for `/api/reports/content` and admin reported-content APIs

### Database

One additive migration is expected, potentially split into two only if SQL Server deployment safety requires it. Proposed durable entities:

- `MediaLifecycleCase`
- `MediaLifecycleRestriction`
- `MediaWithdrawalEvidence`
- `MediaRetentionSchedule`
- `MediaEvidenceHold`
- `MediaDeletionRequest`
- `MediaDeletionJob`
- `MediaDeletionAttempt`
- `MediaLifecycleAppeal`
- `MediaLifecycleAuditEvent`

Existing `ContentReport` rows will be preserved. The migration will add a nullable linkage or backfill evidence record rather than rewriting historical reports. Existing `MediaAsset.deletedAt` values will be classified as legacy soft archive; no blob will be deleted by migration.

### Components

- withdrawal education and consequence cards
- dispute category/intake form
- lifecycle status timeline
- deletion/retention/hold explanation panel
- admin evidence and decision panel
- appeal form and status panel
- shared reason-specific blocked state
- lifecycle status chips using Language Guide terms

### Notifications

- withdrawal applied and Public removal confirmed
- dispute submitted/restricted/information needed/decided
- deletion requested/held/queued/failed/completed/denied
- appeal submitted/decided
- final disposition

Notifications are queued after the access-changing transaction. Notification failure never restores Public access or marks deletion complete. Epic 10 remains responsible for broader template/help alignment.

### Shared libraries

- new canonical lifecycle resolver
- withdrawal service
- dispute and appeal service
- retention deadline service
- deletion queue and purge verification service
- scoped hold service
- lifecycle audit/hash helper
- lifecycle notification orchestration
- storage verification helper using safe metadata/existence checks

### Middleware and authorization

No broad middleware redesign is expected. New routes will use:

- `requireRequestActor`
- database-derived customer ownership/authority
- active vendor membership and manager role
- assigned employee limitations
- path-scoped admin session and active database admin grant
- internal worker secret for background processing

### Tests

- focused unit and route integration tests near each service/route
- lifecycle concurrency and idempotency tests
- cross-role authorization and IDOR tests
- worker failure/retry/verification tests
- Epic 1 through Epic 6 regression suites
- Playwright role journeys and lifecycle visual states

### Documentation

- Epic 7 Engineering Report
- four-role UX Review
- Product Owner Demo results
- Lessons Learned
- Technical Debt
- Checklist Snapshot
- Git Checkpoint
- screenshot index and controlled evidence package
- Project Dashboard and affected Beta Readiness Checklist rows

## 9. Database Migration Strategy

### Additive-only rules

- Create new lifecycle tables and indexes without dropping current fields.
- Do not mutate or delete existing media blobs during migration.
- Do not convert old soft-deleted assets into verified deletion outcomes.
- Preserve `ContentReport`, publication decisions, review records, and audit history.
- Backfill only factual classification such as `LEGACY_SOFT_ARCHIVED`; never fabricate withdrawal, customer request, delivery, or physical purge.
- Store evidence hashes and references, not raw tokens, OTPs, storage keys in UI payloads, or secrets.

### Compatibility period

`MediaAsset.deletedAt` and `archiveStatus` may remain for current UI compatibility, but they will no longer be treated as sufficient proof of deletion. The lifecycle resolver becomes authoritative for participant access and final disposition.

### Rollback rule

Application rollback may restore old screens, but rollback SQL must never:

- reactivate withdrawn Public eligibility;
- release a hold;
- mark an unverified purge complete;
- erase a dispute or appeal; or
- recreate a physically deleted blob.

## 10. API and Security Plan

### Authorization matrix

| Actor | May request | May decide | May never do |
|---|---|---|---|
| Customer/authorized representative | Stop future recording within authority; remove customer-authorized Public use; dispute; request deletion; appeal | Own scoped withdrawal and exact customer authority | Delete vendor evidence directly; act for unrelated people; republish |
| Vendor manager | Withdraw official business representation; dispute; request legitimate deletion; respond to case; appeal | Vendor representation and business-record position | Override customer/employee withdrawal; erase history; broaden audience |
| Employee | Withdraw personal-likeness Public use; report accidental capture/privacy issue; view assigned status | Own likeness decision only | Delete package; restore Public status; access cases outside assignment |
| Admin | Restrict; assign/review case; issue neutral decision; apply/release scoped hold; authorize retry; decide appeal when independent | Platform access, safety, integrity, and disposition eligibility | Invent consent; widen audience; silently republish; erase immutable history |
| Worker | Process due retention/deletion jobs | No policy authority | Create a hold, decide a dispute, or infer authorization |

### Request requirements

Every consequential request records:

- canonical actor and role;
- current authority/ownership/membership;
- work record, vendor, package, proposal, stage, media, and content hash when applicable;
- requested scope and reason;
- prior lifecycle state;
- resulting lifecycle state;
- IP address and user agent;
- evidence hash and timestamp;
- notification enqueue result without raw provider secrets.

### Fail-closed rules

- Uncertain identity or authority: reject without changing access.
- Valid authenticated Public withdrawal: restrict Public access transactionally, even when notification/storage systems are unavailable.
- Active high-risk dispute: narrow Public access first, then investigate.
- Database uncertainty at read time: do not serve Public media.
- Cache uncertainty after unpublish: public resolver remains authoritative and signed URLs remain short-lived.
- Purge uncertainty: state remains pending or retry required, never complete.

### Race and replay protection

- Use unique/idempotency constraints for repeated withdrawal, case, appeal, hold, and deletion commands.
- Serialize or transactionally compare lifecycle version before decisions.
- Prevent old admin screens or delayed workers from restoring a superseded audience.
- Recheck active hold immediately before blob deletion.
- Recheck blob absence after delete and before completing the job.

## 11. UX Plan

### Customer

- Separate cards for `Stop future recording`, `Remove from public view`, and `Request deletion`.
- Explain what changes, what does not change, and what happens if no action is taken before asking.
- Show immediate removal confirmation separately from deletion status.
- Show that Private proof is not made Public by retention.
- Explain outside-copy limits without alarming or blaming the customer.
- Provide dispute and appeal status with a clear responsible participant and next action.

### Vendor

- Show Public removal immediately on the affected work record.
- Preserve legitimate Private/business-record access unless the case restriction removes it.
- Distinguish customer withdrawal from service-quality disagreement and deletion review.
- Show what evidence is restricted, what response is requested, and the deadline if one exists.
- Never offer restore/republish actions that bypass a new Epic 6 approval chain.

### Employee

- Show whether recording is stopped and exactly why.
- Remove camera/session actions when future recording permission is withdrawn or a blocking dispute is active.
- Limit case details to the employee's role and assigned work.
- Allow personal-likeness withdrawal without granting broader package deletion authority.

### Admin

- Present exact media/version, current audience, actor authority, risk category, restrictions, hold scope, history, and affected participants.
- Keep restriction, dispute decision, hold, deletion authorization, and appeal as separate commands.
- Require reasons for consequential decisions.
- Prevent the original decision-maker from acting as appeal reviewer where the approved role model supports separation.
- Make `Public access already removed` visually primary when applicable.

### Truthful status vocabulary

Use plain terms from the Language Guide:

- Removed from public view
- Access restricted
- Under review
- Information needed
- Deletion requested
- Kept securely because a dispute or legal requirement is active
- Deletion queued
- Deletion retry required
- Physically deleted
- Final decision recorded

Do not use a single generic `Deleted`, `Blocked`, or `Pending` label for different lifecycle states.

## 12. Backward Compatibility

Intentionally preserved:

- valid recording permission and canonical gate evidence;
- all existing Private packages and access grants;
- all exact-media publication proposals and decisions;
- valid Public Service Videos until a real lifecycle restriction applies;
- genuine reviews and moderation state;
- Trust Score inputs and exclusions;
- vendor archive/restore for media that is not governed by a completed lifecycle case;
- current customer/vendor download authorization;
- existing content reports and admin notifications.

Compatibility changes:

- vendor soft archive will no longer claim physical deletion or final disposition;
- restore cannot override an active withdrawal, dispute restriction, hold, completed purge, or expired retention state;
- current Public links may stop serving immediately after lifecycle invalidation;
- old report records may display through a compatibility adapter until linked to a canonical case.

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Race between Public request and withdrawal | Withdrawn video may briefly serve | Transactional eligibility invalidation plus read-time lifecycle revalidation and short-lived/no-store delivery |
| Blob deletion before hold check | Evidence loss | Recheck active exact-scope hold in the deletion transaction immediately before storage action |
| Marking purge complete after provider failure | False customer assurance | Verify nonexistence; retry and expose operations state |
| Overbroad dispute restriction | Unnecessary loss of access | Category-specific restriction policy and exact resource/audience scope |
| Underbroad privacy restriction | Continued harmful exposure | Immediate Public restriction for privacy/identity/authority/safety categories |
| Legacy soft deletes misclassified | False deletion history | Label as legacy archive only; no fabricated request or physical outcome |
| Notification outage | Participants miss updates | Access change commits first; durable attempts retry independently |
| Appeal lacks reviewer independence | Unfair process | Record original reviewer and deny same-reviewer appeal decision where feasible |
| Retention scheduler scale or clock error | Early/late purge | UTC deadlines, dry-run inventory, due-job idempotency, clock-boundary tests |
| Rollback republishes withdrawn media | Privacy regression | Monotonic restriction records remain authoritative across rollback |
| Storage accounting diverges | Incorrect quotas/metrics | Count physical and logical states separately; reconcile after verified purge |
| Scope drifts into legal/AI redesign | Frozen baseline violation | Stop at factual notices and human decisions; defer policies and AI authority |

## 14. Rollback Strategy

1. Feature-gate new intake and admin commands independently from read-time safety enforcement.
2. Keep new tables additive and readable by the rollback build where possible.
3. Disable workers before rolling back code to prevent mixed-version job processing.
4. Preserve all restriction, withdrawal, hold, appeal, and deletion-attempt records.
5. Keep Public eligibility invalidated after rollback.
6. Reconcile any `ATTEMPTING` deletion job to actual blob state before resuming workers.
7. Never restore physically deleted blobs automatically.
8. Validate Private and Public routes against lifecycle restrictions before declaring rollback healthy.

## 15. Test Plan

### Unit tests

- lifecycle resolver precedence and reason codes;
- retention deadline calculation by material type;
- exact-scope hold matching;
- immutable audit/evidence hash generation;
- notification event selection;
- deletion retry classification;
- outside-copy and Private-retention copy helpers.

### API/integration tests

- customer, vendor, employee, and admin authority matrix;
- cross-customer, cross-vendor, cross-employee, and general-session-to-admin IDOR denial;
- Public withdrawal invalidates the exact eligibility before notification failure;
- old public route and media link stop serving;
- future recording withdrawal blocks session and stage creation;
- dispute category applies only the required restriction;
- service-quality dispute does not fabricate privacy withdrawal;
- active hold prevents physical deletion but not unpublishing;
- released hold returns eligible jobs to the queue;
- purge success requires blob absence;
- 404/already-absent blob is idempotent success with evidence;
- transient provider failure creates retry-required and never complete;
- duplicate requests/worker delivery are idempotent;
- appeal cannot rewrite original decision;
- account deletion and vendor suspension produce safe lifecycle outcomes;
- no lifecycle event creates review, rating, Trust Score input, publication approval, or Public media.

### Retention boundary tests

- Private media before and after 12 months;
- active Public approval before withdrawal;
- Public withdrawal regardless of retention age;
- seven-year durable evidence deadline;
- replaced/quarantined media with and without a scoped hold;
- timezone and exact-boundary behavior;
- concurrent hold release and purge attempt.

### Playwright journeys

- customer removes a Public stage and sees immediate confirmation;
- vendor sees Public removal and retained Private status;
- employee loses recording access after future-recording withdrawal;
- customer submits dispute and sees restricted status;
- admin reviews, requests information, decides, and processes appeal;
- deletion pending, held, failed/retrying, and completed states;
- mobile and desktop loading, success, failure, empty, and blocked states;
- browser refresh/back/reopen preserves confirmed state and does not repeat actions.

### Regression gates

- Epic 1 permission suite;
- Epic 2 shell/public-language suite;
- Epic 3 Phase A authorization and Playwright suite;
- Epic 4 canonical recording-gate suite;
- Epic 5 capture/Private proof suite;
- Epic 6 exact-media publication and public-serving suite;
- review and Trust Score non-creation tests;
- TypeScript, Prisma format/validate/generate, production build, standalone package inspection, dependency audit, and `git diff --check`;
- lint only if the repository has a valid lint command at execution time.

### Operational validation

- Azure worker authentication and unauthorized rejection;
- controlled notification provider outage;
- controlled blob purge success/failure/retry in nonproduction storage;
- cache/CDN/direct-route withdrawal verification;
- migration status and rollback-readiness evidence;
- storage accounting reconciliation;
- no secrets, raw links, storage credentials, or private media in logs/screenshots.

## 16. Screenshot Plan

### Desktop

1. Customer withdrawal education and consequence selection.
2. Customer immediate `Removed from public view` confirmation.
3. Dead public page/link after withdrawal.
4. Customer dispute intake and submitted status.
5. Vendor affected work-record status.
6. Employee recording blocked with exact reason/owner/action.
7. Admin case evidence and current restriction.
8. Scoped hold detail.
9. Deletion queued, retry-required, and physically deleted states.
10. Appeal intake and final outcome.

### Mobile

1. Withdrawal selection and confirmation.
2. Dispute form and status timeline.
3. Deletion status and retention explanation.
4. Employee blocked state.
5. Admin urgent restriction summary where supported.

### State coverage

- loading;
- empty/no active approval;
- success;
- validation failure;
- authorization blocked;
- notification failed but access already removed;
- active hold;
- purge failed/retrying;
- final disposition.

All screenshots use controlled synthetic data and an indexed redaction review. Before/after comparisons will be included only when the same state and viewport can be reproduced truthfully.

## 17. Product Owner Demo Checklist

| Area | Exact Product Owner action and expected result |
|---|---|
| Expected workflow | Open a synthetic Public Service Video as its verified customer, choose `Remove from public view`, confirm, and retry both the public page and direct media link. Both stop serving immediately. Then open a dispute, request deletion, exercise a scoped hold/release, complete a controlled purge, and submit one appeal. |
| Expected notifications | Disable one configured notification path during withdrawal. Public access still ends first. The notification remains queued/retryable and later records delivery or final failure without restoring access. |
| Expected dashboard updates | Refresh customer, vendor, employee, and admin views. Each shows the same canonical lifecycle state without stale Public or recording actions. |
| Expected database state | Inspect exact withdrawal scope, prior eligibility, restriction, case, hold, deadline, deletion request/job/attempt/verification, appeal, notification attempts, and immutable lifecycle event. No raw token, OTP, or secret appears. |
| Expected admin state | Admin can restrict, request information, decide, apply/release an exact-scope hold, retry purge, and decide an eligible appeal. Admin cannot widen participant authority, silently republish, or erase history. |
| Expected customer state | Customer sees what changed immediately, what remains Private, why deletion is separate, what happens if no action is taken, and that Reliance cannot control outside copies. |
| Expected vendor state | Vendor loses Public representation immediately, receives the permitted explanation, and retains only authorized Private/business-record access. No restore action bypasses a new Epic 6 chain. |
| Expected employee state | Employee cannot record after applicable future-recording withdrawal and cannot download, delete, restore, or republish submitted proof. Personal-likeness action stays limited to that authority. |
| Expected Trust Score behavior | Withdrawn media stops appearing as current Public evidence. No positive or negative score event is created merely from withdrawal, dispute, deletion, or silence. |
| Expected review behavior | A separate genuine review is neither fabricated nor silently changed/deleted by media withdrawal. Review-specific moderation remains separate. |
| Expected audit history | Reconstruct actor, authority, exact resource/version, withdrawal, access restriction, notices, dispute, evidence, decision, hold, deletion attempts, physical result, appeal, and final disposition. |
| Expected screenshots | Verify desktop/mobile withdrawal, dead Public link, customer/vendor/employee/admin states, dispute, hold, deletion pending/failure/retry/success, appeal, loading, empty, failure, and blocked evidence. |

## 18. Regression Statement Plan

The final Engineering Report will include a `REGRESSION STATEMENT` that distinguishes:

### Existing functionality intentionally preserved

- Epic 1 recording-permission flow and identity verification.
- Epic 3 role isolation and database authority.
- Epic 4 assessment, certification, location, and gate behavior.
- Epic 5 capture, upload, manager review, and Private proof.
- Epic 6 exact-media approvals, moderation, and immutable version chain.
- Genuine reviews, ratings, and current Trust Score inputs.

### Existing functionality intentionally unchanged

- registration and onboarding;
- public product shell and navigation;
- service definitions and work-record creation;
- AI feature authority and outputs;
- legal policy text;
- general account lifecycle and passkeys;
- broad notification/help language.

### Areas verified unaffected

- authorization and IDOR boundaries;
- Private proof access/download rules;
- recording gate reason codes;
- public discovery filtering;
- review and Trust Score non-creation;
- notification worker authentication;
- Azure allow-list package hygiene.

### Potential regression risks reviewed

- Public cache after withdrawal;
- concurrent lifecycle commands;
- storage accounting after logical/physical deletion;
- restore/archive compatibility;
- report-queue compatibility;
- rollback after irreversible purge;
- migration ordering behind Epic 5/6.

### Known unrelated issues

Only failures reproduced outside the Epic 7 diff and proven unrelated will be listed. They will not be silently fixed or represented as Epic 7 results.

## 19. Business, Legal, AI, Dashboard, and Notification Impact

| Area | Planned impact |
|---|---|
| Business | Gives participants real control over continued use while preserving defensible service evidence |
| Security/privacy | Narrows exposure promptly, preserves least-privilege access, and prevents false deletion claims |
| API | Adds lifecycle commands and applies canonical restrictions to existing media routes |
| Database | Additive lifecycle, retention, hold, deletion, appeal, and audit evidence |
| Notifications | Adds factual lifecycle events through the existing pipeline; no broad template redesign |
| AI | No new AI decision authority. Existing summary assistance may remain advisory and cannot set restrictions/outcomes |
| Dashboards | Adds truthful lifecycle state and action visibility only; Trust Score/dashboard metric redesign remains Epic 8 |
| Legal | No policy rewrite. UI uses frozen factual rules and approved periods; policy alignment remains Epic 11 |
| Backwards compatibility | Existing valid evidence remains; legacy soft archives are classified without fabricated decisions |

## 20. Estimated Complexity and Repository Impact

- **Complexity:** Very Large
- **Implementation risk:** High
- **Estimated files:** 45-70
- **Estimated migrations:** One additive migration; two only if SQL Server safety requires separation
- **Estimated APIs:** 8-14 new or materially extended route handlers
- **Estimated UI surfaces:** 8-12 new/extended role and status surfaces
- **Estimated notification events:** 10-14 factual lifecycle events
- **Estimated tests:** 90-140 focused assertions plus cross-epic regression and Playwright
- **Estimated screenshots:** 24-32 controlled desktop/mobile images

## 21. Implementation Sequence

Implementation will proceed in this order after Product Owner approval:

1. **Preflight and baseline**
   - verify repository, branch, commit, status, migration order, and unrelated worktree changes;
   - rerun focused Epic 5/6 baseline tests;
   - inventory existing Public, Private, archived, replaced, soft-deleted, and reported records without changing them.

2. **Additive lifecycle schema**
   - add case, restriction, withdrawal, retention, hold, deletion job/attempt, appeal, and audit models;
   - add safe indexes and compatibility links;
   - generate migration evidence without applying to beta.

3. **Canonical lifecycle resolver**
   - implement audience/access precedence and reason-specific outcomes;
   - integrate fail-closed Public serving first;
   - add audit hashing and idempotency.

4. **Immediate withdrawal**
   - implement recording/publication/likeness scopes;
   - invalidate Public eligibility transactionally;
   - wire recording gate consumption without redesigning gate policy.

5. **Dispute and restriction workflow**
   - implement intake, category-specific restriction, admin review, information requests, decisions, and compatibility with existing reports.

6. **Retention and scoped holds**
   - calculate material-specific deadlines;
   - add exact-evidence hold/release/review states;
   - expose truthful participant/admin status.

7. **Deletion queue and physical verification**
   - implement worker, attempts, retries, nonexistence verification, final outcome, and storage reconciliation;
   - ensure no worker has decision authority.

8. **Appeal and final disposition**
   - implement appeal authority, reviewer separation, final outcome, and immutable history.

9. **Notifications and role UX**
   - add factual event delivery after access-changing transactions;
   - complete customer, vendor, employee, and admin surfaces with reason/owner/action.

10. **Regression and evidence package**
    - execute focused, cross-epic, Playwright, build, security, and package gates;
    - capture desktop/mobile states;
    - complete Engineering Report, UX Review, Demo, debt, lessons, checklist, dashboard, and Git checkpoint.

11. **Stop for Product Owner review**
    - do not migrate beta, deploy, or begin Epic 8 without separate approval.

## 22. Acceptance Criteria

Epic 7 engineering may be presented for approval only when:

- all Success Definition items pass with evidence;
- every access-changing route uses the canonical lifecycle resolver;
- Public withdrawal is proven immediate despite notification failure;
- recording withdrawal blocks both UI and server-side session/stage creation;
- disputes apply the narrowest defined restriction and preserve original evidence;
- no hold preserves Public visibility;
- deletion states are truthful and physical completion is verified;
- legacy soft archives are not misrepresented as deletion requests or completed purges;
- appeals preserve original decisions and produce a separate outcome;
- all four roles see consistent state and permitted next actions;
- review, rating, Trust Score, publication, permission, and AI non-creation tests pass;
- migration rollback cannot republish withdrawn content;
- required automated tests, build, screenshots, reports, and Git scope checks are complete;
- all unrun tests and release gates are named honestly.

## 23. Approval Gate

No application code, Prisma schema, migration, API, worker, notification template, or UI change is authorized by this plan.

Product Owner approval must explicitly authorize Epic 7 implementation. After approval, Codex will execute only this plan, stop on any frozen-document conflict, preserve unrelated worktree changes, and stop again after the complete Product Owner evidence package. Epic 8 will not begin automatically.
