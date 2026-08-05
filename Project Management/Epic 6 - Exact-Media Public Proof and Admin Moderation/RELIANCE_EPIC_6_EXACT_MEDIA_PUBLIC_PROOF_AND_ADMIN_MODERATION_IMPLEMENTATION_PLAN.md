# RELIANCE EPIC 6 - EXACT-MEDIA PUBLIC PROOF AND ADMIN MODERATION IMPLEMENTATION PLAN

**Plan date:** 2026-08-05  
**Planning baseline commit:** `dcf634739b9d0aa726a2916b82862cc11ecb0f82`  
**Branch:** `codex/epic3-beta-admin-grant-correction`  
**Status:** Product Owner review required  
**Implementation authorization:** Not granted  

## 1. Scope Confirmation

Epic 6 delivers one complete experience after Epic 5 Private proof is available:

1. A vendor manager intentionally proposes exact completed media for Public proof.
2. Final Result is the only default proposal.
3. Starting Condition and Work in Progress remain Private unless intentionally proposed as separate stages.
4. The authorized customer or representative previews the exact current media and chooses all, some, none, or correction.
5. Every applicable participant decision is bound to the same package, stage version, content hash, audience, labels, captions, audio state, and redaction state.
6. The vendor manager confirms that the selected media may officially represent the business.
7. Admin moderation receives only complete, version-matched proposals and may approve, reject, flag, require correction, or narrow exposure.
8. Public routes serve media only when the complete canonical authority chain and the exact admin-moderated version remain valid.
9. Private remains a complete outcome when publication is declined, partially approved, ignored, blocked, or returned for correction.

This plan does not redesign recording permission, customer registration, work-record gates, capture, Private proof, reviews, Trust Score, withdrawal, disputes, retention, deletion, legal policies, or AI.

### Numbering note

The frozen roadmap originally labels this experience as Epic 7 because Verified Permission Request was moved earlier after roadmap approval. The permanent Project Management workspace and active sequence call it **Epic 6**. This plan changes no frozen roadmap content; both labels refer to the same approved experience.

## 2. Success Definition

Epic 6 succeeds only when Public visibility is a derived server-side result of one complete, immutable, version-matched evidence chain:

```text
Manager-approved Private package
  -> vendor exact-media proposal
  -> customer/authority-holder exact-media decision
  -> applicable employee/guardian/speaker authority
  -> vendor official-representation approval
  -> admin moderation of the same exact version
  -> canonical Public eligibility decision
  -> public serving of that exact version only
```

No UI flag, booking metadata field, legacy visibility choice, admin shortcut, or raw `visibilityStatus` update may bypass this chain.

## 3. Checklist Items Included

The frozen roadmap assigns this experience to:

- `CON-15`, `CON-27`
- `VID-07`, `VID-09` through `VID-13`
- `ADM-01`
- publication portions of `SEC-05` and `SEC-08`
- applicable `NOT-*`
- `TEST-10`
- `SHOT-01`, `SHOT-02`, `SHOT-04`, `SHOT-07`
- related `DOC-*` deliverables

Those legacy row identifiers are not all present as literal rows in the current consolidated checklist. The current tracker rows affected by this implementation are expected to include:

- `PROD-05`, `PROD-10`, `PROD-11`, `PROD-13`
- `SEC-02`, `SEC-03`, `SEC-06`, `SEC-09`
- `ADM-02`, `ADM-03`, `ADM-04`
- `TEST-02`, `TEST-03`, `TEST-06`, `TEST-07`, `TEST-10`, `TEST-11`, `TEST-14`
- `SHOT-01`, `SHOT-02`, `SHOT-04`, `SHOT-07`
- `DOC-01` through `DOC-07`

No row will be marked Beta Ready from code existence alone. Exact row movement will be based on implementation, tests, screenshots, deployment evidence, and Product Owner validation.

## 4. Dependencies Verified

### Required foundations

- Epic 1 verified permission remains the recording authority foundation and is not publication approval.
- Epic 2 product identity and language rules remain frozen.
- Epic 3 Phase A database-derived actor, membership, ownership, admin isolation, and IDOR controls remain mandatory.
- Epic 4 canonical assessment, authority, protected-person, location, assignment, and recording-gate evidence remain intact.
- Epic 5 supplies exact stage hashes, stage versions, capture provenance, package versions, manager decisions, and Private customer access.

### Operational dependency

Epic 5's additive migration and application package must be deployed before an Epic 6 package can be deployed. Planning may proceed now, but Epic 6 integration and beta replay cannot claim completion against a beta database that lacks the Epic 5 evidence schema.

## 5. Frozen Governing Documents

Implementation must follow these frozen baselines without rewriting or reinterpreting them:

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`, especially Sections 9, 10, 13, 14, 15, 16, and 17
- `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`, especially PO-04, PO-06, PO-07, PO-08, PO-10, PO-11, and PO-12
- `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
- `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`

If executable constraints conflict with a frozen rule, implementation stops and the conflict is presented to the Product Owner.

## 6. Current Repository Audit

### Foundations that should be preserved

- `ServiceVideoStageEvidence` records current stage version, content hash, provenance, employee, session, canonical gate decision, and Public eligibility input.
- `ServiceVideoPackageEvidence` records exact package version, package hash, stage evidence set, and manager submission state.
- `ServiceVideoManagerDecisionEvidence` binds a manager decision to a package hash and named stages.
- `PrivateProofAccessGrant` grants the authorized customer access to an approved Private package.
- `MediaAsset` now contains content hash, capture provenance, stage version, replacement lineage, and a Public-eligibility field.
- Epic 3's admin and tenant authorization helpers already provide the required actor boundary.

### Active gaps that Epic 6 must replace or constrain

1. `src/app/api/admin/media/packages/[bookingId]/moderate/route.ts` currently:
   - moderates the latest three assets rather than a canonical publication proposal;
   - accepts Public visibility directly;
   - can derive Public visibility from advance booking metadata;
   - does not require exact post-capture customer, vendor, employee-likeness, guardian, speaker, or bystander evidence;
   - can notify and create operational Trust outcomes from this shortcut.

2. `src/app/api/admin/media/[assetId]/moderate/route.ts` currently permits direct `approve_public` and `set_visibility_public` actions without the full authority chain.

3. `src/lib/admin-media-moderation-queue.ts` and `src/lib/admin-media-moderation-packages.ts` assemble latest-stage assets by booking and moderation state. They do not require an immutable proposal, exact package version, participant decisions, or an exact-media eligibility decision.

4. `src/app/admin/media-moderation/AdminMediaModerationClient.tsx` reflects the legacy moderation model and can present audience controls broader than the approved Private/Public participant-facing model.

5. Public-serving routes such as:
   - `src/app/api/vendors/[vendorId]/public/route.ts`
   - `src/app/api/services/[id]/media/route.ts`
   - `src/app/api/services/discover/route.ts`
   - `src/app/api/services/[id]/route.ts`
   currently rely primarily on asset moderation and visibility fields rather than the complete exact-media authority chain.

6. Public UI components such as `src/components/public/PublicMediaPreview.tsx`, `src/components/public/ProofFirstCard.tsx`, `src/app/page.tsx`, and `src/app/vendors/[vendorId]/page.tsx` need to consume only canonical Public projections.

7. No active schema model records the publication proposal, proposed exact stages, customer per-stage decision, vendor official-representation approval, applicable likeness/speaker/guardian decision, admin exact-version decision, or canonical publication state.

8. Existing Public media without exact post-capture approval remains visible under the legacy path and must return to Private during the controlled transition required by PO-12.

### Current behavior that remains out of scope

- Genuine customer reviews and their moderation remain separate.
- Trust Score redesign remains Epic 8.
- AI moderation redesign remains Epic 9.
- Withdrawal, disputes, retention, deletion, and final disposition remain Epic 7 in the active Project Management sequence.

## 7. User Experience Delivered

### Vendor manager

- Opens a manager-approved Private Service Video.
- Sees that Private is already complete and Public is optional.
- Starts a publication proposal with Final Result selected by default.
- May intentionally add Starting Condition or Work in Progress, each as a separate exact-stage request.
- Reviews media, people/audio indicators, captions, labels, and Public audience before sending.
- Sees clear states: Draft, Customer Decision Needed, Correction Requested, Participant Approval Needed, Ready for Admin Review, Under Admin Review, Public, Declined, or Private.

### Customer or authorized representative

- Receives a focused exact-media request only after media exists.
- Sees why they are being asked, what Public means, what remains Private, and that No or no action leaves proof Private.
- Previews the exact proposed clips and associated presentation metadata.
- Chooses all, some, none, or requests correction/redaction.
- Never sees an advance publication choice as equivalent to this decision.

### Employee and other applicable participants

- An identifiable employee may approve or decline use of their likeness for the exact proposed version.
- An employee cannot publish customer-controlled media or approve for another person.
- Identifiable minors cannot enter the Public chain in Version 1.
- Every audible speaker requires appropriate authority; otherwise audio must be removed and the corrected version reapproved.

### Admin

- Receives only complete proposals whose required decisions match the exact version.
- Sees package/stage hashes, provenance, proposal scope, participant roles, decision timestamps, and restriction indicators without unnecessary private data.
- May approve, reject, flag, require correction, or narrow to Private.
- Cannot widen the maximum participant-approved audience, approve a changed version, supply missing authority, or convert Private to Public independently.

### Public visitor

- Sees only the exact approved stages and presentation version.
- Has no intentional source-file download control.
- Never sees fallback media or an identifiable minor.

## 8. Expected Repository Impact

### Routes

Expected new or materially affected route surfaces:

- Vendor proposal/status surface under the existing vendor job or proof-detail experience
- Customer exact-media decision route associated with the authorized work record
- Admin exact-media moderation queue and evidence-detail route
- Public Service Video and public vendor/service proof surfaces

Stable route compatibility should be preserved where practical. New authority must be server-enforced regardless of UI route.

### APIs

Expected API capabilities:

- create/update/cancel a draft exact-media proposal;
- submit exact stage/version/hash proposal;
- fetch authorized exact-media proposal and current decisions;
- customer all/some/none/correction decision;
- applicable participant likeness/audio/guardian decision;
- vendor official-representation approval;
- submit complete proposal to admin;
- admin approve/reject/flag/correction/narrow action;
- canonical Public eligibility resolver;
- canonical public-serving projection;
- compatibility guards that retire direct legacy Public mutation paths.

Every mutation must enforce authentication, database-derived authorization, ownership/membership, exact version, optimistic concurrency or idempotency, audit evidence, and no-side-effect failure.

### Database

Expected additive evidence models:

- publication proposal header tied to an exact `ServiceVideoPackageEvidence` version and hash;
- proposed stage rows tied to exact `ServiceVideoStageEvidence` and `MediaAsset` identities;
- participant decision evidence with role/authority, decision, media version, audience, and decision time;
- vendor official-representation decision;
- admin moderation decision tied to the same proposal/version;
- canonical publication state or projection evidence;
- notification attempt linkage where current generic delivery evidence is insufficient.

No destructive deletion of Epic 5 evidence is planned.

### Components

Expected affected components include:

- vendor job/proof proposal controls and status cards;
- customer exact-preview and per-stage decision controls;
- correction/redaction request surface;
- admin moderation evidence panel and queue;
- public proof cards and media preview;
- shared status, empty, loading, success, failure, and blocked components.

### Notifications

Expected transactional events:

- exact-media approval requested;
- corrected version available;
- customer approved some/all, declined all, or requested correction;
- participant approval required or decided;
- proposal ready for admin review;
- admin approved, rejected, flagged, or requested correction;
- selected media became Public.

Notifications must identify the work record and action without exposing raw tokens, unnecessary private media, or authority details. No response remains Private and does not trigger pressure reminders.

### Shared libraries

Expected services:

- exact-media proposal service;
- exact-version decision service;
- participant-authority resolver;
- canonical Public eligibility resolver;
- canonical public-proof projection;
- legacy-public transition/report helper;
- publication audit event writer;
- notification orchestrator.

### Middleware and authorization

No broad session redesign is expected. Existing Epic 3 helpers will be extended to exact resource ownership and participant authority. Public routes must not infer eligibility from session state or raw visibility metadata.

### AI

No AI expansion is authorized. Existing metadata assistance must remain recommendation-only and cannot create, widen, or satisfy an approval. If it cannot be safely isolated from the new canonical moderation decision, its exact-media action must remain disabled until Epic 9.

### Dashboards

Vendor, customer, and admin views should display the same canonical publication state. Public counts and cards must derive only from canonical Public projections. This epic will not redesign Trust Score or unrelated dashboard metrics.

### Policies

No Privacy Policy, Terms, SMS Policy, agreement, or legal-governance rewrite is included. Only approved operational explanations from the frozen UX/language baselines may be used.

### Documentation

The Epic 6 Project Management package must be completed:

- `01_Engineering_Report.md`
- `02_UX_Review.md`
- `03_Product_Owner_Demo.md`
- `04_Lessons_Learned.md`
- `05_Technical_Debt.md`
- `06_Checklist_Snapshot.md`
- `07_Git_Checkpoint.md`
- indexed desktop/mobile/before/after screenshots
- updated `PROJECT_DASHBOARD.md`
- updated Beta Readiness Checklist rows

## 9. Database Migration Strategy

### Expected migrations

Two controlled additive checkpoints are recommended:

1. **Exact-media publication evidence migration**
   - Adds proposal, stage, participant, vendor, admin, and canonical-state evidence.
   - Adds unique constraints that prevent duplicate active proposals and mismatched decisions.
   - Adds indexes for customer, vendor, admin queue, exact hash/version, and public projection reads.

2. **Legacy Public restriction migration or controlled data operation**
   - Identifies active Public media lacking the full exact-media chain.
   - Returns those records to Private before the new public-serving code is mounted.
   - Preserves media, historical moderation facts, prior metadata, and a transition audit record.
   - Does not fabricate customer decisions or recreate publication authority.

### Migration gates

- Produce pre-migration counts by visibility, moderation state, stage, vendor, provenance, and evidence completeness.
- Dry-run legacy classification using identifiers only; do not include private media or customer data in reports.
- Verify restore capability before applying the restriction operation.
- Apply schema before application package.
- Apply Private restriction before enabling canonical public-serving paths.
- Reconcile counts after migration and prove no unauthorized Public records remain.

### Rollback constraint

Rollback must never restore unauthorized Public exposure. Application rollback may return to a prior package only if a server-side or operational restriction continues to keep migrated media Private.

## 10. Security and Privacy Considerations

- Database state, not client metadata, determines actor authority and publication eligibility.
- Advance recording visibility choices are not publication decisions.
- Proposal and decision links must use the existing secure account/claim pattern or a stronger approved mechanism; raw bearer possession alone cannot broaden authority.
- Every proposal and decision must use the exact current package/stage/content hash.
- Changed media or presentation metadata invalidates affected decisions.
- Direct admin Public actions must be removed, compatibility-blocked, or constrained through the canonical resolver.
- Admin can narrow to Private but cannot widen authority.
- Fallback media is never Public.
- Identifiable minors are never Public in Version 1.
- Every audible speaker must have applicable authority or audio must be removed.
- Customer/business authority does not automatically cover employees, visitors, contractors, household members, or bystanders.
- Public endpoints return only approved fields and canonical media references.
- No intentional public source-file download control is added.
- Logs, API responses, dashboards, screenshots, and audit metadata must not expose raw decision tokens, OTPs, private blob URLs, or unnecessary personal data.
- No publication event may create a customer review or rating.

## 11. UX Considerations

- Educate before asking: why Public proof is proposed, what will be Public, what No means, and what happens next.
- Keep Private visibly complete and neutral.
- Use clip previews and stage labels instead of long legal text.
- Show Final Result selected by default and explain that other stages are optional separate choices.
- Present all/some/none/correction as equal legitimate outcomes without pressure colors or countdowns.
- Clearly identify audio, visible people, labels, captions, and redactions.
- Give every blocked state a specific reason, responsible participant, and resolution.
- On mobile, each decision must remain readable without horizontal scrolling or hidden controls.
- Admin evidence hierarchy should lead with exact version and missing/complete authority, then moderation actions.
- Public pages should distinguish a Public Service Video from reviews, Trust Score, and Services Offered.

## 12. Backward Compatibility

### Preserved

- Existing Private proof and authorized customer/vendor-manager access.
- Existing manager correction and approval history.
- Existing recording permission, location, employee, and package evidence.
- Stable vendor/customer/admin navigation where practical.
- Genuine reviews and review moderation.
- Existing Public page URLs may remain valid but must stop serving media until exact approval exists.

### Intentionally changed

- Advance public/private preference no longer authorizes Public visibility.
- Direct admin Public visibility actions no longer bypass participant authority.
- Legacy Public media without exact approval becomes Private.
- Public discovery and profiles consume only canonical Public projections.
- Participant-facing audience choices are Private or Public only.

### Not preserved as authority

- Booking metadata publication choices.
- Latest-asset inference without exact package identity.
- Legacy Public moderation state standing alone.
- Admin audience widening.

## 13. Risks

| Risk | Level | Mitigation |
|---|---|---|
| Legacy Public media remains exposed during transition | Critical | Restrict to Private before mounting new code; verify all public routes and caches |
| Hash/version mismatch publishes changed media | Critical | Exact foreign keys, content hashes, optimistic concurrency, invalidation tests |
| Admin shortcut bypasses participant authority | Critical | One canonical resolver; block direct visibility mutation paths |
| Incorrect person authority is treated as universal | Critical | Role-specific authority evidence and explicit missing-participant blocks |
| Partial approval accidentally publishes all stages | Critical | Per-stage proposal and decision rows; Final Result-only default |
| Audio or identifiable minor becomes Public | Critical | Hard eligibility blocks and negative route tests |
| Public cache serves formerly Public media | High | Cache-key/version review, invalidation, direct URL tests, rollback restriction |
| Existing Trust Score behavior changes unintentionally | High | No score redesign; focused no-side-effect regression |
| Notification retries create duplicate requests | Medium | Idempotency keys and current delivery-attempt patterns |
| Very large UI/API change produces state drift | High | Canonical server status payload consumed by all roles |

## 14. Rollback Strategy

1. Keep schema changes additive and backward-compatible.
2. Separate legacy restriction evidence from application package activation.
3. Preserve all proposal and decision records if application rollback occurs.
4. Never roll Public visibility backward to a less restrictive state.
5. Maintain a feature gate that can keep all exact-media publication actions disabled while Private proof continues to work.
6. If the new public projection fails, disable Public serving and leave media Private.
7. Keep prior admin moderation pages read-only or compatibility-blocked rather than allowing legacy Public mutations.
8. Record package, migration, counts, cache actions, and rollback commands in the Engineering Report without secrets.

## 15. Test Plan

### Unit tests

- Final Result-only default proposal.
- Separate stage proposal and decision rules.
- all/some/none/correction state transitions.
- exact package/stage/hash/version binding.
- participant authority requirements by media scope.
- fallback, identifiable-minor, unresolved-bystander, and unauthorized-audio blocks.
- edit/replacement/crop/blur/mute/caption/label invalidation.
- canonical Public eligibility resolver.
- Private neutrality and no-side-effect rules.

### API integration tests

- Vendor-manager ownership and proposal authorization.
- Customer/representative ownership and exact decision authorization.
- Employee likeness decision limited to that employee.
- Admin session isolation and exact moderation authority.
- IDOR across customer, vendor, employee, and admin resources.
- Duplicate/replayed/stale/concurrent decisions.
- Missing evidence fails closed with no Public mutation.
- Legacy direct `approve_public` and `set_visibility_public` paths cannot bypass the chain.
- Public endpoints return exact approved media only.
- Private, declined, stale, corrected, fallback, minor, and incomplete proposals never appear publicly.

### Migration tests

- Existing Public media without canonical evidence becomes Private.
- Existing Private and Epic 5 evidence remain unchanged.
- Genuine historical moderation facts remain intact.
- Migration is idempotent or safely detects prior application.
- Counts reconcile and unauthorized Public count is zero.

### Notification tests

- Correct recipient, work record, state, and secure link.
- No deadline, pressure, or implied approval.
- Idempotent retries and visible delivery failure.
- No raw token, OTP, private URL, or unnecessary personal data.

### Regression tests

- Epic 1 permission and recording lock.
- Epic 2 public shell and signal distinction.
- Epic 3 role isolation, direct-route denial, and admin session isolation.
- Epic 4 assessment/gate matrix and reason-specific blocks.
- Epic 5 capture, upload/retry, package, manager review, and Private access.
- Genuine reviews remain independent.
- No review, rating, Trust Score input, permission, or recording state is created from publication decisions.

### Playwright and manual tests

- Desktop and mobile vendor proposal.
- Customer all/some/none/correction.
- Applicable participant approval.
- Admin approval/rejection/correction/blocked authority.
- Public page and direct media link.
- Legacy restricted state.
- Refresh/reopen/back/forward behavior.
- Loading, empty, success, failure, stale version, and blocked states.

### Quality gates

- Prisma format, validate, generate, and migration validation.
- Type checking.
- Linting for affected files and repository command where feasible.
- Focused unit/integration suites.
- Epic 1-5 regressions.
- Epic 6 Playwright.
- Production build using the established heap setting.
- Dependency/security audit classification.
- `git diff --check`.

Only executed results may be claimed.

## 16. Screenshot Plan

Controlled synthetic data only. No secrets, OTPs, raw tokens, real customer data, private blob URLs, or unrelated browser content.

### Desktop

- Vendor Final Result-only draft.
- Vendor expanded multi-stage proposal.
- Customer exact preview with all/some/none/correction.
- Customer Private/no-action outcome.
- Applicable employee-likeness decision.
- Admin complete evidence and moderation.
- Admin blocked missing/mismatched authority.
- Public Service Video page.
- Legacy media restricted to Private.

### Mobile

- Customer education and exact stage decisions.
- Vendor proposal and status.
- Admin evidence and blocked state.
- Public proof playback.

### State coverage

- Loading.
- Empty/no proposal.
- Success.
- Delivery/API failure with recovery.
- Stale or replaced version.
- Correction requested.
- Partial approval.
- Declined/Private.
- Pending admin.
- Public.
- Before/after legacy moderation authority controls where practical.

Each screenshot index entry must record commit, role, viewport/device, test case, date, expected state, and redaction review.

## 17. PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact manual action and expected observation |
|---|---|
| Expected workflow | Open a manager-approved Private package as vendor manager. Confirm Final Result is the only default. Submit it, open as the correct customer, preview the exact clip, approve it, complete applicable participant/vendor approvals, open admin moderation, approve the same version, then confirm the exact clip appears publicly. Repeat with some, none, and correction. |
| Expected notifications | Confirm proposal request, customer decision, correction, participant decision, admin result, and Public notices reach only applicable synthetic participants. Confirm no deadline or pressure language and no duplicate retry. |
| Expected dashboard updates | Observe canonical Draft, Customer Decision Needed, Partially Approved, Correction Requested, Participant Approval Needed, Ready for Admin, Under Admin Review, Public, Declined, and Private states across applicable views without manual refresh. |
| Expected database state | Inspect proposal, exact package/stage/version/hash, audience, customer decision, participant authority, vendor decision, admin decision, public timestamp, and audit events. Confirm no fabricated decision. |
| Expected admin state | Confirm the queue contains only complete exact-version proposals. Attempt to approve a changed version or missing authority and confirm admin is blocked. Confirm admin can narrow to Private but cannot widen authority. |
| Expected customer state | Approve all, approve selected stages, approve none, and request correction. Confirm Private remains complete and no Public choice existed before completed media was available. |
| Expected vendor state | Confirm only Final Result is preselected. Add another stage intentionally and verify it receives an independent customer decision. Confirm the vendor cannot override a decline. |
| Expected employee state | Confirm an identifiable employee decision applies only to that person's likeness and the employee cannot publish customer-controlled media. Confirm an unrelated employee cannot access the proposal. |
| Expected Trust Score behavior | Confirm Private, no action, partial/declined publication, and admin restriction create no negative Trust Score result. Do not certify score calculation beyond valid Public-proof input eligibility; full reconciliation remains Epic 8. |
| Expected review behavior | Confirm review availability, content, moderation, and visibility remain unchanged and independent from exact-media publication decisions. |
| Expected audit history | Reconstruct proposal creation, exact version/hash, every participant decision, correction, invalidation, vendor approval, admin decision, visibility transition, and legacy restriction. |
| Expected screenshots to verify | Compare the indexed desktop/mobile proposal, exact preview, all/some/none/correction, missing-authority block, admin moderation, Public page, Private outcome, legacy restriction, and non-happy states. |

## 18. REGRESSION STATEMENT Plan

The final Engineering Report must explicitly distinguish:

### Existing functionality intentionally preserved

- Epic 1 recording permission and fail-closed lock.
- Epic 2 proof-first identity and public signal distinction.
- Epic 3 database-derived role/ownership isolation.
- Epic 4 work-record assessment and recording gates.
- Epic 5 three-stage capture, package evidence, manager approval, and Private access.
- Genuine review behavior.

### Existing functionality intentionally unchanged

- Registration and policy acceptance.
- Location verification and employee assignment.
- Audio-off recording default.
- Trust Score calculation rules except preventing unauthorized publication inputs.
- AI features outside the affected legacy moderation action.
- Withdrawal, disputes, retention, deletion, and legal-policy content.

### Areas verified unaffected

- Customer, vendor, employee, and admin authorization.
- Permission links and OTP.
- Capture/upload/retry/correction.
- Private access and downloads.
- Reviews and no-review neutrality.
- Notifications unrelated to publication.
- Public pages with no eligible proof.

### Potential regression risks reviewed

- Public cache invalidation.
- Legacy route compatibility.
- Existing public counts/cards.
- Admin queue behavior.
- Stage replacement and version invalidation.
- Package rollback without renewed exposure.

### Known unrelated issues

Record only verified pre-existing failures or external dependencies. Do not silently fix them and do not attribute them to Epic 6.

## 19. Estimated Implementation Sequence

1. Reconfirm clean scope, branch, commit, worktree, migration status, and untouched unrelated changes.
2. Inventory every active Public read/write path, cache, count, notification, dashboard, admin action, and AI touchpoint.
3. Freeze controlled synthetic fixtures for Private, legacy Public, fallback, minor, audio, bystander, employee-likeness, and corrected-version cases.
4. Define the canonical publication state machine and exact evidence invariants in tests before runtime mutation work.
5. Add additive schema models, indexes, constraints, and migration tests.
6. Implement exact-media proposal and per-stage decision services.
7. Implement participant-authority and vendor official-representation decisions.
8. Implement one canonical Public eligibility resolver and audit writer.
9. Add vendor proposal and customer exact-preview/decision APIs and UI.
10. Replace the admin queue and moderation mutation with exact-version evidence and authority checks.
11. Compatibility-block direct legacy Public actions.
12. Change public-serving APIs, counts, cards, and media components to canonical Public projections.
13. Add notifications and delivery evidence for the exact-media lifecycle.
14. Add the controlled legacy Public-to-Private migration/data operation and reconciliation report.
15. Run focused tests, Epic 1-5 regressions, security/IDOR checks, Playwright, accessibility checks, type check, build, and diff validation.
16. Capture and review the complete desktop/mobile state package.
17. Perform four-role UX critique and resolve genuine Epic 6 defects only.
18. Update the Engineering Report, UX Review, Product Owner Demo, Lessons Learned, Technical Debt, Checklist Snapshot, Project Dashboard, and checklist rows.
19. Create a scoped Git checkpoint containing only approved Epic 6 implementation and documentation.
20. Stop for Product Owner review before migration application, deployment, or Epic 7.

## 20. Estimated Complexity and Risk

- **Estimated files affected:** 40-65
- **Estimated migrations:** 1-2 additive schema/data checkpoints
- **Estimated screenshots:** 24-32
- **Complexity:** Very Large
- **Risk:** High

Epic 6 precedes withdrawal because withdrawal can only revoke a canonical Public authority chain with an exact version and audience.

## 21. Acceptance Criteria

- Private proof remains complete when the customer approves none or takes no publication action.
- Final Result is the only default proposal.
- Starting Condition and Work in Progress require separate intentional proposal and approval.
- Public eligibility resolves to the same exact content hash/version reviewed by every required participant and admin.
- Every edit, replacement, crop, blur, mute, caption, or approval-relevant label change creates a new version and renewed chain.
- Fallback media and identifiable minors never become Public in Version 1.
- Unresolved bystander, employee-likeness, or audio authority blocks Public eligibility.
- Existing Public media lacking exact-media approval becomes Private and remains Private until reapproved.
- Admin may restrict but never broaden participant-approved authority.
- Public endpoints and direct media links serve only canonical eligible versions.
- Reviews remain separate and no publication decision fabricates a review or rating.
- Private, declined, ignored, corrected, or restricted publication causes no negative Trust Score result.
- All required tests, screenshots, reports, checklist updates, and Git evidence are complete before presenting the epic for approval.

## 22. Approval Gate

This plan authorizes no code, migration, deployment, legacy-media restriction, checklist-row promotion, or runtime behavior change.

Product Owner approval is required before implementation begins. After approval, implementation must stop again after the complete Epic 6 evidence package. It must not begin withdrawal, disputes, retention, deletion, Trust Score redesign, AI redesign, notification/help alignment, legal-document alignment, or Epic 7.
