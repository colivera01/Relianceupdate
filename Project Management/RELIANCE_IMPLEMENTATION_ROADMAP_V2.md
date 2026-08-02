# RELIANCE IMPLEMENTATION ROADMAP V2

**Document type:** Approved implementation sequencing proposal

**Status:** Awaiting Product Owner approval

**Purpose:** Move Reliance to private beta through complete, testable user experiences while minimizing duplicate engineering work.

**Repository:** `C:\Users\Cesar Olivera\Project Reliance`

## 1. Governing Standards

The following frozen documents govern every epic and are not changed by this roadmap:

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
- `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
- `RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`

The repository is the implementation source of truth. The frozen documents are the design source of truth. If implementation and a frozen requirement conflict, implementation stops until the Product Owner decides how to resolve the conflict.

## 2. Roadmap Rules

1. The Beta Readiness Checklist is the master tracker.
2. An epic is the smallest complete user experience, not an arbitrary collection of checklist rows.
3. An epic may contain multiple technical commits during development, but it is not complete until one scoped final checkpoint includes code, tests, UX review, screenshots, documentation, checklist updates, and the engineering report.
4. Every epic must leave the deployed test environment usable end to end. Incomplete branches remain disabled or inaccessible.
5. Privacy never weakens during rollout. Unknown, missing, or failed evidence narrows access and keeps recording or publication locked.
6. Private is a complete outcome. Recording permission never implies Public permission.
7. No customer action, review, rating, Trust Score input, consent, or publication approval may be fabricated or inferred.
8. The Product Owner completes the epic's demo checklist before the next major epic is approved.

## 3. Approved Implementation Order

| Order | Epic | Primary capability delivered | Complexity | Risk |
|---|---|---|---|---|
| 1 | Optional Customer Reviews | Genuine, non-expiring optional reviews | Medium | Medium |
| 2 | Proof-First Platform Shell | Frozen identity, language, navigation, and shared UX hierarchy | Large | Medium |
| 3 | Trusted Accounts and Role Isolation | Reliable customer, vendor, employee, and admin session boundaries | Large | High |
| 4 | Verified Permission Request | Verified digital recording-permission decisions | Very Large | High |
| 5 | Universal Work Record and Recording Gates | Complete assessment and unlock rules for all three locations | Very Large | High |
| 6 | Safe Capture Through Private Proof | Employee capture through manager-approved customer-visible Private proof | Very Large | High |
| 7 | Exact-Media Public Proof and Admin Moderation | Exact-version Public approval and moderation | Very Large | High |
| 8 | Withdrawal, Disputes, Retention, and Final Disposition | Reversible exposure and defensible media lifecycle | Very Large | High |
| 9 | Trust Score and Evidence-Based Dashboards | Reconciled metrics from genuine evidence | Large | High |
| 10 | Responsible AI and Fair Admin Support | Guarded, human-controlled assistance | Large | High |
| 11A | Notifications and Help Alignment | Consistent messages, help, tutorials, and support | Large | High |
| 11B | Legal Documents and Agreements | Legal text and assent evidence aligned to proven behavior | Large | High |
| 12 | Private-Beta Hardening and Release | Integrated release candidate and final evidence package | Very Large | High |

## 4. Mandatory Epic Deliverables

Every epic must produce all of the following before it is presented for approval:

1. Implemented, reviewed code for the complete experience.
2. Additive and rollback-aware migrations when required.
3. Applicable unit, integration, Playwright, mobile, accessibility, security, type-check, lint, and production-build results.
4. A screenshot package containing desktop, mobile, loading, success, failure, empty, blocked, and practical before/after evidence.
5. An honest UX review from the Customer, Vendor, Employee, and Admin perspectives.
6. Updated affected rows in `RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`.
7. An engineering report containing the required impact sections and the mandatory `REGRESSION STATEMENT` section in Section 19 of this roadmap.
8. A scoped Git commit containing only the epic implementation and approved documentation.
9. A Product Owner demo result recording pass, fail, observations, and follow-up disposition for every demo step.

## 5. Epic 1: Optional Customer Reviews

### User experience delivered

A verified customer associated with an eligible completed work record may leave one genuine optional review immediately or later. No deadline, countdown, automatic outcome, synthetic rating, or Trust Score signal is created when the customer does nothing.

### Checklist items included

`REV-01` through `REV-06`, the review-related portion of `TRUST-01` and `TRUST-04`, `NOT-05`, `TEST-08`, relevant `TEST-01`, `TEST-02`, `TEST-03`, `TEST-11`, `SHOT-01`, `SHOT-07`, `SHOT-08`, and the related `DOC-*` deliverables.

### Dependencies

- Existing completed-work-record ownership and customer-visible Private proof rules.
- Existing review moderation and visibility behavior.
- Frozen review rules in Workflow Specification Section 11.
- Phase 1 historical records must not be converted into customer activity.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Customer review pages, review card, optional review entry points |
| APIs | Review create/read, compatibility window routes, moderation queue |
| Database | Preserve `Review`; keep or deprecate timing fields safely; no destructive migration expected |
| UI | Optional invitation, review form, submitted/moderated/empty states |
| Notifications | At most one ordinary invitation with no deadline language |
| AI | No synthetic review or rating; review assistance remains advisory only |
| Dashboards | Review availability and genuine outcome only |
| Policies | No policy rewrite; remove only active obsolete review wording if found |
| Tests | Unit, route integration, clock-controlled eligibility, ownership, moderation, Trust Score neutrality, Playwright, copy scan |
| Size | Approximately 10-18 files; 8-12 screenshots |

**Complexity:** Medium
**Risk:** Medium

### Why this epic comes first

It closes the approved review phase cleanly and prevents obsolete review behavior from contaminating later Trust Score, notification, and dashboard work.

### Acceptance criteria

- An eligible customer can submit immediately and more than 72 hours later.
- An old expired or closed unsubmitted compatibility record does not block eligibility.
- No passage of time creates a review, rating, sentiment, or Trust Score input.
- Ownership, rating bounds, duplicate protection, moderation, visibility, and valid historical reviews remain intact.
- Active UI and notification text contain no deadline, expiration, countdown, reopening, or automatic-outcome wording.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Open an eligible completed work record as its customer, select the optional review action, submit a real rating and comment, and confirm one review is created. |
| Expected notifications | Trigger review availability and confirm no more than one invitation arrives and it contains no deadline or automatic-rating statement. |
| Expected dashboard updates | Return to customer and vendor review views and confirm the submitted review appears only in the correct moderated/visibility state. |
| Expected database state | Inspect the test record and confirm one customer-owned `Review`; confirm no synthetic record was created for an untouched eligible work record. |
| Expected admin state | Open admin review moderation, moderate the submitted review, and confirm actor, decision, reason, and time are recorded. |
| Expected customer state | Reopen the work record and confirm review status is submitted; attempt a duplicate and confirm it is blocked clearly. |
| Expected vendor state | Open the vendor review view and confirm only the genuine review is attributed to the correct work record/customer. |
| Expected employee state | Confirm review text and customer identity are not exposed to an employee beyond the currently approved employee experience. |
| Expected Trust Score behavior | Compare score inputs before and after a genuine moderated outcome; confirm no-review produces no review signal. |
| Expected review behavior | Use a fixture older than 72 hours and confirm the customer can still review; leave another eligible record untouched and confirm nothing happens. |
| Expected audit history | Confirm creation and moderation events exist; confirm there is no automatic expiry/reopen/rating event. |
| Expected screenshots | Desktop/mobile review invitation, form, success, duplicate failure, moderated state, empty/no-review state, and practical before/after obsolete copy. |

## 6. Epic 2: Proof-First Platform Shell

### User experience delivered

First-time and returning users understand Reliance as a proof-of-service platform through consistent terminology, navigation, visual hierarchy, responsive behavior, and shared interaction patterns before additional workflow screens are built.

### Checklist items included

`PROD-01` through `PROD-09`, `PROD-04`, `PROD-05`, `PROD-06` through `PROD-08`, `HELP-05`, `TEST-03`, `TEST-05`, `TEST-11`, `SHOT-05` through `SHOT-08`, and related `DOC-*` deliverables. Dashboard-specific rows remain open until their workflow epics are complete.

### Dependencies

- Frozen Product Identity, Product Identity Alignment Audit, Language Guide, and UX Specification.
- Epic 1 review terminology must remain intact.
- Existing public access controls must not be broadened while public pages are reorganized.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Homepage, browse, discover, vendor profile, service detail, auth, help, shared layouts |
| APIs | Existing public vendor/service/proof reads; no broader public response fields |
| Database | No migration expected |
| UI | Shared navigation, page hierarchy, status chips, banners, cards, responsive and accessibility primitives |
| Notifications | Authentication/public onboarding wording only |
| AI | Shared language guard alignment; no workflow decision changes |
| Dashboards | Shared shell and navigation only; workflow content completed later |
| Policies | Existing links and labels only; no policy rewriting |
| Tests | Public route E2E, content scans, responsive layout, keyboard, screen reader, contrast, visual regression |
| Size | Approximately 25-45 files; 20-30 screenshots |

**Complexity:** Large
**Risk:** Medium

### Why this epic precedes accounts and workflows

It establishes the language, shared components, navigation, and information hierarchy once, reducing duplicate UI work in every later customer, vendor, employee, and admin experience.

### Acceptance criteria

- No active page describes Reliance as a marketplace or makes booking the primary product promise.
- Public and signed-in navigation uses the frozen terminology consistently.
- The first viewport explains proof-of-service without inventing unsupported functionality.
- Shared layouts pass supported desktop/mobile and accessibility checks without overlap or hidden actions.
- Existing authorization and public/private filtering remain unchanged.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Start signed out at the homepage, navigate through Browse, a vendor profile, a service, Help, registration, and sign-in; state what Reliance does without relying on training. |
| Expected notifications | Trigger any public/auth onboarding email affected by copy changes and confirm proof-first language and correct links. |
| Expected dashboard updates | Sign in to each role and confirm the shared shell identifies the current role and offers only role-appropriate navigation; workflow cards may remain unchanged. |
| Expected database state | Confirm navigation and copy changes create no new records and do not alter public/private media or service visibility. |
| Expected admin state | Open admin navigation and confirm admin tools remain accessible only to admin sessions and use the approved product terminology. |
| Expected customer state | Confirm customer navigation emphasizes service records, proof, reviews, profile, and help rather than marketplace promises. |
| Expected vendor state | Confirm vendor navigation emphasizes credibility, work records, service video, reviews, team, and support. |
| Expected employee state | Confirm employee entry clearly identifies assigned work and recording responsibilities without unrelated vendor controls. |
| Expected Trust Score behavior | Confirm labels and explanations match the frozen identity; no metric value or input changes in this epic. |
| Expected review behavior | Confirm the Epic 1 optional review flow and wording still work after shared-shell changes. |
| Expected audit history | Confirm purely presentational navigation does not create consequential audit events or alter existing history. |
| Expected screenshots | Homepage, browse, vendor/service pages, all four role shells, loading/empty/failure states, mobile menus, keyboard focus, and comparable before/after identity screens. |

## 7. Epic 3: Trusted Accounts and Role Isolation

### User experience delivered

Customer, vendor, employee, and admin sessions are reliably separated. Account switching, multiple browser tabs, logout, recovery, MFA, and protected routes always resolve to the correct current identity and role.

### Checklist items included

`SEC-01` through `SEC-03`, relevant `SEC-06` and `SEC-09`, role-boundary portions of `ADM-02` through `ADM-04`, `PROD-03`, `TEST-01` through `TEST-03`, `TEST-11`, `TEST-14`, `SHOT-05`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 2 shared shell and role terminology.
- Current User, AuthCredential, MFA, passkey, trusted-device, VendorMembership, and employee models.
- Frozen participant definitions and non-delegable authority rules.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Login, logout, account recovery, role layouts, account switchers, protected admin/vendor/customer/employee pages |
| APIs | Session, MFA, passkey, vendor context, admin guard, membership/context checks |
| Database | Zero or one additive session/security-evidence migration; no account merging |
| UI | Login/recovery, access-required, session-expired, role-switch, multi-tab conflict guidance |
| Notifications | Login/MFA/recovery security messages only |
| AI | None; AI routes inherit corrected authorization |
| Dashboards | Server-derived role context and correct access failure state |
| Policies | No rewrite; existing security links remain |
| Tests | Authorization matrix, multi-account/multi-tab, IDOR, CSRF, expiry, fixation, logout, recovery, brute-force controls, Playwright |
| Size | Approximately 20-35 files; 10-14 screenshots |

**Complexity:** Large
**Risk:** High

### Why this epic precedes permission

Every later permission, recording, publication, withdrawal, and moderation decision depends on knowing exactly which actor and role made it.

### Acceptance criteria

- A vendor account cannot inherit or open an admin session from another tab.
- Direct API requests enforce role, membership, and record ownership.
- Login, logout, expiry, recovery, MFA, passkey, and trusted-device behavior are consistent.
- Role switching does not expose another account's data or carry elevated authority.
- Existing valid accounts, profiles, memberships, and work records remain intact.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Sign into an admin account in one browser context and a vendor/customer account in another supported context; navigate and refresh both without role leakage. |
| Expected notifications | Perform MFA, recovery, and security-notification actions and confirm only the intended account/contact receives them. |
| Expected dashboard updates | Open each role dashboard after login, refresh, logout, and expiry; confirm the displayed identity and data always match the active session. |
| Expected database state | Inspect sessions/challenges/trusted-device evidence and confirm records belong to the correct user and expired/revoked records cannot authenticate. |
| Expected admin state | Attempt admin routes as vendor/customer/employee and confirm denial; sign in as admin and confirm normal access. |
| Expected customer state | Confirm customer pages never display another account's vendor/admin state and account switching follows the approved experience. |
| Expected vendor state | Confirm vendor context loads only memberships owned by the signed-in account and direct vendor-ID substitution fails. |
| Expected employee state | Confirm employee links expose only current assignments and revoked/reassigned access ends. |
| Expected Trust Score behavior | Confirm authentication changes do not recalculate or alter scores. |
| Expected review behavior | Confirm the same customer can still access only their eligible reviews and cannot review another customer's work record. |
| Expected audit history | Confirm security-sensitive login, role, recovery, and admin-access events are recorded where required without exposing secrets. |
| Expected screenshots | Login, MFA, passkey, recovery, access denied, session expired, correct role dashboards, vendor/admin isolation, mobile, loading, failure, and blocked states. |

## 8. Epic 4: Verified Permission Request

### User experience delivered

An authorized vendor sends one recording-permission request. The intended authority holder verifies identity, confirms their role, reviews scope, and accepts, declines, or reports that the request reached the wrong person.

### Checklist items included

`CON-01`, `CON-03`, `CON-05` through `CON-07`, `CON-24` through `CON-27`, `LEG-09` through `LEG-12`, `SEC-04`, `NOT-01` through `NOT-03`, `NOT-05` through `NOT-08`, `TEST-06`, `TEST-09`, relevant `SHOT-01`, `SHOT-02`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 3 authenticated role boundaries.
- Approved 48-hour pending-request expiry and work-record-long accepted decision rules.
- Approved no-digital-channel outcome, wrong-recipient path, authority declarations, and material-change supersession rules.
- One request delivered through email and SMS must remain one decision object.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Vendor request action, customer permission, OTP, wrong recipient, accepted/declined/expired/status screens |
| APIs | Request, status, resend, contact correction, OTP issue/verify, accept, decline, wrong-recipient |
| Database | 1-2 additive migrations for hashed tokens, verified contact, authority, lifecycle, presented versions, and events |
| UI | Education-before-choice permission flow with loading, success, failure, expired, blocked, and recovery states |
| Notifications | Coordinated SMS/email request, resend, decision confirmation, delivery failure, and vendor/employee status |
| AI | No authority or permission decision; existing guidance must use confirmed state only |
| Dashboards | Vendor and employee pending/allowed/declined/expired/wrong-recipient statuses |
| Policies | Store current presented versions; do not rewrite policy content in this epic |
| Tests | Authorization, token hashing/rotation, OTP, replay, expiry, accepted validity, supersession, wrong recipient, resend idempotency, delivery failures |
| Size | Approximately 30-50 files; 18-24 screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic precedes recording gates

Recording cannot safely unlock while link possession alone can make a decision or while an unauthorized caller can create or replace a request.

### Acceptance criteria

- Only an authorized vendor actor can create or resend a request for an eligible work record.
- Link possession alone cannot accept or decline; the intended person completes the approved verification tier.
- An undecided request/link expires after 48 hours; an accepted decision remains valid through completion unless withdrawn or materially superseded.
- Wrong recipients cannot decide and can safely report/correct the issue.
- Email and SMS point to one idempotent request and one decision history.
- If neither usable email nor mobile exists, recording remains locked and service may continue without Reliance recording.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | As a vendor, create one permission request; as the intended customer, open the link, complete OTP/identity and authority confirmation, review the scope, and accept. Repeat with decline, wrong recipient, and expired fixtures. |
| Expected notifications | Confirm email and SMS arrive for the same request, resend does not create a second decision, and both parties receive accurate decision/failure confirmation. |
| Expected dashboard updates | Watch vendor and employee status change from pending to allowed/declined/expired/wrong-recipient without manual refresh where supported. |
| Expected database state | Confirm hashed token only, one active request, verified contact/method, authority declaration, versions, timestamps, delivery attempts, and one final decision. |
| Expected admin state | Confirm admin can inspect status/evidence but cannot accept for the customer or silently revive an expired request. |
| Expected customer state | Confirm the page explains why, scope, audio, initial Private audience, no-action result, decline result, and separate later Public choice. |
| Expected vendor state | Attempt request creation as an unrelated vendor and confirm denial; correct a mistaken contact through the approved flow and issue a new request. |
| Expected employee state | Confirm recording remains blocked while pending/declined/expired/wrong-recipient and changes only after valid acceptance. |
| Expected Trust Score behavior | Confirm acceptance, decline, non-response, expiry, and wrong-recipient status create no Trust Score input. |
| Expected review behavior | Confirm permission decisions create no review prompt, rating, or customer opinion. |
| Expected audit history | Reconstruct request creation, channels, delivery, verification, authority, decision, supersession, and failed attempts by actor/time/version. |
| Expected screenshots | Vendor request, customer education, OTP, authority, accept, decline, wrong recipient, expired, no-channel, resend, delivery failure, mobile, and dashboard status states. |

## 9. Epic 5: Universal Work Record and Recording Gates

### User experience delivered

The vendor creates a permission-ready work record using a short subject assessment. Vendor business address, customer residence, and customer business address each apply the approved authority, notice, consent, location, audio, protected-person, and employee-certification gates.

### Checklist items included

`CON-02`, `CON-04`, `CON-08` through `CON-14`, `CON-22`, `CON-23`, `LEG-03`, `LEG-04`, `LEG-11`, workflow portions of `PROD-10` through `PROD-12`, `HELP-02`, `HELP-03`, `HELP-06`, relevant `SEC-02`, `TEST-04`, `TEST-06`, `SHOT-01` through `SHOT-03`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 4 verified permission lifecycle.
- Approved subject assessment and risk tiers.
- Approved location rules, no silent manager override, disclosed essential-Private-recording exception, and identifiable-minor protections.
- Approved vendor and employee responsibility content/version process.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Work-record creation/edit, assessment, authority, assignment, employee preflight, location exception, blocked/allowed pages |
| APIs | Jobs, assignments, scope, authority, certification, location verify/exception, gate status, material-change supersession |
| Database | 1-2 additive migrations for assessment, scope, authority, audio, protected people, certifications, and location attempts/review |
| UI | Branching assessment, three location choices, scope summary, employee certification, blocked reasons, manager/admin exception review |
| Notifications | Assignment, request required, permission status, location exception, reassignment, and material-change notices |
| AI | Vendor/employee guidance may explain confirmed gate state only and cannot override it |
| Dashboards | Customer, vendor, and employee next-action/status synchronization |
| Policies | Record current agreement/acknowledgment versions; final legal text remains Epic 11B |
| Tests | Full three-location and subject-risk matrix, audio, guardian/private minor, reassignment, material change, GPS accuracy, exception authorization, mobile |
| Size | Approximately 45-70 files; 30-40 screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic precedes capture

It ensures the camera cannot open until the platform knows what will be recorded, who has authority, where recording occurs, and which employee is responsible.

### Acceptance criteria

- All three location selections reach the correct complete allowed, declined, pending, or no-recording outcome.
- Vendor authorization alone is limited to approved vendor-owned property/work-area scope.
- Customer residence and customer business paths require verified affirmative permission, with personal authority handled separately.
- Audio remains off unless the separately approved speaker-authority pathway is satisfied.
- Employee certification is durable and renews after reassignment or material scope change.
- Managers may request but never self-approve alternate location verification.
- Identifiable minors remain in approved necessary Private scope only and can never become Public in Version 1.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Create test records for vendor property-only, vendor person-centered, customer residence, and customer business; complete assessment, authority, permission, assignment, certification, and location steps. |
| Expected notifications | Confirm the correct participant receives assignment, permission, material-change, reassignment, and location-exception messages without unrelated private details. |
| Expected dashboard updates | Observe each record move to the correct pending, blocked, allowed, declined, or no-recording status with one clear next action. |
| Expected database state | Inspect assessment answers, location snapshot, scope, audio state, authority, active decision, employee certification, verification attempts, and exception evidence. |
| Expected admin state | Submit a failed-location exception; confirm the manager cannot approve it and authorized admin/support can approve or deny with evidence. |
| Expected customer state | Decline recording and confirm the service remains available unless the approved disclosed essential-Private-recording condition applies; declining Public is not presented yet. |
| Expected vendor state | Change location, subject, planned people, audio, authority holder, service scope, or capture-risk category and confirm prior permission is superseded. |
| Expected employee state | Open the assignment and confirm the exact approved scope, audio state, stop rules, location status, and certification are shown before camera access. |
| Expected Trust Score behavior | Confirm permission, location, decline, no-channel, reassignment, and certification states do not directly change Trust Score. |
| Expected review behavior | Confirm no review becomes available before complete manager-approved customer-visible Private proof. |
| Expected audit history | Reconstruct assessment, authority, decision, assignment, certification, location attempts, exception request/decision, and supersession. |
| Expected screenshots | Every location path, low/high-risk assessment, authority, audio, guardian/private-minor, assignment, certification, GPS success/failure, admin exception, loading/success/failure/blocked/mobile. |

## 10. Epic 6: Safe Capture Through Private Proof

### User experience delivered

The assigned certified employee records Starting Condition, Work in Progress, and Final Result, recovers from capture/upload problems, submits the package, responds to manager correction, and delivers manager-approved Private proof to the authorized customer.

### Checklist items included

`VID-01` through `VID-06`, `VID-08` through `VID-10`, `VID-14` through `VID-17`, `ADM-04`, relevant `SEC-05` and `SEC-07`, `TEST-04`, `TEST-07`, `SHOT-01` through `SHOT-03`, `SHOT-05`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 5 valid unlock decision and current employee certification.
- Three-stage, 30-second proof model and audio-off default.
- Approved fallback-media provenance/private-only rule and private download roles.
- Reliable storage, MIME/duration checks, and version/hash strategy.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Employee recording, vendor job review/correction, customer Private video, media detail/download |
| APIs | Sessions, upload init/proxy/complete, stage, complete, replacement, manager approve/reject, customer/vendor download |
| Database | 1-2 additive migrations for content hash, media version lineage, provenance, replacement, incident, and package version |
| UI | Mobile capture/previews, progress, retry, replacement, accidental-capture stop, manager review, customer Private proof |
| Notifications | Assignment refresh, upload failure, submission, correction requested, manager approved, Private proof ready |
| AI | Manager/vendor help remains advisory and cannot inspect raw video unless explicitly supported and disclosed |
| Dashboards | Employee stage progress, manager-review queue, customer proof-ready status |
| Policies | Private-proof and download notices only; no final policy rewrite |
| Tests | Real-device camera/GPS, denied permissions, poor network, upload retry/idempotency, MIME/duration/hash, reassignment, fallback, manager correction, access/download |
| Size | Approximately 45-70 files; 30-40 screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic precedes Public approval

Exact-media publication requires stable, identifiable, manager-approved media versions that the customer can first receive as complete Private proof.

### Acceptance criteria

- Only the currently assigned certified employee can capture for the unlocked work record.
- All three stages support preview, retry, replacement, and accurate progress without layout failure.
- Audio is absent by default and accidental/scope-changing capture stops safely.
- Every accepted upload has verified type, duration, content hash, provenance, stage, version, and storage identity.
- Fallback media receives enhanced manager review and remains permanently ineligible for Public proof.
- Manager correction targets the correct package/stage; customer sees all approved Private stages.
- Customer/representative and vendor-manager downloads follow approved roles/labels; employee download fails after submission.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | On a supported phone, open the assigned job, record/preview/save all three stages, submit, request one manager correction, replace that clip, approve, and open the resulting Private proof as customer. |
| Expected notifications | Confirm employee assignment/correction, manager submission, and customer proof-ready notices arrive once with working secure links. |
| Expected dashboard updates | Watch employee stage progress, vendor manager-review state, and customer proof-ready state update after each mutation without stale cards. |
| Expected database state | Inspect sessions/assets and confirm three current stages, content hashes, versions, provenance, replacement lineage, package status, manager decision, and storage identifiers. |
| Expected admin state | Confirm Private proof does not enter Public moderation; admin access is limited to approved support/safety/moderation contexts and is audited. |
| Expected customer state | Open all three Private stages, confirm clear privacy status, and download through the approved customer path with the private-proof notice. |
| Expected vendor state | Review exact stages, request correction, approve Private delivery, and download only through an allowed vendor-manager purpose path. |
| Expected employee state | Confirm camera opens only when assigned/unlocked; test denied camera, failed upload, retry, reassignment, and post-submission download denial. |
| Expected Trust Score behavior | Confirm Private completion can contribute only approved operational evidence and does not imply a public review or Public proof. |
| Expected review behavior | Confirm the optional review becomes available only after the approved eligibility point and remains separate from media visibility. |
| Expected audit history | Reconstruct recording start/end, location, stage, upload/hash/version, replacement, submission, correction, manager approval, access, and download. |
| Expected screenshots | Employee mobile loading/capture/preview/success/failure/retry/blocked, all stage states, manager review/correction, customer Private proof, empty state, downloads, and before/after corrected UI. |

## 11. Epic 7: Exact-Media Public Proof and Admin Moderation

### User experience delivered

After Private delivery, the vendor may propose exact completed media for Public proof. The customer reviews the exact current clips, approves all, some, or none, requests correction, and the approved version proceeds to fair admin moderation without any participant's authority being widened.

### Checklist items included

`CON-15`, `CON-27`, `VID-07`, `VID-09` through `VID-13`, `ADM-01`, publication portions of `SEC-05` and `SEC-08`, relevant `NOT-*`, `TEST-10`, `SHOT-01`, `SHOT-02`, `SHOT-04`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 6 exact content hashes, version lineage, manager-approved Private delivery, and live/fallback provenance.
- Approved Private/Public-only audience model.
- Final Result-only default proposal; separate stage decisions for Starting Condition and Work in Progress.
- Existing Public media transition to Private until full exact-media reapproval.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Customer Public approval, vendor proposal/status, admin moderation, public service proof |
| APIs | Proposal, exact clip/version decision, correction, vendor approval, participant authority, moderation, public serving |
| Database | 1-2 additive migrations plus controlled legacy-public classification/restriction migration |
| UI | Exact preview, clip-by-clip all/some/none, correction/redaction, publication state, admin evidence panel |
| Notifications | Approval requested, corrected version, approved/declined, moderation result, made Public |
| AI | Metadata-only moderation assistance; no raw-video or final-decision claim |
| Dashboards | Vendor, customer, and admin publication queues/statuses; public proof display |
| Policies | No final rewrite; use approved current explanations and preserve versions |
| Tests | Exact-version/hash binding, partial approval, edit/replacement invalidation, minor/bystander/audio authority, fallback block, admin authorization, migration |
| Size | Approximately 40-65 files; 24-32 screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic precedes withdrawal

Withdrawal can only be reliable after the platform has one canonical Public authority chain, exact version, and audience state to revoke.

### Acceptance criteria

- Private proof remains complete when the customer approves none or takes no publication action.
- Final Result is the only default proposal; other stages require intentional separate proposal and approval.
- Public eligibility resolves to the same content hash/version reviewed by every required participant and admin.
- Any edit, replacement, crop, blur, mute, caption, or label change requiring approval creates a new version and renewed chain.
- Fallback media and identifiable minors can never become Public in Version 1.
- Existing Public media lacking exact-media approval becomes Private and stays Private until reapproved.
- Admin may restrict but never broaden the maximum participant-approved audience.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | From approved Private proof, propose Final Result, open as customer, preview exact media, approve it, send to admin, approve moderation, and open the Public page. Repeat with approve none, partial stage approval, and correction. |
| Expected notifications | Confirm exact-media request, decision, correction, moderation result, and Public notices reach only applicable participants with correct links. |
| Expected dashboard updates | Observe Private, approval requested, partially approved, pending admin, Public, declined, and correction states synchronize across customer/vendor/admin views. |
| Expected database state | Inspect proposal, stage/version/hash, audience, customer decision, vendor approval, applicable likeness/guardian/audio evidence, admin decision, and public timestamp. |
| Expected admin state | Confirm queue entry exposes the exact approved version/evidence; attempt to approve missing/changed authority and confirm it is blocked. |
| Expected customer state | Confirm all/some/none and correction choices are unpressured, Private is clearly complete, and no Public choice existed before media was available. |
| Expected vendor state | Confirm only Final Result is preselected; intentionally add another stage and verify it receives an independent decision. |
| Expected employee state | Confirm identifiable employee likeness follows approved authority and employee has no power to publish customer-controlled media. |
| Expected Trust Score behavior | Confirm only valid approved Public proof can appear in public proof inputs; Private or declined publication is not penalized. |
| Expected review behavior | Confirm review availability and review visibility remain independent from Public media approval. |
| Expected audit history | Reconstruct proposal, exact version/hash, each participant decision, correction, invalidation, moderation, visibility, and legacy transition. |
| Expected screenshots | Customer exact-preview all/some/none/correction, vendor proposal, admin evidence/moderation, Public page, Private outcome, legacy restricted state, mobile, loading, failure, empty, and blocked. |

## 12. Epic 8: Withdrawal, Disputes, Retention, and Final Disposition

### User experience delivered

Authorized participants can stop future recording, withdraw Public approval, dispute content, request deletion, appeal a decision, and receive a truthful final outcome while Reliance preserves only the approved minimum restricted evidence.

### Checklist items included

`CON-16` through `CON-21`, `VID-12`, `VID-16`, `VID-18`, `ADM-03`, `ADM-05`, `ADM-06`, `HELP-07`, relevant `SEC-05`, `SEC-08`, `DEP-03`, `TEST-13`, `SHOT-01`, `SHOT-02`, `SHOT-04`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Epic 7 canonical audience, exact version, and publication authority.
- Approved 12-month Private media, active-approval Public media, and seven-year decision-evidence rules.
- Approved immediate Public withdrawal, download roles, minimum-scope holds, and physical purge verification.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Withdrawal, deletion request/status, dispute, appeal, admin case, final disposition |
| APIs | Immediate unpublish, link revocation, dispute/restriction, hold, deletion queue, physical purge, retry, appeal |
| Database | 1-2 additive migrations for withdrawal, case/appeal, hold scope, retention deadline, deletion queue/attempt/outcome |
| UI | Education-before-withdrawal, immediate status, dispute intake, restricted evidence, purge pending/failure/final states |
| Notifications | Withdrawal, immediate unpublish, dispute, hold, deletion, purge failure, appeal, final disposition |
| AI | Optional case summary only; no authority, legal conclusion, or final decision |
| Dashboards | Restricted/unpublished/disputed/held/deletion states and admin queues |
| Policies | No rewrite until behavior is validated; use approved factual notices |
| Tests | Access/link revocation, notification outage, retention clocks, scoped holds, purge/retry/orphan, race/concurrency, appeal, account deletion |
| Size | Approximately 45-70 files; 24-32 screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic precedes Trust Score and policies

Metrics and legal promises must reflect reversible Public exposure and final disposition rather than assuming media stays available indefinitely.

### Acceptance criteria

- Authenticated withdrawal disables Reliance-controlled Public access and links before notification success.
- Withdrawal never rewrites prior decisions and never promises deletion of outside copies.
- Private/Public/evidence retention follows the approved time and active-approval rules.
- Holds preserve only covered evidence and never preserve Public visibility.
- Physical deletion has queued, attempted, verified, failed, retried, and final states; the platform never reports success while the blob remains.
- Dispute restrictions, neutral decisions, notices, appeals, and final disposition are reconstructable.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Open Public proof as the verified authority holder, withdraw publication, immediately retry the old public link, file a dispute/deletion request, apply and release a scoped hold, complete purge, and exercise one appeal. |
| Expected notifications | Disable one notification provider during withdrawal and confirm public access still ends first; then confirm queued notices and final outcomes reach applicable roles. |
| Expected dashboard updates | Watch Public become Private/restricted immediately and follow dispute, hold, deletion pending, purge failed/retrying, and final disposition states. |
| Expected database state | Inspect withdrawal, audience change, case, hold scope, retention deadline, queue attempts/errors, blob result, appeal, and final evidence record. |
| Expected admin state | Confirm admin can restrict, investigate, decide, and record appeal but cannot silently republish or erase immutable decision history. |
| Expected customer state | Confirm the customer understands future visibility ends immediately, deletion may differ from retained evidence, and outside copies are not controlled by Reliance. |
| Expected vendor state | Confirm vendor receives the allowed explanation/status, loses public representation promptly, and retains only approved Private/business-record access. |
| Expected employee state | Confirm employee access remains limited and employee cannot restore, download, or republish withdrawn proof. |
| Expected Trust Score behavior | Confirm withdrawn Public proof stops appearing as current public evidence without fabricating a negative customer signal. |
| Expected review behavior | Confirm media withdrawal does not delete, fabricate, or silently change a separate genuine review except through its own moderation/dispute rules. |
| Expected audit history | Reconstruct withdrawal, restriction, access denial, notices, dispute, hold, deletion attempts, physical result, appeal, and final disposition. |
| Expected screenshots | Withdrawal education/confirmation, dead public link, dispute, hold, deletion pending/failure/retry/success, appeal, role dashboards, mobile, loading, empty, and blocked states. |

## 13. Epic 9: Trust Score and Evidence-Based Dashboards

### User experience delivered

Customers, vendors, and admins see consistent, explainable metrics derived only from genuine eligible evidence. Private choices, missing reviews, permission decisions, and silence do not create positive or negative signals.

### Checklist items included

`TRUST-01` through `TRUST-06`, `REV-04`, `PROD-10`, `PROD-11`, `PROD-13`, `ADM-07`, `ADM-08`, relevant `TEST-01` through `TEST-03`, `TEST-11`, `SHOT-01`, `SHOT-02`, `SHOT-04`, and related `DOC-*` deliverables.

### Dependencies

- Epic 1 genuine review outcomes.
- Epics 6 through 8 stable completion, Private/Public, withdrawal, moderation, and deletion states.
- A frozen metric dictionary and approved Trust Score inputs/outputs.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Customer, vendor, public profile, analytics, and admin reporting dashboards |
| APIs | Trust Score, vendor/customer metrics, admin summaries, reconciliation/export |
| Database | Zero or one additive snapshot/provenance migration plus controlled backfill if required |
| UI | Metric cards, definitions, data freshness, empty/insufficient-evidence, source explanations |
| Notifications | No score-change marketing pressure; only approved operational alerts if required |
| AI | No score calculation or unsupported explanation authority |
| Dashboards | Canonical shared queries and role-appropriate visibility |
| Policies | No rewrite; prepare verified metric definitions for Epic 11B |
| Tests | Fixture reconciliation, no-review/private neutrality, moderation/withdrawal, time zones, stale cache, access controls, public filtering |
| Size | Approximately 25-45 files; 16-22 screenshots |

**Complexity:** Large
**Risk:** High

### Why this epic precedes AI and final communication

AI, help content, policies, and release reporting must explain the same verified metrics rather than preserving inconsistent dashboard calculations.

### Acceptance criteria

- Every displayed metric reconciles to named source records and one documented definition.
- No-review, silence, decline, Private publication choice, or consent status creates a review or Trust Score outcome.
- Withdrawn or no-longer-public proof is represented according to the approved current-evidence rule without rewriting history.
- Customer, vendor, public, and admin views agree while exposing only role-appropriate detail.
- Backfill/recalculation is idempotent, audited, and rollback-aware.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Create controlled records representing no review, genuine review, Private proof, Public proof, withdrawn proof, and moderated outcomes; open every metric surface and compare results. |
| Expected notifications | Confirm no notification pressures a participant to publish/review or claims a score changed from silence; inspect any approved operational score notice. |
| Expected dashboard updates | Trigger each genuine eligible event and confirm customer/vendor/admin/public metrics update consistently with an accurate freshness time. |
| Expected database state | Inspect source outcomes and any snapshot/provenance record; rerun calculation and confirm no duplicate or drift. |
| Expected admin state | Open reporting, inspect source counts and definitions, export a controlled report, and reconcile it to the same fixture records. |
| Expected customer state | Confirm customer sees only approved public/vendor information and is not penalized or messaged for choosing Private or leaving no review. |
| Expected vendor state | Confirm vendor can understand each metric and cannot manufacture inputs through internal actions, silence, fallback uploads, or unapproved proof. |
| Expected employee state | Confirm employee actions outside approved operational outcomes do not create reviews or unauthorized score inputs. |
| Expected Trust Score behavior | Record expected values for every fixture, compare actual values, withdraw proof, and confirm the current/public evidence behavior changes exactly as approved. |
| Expected review behavior | Submit no review for one record and a genuine moderated review for another; confirm only the genuine outcome contributes. |
| Expected audit history | Confirm recalculation/backfill/admin actions and source versions are recorded without inventing customer events. |
| Expected screenshots | All role metric cards, source explanation, no-data/insufficient-evidence, Private/Public/withdrawn comparisons, admin report, mobile, loading, failure, and empty states. |

## 14. Epic 10: Responsible AI and Fair Admin Support

### User experience delivered

Vendors receive state-grounded next-step guidance, while admins receive metadata-based moderation, dispute, support, and reporting assistance that never replaces participant authority or human decisions.

### Checklist items included

`AI-01` through `AI-07`, `LEG-08`, AI portions of `ADM-01`, `ADM-05`, `ADM-07`, `ADM-08`, `HELP-04`, `HELP-07`, relevant `SEC-07`, `SEC-09`, AI/security tests, `SHOT-02`, `SHOT-04`, `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Canonical actor, permission, media, withdrawal, dispute, moderation, and Trust Score states from Epics 3 through 9.
- Frozen Language Guide AI rules and role boundaries.
- Existing prompt registry, output guards, evaluation, feedback, and rollout controls.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Vendor assistance, admin moderation/dispute/support/reporting panels |
| APIs | AI assist, queue, feedback, export, rollout, evaluation, and status endpoints |
| Database | Zero or one additive recommendation/prompt/model/guard evidence migration |
| UI | Clear AI labels, source/state summary, uncertainty, human decision, feedback, failure/escalation |
| Notifications | AI-generated summaries only where approved and clearly labeled |
| AI | Structured grounding, prohibited outputs, prompt/version registry, adversarial gates, disable/rollback controls |
| Dashboards | Admin AI queue/quality/rollout and vendor guidance states |
| Policies | Prepare validated disclosure content for Epic 11B; do not rewrite yet |
| Tests | Focused AI gate, evals, prompt injection, hallucination, role/privacy, stale/conflicting data, provider outage, model rollback |
| Size | Approximately 25-45 files; 12-18 screenshots |

**Complexity:** Large
**Risk:** High

### Why this epic precedes communication and legal alignment

Help, notifications, and legal disclosures must describe the final enabled AI capabilities and limits, not a planned or unsafe scope.

### Acceptance criteria

- AI uses structured confirmed state and never invents delivery, permission, media review, moderation, score, or legal facts.
- AI cannot accept consent, unlock recording, approve Public media, decide disputes, moderate content, or calculate Trust Score.
- Raw video is never claimed to be reviewed unless the exact supported capability and disclosure are verified.
- Prompt, model, guard, input source, output, feedback, and rollout versions are traceable.
- Unsafe or failing AI features can be disabled without blocking the underlying human workflow.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Request vendor guidance and admin assistance across pending, blocked, declined, Private, Public, withdrawn, disputed, and incomplete-data states; then complete the human action separately. |
| Expected notifications | Trigger an approved AI-assisted summary and confirm it is labeled, factual, minimum-data, and never sent as an unreviewed consequential decision. |
| Expected dashboard updates | Confirm AI suggestions never change workflow status; only the authorized human action updates dashboards. |
| Expected database state | Inspect recommendation evidence and confirm prompt/model/guard versions, grounded inputs, output, human action, feedback, and no unauthorized state mutation. |
| Expected admin state | Generate moderation/dispute assistance, reject the suggestion, make a different authorized decision, and confirm the human result controls. |
| Expected customer state | Confirm customer-facing AI/support text distinguishes confirmed facts, guidance, uncertainty, and escalation without legal guarantees. |
| Expected vendor state | Confirm guidance names the current confirmed status and one safe next step but offers no bypass for permission, location, or moderation. |
| Expected employee state | Confirm any employee guidance repeats approved scope/stop rules and cannot unlock camera or broaden recording. |
| Expected Trust Score behavior | Ask AI to explain or change a score and confirm it can only describe verified approved inputs and cannot recalculate or invent them. |
| Expected review behavior | Ask AI to draft/infer a review or rating and confirm synthetic customer opinion and automatic rating are blocked. |
| Expected audit history | Confirm AI request/version/output/feedback and later human decision are distinguishable and traceable. |
| Expected screenshots | Vendor guidance, admin moderation/dispute/support assistance, uncertainty, blocked output, provider failure, human override, rollout status, mobile/desktop, loading, success, empty, and failure. |

## 15. Epic 11A: Notifications and Help Alignment

### User experience delivered

Customers, vendors, employees, and admins receive consistent transactional notifications and can find concise role-appropriate Help Center, FAQ, tutorial, and support guidance matching the implemented workflow.

### Checklist items included

`PROD-04`, `NOT-01` through `NOT-08` with `NOT-04` remaining Product Owner-approved Deferred unless promoted, `HELP-01` through `HELP-07`, language portions of `AI-05`, notification/help-related `TEST-05`, `TEST-09`, `TEST-11`, `SHOT-01` through `SHOT-07`, and related `DOC-*` deliverables.

### Dependencies

- Completed behavior and canonical event/status vocabulary from Epics 1 through 10.
- Frozen Platform Language Guide and UX Specification.
- Provider accounts, delivery callbacks, sender/domain registration, opt-out requirements, and support ownership.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Help Center, FAQ, tutorials, support/contact, notification centers, contextual help links |
| APIs | Notification read/status/resend, support intake/routing, delivery callbacks, retry/dead-letter status |
| Database | No migration or one additive template/version/retry-support migration if earlier evidence is insufficient |
| UI | In-app notices, role help, contextual guidance, escalation, delivery/retry/failure states |
| Notifications | Full email/SMS/in-app trigger and template inventory; idempotency, retry, opt-out, failure escalation |
| AI | Messaging and support response alignment; no new authority |
| Dashboards | Accurate notification/read/delivery/next-action states |
| Policies | Link to current documents and state verified behavior; legal text remains Epic 11B |
| Tests | Template snapshots, prohibited-language scan, links, sender/recipient, provider sandbox/live, retry, STOP, accessibility, role help walkthrough |
| Size | Approximately 30-50 files; 28-40 screenshots |

**Complexity:** Large
**Risk:** High

### Why this epic precedes legal documents

Legal documents should reference a stable, tested communication and support experience rather than templates or help paths that are still changing.

### Acceptance criteria

- Every consequential workflow event maps to an approved recipient, channel, template version, retry class, and evidence record.
- Messages state why, status, required action, no-action result, next result, and what remains Private where relevant.
- Delivery failure never creates permission or blocks immediate privacy restriction.
- Help content covers all four roles and every consequential blocked/recovery state without obsolete or legalistic wording.
- AI and human support messages follow the same verified-state and escalation rules.
- Push remains absent from beta unless separately approved.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Follow one complete customer, vendor, employee, and admin journey using only in-app guidance, Help Center, FAQ/tutorial, and received notifications; confirm no training is required. |
| Expected notifications | Trigger every critical event in the matrix, inspect SMS/email/in-app content and links, then force provider failure, retry, duplicate delivery, wrong address, and STOP/opt-out. |
| Expected dashboard updates | Mark notifications read, complete linked actions, and confirm status/next action updates without stale or contradictory messages. |
| Expected database state | Inspect template version, intended recipient, channel, provider, attempts, result/error, idempotency key, read state, and escalation record. |
| Expected admin state | Open notification/support queues, identify failed critical delivery, resend through the allowed path, and escalate a privacy issue. |
| Expected customer state | Use permission, Private proof, Public approval, withdrawal, review, dispute, and wrong-recipient help; confirm control and privacy are clear. |
| Expected vendor state | Use creation, assessment, assignment, manager review, publication, and correction help; confirm exactly one next action is clear. |
| Expected employee state | Use assignment, scope, location, capture, retry, accidental-capture, and blocked help on mobile; confirm safe stop guidance. |
| Expected Trust Score behavior | Confirm notifications/help never claim silence, Private choice, or non-review changes Trust Score. |
| Expected review behavior | Confirm the review invitation remains optional, non-expiring, and single-send without pressure. |
| Expected audit history | Reconstruct each consequential notification attempt/result and support escalation without storing message secrets or unnecessary private content. |
| Expected screenshots | Email/SMS samples, in-app unread/read, help/FAQ/tutorial for each role, contextual help, provider failure/retry, wrong recipient, STOP, loading, empty, success, failure, blocked, mobile/desktop. |

## 16. Epic 11B: Legal Documents and Agreements

### User experience delivered

Participants see and accept role-appropriate legal documents and agreements that accurately describe the final implemented behavior, with durable prospective evidence of the exact version presented.

### Checklist items included

`LEG-01` through `LEG-12`, including Terms of Service, Privacy Policy, Vendor Agreement, Employee Agreement, SMS Policy, email policy, Cookie Policy if applicable, AI disclosure, consent versioning, policy versioning, registration acceptance history, and legal document retrieval. Related `TEST-01`, `TEST-02`, `TEST-03`, `TEST-11`, `SHOT-01` through `SHOT-04`, `SHOT-07`, and `DOC-*` items are included.

### Dependencies

- All user-visible operational behavior in Epics 1 through 11A is implemented and validated.
- Future Legal Review for final legal wording and applicability decisions.
- Approved prospective transition for existing users without false retroactive acceptance.
- Reliable policy/version storage and retrieval.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Terms, Privacy, SMS, Cookie if applicable, AI disclosure, registration, vendor/employee agreement, document history/retrieval |
| APIs | Registration/assent, agreement acceptance, policy retrieval/version, authenticated acceptance history |
| Database | Zero or one additive prospective-assent/policy-version migration if not already completed |
| UI | Short role-appropriate presentation, expandable document, acceptance, changed-version notice, retrieval/history |
| Notifications | Material policy/agreement update and acceptance confirmation only where approved |
| AI | Final disclosure of enabled capabilities and limits |
| Dashboards | Agreement/policy status and required prospective action where applicable |
| Policies | Final active Terms, Privacy, Vendor, Employee, SMS, email, Cookie decision, and AI disclosure |
| Tests | Version binding, prospective transition, required/optional acceptance, retrieval, direct URL, accessibility, notification, no retroactive rewrite |
| Size | Approximately 20-35 files; 16-24 screenshots |

**Complexity:** Large
**Risk:** High

### Why this epic follows implemented behavior

Legal documents must describe what Reliance actually does. Writing them earlier would risk documenting anticipated behavior or forcing later rewrites and assent confusion.

### Acceptance criteria

- Future Legal Review and Product Owner approve the final active document versions.
- Registration, vendor, employee, consent, SMS, and AI assent evidence records actor, role, version, presented content reference, decision, and time.
- Existing users receive a prospective transition without a fabricated historical acceptance.
- Earlier versions remain retrievable as immutable evidence of what a participant saw.
- Public policy pages and authenticated acceptance history are accessible, readable, and correctly linked.
- No document promises unsupported functionality, automatic legal compliance, or broader access than implementation permits.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Register a new customer and vendor, accept role documents, invite/activate an employee, view consent-related version references, then sign in as an existing user requiring prospective acknowledgment. |
| Expected notifications | Trigger an approved material document update and confirm only affected participants receive an accurate notice and acceptance confirmation. |
| Expected dashboard updates | Confirm required prospective acknowledgment appears clearly, blocks only the approved future action, and disappears after valid acceptance. |
| Expected database state | Inspect actor, account, role, document/version, presented-content reference, decision, timestamp, and channel; confirm no backdated acceptance for existing users. |
| Expected admin state | Retrieve a participant's acceptance history without editing it; confirm authorization, version content, and access audit. |
| Expected customer state | Open current Terms, Privacy, SMS/Cookie information if applicable, and acceptance history; confirm plain navigation and no false consent implication. |
| Expected vendor state | Review and accept the Vendor Agreement prospectively; confirm business responsibilities without accepting for customers or employees. |
| Expected employee state | Review and accept the Employee Agreement; confirm recording duties and that the employee does not accept customer permission. |
| Expected Trust Score behavior | Confirm policy/agreement acceptance or refusal creates no customer review or synthetic Trust Score input. |
| Expected review behavior | Confirm legal acceptance is separate from optional review submission and contains no review deadline or pressure. |
| Expected audit history | Retrieve exact historical/current document versions and each acceptance/update notice; confirm records are immutable and access controlled. |
| Expected screenshots | Each active policy/agreement, registration presentation, prospective update, acceptance success/failure/blocked, retrieval/history, all roles, mobile/desktop, loading, and empty states. |

## 17. Epic 12: Private-Beta Hardening and Release

### User experience delivered

A controlled private-beta release candidate works consistently across supported roles, devices, browsers, providers, data states, failures, deployment, recovery, and support operations.

### Checklist items included

Remaining work in `PROD-05` through `PROD-08`, `SEC-06`, `SEC-08` through `SEC-10`, `DEP-01` through `DEP-08`, `TEST-01` through `TEST-14`, `SHOT-01` through `SHOT-10`, `DOC-01` through `DOC-08`, every Beta Release Gate row, and revalidation of every previously completed checklist item.

### Dependencies

- Epics 1 through 11B are complete and approved.
- Controlled beta-like environment, provider accounts, supported device/browser list, monitoring ownership, support ownership, and deployment access.
- No unresolved Critical checklist item.

### Estimated repository impact

| Area | Estimate |
|---|---|
| Routes | Stabilization, error/loading/empty/blocked completeness, no planned new workflow |
| APIs | Security, observability, idempotency, health, failure handling, and release fixes only |
| Database | No planned migration beyond approved defect correction; migration/rollback rehearsal required |
| UI | Cross-role UX polish, accessibility, responsive correction, truthful failure/recovery states |
| Notifications | Controlled live deliverability, retries, callbacks, escalation, monitoring, and redaction validation |
| AI | Full release gate, provider outage, rollback/disable, version/eval evidence |
| Dashboards | Release health, delivery, failures, queues, metric reconciliation, admin operational visibility |
| Policies | Verify deployed versions/links/acceptance evidence; no redesign |
| Tests | Full unit, integration, Playwright, mobile, accessibility, regression, load, failure recovery, security, type check, lint, build, migration, rollback, restore |
| Size | Approximately 40-80 repository files plus reports; 100-140 indexed/redacted screenshots |

**Complexity:** Very Large
**Risk:** High

### Why this epic is last

It validates the integrated release candidate. It cannot compensate for an incomplete workflow and must not be used to defer unresolved Critical requirements.

### Acceptance criteria

- Every Critical checklist item is Complete or Beta Ready; none is waived or deferred.
- High/Medium/Low items follow the checklist's documented release treatment.
- Full applicable quality gates pass and each result is preserved; unrun tests are stated as unrun.
- Controlled live email, SMS, location, storage/playback, authentication, AI if enabled, and monitoring tests pass.
- Rollback, backup restoration, incident response, provider failure, and purge failure exercises meet approved targets.
- Engineering report, screenshot package, UX observations, four role journey summaries, checklist, and release decision record are complete.
- Product Owner records an explicit go/no-go decision.

### PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Execute the complete golden journey: register/sign in, create work record, verify permission, unlock, record three stages, manager approve, customer receive Private proof, optionally review, propose exact Public proof, moderate, publish, withdraw, dispute/delete, and verify final disposition. |
| Expected notifications | Inspect every notification from the golden journey, then repeat critical privacy actions with one provider disabled and confirm safe behavior and retries. |
| Expected dashboard updates | Keep customer, vendor, employee, and admin views open during the golden journey and confirm every mutation appears consistently without manual stale-state confusion. |
| Expected database state | Reconcile actors, versions, permissions, media hashes, stages, decisions, notifications, score inputs, audits, retention, deletion, and final state against the golden journey. |
| Expected admin state | Complete moderation, location exception, dispute, appeal, audit retrieval, reporting, security, and operational failure queues using authorized admin accounts only. |
| Expected customer state | Complete all customer actions on supported desktop/mobile browsers and confirm control, privacy, no-pressure choices, and understandable recovery. |
| Expected vendor state | Complete work creation through final disposition and confirm every card/status/action updates immediately and names the correct next step. |
| Expected employee state | Complete assignment, certification, location, recording, upload recovery, correction, reassignment, and submission on each supported mobile platform. |
| Expected Trust Score behavior | Reconcile every displayed score/metric before and after genuine review, Public approval, withdrawal, and no-review/Private outcomes. |
| Expected review behavior | Confirm optional review remains genuine, non-expiring, non-synthetic, independent from publication, and moderated correctly. |
| Expected audit history | Export/reconstruct the complete golden journey and confirm every consequential actor, authority, version, decision, attempt, failure, and final outcome is present and tamper-evident. |
| Expected screenshots | Review the complete indexed package for all four roles, supported viewports, loading/success/failure/empty/blocked states, accessibility evidence, and practical before/after comparisons. |

## 18. Expected Deliverables By Epic

| Deliverable | Required content |
|---|---|
| Engineering report | Objective; files changed; migrations; security, API, database, notification, AI, dashboard, and legal impacts; backward compatibility; rollback; commands and actual results; limitations; `REGRESSION STATEMENT`. |
| Test evidence | Commands, environment, commit, pass/fail/skipped result, relevant logs, and proof that unrelated failures were distinguished from epic regressions. |
| Screenshot package | Desktop, mobile, loading, success, failure, empty, blocked, practical before/after, build/commit, role, viewport/device, date, and redaction manifest. |
| UX review | Customer, Vendor, Employee, and Admin critique covering wording, hierarchy, density, controls, privacy reassurance, anxiety, accessibility, and recovery. |
| Journey summaries | Updated summaries for every role materially affected by the epic. |
| Checklist update | Every affected item updated with evidence; no row marked Beta Ready from code existence alone. |
| Git checkpoint | Scoped commit excluding `.env`, credentials, logs, screenshots, temporary folders, and generated artifacts unless explicitly approved. |
| Product Owner demo result | Every demo row marked pass/fail with notes, evidence link, defect owner, and disposition. |

## 19. Mandatory Engineering Report Section: REGRESSION STATEMENT

Every implementation report must include a section titled exactly:

## REGRESSION STATEMENT

Use the following required structure:

### Existing functionality intentionally preserved

List the working behaviors the epic depended on and prove how each remained operational. Include routes, roles, data, and tests rather than saying only "preserved."

### Existing functionality intentionally unchanged

List adjacent behaviors outside the epic scope. State why they were not modified and identify the verification used to confirm no accidental change.

### Areas verified unaffected

Record the actual regression checks run for authentication, authorization, role switching, work records, recording, reviews, Trust Score, notifications, admin tools, policies, public/private access, storage, and any other relevant shared surface. Mark non-applicable areas explicitly.

### Potential regression risks reviewed

For each identified risk, state the shared module or data contract involved, possible failure, mitigation, test evidence, remaining exposure, and rollback trigger.

### Known unrelated issues

List pre-existing or newly discovered issues outside the epic. Include evidence showing they were not introduced by the epic, their owner/status, and whether they block the next epic or beta. Do not fix unrelated issues silently inside the epic.

### Required closing declaration

End the section with one of these evidence-based statements:

- `No known regression attributable to this epic remains after the executed validation.`
- `The following potential or confirmed regressions remain and block epic approval: ...`

Do not use the first statement unless the applicable regression validation was actually executed.

## 20. Epic Completion Gate

An epic may be presented as complete only when all answers below are Yes:

| Gate question | Required answer |
|---|---|
| Is the complete user experience usable end to end? | Yes |
| Are all included checklist acceptance criteria satisfied? | Yes |
| Were all applicable tests executed and accurately reported? | Yes |
| Are loading, success, failure, empty, and blocked states complete? | Yes |
| Did the four-role UX review identify and resolve blocking confusion? | Yes |
| Is the screenshot package complete and redacted? | Yes |
| Does the engineering report include the complete Regression Statement? | Yes |
| Were all affected checklist rows updated with evidence? | Yes |
| Is the Git checkpoint scoped to the epic? | Yes |
| Did the Product Owner complete the demo checklist and approve progression? | Yes |

If any answer is No, the epic remains In Progress or Blocked and the next major epic does not begin.

## 21. Approval Requested

This Version 2 roadmap incorporates the Product Owner's requested sequencing, legal-epic split, Product Owner Demo Checklist, Regression Statement, and complete-experience gate.

No implementation is authorized by this document alone. After approval, work begins with **Epic 1: Optional Customer Reviews** and stops again after that epic's complete evidence package and Product Owner demo.
