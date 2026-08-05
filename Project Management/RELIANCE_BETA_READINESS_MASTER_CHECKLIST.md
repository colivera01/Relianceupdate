# RELIANCE BETA READINESS MASTER CHECKLIST

## Epic 6 Implementation Checkpoint - Exact-Media Public Proof and Admin Moderation

**Checkpoint date:** 2026-08-05

**Epic status:** **Engineering Complete; Product Owner review pending**

**Deployment status:** Not deployed; additive migration `20260805213000_add_exact_media_publication_evidence` is not applied

**Primary evidence:** `Project Management/Epic 6 - Exact-Media Public Proof and Admin Moderation/`

Epic 6 replaces raw visibility flags as Public authority with one exact-media evidence chain: approved recording evidence, manager-approved Private package, exact customer decision, applicable participant decisions, vendor representation approval, admin moderation, and active canonical Public eligibility.

- Final Result is the only default proposal; other stages require intentional selection.
- Customer may approve all, some, none, or request correction. No action leaves proof Private.
- Missing, stale, revoked, superseded, or inconsistent evidence fails closed at both mutation and read time.
- Any presentation-affecting change requires a new media version and a new approval chain.
- Legacy Public flags are inventoried and restricted to Private by migration; no media is deleted or silently approved.
- Public service, discovery, category, favorites, vendor-profile, and direct-media paths use the canonical resolver.
- Legacy direct-Public moderation shortcuts are blocked while Private moderation remains available.
- Publication creates no review, rating, Trust Score input, permission, recording state, AI decision, or synthetic customer activity.
- Validation passed: 45/45 Epic 6 focused tests, 331/331 Epic 1-6 regressions, 5/5 Playwright states, TypeScript, Prisma validation/generation, production build, and standalone package inspection.
- Full suite result: 835/840; five untouched unrelated failures are documented in the Engineering Report.
- `CON-15`, `CON-27`, `VID-07`, `VID-09` through `VID-13`, `ADM-01`, publication portions of `SEC-05` and `SEC-08`, `TEST-10`, `SHOT-01`, `SHOT-02`, `SHOT-04`, `SHOT-07`, and `DOC-01` through `DOC-07` gain local implementation evidence but remain release-shared until migration, deployment, live replay, and final release criteria pass.
- Notifications were intentionally preserved under the final scope boundary; publication lifecycle delivery remains Epic 10 work.
- No row is marked Beta Ready from local implementation alone.
- Do not begin Epic 7 or deploy Epic 6 without Product Owner approval.

## Epic 5 Implementation Checkpoint - Safe Capture Through Private Service Videos

**Checkpoint date:** 2026-08-05

**Epic status:** **Completed and frozen**

**Product Owner decision:** Approved on 2026-08-05

**Engineering status:** **Engineering Complete**

**Deployment/release gates:** Additive migration `20260805193000_add_private_service_video_evidence`, application deployment, physical-device replay, and four-role Product Owner replay remain pending

**Gate classification:** The remaining migration, deployment, physical-device replay, and four-role replay are deployment/release gates, not Epic 5 engineering defects

**Primary evidence:** `Project Management/Epic 5 - Safe Capture Through Private Service Videos/`

Epic 5 binds every customer-visible Private Service Video to a complete server-verified evidence chain from work record and assessment generation through permission, canonical recording decision, assigned employee capture, exact package version, manager approval, and customer access grant.

- Upload status is limited to truthful `Uploading`, `Saved`, `Retry Required`, or `Rejected` states.
- Every accepted stage carries SHA-256 identity, capture provenance, stage version, session, employee, and canonical gate evidence.
- Identical package resubmission is idempotent; correction targets named stages and preserves unrelated Saved stages.
- Manager approval atomically creates the exact manager decision, customer-only access grant, Private asset visibility, and completed work-record state.
- Customer and vendor-manager media paths fail closed when any evidence-chain link is missing or inconsistent.
- Private approval creates no review, rating, Trust Score input, publication approval, Public media, AI decision, or admin Public moderation task.
- Validation passed: 108/108 Epic 1-5 focused regressions, 85/85 final focused tests, 2/2 Epic 5 Playwright states, TypeScript, Prisma validation/generation, production build, and `git diff --check`.
- Controlled employee desktop/mobile screenshots cover all-three-Saved and Retry-Required-with-preserved-preview states.
- Shared `PROD-*`, `TEST-*`, `SHOT-*`, and `DOC-*` rows remain `In Progress` until physical-device, four-role, release-wide accessibility/security, and Product Owner evidence is complete.
- No checklist row is marked Beta Ready from local implementation alone. Epic 6 implementation has not started; planning is active.
- Epic 5 is frozen. Do not reopen it unless beta validation identifies a genuine defect.
- The next active objective is Epic 6 planning. No Epic 6 implementation is authorized by this checkpoint.

## Epic 4 Implementation Checkpoint - Universal Work Records and Recording Gates

**Checkpoint date:** 2026-08-05

**Epic status:** **Completed and frozen**

**Product Owner decision:** Approved on 2026-08-05

**Engineering status:** Implemented and validated locally

**Deployment status:** Not deployed; two additive migrations remain unapplied

**Product Owner demo:** Automated package accepted; the combined live recording/device replay is assigned to Epic 5 and RR-1A
**Primary evidence:** `Project Management/Epic 4 - Universal Work Record and Recording Gates/`

Epic 4 now applies one canonical server-side recording decision across work-record release, employee work/start/stage views, location verification, media-session creation, upload boundaries, vendor status, and admin evidence. The decision includes the current recording assessment, authority, verified permission basis, assignment, employee certification, location evidence, protected-person restrictions, and unresolved exception state.

- Every canonical recording block provides the reason, responsible participant, resolution, and whether service may continue without recording.
- Internal `RecordingGateMetric` evidence records the canonical block reason only and has no review, Trust Score, permission, publication, or dashboard effect.
- Two additive migrations add assessment/authority and certification/location/metric evidence. Deployment remains a prerequisite for the combined Epic 5/RR-1A live recording replay, not a reason to reopen Epic 4.
- Final named regression package: 76 of 76 passed. Epic 4 Playwright package: 4 of 4 passed. Type check and production build passed.
- `CON-02`, `CON-04`, `CON-08` through `CON-14`, `CON-22`, and `CON-23` gain complete Epic 4 implementation evidence but remain release-shared until migration, deployment, Product Owner replay, Epic 5 physical capture, and final RR-1A gates pass.
- `PROD-11`, `PROD-12`, `TEST-04`, `TEST-06`, `SHOT-03`, `SHOT-07`, and `DOC-01` through `DOC-07` gain focused Epic 4 evidence and remain `In Progress` where later device/release evidence is required.
- `LEG-03`, `LEG-04`, and `LEG-11` are not promoted; Epic 4 records operational evidence but does not implement or replace future legal agreements.
- Epic 4 is complete at the roadmap level. Shared release rows remain `In Progress` until Epic 5 device/capture evidence and final RR-1A gates pass.
- Remaining physical-device, screenshot, manager-correction fixture, capture-copy, and dependency-advisory work is explicitly accepted in the Epic 4 Technical Debt record and assigned to Epic 5 or release hardening.
- No further Epic 4 changes are authorized unless a genuine beta defect is discovered.

## Epic 3 Phase A - Identity Foundation

**Phase status:** **Implemented locally; Product Owner review pending**
**Starting commit:** `43c18f9282d14567ce4c40b1fab32bfb97126817`
**Deployment status:** Blocked by unrelated production-build defects
**Primary evidence:** `Project Management/Epic 3 - Trusted Accounts and Role Isolation/`

Phase A establishes the permanent authorization rule: a signed session identifies the candidate user, while current database state determines authority. Canonical actor, active account, ownership, exact vendor membership, employee membership/assignment, database-backed admin grants, admin/general session separation, direct-route protection, and IDOR controls are implemented and validated locally.

- 206 focused unit/integration regression tests and 5 Playwright role-isolation scenarios pass.
- All 35 repository migrations are applied and current.
- Epic 3 is not complete. Phase B remains unauthorized.
- Deployment is not claimed because untouched `pages/support` and `pages/notifications` block the production build after compilation/type/lint.
- Existing dependency audit findings remain a release security gate and require separately approved remediation.

## Epic 2 Completed - Proof-First Platform Shell

**Epic status:** **Completed**
**Product Owner decision:** Approved on 2026-08-02
**Implementation commit:** `cb44c9eaeef905b6cd06b2218fd923e5cc43875d`
**Primary evidence:** `Project Management/Epic 2 - Proof-First Platform Shell/`

Epic 2 aligned the active public and role shell with Reliance's proof-of-service identity while preserving effective copy, stable routes, role boundaries, operational workflows, and the Epic 1 recording gate. The focused implementation, regression, build, UX, and screenshot evidence are complete for the epic.

**Independent five-person comprehension validation:** **Deferred to private beta user feedback.** This is an evidence-gathering activity, not an engineering blocker or application defect. Beta feedback may create a focused follow-up only when it identifies measurable confusion or a genuine defect.

- `PROD-01`, `PROD-02`, and `PROD-09` are complete for the active Epic 2 shell; their release-wide `Beta Ready` state remains `No` until the master release gates pass.
- Shared navigation, accessibility, responsive, screenshot, documentation, and role-journey rows remain `In Progress` where later epics or private-beta hardening own additional evidence.
- No further Epic 2 changes are planned unless private beta identifies a genuine defect.

## Epic 1 Completed - Verified Permission Request

**Deployed package:** `reliance-beta-08de960-epic1-operational-closeout-202608021730.zip`
**Epic 1 corrected application commit:** `08de960c768463f2fea7c407d7bb39e6dcfacb3b`
**Migration state:** All 34 repository migrations applied in Azure beta
**Epic status:** **Completed**
**Product Owner decision:** Approved on 2026-08-02
**Result:** Epic 1 engineering, operational validation, and Product Owner closeout are complete
**Primary evidence:** `Project Management/Epic 1 - Verified Permission Request/`

Controlled live validation passed matching-account verification, email OTP, Allow, Decline, Decide later, Wrong recipient, and read-only masked Admin Permission Audit. Email delivery succeeded. SMS provider acceptance was recorded for a reserved fictional test number; handset receipt was not tested.

The original live walkthrough found that a declined customer-residence record could be released and expose employee camera controls. Commit `97396da` replaced the divergent decisions with one immutable-scope server resolver. Commit `08de960` added assigned-work-record resend/contact-correction UX, superseded-link guidance, and a corrected notification-worker query. The current package is healthy, the scheduler has consecutive successful runs, and a fresh signed-in replay passed live email delivery, login, vendor jobs, and masked recovery controls.

**SMS handset validation:** **Deferred - External Provider Dependency.** Telnyx is not operational yet. This is not classified as an application defect. The enabled application path, OTP handling, provider routing, failure behavior, retry behavior, and secret-safety coverage remain preserved for validation after provider activation.

- `CON-05`, `CON-06`, `CON-24`, `CON-25`, `CON-26`, `SEC-04`, `PROD-11`, `PROD-12`, `TEST-03`, and `TEST-06` remain `In Progress`, but the cross-role gate defect is resolved by deployed code and focused regression evidence.
- `NOT-01` through `NOT-03`, `NOT-05` through `NOT-08`, and `TEST-09` remain `In Progress`; email and scheduler operation are evidenced, while SMS handset/callback validation is externally deferred.
- `SHOT-01`, `SHOT-02`, `SHOT-03`, `SHOT-07`, and `DOC-01` through `DOC-07` gain corrected desktop/mobile evidence but remain `In Progress` pending complete cross-epic role and release evidence.
- Epic 1 is `Completed`. Shared checklist rows that also depend on later epics remain `In Progress`; they are not promoted to `Beta Ready` solely from Epic 1 approval.
- No further Epic 1 changes are planned unless beta validation identifies a genuine defect.


## Beta Feedback Checkpoint - Updates 7-31-26

**Implementation date:** 2026-08-01
**Engineering state:** Six reported workflow/UX issues are implemented and verified; no checklist row is promoted to Beta Ready by this maintenance checkpoint.
**Primary evidence:** `Project Management/Beta Feedback/UPDATES_2026-07-31_ENGINEERING_REPORT.md`

- `PROD-07`, `PROD-10`, `PROD-11`, `TEST-02`, `TEST-03`, `TEST-09`, `TEST-11`, `SHOT-01`, `SHOT-05`, `SHOT-07`, and `SHOT-10` gain implementation or validation evidence.
- The customer proof-ready handoff is focused and account-protected; Manage Jobs operational reads are current after mutations; manager approval retries are idempotent; permission-decision email uses the shared Reliance shell; Analytics uses canonical service-order lifecycle metrics.
- Release status remains unchanged because live provider delivery, full role journeys, the complete screenshot matrix, the Product Owner demo, and unrelated repository-wide test failures remain open.


## Epic 1 Checkpoint - Verified Permission Request

**Implementation date:** 2026-07-31
**Starting commit:** `2ddc4f31560da791330fa67f753593f3962ca544`
**Engineering state:** Implemented and deployed; the customer-residence permission-gate defect found during live validation is corrected in `97396da`.
**Primary evidence:** `Project Management/Epic 1 - Verified Permission Request/`

Epic 1 added a verified, Private-by-default recording-permission request with hashed action links, consent-specific OTP or matching-account verification, authority-role evidence, wrong-recipient handling, durable notification attempts, read-only admin evidence, and recording gates based on canonical verified permission. It did not add publication approval, reviews, ratings, Trust Score inputs, audio recording, withdrawal, or later consent phases.

### Evidence-supported row movement

- `CON-05`, `CON-06`, `CON-24`, `CON-25`, `CON-26`, `SEC-04`, `NOT-06`, and `NOT-07`: Epic 1 implementation, migration deployment, automated coverage, and Product Owner validation are complete; shared release status remains evidence-gated by later epics.
- `CON-01`, `CON-03`, `CON-07`, `CON-27`, `LEG-09` through `LEG-12`, `NOT-01` through `NOT-03`, `NOT-05`, `NOT-08`, `TEST-06`, `TEST-09`, `SHOT-01`, `SHOT-02`, `SHOT-07`, and `DOC-01` through `DOC-07`: remain `In Progress` because later epics, live providers, role-wide evidence, or Product Owner review still own part of the acceptance criteria.
- No row is marked `Beta Ready` from code existence alone.

**Document type:** Master implementation and release tracker

**Status:** Active through private-beta approval

**Repository baseline:** `C:\Users\Cesar Olivera\Project Reliance`

**Purpose:** Ensure that no feature, policy, workflow, notification, legal document, dashboard, security control, deployment dependency, test, screenshot, or user experience is forgotten before Reliance enters private beta.

## 1. Governing Baselines

This checklist tracks implementation against the frozen design baselines. It does not rewrite them:

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
- `RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`

The current executable repository remains the source of truth for implementation status. A design document marked complete does not make the related application behavior complete.

## 2. Tracker Rules

### Status values

| Status | Meaning |
|---|---|
| Not Started | No verified implementation or approved deliverable exists. |
| In Progress | Some verified implementation or design exists, but acceptance criteria are not fully satisfied. |
| Complete | The item is implemented and documented, but may still depend on the final release gate. |
| Blocked | Work cannot proceed until a named dependency or decision is resolved. |
| Deferred | Product Owner approved deferral with written justification and no Critical beta risk. |
| Beta Ready | Implementation, tests, screenshots, documentation, and required approvals are complete. |

### Risk values

| Risk | Release treatment |
|---|---|
| Critical | Must be complete before private beta. No waiver. |
| High | Must be complete unless Product Owner documents a constrained beta exception that does not weaken a Critical control. |
| Medium | Must be complete or have an approved documented decision, mitigation, owner, and target date. |
| Low | May be deferred with Product Owner justification, owner, and target date. |

### Owner values

Only these owner values are used:

- Product Owner
- Codex
- Future Legal Review
- Future Designer
- Future QA
- Shared

### Implementation phases

| Phase | Objective |
|---|---|
| P0 - Baseline | Freeze design, inventory current behavior, and establish traceability. |
| P1 - Identity and reviews | Correct proof-of-service positioning and remove obsolete review-deadline behavior. |
| P2 - Verified permission | Secure request authorization, identity verification, OTP, and wrong-recipient handling. |
| P3 - Agreements and assent | Add durable vendor, employee, customer-registration, policy, and version evidence. |
| P4 - Recording gates | Implement subject assessment, authority, three-location rules, certification, and recording UX. |
| P5 - Exact-video approval | Implement private delivery and exact-video public approval. |
| P6 - Withdrawal and retention | Implement unpublishing, deletion, retention, evidence-only retention, and final disposition. |
| P7 - Protected people | Implement minor, guardian, bystander, redaction, and protected-person controls. |
| P8 - Integrity and security | Complete hashes, audit evidence, authorization, storage integrity, and security hardening. |
| P9 - Policy and support | Align legal documents, Help Center, tutorials, notifications, and AI disclosures. |
| P10 - Validation and release | Complete end-to-end QA, screenshots, deployment evidence, rollback, and beta gate. |
| PX - Product UX | Cross-cutting navigation, dashboard, accessibility, responsive, and visual alignment. |
| OPS - Operations | Azure, GitHub, DNS, monitoring, logging, backups, secrets, and release operations. |

### Required fields

Each section contains two tables linked by item ID.

The first table records:

- Description
- Current implementation
- Required work
- Risk level
- Current Status
- Ready for beta
- Owner

The second table records:

- Dependencies
- Files affected
- Implementation phase
- Acceptance criteria
- Testing requirements
- Screenshot required
- Documentation updated

A value of **Unable to verify** is an active release finding, not evidence of readiness.

## 3. Current Baseline Summary

Verified current strengths include:

- signed customer and admin sessions;
- assignment-bound employee capture access;
- three-stage service-video recording;
- server-side location checks for applicable business-location paths;
- Azure upload initialization, proxy fallback, MIME checks, and duration enforcement;
- manager review;
- admin moderation;
- private/public filtering;
- email/SMS transports and delivery-attempt evidence;
- genuine customer review ownership and moderation;
- AI metadata assistance with output guards; and
- active Terms, Privacy Policy, and SMS Policy pages.

Verified or documented readiness gaps include:

- public identity and navigation still contain marketplace/booking-first language;
- consent-request creation authorization and decision-maker identity are incomplete;
- consent-specific OTP and authority-holder workflows are incomplete;
- durable registration, vendor, and employee assent evidence is incomplete;
- exact-video public approval is implemented locally in Epic 6; migration, deployment, and live replay remain pending;
- withdrawal-to-unpublish is incomplete;
- physical purge, retention scheduling, and evidence-only retention are incomplete;
- minor, guardian, and protected-person workflows are incomplete;
- media content hashes, attestation, malware results, and orphan cleanup are incomplete;
- audit logging is inconsistent across consequential actions;
- live cloud configuration, backups, provider delivery, and infrastructure controls cannot be verified from the repository; and
- full accessibility, responsive, cross-browser, and role-journey release evidence is not complete.

No item should move to **Beta Ready** solely because a route or screen exists.

## 4. Product

### Implementation status

| ID | Item | Description | Current implementation | Required work | Risk | Status | Beta Ready | Owner |
|---|---|---|---|---|---|---|---|---|
| PROD-01 | Platform identity | Present Reliance consistently as a proof-of-service, transparency, and trust platform. | Epic 2 aligns active public and role-shell identity and removes audited marketplace conflicts. | Independent five-person validation is deferred to private beta feedback and is not an engineering blocker. | Critical | Complete | No | Shared |
| PROD-02 | Proof-of-service positioning | Make completed work, service videos, reviews, and Trust Score distinct proof signals. | Homepage, Explore Proof, work detail, and provider profile now lead with completed proof and distinguish all four signals. | Preserve this hierarchy as later workflow epics add capabilities. | Critical | Complete | No | Shared |
| PROD-03 | Navigation | Use role-appropriate proof-first navigation and preserve route compatibility. | Epic 2 applies proof-first labels while preserving stable hrefs; focused route tests pass. | Restore the missing authenticated route-smoke fixture and complete the release-wide link matrix. | High | In Progress | No | Shared |
| PROD-04 | Language guide | Apply the frozen communication standard across every user-facing channel. | Epic 2 aligns active shell, affected Help, errors, empty states, and recommendation-only AI guidance. | Notification/template and full Help alignment remain owned by Epic 10. | High | In Progress | No | Shared |
| PROD-05 | UX specification | Implement all 18 defined consent screens and universal state patterns. | Frozen UX specification exists; its complete application implementation is not verified. | Map screens to current routes/components, implement gaps by approved phase, and complete post-implementation UX package. | Critical | In Progress | No | Shared |
| PROD-06 | Accessibility | Provide keyboard, screen-reader, contrast, focus, status-announcement, and media accessibility. | Radix components and some accessible labels exist; full WCAG AA audit is unavailable. | Complete automated and manual accessibility audit and remediate all Critical/High failures. | High | In Progress | No | Future QA |
| PROD-07 | Responsive layouts | Support mobile and desktop without overlap, clipping, stale controls, or hidden actions. | Epic 2 public shell passes desktop and 390px mobile checks with no horizontal overflow; screenshots are indexed. | Complete tablet, wide-desktop, authenticated-role, zoom, and physical-device matrices. | High | In Progress | No | Shared |
| PROD-08 | Dark theme consistency | Maintain readable, accessible dark-theme surfaces across signed-in platform pages. | Dark styling exists but historical screenshots show inconsistent light cards and low-contrast states. | Audit colors, badges, cards, inputs, videos, banners, and all dynamic states. | Medium | In Progress | No | Future Designer |
| PROD-09 | Homepage | Explain proof-of-service first and remove marketplace identity. | First viewport now identifies Reliance, real completed work, distinct trust signals, and Explore Proof on desktop/mobile. | Gather independent comprehension feedback during private beta; reopen only for measurable confusion or a genuine defect. | Critical | Complete | No | Shared |
| PROD-10 | Customer dashboard | Prioritize service history, service videos, decisions, reviews, and trust context. | Customer work-record detail now includes exact-media Public choices while preserving Private as complete; full dashboard reconciliation remains open. | Complete release-wide synchronized statuses and proof-first organization. | High | In Progress | No | Shared |
| PROD-11 | Vendor dashboard | Show current workflow step, responsible participant, and next valid action. | Vendor work detail now exposes canonical exact-media proposal status and next action; broader dashboard metrics remain unreconciled. | Complete release-wide tabs/cards/metrics and live refresh evidence. | High | In Progress | No | Shared |
| PROD-12 | Employee dashboard | Show assignment, approved scope, block reason, stage, and safe next action. | Assigned-job and recording experiences exist; durable certification and protected-person guidance are incomplete. | Implement UX specification and test correction, reassignment, blocked, and offline/error paths. | Critical | In Progress | No | Shared |
| PROD-13 | Admin dashboard | Provide fair-decision context for moderation, disputes, withdrawals, and operations. | Epic 6 adds an exact-version Public Proof Review queue with customer, participant, vendor, package, presentation, and content evidence. Dispute/withdrawal operations remain future work. | Complete later dispute/withdrawal context and release-wide admin evidence. | Critical | In Progress | No | Shared |

### Release controls

| ID | Dependencies | Files affected | Phase | Acceptance criteria | Testing requirements | Screenshot | Docs updated |
|---|---|---|---|---|---|---|---|
| PROD-01 | Frozen identity and alignment audit | `src/app/page.tsx`; auth pages; public header/footer; public copy | P1 / PX | No active surface describes Reliance as a marketplace, directory, or booking-first product. | Repository language scan; public-route E2E; manual first-time review | Yes | No |
| PROD-02 | PROD-01; real proof metrics | Browse/discover/service/vendor profile/dashboard pages | P1 / PX | Proof is primary; services are supporting context; signals remain distinct. | Component tests; Playwright public/customer journeys; content review | Yes | No |
| PROD-03 | PROD-01; route inventory | public/user/vendor/admin sidebars, headers, footers | PX | Every link works, active states match, labels follow role language, no duplicate/dead routes. | Route smoke; keyboard navigation; mobile menu tests | Yes | No |
| PROD-04 | Frozen language guide | All `src/app`, `src/components`, notification templates, AI prompts, help | P1 / P9 / PX | Prohibited internal terms and pressure language are absent from active user-facing surfaces. | String scan; snapshot tests; human language review | Yes | No |
| PROD-05 | Frozen UX specification; all consent phases | Role pages/components and workflow routes | P4-P10 / PX | All 18 screens include orientation answers, action hierarchy, and complete states. | Full role E2E; manual UX critique; accessibility; screenshot package | Yes | No |
| PROD-06 | Stable implemented screens | Global styles, components, pages, video controls | PX / P10 | WCAG AA for critical paths; no keyboard traps; labels and live states verified. | axe or equivalent; keyboard; screen-reader-oriented manual testing | Yes | No |
| PROD-07 | PROD-05 | All role pages; global CSS; shared layout components | PX / P10 | Required viewport matrix passes with no overlap, clipping, horizontal decision scrolling, or hidden actions. | Playwright viewport suite; device/manual camera checks | Yes | No |
| PROD-08 | Design tokens; PROD-06 | `src/app/globals.css`; shared UI; role pages | PX | Text/status contrast passes; one consistent semantic color system; no unreadable cards. | Contrast audit; visual regression; manual inspection | Yes | No |
| PROD-09 | PROD-01/02/03 | `src/app/page.tsx`; public components | P1 / PX | First viewport identifies Reliance and proof value; CTAs and next content are clear on mobile/desktop. | Public E2E; responsive screenshots; link audit | Yes | No |
| PROD-10 | Workflow states; customer APIs | `src/app/(user)/user-dashboard/page.tsx`; `UserSidebar`; customer APIs | PX / P10 | Status, counts, privacy, and next actions match the same confirmed source. | Customer journey E2E; state synchronization tests | Yes | No |
| PROD-11 | Consent/publication/withdrawal phases | vendor dashboard/jobs components and APIs | P4-P6 / PX | Each work record appears in one correct state; counts/cards refresh immediately after actions. | Vendor journey E2E; mutation refresh tests; mobile | Yes | No |
| PROD-12 | P2/P4/P7; capture authorization | employee pages/APIs; capture token; location; upload | P4 / P7 / PX | Employee always sees scope, audio, stage, stop rules, and reason-specific block recovery. | Employee E2E; camera/device manual; reassignment; failures | Yes | No |
| PROD-13 | P5-P8; audit evidence | admin dashboard/moderation/accounts/reporting routes | P5-P8 / PX | Admin sees exact version and every required decision; cannot widen missing authority. | Admin E2E; authorization; moderation/dispute scenarios | Yes | No |

## 4A. Security And Admin Isolation

These rows were added narrowly because no authoritative SEC/ADM row table was present in the current checklist. Existing unrelated IDs and rows are unchanged.

| ID | Item | Current implementation | Remaining work | Risk | Status | Beta Ready | Owner |
|---|---|---|---|---|---|---|---|
| SEC-01 | Canonical authentication identity | Signed sessions identify only the candidate user; current active `User` is loaded for protected requests. | Durable sessions and lifecycle belong to Phase B. | Critical | Phase A Complete | No | Epic 3 |
| SEC-02 | Database-derived authorization | Customer ownership, exact active vendor membership, manager role, employee membership/assignment, and platform grants determine authority. | Maintain inventory as routes change. | Critical | Phase A Complete | No | Epic 3 |
| SEC-03 | API/direct-route and IDOR protection | Affected routes fail closed with ownership/membership/resource-first checks; focused matrices and Playwright pass. | Complete release-wide independent security review. | Critical | Phase A Complete | No | Shared |
| SEC-06 | Response minimization | Affected denials use 401/403/non-disclosing 404 and do not return unrelated tenant data. | Extend consistency to future routes. | High | In Progress | No | Shared |
| SEC-09 | Security audit evidence | Admin grants and consequential authorization decisions carry actor/resource evidence without raw secrets. | Complete release-wide immutable audit coverage. | High | In Progress | No | Shared |
| ADM-02 | Database-backed admin authority | Active `PlatformRoleGrant(ADMIN)` plus current active user is required. | Add lifecycle management in approved future scope. | Critical | Phase A Complete | No | Epic 3 |
| ADM-03 | Admin session isolation | Admin requires path-scoped signed admin session; general session and bearer fallback are denied. | Durable revocation/logout-everywhere is Phase B. | Critical | Phase A Complete | No | Epic 3 |
| ADM-04 | Admin route/API protection | Admin layout and affected APIs require the canonical admin policy. | Finish release-wide admin attack-surface review. | Critical | In Progress | No | Shared |

Phase A completion here does not mark Epic 3 or the release Beta Ready. Deployment and Product Owner replay remain open.

## 5. Legal

### Implementation status

| ID | Item | Description | Current implementation | Required work | Risk | Status | Beta Ready | Owner |
|---|---|---|---|---|---|---|---|---|
| LEG-01 | Terms of Service | Maintain current, retrievable terms aligned to approved workflows. | Active rendered Terms exist; current audit finds no comprehensive persisted assent/version evidence. | Future legal review after behavior is implemented; version, publish, retrieve, and acceptance history. | Critical | In Progress | No | Future Legal Review |
| LEG-02 | Privacy Policy | Explain actual data collection, location, media, AI, retention, deletion, and participant rights. | Active policy exists; audit identifies incomplete details and unmatched deletion promises. | Align only after implementation; legal review; version and archive each effective policy. | Critical | In Progress | No | Future Legal Review |
| LEG-03 | Vendor Agreement | Record vendor duties, authority, staff responsibility, use limits, and official representation. | Duties appear in Terms; no separate executed vendor agreement record verified. | Draft through counsel and implement durable signer/version/time evidence. | Critical | Not Started | No | Future Legal Review |
| LEG-04 | Employee Agreement | Record employee recording duties, scope, bystander rules, fallback restrictions, and assent. | Invite/preview operations exist; no durable legal employee acknowledgment verified. | Draft through counsel and implement versioned acceptance before assignment/recording. | Critical | Not Started | No | Future Legal Review |
| LEG-05 | SMS Policy | Explain transactional SMS behavior, consent, STOP, providers, and support. | Active SMS Policy and STOP template language exist; registration SMS assent is not persisted. | Legal review and durable opt-in/version evidence; validate sender configuration and delivery. | Critical | In Progress | No | Shared |
| LEG-06 | Email policy | Define transactional email purposes, sender identity, delivery, security, and preferences. | Email templates and Resend transport exist; dedicated approved email policy was not verified. | Decide whether standalone policy is required; document operational rules and delivery handling. | Medium | Not Started | No | Future Legal Review |
| LEG-07 | Cookie policy | Explain required, preference, analytics, and security cookies when applicable. | Signed session and beta-gate cookies exist; dedicated cookie policy/applicability decision not verified. | Inventory cookies and trackers; legal decision; banner/controls only if applicable. | High | Not Started | No | Future Legal Review |
| LEG-08 | AI disclosure | Explain where AI assists, its limits, and human decision ownership. | AI labels/guards exist in code; platform-wide disclosure and acceptance standard are not verified. | Add approved disclosures to affected admin/vendor/support surfaces and policies. | High | In Progress | No | Shared |
| LEG-09 | Consent versioning | Preserve the exact permission language and decision version. | Version strings and hash metadata exist; immutable rendered content/version entity is incomplete. | Implement immutable content versions tied to each decision and retrieval. | Critical | In Progress | No | Shared |
| LEG-10 | Policy versioning | Preserve each legal policy version, effective date, and supersession. | Version labels exist in selected paths; no complete immutable legal-document revision model verified. | Implement version registry, archive, retrieval, and acceptance linkage. | Critical | In Progress | No | Shared |
| LEG-11 | Registration acceptance history | Prove customer/vendor Terms, Privacy, SMS, and applicable agreement acceptance. | UI links/checkboxes exist; APIs do not comprehensively persist signer, time, version, and text. | Add required assent UX and durable evidence for customer, vendor, and employee. | Critical | In Progress | No | Shared |
| LEG-12 | Legal document retrieval | Let participants retrieve current and accepted historical documents. | Current policy routes exist; accepted-version retrieval is not verified. | Add safe version archive and account/admin retrieval without exposing unrelated records. | High | In Progress | No | Shared |

### Release controls

| ID | Dependencies | Files affected | Phase | Acceptance criteria | Testing requirements | Screenshot | Docs updated |
|---|---|---|---|---|---|---|---|
| LEG-01 | Implemented workflow; counsel | `src/app/terms/page.tsx`; policy registry; registration | P9 | Counsel-approved current terms; version retrievable; acceptance tied to actor/time. | Legal signoff; route/access tests; acceptance E2E | Yes | No |
| LEG-02 | P5-P8 behavior; counsel | `src/app/privacy/page.tsx`; policy registry; privacy controls | P9 | Policy matches actual collection, audience, withdrawal, retention, and deletion. | Legal signoff; content-to-code audit; privacy journey | Yes | No |
| LEG-03 | Vendor duties; policy registry | vendor registration/onboarding; schema; admin agreement retrieval | P3 / P9 | Vendor cannot activate required capabilities without versioned acceptance; history retrievable. | Registration/API/auth tests; legal signoff | Yes | No |
| LEG-04 | Employee certification design | invite acceptance; employee onboarding; schema | P3 / P9 | Employee assent recorded before assignment/recording and renewed after material version change. | Invite/onboarding/authorization E2E | Yes | No |
| LEG-05 | Messaging configuration; policy registry | SMS policy; registration; SMS templates/transports | P3 / P9 | Required SMS choice is persisted with version/time; STOP and sender behavior verified. | Unit/integration; live controlled delivery; opt-out test | Yes | No |
| LEG-06 | Legal applicability decision | email templates; suppor…17276 tokens truncated…ack, and partial-completion scenarios. | Critical | Not Started | No | Shared |
| TEST-14 | Security tests | Verify authentication, authorization, input safety, secrets, dependencies, abuse limits, and media access. | Security controls/tests exist in parts; release penetration evidence is incomplete. | Run automated scans, authorization/IDOR matrix, abuse tests, and independent review. | Critical | In Progress | No | Shared |

### Release controls

| ID | Dependencies | Files affected | Phase | Acceptance criteria | Testing requirements | Screenshot | Docs updated |
|---|---|---|---|---|---|---|---|
| TEST-01 | Approved rule inventory | all unit test directories/config | Every phase / P10 | Every critical rule has positive, negative, boundary, and no-side-effect coverage. | Full unit suite with saved report | No | No |
| TEST-02 | Test database/provider doubles | route/service integration suites | Every phase / P10 | Every consequential transition commits atomically, audits, notifies, and fails safely. | Integration suite; transactional/concurrency failures | No | No |
| TEST-03 | Stable beta-like environment/data | Playwright/E2E suites and fixtures | PX / P10 | All role journeys pass independently and end in correct privacy/audit state. | Desktop/mobile browser E2E; retries; cross-role verification | Yes | No |
| TEST-04 | Supported device/browser list | device lab/browser tests | P4-P5 / PX / P10 | Camera/GPS/upload works or gives recoverable truthful failure on each supported combination. | Physical devices; poor network; denied permissions | Yes | No |
| TEST-05 | UX spec and design tokens | all consequential pages/components | PX / P10 | No critical/serious accessibility defect; manual keyboard/screen-reader flow succeeds. | axe; keyboard; screen reader; zoom/contrast | Yes | No |
| TEST-06 | P2-P7 features | consent tests/fixtures | P2-P7 / P10 | All three locations and subject branches enforce the exact approved permission/authority rules. | Decision matrix; wrong actor; time/replay/concurrency | Yes | No |
| TEST-07 | Media/device/storage readiness | recording/upload/playback tests | P4-P8 / P10 | Approved media only; exact stages/versions persist; failures never fabricate success. | Real-device, MIME/duration/hash, outage, replacement, reassignment | Yes | No |
| TEST-08 | Review Phase 1 and Trust Score | review/Trust Score/UI/template tests | P1 / P10 | Review is optional/non-expiring; no-review is neutral; genuine review rules remain intact. | Unit/integration/E2E; repository wording scan | Yes | No |
| TEST-09 | Provider sandbox/live accounts | notification tests/templates/callbacks | P2-P9 / P10 | Intended recipient gets accurate content once; failures/retries are visible and audited. | Snapshot; provider; delivery callback; opt-out; duplicate | Yes | No |
| TEST-10 | Admin auth and seeded evidence | admin test suites | P5-P8 / P10 | Epic 6 exact-version moderation and denial tests pass locally; dispute/report coverage remains later work. | Role matrix; direct API; moderation/dispute/report | Yes | No |
| TEST-11 | Agreed golden journeys | repository full suite/CI | Every phase / P10 | No approved existing journey regresses; failures are triaged as new or pre-existing. | Full CI/build plus golden E2E | Yes | No |
| TEST-12 | Capacity assumptions/monitoring | load scripts/results/dashboards | OPS | Error/latency/resource use stays within approved threshold with no data/access corruption. | Ramp/spike/soak/media concurrency | Yes | No |
| TEST-13 | Observable staging environment | fault/restore/rollback scripts and runbooks | P8 / OPS / P10 | Each injected failure preserves privacy/evidence and returns to a consistent recoverable state. | Chaos/fault injection; recovery/rollback drills | Yes | No |
| TEST-14 | Complete attack surface | security test config/reports | Every phase / P10 | No unresolved critical/high exploitable issue; accepted medium risks have owner/date/mitigation. | SAST/SCA/secret/DAST; auth matrix; penetration test | No | No |

## 17. Screenshots

The screenshot package is release evidence, not decoration. Capture only controlled test data; exclude secrets, real customer data, OTPs, access tokens, private media, browser password prompts, and unrelated browser content. Each image must include the build/commit, role, viewport/device, test case, and capture date in its index entry.

### Implementation status

| ID | Item | Description | Current implementation | Required work | Risk | Status | Beta Ready | Owner |
|---|---|---|---|---|---|---|---|---|
| SHOT-01 | Customer screens | Capture permission, wrong-recipient, decline/allow, private proof, publication, review, withdrawal, dispute, and recovery states. | Epic 6 adds controlled desktop/mobile exact-media and Private-outcome evidence; later review/withdrawal/dispute and release-wide states remain open. | Complete remaining release states and live replay captures. | High | In Progress | No | Future QA |
| SHOT-02 | Vendor screens | Capture work-record creation, assessment, authority, assignment, status, review, correction, and outcomes. | Epic 6 adds a controlled Final Result-only proposal capture; full release-wide vendor set remains incomplete. | Complete live role/state and location-branch captures. | High | In Progress | No | Future QA |
| SHOT-03 | Employee screens | Capture assignment, scope, certification, location, blocked, three stages, upload, retry, and submission. | Historical phone screenshots exist; release-quality device set is absent. | Capture supported real devices and permission/failure states. | High | Not Started | No | Future QA |
| SHOT-04 | Admin screens | Capture moderation, evidence, restrictions, disputes, appeals, reporting, and audit history. | Epic 6 adds controlled exact-media evidence/moderation capture; live unauthorized, dispute, appeal, and reporting states remain open. | Complete release-wide admin package after deployment and later epics. | High | In Progress | No | Future QA |
| SHOT-05 | Responsive layouts | Prove critical screens fit without overlap, clipping, unreadable chips, or hidden actions. | Responsive styling exists; systematic evidence is incomplete. | Capture supported narrow mobile, tablet, laptop, and wide desktop viewports. | High | Not Started | No | Future QA |
| SHOT-06 | Accessibility states | Capture focus, zoom, contrast, validation, reduced-motion, and assistive text where visual evidence helps. | No verified package. | Add images alongside automated/manual accessibility results. | Medium | Not Started | No | Future QA |
| SHOT-07 | Empty/loading/success/failure | Capture non-happy states defined by the UX specification. | Such states exist in parts; complete inventory is absent. | Capture every consequential screen's loading, empty, success, failure, and recovery states. | High | In Progress | No | Future QA |
| SHOT-08 | Before/after | Document material UX corrections when a trustworthy comparison exists. | Historical user screenshots may provide references but are not uniformly reproducible. | Use only comparable build/state/viewport pairs and explain the changed outcome. | Medium | Not Started | No | Shared |
| SHOT-09 | Index and redaction | Make every image traceable, reviewable, and safe to share. | Epic 2 has an indexed, redaction-reviewed shell package; a release-wide master index remains absent. | Merge each epic package into the release manifest and complete second-person review. | High | In Progress | No | Future QA |
| SHOT-10 | UX observations | Pair screenshots with honest first-time-user findings and severity. | Epic 2 records scripted first-time and four-role observations with evidence. | Add private-beta comprehension feedback and later workflow-epic observations to the release-wide package. | High | In Progress | No | Shared |

### Release controls

| ID | Dependencies | Files affected | Phase | Acceptance criteria | Testing requirements | Screenshot | Docs updated |
|---|---|---|---|---|---|---|---|
| SHOT-01 | Customer UX implemented/tested | release evidence package/customer | PX / P10 | All approved customer states represented with controlled data and clear next action/privacy. | Visual review against UX checklist | Yes | No |
| SHOT-02 | Vendor UX implemented/tested | release evidence package/vendor | PX / P10 | All consequential vendor states and three location selections represented. | Visual/state comparison | Yes | No |
| SHOT-03 | Employee UX implemented/tested | release evidence package/employee | PX / P10 | Scope, blockers, stages, recovery, and submission are readable on supported phones. | Device screenshot review | Yes | No |
| SHOT-04 | Admin UX implemented/tested | release evidence package/admin | PX / P10 | Evidence and decision basis are visible without exposing unnecessary private data. | Role/privacy visual review | Yes | No |
| SHOT-05 | Supported viewport list | release evidence package/responsive | PX / P10 | No overlap/clipping/hidden action; longest approved text fits. | Screenshot diff across viewports | Yes | No |
| SHOT-06 | Accessibility testing | release evidence package/accessibility | PX / P10 | Visual evidence supports, but does not replace, accessibility test results. | Zoom/focus/contrast review | Yes | No |
| SHOT-07 | State inventory | release evidence package/states | PX / P10 | Each screen has required non-happy states or a documented non-applicability. | State checklist review | Yes | No |
| SHOT-08 | Comparable historical capture | release evidence package/comparisons | P10 | Each pair names builds, state, viewport, issue, and verified improvement. | Human review | Yes | No |
| SHOT-09 | All screenshot sets | screenshot manifest/redaction record | P10 | Every file is indexed and cleared of sensitive data before distribution. | Manifest audit; second-person redaction review | Yes | No |
| SHOT-10 | Journey testing | UX observations and journey summaries | P10 | Every confusing page has severity, evidence, recommendation, owner, and disposition. | First-time-user review; Product Owner sign-off | Yes | No |

## 18. Release Documentation And Evidence Package

These deliverables are mandatory after implementation and before the final beta decision. They must describe what was actually tested, not what the design intended.

### Implementation status

| ID | Item | Description | Current implementation | Required work | Risk | Status | Beta Ready | Owner |
|---|---|---|---|---|---|---|---|---|
| DOC-01 | Engineering report | Record implementation scope, architecture impact, migrations, security, tests, deployment, rollback, and known limitations. | Epic 6 engineering report is complete locally; final release report remains pending. | Consolidate committed/deployed evidence at release gate. | Critical | In Progress | No | Codex |
| DOC-02 | Screenshot package | Provide indexed, redacted visual evidence for all roles and consequential states. | Not yet produced for the frozen workflow. | Complete SHOT-01 through SHOT-10. | High | In Progress | No | Future QA |
| DOC-03 | UX observations | Critique the implemented experience honestly against the frozen UX specification. | Epic 6 includes four-role UX review; release-wide critique remains pending. | Add live beta and later-epic findings. | High | In Progress | No | Shared |
| DOC-04 | Customer journey summary | Summarize first-time customer paths, decisions, privacy, failure recovery, and final outcomes. | Not yet produced from implemented build. | Document tested paths and unresolved friction with screenshot references. | High | In Progress | No | Shared |
| DOC-05 | Vendor journey summary | Summarize work-record creation through final disposition for all three location selections. | Not yet produced from implemented build. | Document tested paths, state transitions, and unresolved friction. | High | In Progress | No | Shared |
| DOC-06 | Employee journey summary | Summarize assignment, scope, recording, upload, recovery, reassignment, and submission. | Not yet produced from implemented build. | Document supported devices and every tested blocking/recovery state. | High | In Progress | No | Shared |
| DOC-07 | Admin journey summary | Summarize moderation, evidence, restriction, dispute, appeal, reporting, and audit. | Not yet produced from implemented build. | Document tested decisions, role boundaries, and unresolved fairness/privacy issues. | High | In Progress | No | Shared |
| DOC-08 | Release decision record | Preserve final gate results, accepted risks, deferrals, approvals, commit/build, deployment, and monitoring window. | This master checklist establishes the structure; final record is pending. | Complete at go/no-go and update after deployment closeout. | Critical | Not Started | No | Shared |

### Release controls

| ID | Dependencies | Files affected | Phase | Acceptance criteria | Testing requirements | Screenshot | Docs updated |
|---|---|---|---|---|---|---|---|
| DOC-01 | All implementation/testing/deployment evidence | final engineering report | P10 | Report matches final commit/build and names every unrun test or limitation. | Second-person evidence review | No | No |
| DOC-02 | SHOT-01 through SHOT-10 | final screenshot package and index | P10 | Complete, traceable, redacted, readable package approved by Product Owner. | Manifest/redaction/visual audit | Yes | No |
| DOC-03 | UX walkthroughs and screenshots | final UX observations | P10 | Honest findings cover all roles; critical confusion blocks release until resolved. | UX checklist and Product Owner review | Yes | No |
| DOC-04 | Customer E2E and SHOT-01 | customer journey summary | P10 | First-time user can understand why, action, no-action result, next step, and privacy. | Journey replay and evidence check | Yes | No |
| DOC-05 | Vendor E2E and SHOT-02 | vendor journey summary | P10 | Every location/subject branch and status transition is represented accurately. | Journey replay and evidence check | Yes | No |
| DOC-06 | Employee E2E and SHOT-03 | employee journey summary | P10 | Supported device paths and safe stopping/recovery rules are represented accurately. | Journey replay and evidence check | Yes | No |
| DOC-07 | Admin E2E and SHOT-04 | admin journey summary | P10 | Decision evidence, role limits, disputes, and appeals are represented accurately. | Journey replay and evidence check | Yes | No |
| DOC-08 | All critical gates | signed release decision and deployment closeout | P10 / OPS | Every exception has owner, justification, mitigation, date, and Product Owner decision. | Final checklist audit | Yes | No |

## 19. Beta Release Gate

### 19.1 Current Gate Verdict

**Current status: Blocked**

The current executable product includes substantial working foundations, but this checklist identifies unresolved Critical release gates in migration/deployment validation, withdrawal and unpublishing, evidence integrity, retention and physical purge, security validation, production provider validation, recovery, and complete cross-role testing. Epic 6 exact-media publication is implemented locally but is not release evidence until deployed and replayed. Those gaps prevent a responsible **Beta Ready** designation.

This is a readiness judgment, not a statement that the current application has no usable features. The gate remains blocked until the criteria below are satisfied with implementation and evidence.

### 19.2 Mandatory Gate Rules

| Gate | Requirement | Evidence required | Decision authority | Current result |
|---|---|---|---|---|
| GATE-01 | Every Critical item is `Complete` or `Beta Ready`; no Critical item may be deferred. | Tracker rows, implementation evidence, tests, screenshots where required, and documentation. | Shared | Blocked |
| GATE-02 | Every High/Medium item is complete or has an explicit documented risk decision, mitigation, owner, and target date. | Risk register and Product Owner decision. | Product Owner | Blocked |
| GATE-03 | Low items may be deferred only with written justification, owner, and confirmation they do not weaken privacy, security, evidence, or a core journey. | Deferral record. | Product Owner | In Progress |
| GATE-04 | No frozen baseline was changed without a separately approved versioning decision. | Git diff and baseline checksum/version review. | Product Owner | Complete for this checklist task |
| GATE-05 | Full type check, lint, unit, integration, E2E, regression, security, accessibility, and production build gates pass, or an unrelated failure is documented and accepted without hiding release impact. | Saved command output and CI/build links. | Shared | Blocked |
| GATE-06 | Controlled live beta tests pass for email, SMS, location, media storage/playback, AI where enabled, authentication, and monitoring. | Test accounts, provider evidence, redacted screenshots/logs. | Shared | Blocked |
| GATE-07 | All four role journeys pass on supported desktop/mobile environments with correct privacy, audit, notification, and recovery outcomes. | E2E report, journey summaries, screenshot index. | Shared | Blocked |
| GATE-08 | Rollback, restore, incident response, and provider-failure exercises meet approved targets. | Exercise reports and named on-call owners. | Shared | Blocked |
| GATE-09 | Engineering report, screenshot package, UX observations, four journey summaries, and release decision record are complete. | DOC-01 through DOC-08. | Shared | Blocked |
| GATE-10 | Product Owner gives explicit go/no-go after reviewing unresolved risk, UX findings, legal-review flags, and release evidence. | Dated decision record. | Product Owner | Blocked |

### 19.3 Required Sign-Offs

| Area | Required owner | Approval condition | Status |
|---|---|---|---|
| Product identity and scope | Product Owner | Product remains proof-of-service, not marketplace; role and outcome language is consistent. | In Progress |
| Consent and privacy behavior | Product Owner / Shared | Approved architecture/workflow decisions are implemented exactly and tested across all three locations. | Blocked |
| Legal review flags | Future Legal Review | Review items are resolved or explicitly accepted by Product Owner without claiming legal guarantee. | Not Started |
| Engineering quality | Codex | Scope, migrations, security, tests, build, deployment, rollback, and limitations are evidenced. | Not Started |
| UX quality | Future Designer / Product Owner | UX checklist passes; no unresolved critical first-time-user confusion. | Not Started |
| QA | Future QA | Supported journey/device/browser matrix passes with evidence. | Not Started |
| Operations | Shared | Providers, monitoring, response, backup, restore, rollback, and support ownership are ready. | Not Started |

### 19.4 Final Go/No-Go Record

Complete this table only after every gate has been reviewed.

| Field | Final value |
|---|---|
| Release name/version | Pending |
| Repository | Project Reliance |
| Branch | `cursor-latest-build` at checklist creation |
| Release commit | Pending |
| Build/deployment identifier | Pending |
| Beta URL/environment | Pending controlled verification |
| Gate review date | Pending |
| Product Owner decision | **NO-GO until GATE-01 through GATE-10 pass** |
| Approved exceptions | None recorded |
| Monitoring window and owner | Pending |
| Rollback trigger and owner | Pending |
| Final evidence package | Pending |

## 20. Checklist Maintenance

1. Update this file when implementation or verified evidence changes an item's status; do not mark work complete from intent alone.
2. Link every `Complete` or `Beta Ready` item to its commit, tests, screenshots where required, and updated documentation.
3. Preserve failed-test and rollback evidence. A clean summary must not erase the path used to reach the decision.
4. When an implementation supersedes a baseline statement, version the governing document through Product Owner approval before changing this tracker's rule.
5. Re-run the final gate after every release-candidate change, migration, provider configuration change, security fix, or frozen-language change.
6. Keep real customer data, credentials, tokens, private media, and provider secrets out of this checklist and all release evidence.
