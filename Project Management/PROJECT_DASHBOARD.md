# Reliance Project Dashboard

**Purpose:** Permanent master record for implementation progress through private beta.
**Last updated:** 2026-08-05 (Epic 6 engineering complete; Product Owner and release gates pending)
**Update rule:** Update this dashboard after every completed epic and link the final evidence in that epic folder.

## Completed Epics

**Epic 1 - Verified Permission Request**

- Status: **Completed**
- Planning: Approved
- Implementation: Operational closeout deployed
- Product Owner demo: Approved
- SMS handset validation: **Deferred - External Provider Dependency**; not an application defect
- Maintenance rule: No further Epic 1 changes unless a genuine beta defect is discovered

**Epic 2 - Proof-First Platform Shell**

- Status: **Completed**
- Implementation: Proof-first public and role shell complete with focused tests and screenshots
- Product Owner decision: Approved on 2026-08-02
- Independent five-person comprehension validation: **Deferred to private beta user feedback**; not an engineering blocker
- Maintenance rule: No further Epic 2 changes unless a genuine beta defect or measurable beta confusion is discovered

**Epic 3 - Trusted Accounts and Role Isolation, Phase A**

- Status: **Completed and deployed**
- Delivered: Canonical database actor, ownership/membership authorization, IDOR protection, database-backed admin isolation, deterministic allow-list packaging, and live role-boundary validation
- Deployment: `reliance-beta-59d696f-epic3-phase-a-202608040430.zip`
- Source commit: `59d696f55f01e670846800822d295aa558a36f03`
- Phase B: Deferred by Product Owner; it is not part of the current active objective
- Evidence: [Epic 3 Phase A Deployment Report](<Epic 3 - Trusted Accounts and Role Isolation/EPIC_3_PHASE_A_DEPLOYMENT_REPORT.md>)

**RR-1A A5 - Current Customer Onboarding**

- Status: **Completed and deployed**
- Delivered: Required Terms and Privacy decisions, optional SMS, durable registration evidence, email verification, duplicate protection, account restoration, service-record claiming, and permission-link onboarding compatibility
- Deployed application commit: `df36f113d37149adab2373964663016e4cd845a6`
- Database: 37 migrations applied after `20260804230000_add_customer_registration_evidence`
- Evidence: [A5 Deployment Report](<RR-1A - Current Beta Readiness/A5 - Current Customer Onboarding/A5_DEPLOYMENT_REPORT.md>)

**Epic 4 - Universal Work Records and Recording Gates**

- Status: **Completed and frozen**
- Product Owner decision: Approved on 2026-08-05
- Delivered: Three-location scope assessment, authority requirements, notice/permission routing, employee certification, durable location evidence, admin exception decisions, material-change supersession, canonical runtime gate, and reason-specific block UX
- Diagnostics: Canonical block metrics are internal-only and cannot affect reviews, Trust Score, permission, publication, or dashboards
- Validation: 76/76 final named tests, 4/4 Playwright states, type check, Prisma validation/generation, and production build passed
- Git checkpoint: `98c50ae727839d353f0eb357b39ca5c5761bf7ac`
- Evidence: [Engineering Report](<Epic 4 - Universal Work Record and Recording Gates/01_Engineering_Report.md>) and [Product Owner Demo](<Epic 4 - Universal Work Record and Recording Gates/03_Product_Owner_Demo.md>)
- Accepted open work: Physical-device replay, full role screenshots, manager-correction fixture reconciliation, and contextual capture copy move to Epic 5; dependency advisories remain release-hardening work
- Maintenance rule: No further Epic 4 changes unless a genuine beta defect is discovered

**Epic 5 - Safe Capture Through Private Service Videos**

- Status: **Completed and frozen**
- Product Owner decision: Approved on 2026-08-05
- Delivered: Assigned-employee three-stage capture through manager-approved, customer-visible Private proof with safe retry, correction, provenance, content identity, package versions, and role-bound access
- Governing rule: Private proof is a complete outcome; recording does not authorize Public use
- Validation: 108/108 Epic 1-5 focused regressions, 85/85 final focused regressions, 2/2 Playwright states, type check, Prisma validation/generation, and production build passed
- Git checkpoint: `dcf634739b9d0aa726a2916b82862cc11ecb0f82`
- Evidence: [Engineering Report](<Epic 5 - Safe Capture Through Private Service Videos/01_Engineering_Report.md>), [UX Review](<Epic 5 - Safe Capture Through Private Service Videos/02_UX_Review.md>), and [Product Owner Demo](<Epic 5 - Safe Capture Through Private Service Videos/03_Product_Owner_Demo.md>)
- Release gates: Apply the additive migration, deploy the package, complete physical-device replay, and complete the four-role Product Owner replay
- Release-gate classification: These remaining items are deployment and release validation, not Epic 5 engineering defects
- Maintenance rule: No further Epic 5 implementation unless a genuine beta defect is discovered

**Epic 6 - Exact-Media Public Proof and Admin Moderation**

- Status: **Engineering complete locally; Product Owner review pending**
- Delivered: Exact-version proposals, all/some/none/correction customer decisions, applicable participant decisions, vendor representation approval, admin moderation, canonical Public eligibility, and fail-closed public serving
- Governing rule: A Public Service Video must retain the complete unchanged evidence chain; any presentation-affecting change requires a new version and approval chain
- Validation: 45/45 Epic 6 focused tests, 331/331 cross-epic regressions, 5/5 Playwright states, TypeScript, Prisma validation/generation, and production build passed
- Application checkpoint: `d6edf5cee81b11d9c1eb9fc5ee9bbbe4fbe96e5d`
- Evidence: [Engineering Report](<Epic 6 - Exact-Media Public Proof and Admin Moderation/01_Engineering_Report.md>), [UX Review](<Epic 6 - Exact-Media Public Proof and Admin Moderation/02_UX_Review.md>), and [Product Owner Demo](<Epic 6 - Exact-Media Public Proof and Admin Moderation/03_Product_Owner_Demo.md>)
- Release gates: Apply/reconcile the additive migration, deploy the package, and complete live customer/vendor/employee/admin plus storage/cache replay

## Current Active Epic

**Epic 6 - Exact-Media Public Proof and Admin Moderation**

- Status: **Engineering complete locally; Product Owner review pending**
- Objective delivered: Exact completed media can become Public only after matching customer, applicable participant, vendor, and admin decisions
- Migration/deployment: Not applied or deployed
- Next gate: Product Owner evidence review, then a separately approved migration/deployment/live-replay checkpoint

## Current Branch

`codex/epic3-beta-admin-grant-correction`

## Current Commit

Current repository commit at Epic 6 implementation start: `2f3bcece9bff3b42ada75bd24b03cf04f88a9787`

Epic 6 application commit: `d6edf5cee81b11d9c1eb9fc5ee9bbbe4fbe96e5d`

Current beta application commit: `df36f113d37149adab2373964663016e4cd845a6`

Current beta package: `reliance-beta-df36f11-a5-202608042023.zip`

## Latest Beta Feedback Maintenance

The six issues in `Updates 7-31-26.docx` were corrected without beginning Epic 2. This checkpoint covers immediate archived-work-record refresh, a focused service-video account handoff, registration-safe policy links, idempotent manager approval, branded permission-decision email, and canonical Vendor Analytics metrics.

- Report: [Updates 7-31-26 Engineering Report](<Beta Feedback/UPDATES_2026-07-31_ENGINEERING_REPORT.md>)
- Focused tests: 9 of 9 passed
- Related regression tests: 57 of 57 passed
- Production build: Passed with a 4 GB Node heap allowance
- Full repository suite: 735 passed; 13 unrelated existing failures remain documented in the report
- Screenshots: `output/updates-7-31-26/` (local evidence, not committed)

## Roadmap Progress

| Order | Epic                                                  | Status                                    | Engineering | UX          | Demo    | Git checkpoint     |
| ----- | ----------------------------------------------------- | ----------------------------------------- | ----------- | ----------- | ------- | ------------------ |
| 1     | Verified Permission Request                           | **Completed** | Complete | Complete | Approved | Application `08de960` |
| 2     | Proof-First Platform Shell                            | **Completed** | Complete | Complete | Approved | `cb44c9e` |
| 3     | Trusted Accounts and Role Isolation                   | **Phase A completed and deployed; Phase B deferred** | Phase A complete | Reviewed | Live validation passed | `59d696f` |
| 4     | Universal Work Record and Recording Gates             | **Completed and frozen** | Complete | Reviewed | Product Owner approved | `98c50ae` |
| 5     | Safe Capture Through Private Service Videos           | **Completed and frozen** | Complete | Reviewed | Product Owner approved; release replay pending | `dcf6347` |
| 6     | Exact-Media Public Proof and Admin Moderation         | **Engineering complete; review pending** | Complete locally | Reviewed | Automated evidence ready | Pending final checkpoint |
| 7     | Withdrawal, Disputes, Retention and Final Disposition | Not started                               | Not started | Not started | Not run | Not recorded       |
| 8     | Trust Score and Evidence-Based Dashboards             | Not started                               | Not started | Not started | Not run | Not recorded       |
| 9     | Responsible AI and Fair Admin Support                 | Not started                               | Not started | Not started | Not run | Not recorded       |
| 10    | Notifications and Help Alignment                      | Not started                               | Not started | Not started | Not run | Not recorded       |
| 11    | Legal Documents and Agreements                        | Not started                               | Not started | Not started | Not run | Not recorded       |
| 12    | Private Beta Hardening and Release                    | Not started                               | Not started | Not started | Not run | Not recorded       |

## Beta Readiness Progress

The Beta Readiness Checklist remains the master acceptance tracker. Epic 3 Phase A and A5 are deployed, Epics 4 and 5 are approved and frozen, and Epic 6 is engineering-complete locally with release gates pending.

- Engineering-complete roadmap epics: 6 of 12; Epic 3 Phase B is intentionally deferred and does not reopen Phase A
- Completed RR-1A gates: A3, A5, A8, A10, A11, and A14 have current evidence; the final status remains governed by the RR-1A tracker and Product Owner acceptance
- Beta Ready release: No; later epics and release gates remain open
- Current checklist: [Beta Readiness Master Checklist](RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md)
- Completed Epic 1 snapshot: [Epic 1 Checklist Snapshot](<Epic 1 - Verified Permission Request/06_Checklist_Snapshot.md>)
- Release gate: Not ready
- Evidence rule: No checklist row becomes Beta Ready from code existence alone

## Critical Open Items

| Item                                  | Owner                       | Status  | Next action                                                                                |
| ------------------------------------- | --------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Controlled SMS handset validation | Engineering / Product Owner | Deferred - External Provider Dependency | Validate after Telnyx activation; do not classify as an application defect |
| Independent comprehension validation | Product Owner / Beta participants | Deferred to private beta user feedback | Gather natural beta feedback; reopen Epic 2 only for measurable confusion or a genuine defect |
| Epic 4 additive migrations in beta | Engineering / Product Owner | Accepted Epic 5 dependency | Apply before mounting an Epic 5 package that requires the canonical gate schema; do not reopen Epic 4 |
| Epic 5 additive migration/deployment | Product Owner / Engineering | Release gate | Apply migration before mounting the application package; verify exact schema and rollback readiness without reopening Epic 5 engineering |
| Epic 5 physical-device and four-role replay | Product Owner / Engineering | Release gate | Run physical Android/iOS capture, upload interruption/retry, manager correction/approval, Private customer access, and role denials |
| Epic 6 migration/deployment/live replay | Product Owner / Engineering | Release gate | Apply and reconcile exact-media evidence migration, deploy, and verify four-role decisions plus direct Public storage/cache behavior |
| Deferred A2/A4/A6/A7 replay | Product Owner / Engineering | Intentionally deferred | Execute once after Epic 4 and Epic 5 so the complete recording journey is validated together |
| High dependency advisories | Product Owner / Engineering | Documented | Continue package-specific decisions; never use blind or forced upgrade |

## Blocked Items

| Item | Blocker | Owner | Resolution |
|---|---|---|---|
| Epic 6 formal closure | Local evidence is complete; migration, deployment, and live replay have not run | Product Owner / Engineering | Review the evidence package and authorize or revise the release checkpoint |

## Remaining Internal Beta Checkpoints

| Order | Checkpoint | Current state | Completion evidence required |
|---|---|---|---|
| 1 | Confirm the current beta capability boundary (A1) | Needs Product Owner confirmation | Signed reachable-feature inventory and explicit deferred-feature list |
| 2 | Epic 4 - Universal Work Records and Recording Gates | Completed and frozen | Product Owner approval and scoped Git checkpoint recorded; accepted device/deployment evidence moves forward without reopening Epic 4 |
| 3 | Epic 5 - Safe Capture Through Private Service Videos and A9 physical-device recording | Epic complete; release gates pending | Migration-first deployment, three-stage real-device capture, upload/retry, manager correction/approval, and Private customer proof evidence |
| 4 | Consolidated A2, A4, A6, and A7 replay | Deferred by Product Owner until Epics 4-5 complete | One end-to-end authentication, vendor onboarding, employee onboarding, permission, recording, and role-isolation replay |
| 5 | A12, A13, and A15-A17 current-feature safety and operational gates | Needs verification | Review/Trust non-creation and validity checks, notifications, monitoring, worker, rollback, and minimum restore evidence |
| 6 | A18 candidate smoke and Internal Beta go/no-go | Not started | Final desktop/mobile role journey, release evidence, known-limitations review, and Product Owner acceptance |

The deferred A2/A4/A6/A7 replay is not waived. Epic 4 and Epic 5 must preserve those contracts through focused automated regression while implementation is underway.

## Technical Debt Summary

| Epic |  Open debt |     Beta blocker | Reference                                                                                               |
| ---- | ---------: | ---------------: | ------------------------------------------------------------------------------------------------------- |
| 1    | 7 open; 3 resolved; 1 external deferral | 0 engineering blockers | [Technical Debt](<Epic 1 - Verified Permission Request/05_Technical_Debt.md>)                          |
| 2    | 6 open; 1 beta-validation deferral | 0 engineering blockers | [Technical Debt](<Epic 2 - Proof-First Platform Shell/05_Technical_Debt.md>)                            |
| 3    | 10 recorded | 1 packaging blocker plus 17 assessed High advisories | [Technical Debt](<Epic 3 - Trusted Accounts and Role Isolation/05_Technical_Debt.md>)                   |
| 4    | 5 accepted | 0 Epic 4 blockers; 4 assigned to Epic 5 and 1 to release hardening | [Technical Debt](<Epic 4 - Universal Work Record and Recording Gates/05_Technical_Debt.md>)             |
| 5    | 6 recorded | 0 engineering blockers; migration, deployment, and replays are release gates | [Technical Debt](<Epic 5 - Safe Capture Through Private Service Videos/05_Technical_Debt.md>)           |
| 6    | 6 recorded | 0 known local engineering blockers; release gates pending | [Technical Debt](<Epic 6 - Exact-Media Public Proof and Admin Moderation/05_Technical_Debt.md>)         |
| 7    | 0 recorded |       0 recorded | [Technical Debt](<Epic 7 - Withdrawal, Disputes, Retention and Final Disposition/05_Technical_Debt.md>) |
| 8    | 0 recorded |       0 recorded | [Technical Debt](<Epic 8 - Trust Score and Evidence-Based Dashboards/05_Technical_Debt.md>)             |
| 9    | 0 recorded |       0 recorded | [Technical Debt](<Epic 9 - Responsible AI and Fair Admin Support/05_Technical_Debt.md>)                 |
| 10   | 0 recorded |       0 recorded | [Technical Debt](<Epic 10 - Notifications and Help Alignment/05_Technical_Debt.md>)                     |
| 11   | 0 recorded |       0 recorded | [Technical Debt](<Epic 11 - Legal Documents and Agreements/05_Technical_Debt.md>)                       |
| 12   | 0 recorded |       0 recorded | [Technical Debt](<Epic 12 - Private Beta Hardening and Release/05_Technical_Debt.md>)                   |

## Lessons Learned Summary

| Epic | Key lesson                                                                                          | Action carried forward                                      | Reference                                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1    | Decision state alone is insufficient if booking metadata independently drives release and employee camera access | Use one canonical gate and require live cross-role blocked-state replay | [Lessons Learned](<Epic 1 - Verified Permission Request/04_Lessons_Learned.md>) |
| 2    | Preserve effective copy and change only proven product-identity conflicts | Reconcile DB/test fixtures before relying on broad authenticated smoke | [Lessons Learned](<Epic 2 - Proof-First Platform Shell/04_Lessons_Learned.md>) |
| 3    | Database authority and focused fixtures produced clear isolation evidence                           | Keep Phase B separate; resolve build/security gates first   | [Lessons Learned](<Epic 3 - Trusted Accounts and Role Isolation/04_Lessons_Learned.md>)                   |
| 4    | Canonical decisions prevent cross-surface drift; isolate Playwright servers                           | Preserve gate codes and reuse canonical fixtures in Epic 5 | [Lessons Learned](<Epic 4 - Universal Work Record and Recording Gates/04_Lessons_Learned.md>)             |
| 5    | One evidence service must bind package submission, manager approval, and Private access to the same exact chain | Reuse Epic 5 hash/version lineage as the non-negotiable foundation for Epic 6 publication authority | [Lessons Learned](<Epic 5 - Safe Capture Through Private Service Videos/04_Lessons_Learned.md>)           |
| 6    | Public access must revalidate the entire exact-version chain, not trust a visibility flag            | Build Epic 7 withdrawal on canonical eligibility invalidation | [Lessons Learned](<Epic 6 - Exact-Media Public Proof and Admin Moderation/04_Lessons_Learned.md>)         |
| 7    | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 7 - Withdrawal, Disputes, Retention and Final Disposition/04_Lessons_Learned.md>) |
| 8    | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 8 - Trust Score and Evidence-Based Dashboards/04_Lessons_Learned.md>)             |
| 9    | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 9 - Responsible AI and Fair Admin Support/04_Lessons_Learned.md>)                 |
| 10   | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 10 - Notifications and Help Alignment/04_Lessons_Learned.md>)                     |
| 11   | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 11 - Legal Documents and Agreements/04_Lessons_Learned.md>)                       |
| 12   | Not reviewed                                                                                        | None yet                                                    | [Lessons Learned](<Epic 12 - Private Beta Hardening and Release/04_Lessons_Learned.md>)                   |

## Next Engineering Decision

Review the Epic 6 evidence package. Epic 3 Phase B remains deferred; Epics 4 and 5 remain frozen. Do not apply the migration, deploy Epic 6, or begin Epic 7 without Product Owner approval.

## Required Update Cycle

After every completed epic:

1. Update this dashboard.
2. Update the affected epic folder.
3. Finalize the Engineering Report.
4. Finalize the UX Review.
5. Record Product Owner Demo results.
6. Record Lessons Learned.
7. Record Technical Debt.
8. Save the Checklist Snapshot.
9. Record the Git checkpoint.
