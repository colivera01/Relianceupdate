# Reliance draft legal/content coverage map

Status: **DRAFT / PRODUCT OWNER REVIEW**

This map is an implementation and review aid. It is not legal advice, an effective policy, or proof that a described control is live. "Current" identifies repository behavior inspected at source commit `8dbe47be9174374f5b2cb8bb31f544e316261cbd`. "Future" identifies work required before any draft can become effective.

## Draft placement map

| Draft | Current implementation reviewed | Prospective placement | Activation boundary |
| --- | --- | --- | --- |
| Terms of Use | `src/app/terms/page.tsx`; registration evidence in `src/lib/legal/customer-registration-policy-evidence.ts` | Replace rendered Terms only in a separately authorized versioned release; bind role assent to `GovernedContentVersion` | Remove current arbitration/class waiver prospectively; attorney review; no historical backfill |
| Privacy Notice | `src/app/privacy/page.tsx`; current models/routes; privacy case infrastructure | Versioned rendered notice plus registration and role-specific references | Verify provider inventory, retention controls, rights workflow, and contact before activation |
| Vendor assent | No equivalent complete Vendor clickwrap; dormant `RoleAssentEvidence` | Vendor registration/Manager authority checkpoint | Verified authority, durable copy, no Employee proxy, no retaliation |
| Accountless Employee assent | Service Order access at `src/app/employee/jobs/page.tsx`; verified decision routes | Verified accountless Service Order entry before consequential use | Identity not email alone; current release; durable copy; no recording/Public proxy |
| Customer recording authorization | `src/app/consent/[token]/page.tsx`; `src/lib/consent/*`; exact content helper | Current assessment authorization surface | Remove Decide Later prospectively; reconcile current decline handling; exact scope/text binding |
| Employee job recording participation | `src/lib/employee-recording-participation.ts`; `src/lib/recording/employee-v2-service-order.ts`; participation API | Dormant Phase 3C Service Order surface | Counsel-review-required copy; Product Owner activation; controlled physical acceptance |
| Employee standing Public participation | `src/app/employee/public-media-consent/page.tsx`; related API/token modules; `src/lib/service-video-publication.ts` | Existing separate verified Employee surface with a future governed copy version | Attorney review of image/likeness/voice/audio and withdrawal; never mandatory for Private Proof |
| Customer package visibility | `src/components/service-video/PackageVisibilityCard.tsx`; booking visibility API; publication resolver | Existing Service Record visibility control with governed exact copy | Add outside-copy evidence and exact content binding; preserve historical contracts |
| Withdrawal/dispute | Support/report paths; dormant privacy case models | Authenticated and former-participant request intake plus human case handling | No workflow is live; legal holds, dependency resolution, and outcomes required |
| Privacy request intake | Support email and dormant `PrivacyCaseReference`/`PrivacyCaseEvent` | Dedicated secure intake and authorized staff case surface | Rights/jurisdiction determination, identity verification, deadlines, appeals, provider propagation |
| Transactional SMS | `src/app/sms-policy/page.tsx`; `src/lib/sms/twilio.ts`; notification modules; Employee channel capability | Optional, channel-capability-aware opt-in and STOP/HELP flow | SMS readiness, carrier registration, suppression, evidence, fallback; currently disabled for Employee OTP |
| AI disclosure/governance | `src/lib/ai/*`; Admin AI routes; current Privacy/Terms references | General notice plus feature-specific just-in-time disclosure and internal controls | Provider/data inventory, evals, human review, retention, incident response; no unverified no-training promise |
| Retention/disposition | `src/lib/legal/retention-dry-run.ts`; storage/database models; current Privacy | Versioned policy plus guarded lifecycle workers and immutable receipts | Targets are not promises until workers, holds, monitoring, backups, and restoration are proven |
| Accessibility | Existing role/customer UI and current support path | Public statement after baseline audit; controlled translations at each consequential surface | Do not claim conformance/certification before evidence; provide accessible alternatives |

## Draft-to-review-item traceability

| Draft | C-01 through C-24 items addressed | Section-level notes |
| --- | --- | --- |
| Terms of Use | C-01, C-02, C-03, C-04, C-05, C-16, C-18, C-19, C-20, C-21, C-22, C-23, C-24 | Operator/contact in sections 1 and 20; platform/Vendor duties in 2-3 and 11; electronic records in 5; recording/audio in 6-7; Public/license in 8 and 12; AI/providers in 14-15; changes in 16; disclaimers/disputes in 17-19. |
| Privacy Notice | C-01, C-05, C-07, C-08, C-10, C-11, C-12, C-13, C-14, C-15, C-16, C-17, C-18, C-19, C-20 | Data/source/purpose in sections 2-4; recording/location in 5; Public use in 6; providers/AI in 7-8; retention in 9; rights/requests in 10; minors in 12; changes/contact in 14-15. |
| Vendor assent | C-03, C-04, C-05, C-19, C-20, C-23 | Separate acknowledgments and e-record evidence; no proxy/retaliation; exact job-specific Manager attestation; current-context obligations. |
| Accountless Employee assent | C-03, C-04, C-05, C-08, C-19, C-20, C-23 | Verified self-only access; separate Terms, Privacy, e-record acknowledgments; recording/Public separation; wrong-recipient path. |
| Customer recording authorization | C-05, C-07, C-15, C-19, C-20, C-23 | Exact scope and audio; Allow/Decline/Not-for-Me; no passive consent; immutable evidence; material changes and prospective withdrawal. |
| Employee recording participation | C-05, C-06, C-07, C-08, C-15, C-19, C-20, C-23 | Exact Allow/Decline; no override/retaliation; current-context evidence; reassignment/scope invalidation; safety reminder. |
| Employee standing Public participation | C-07, C-08, C-09, C-10, C-19, C-20, C-23 | Optional Vendor-specific likeness/voice/audio choice; separate dependencies; membership cessation; prospective change. |
| Customer package visibility | C-07, C-09, C-10, C-19, C-20, C-21, C-23 | Complete exact package; audio and outside copies; immediate server transaction; Make Private limitations; evidence binding. |
| Withdrawal/dispute | C-04, C-07, C-08, C-09, C-10, C-12, C-13, C-20 | Prospective effect; former/reassigned access; no automatic erasure; coercion; immutable case history. |
| Privacy request intake | C-08, C-12, C-13, C-18, C-20, C-23, C-24 | Authenticated and neutral support paths; proportional verification; no universal deadline; accessible intake and durable case reference. |
| Transactional SMS | C-03, C-17, C-18, C-19, C-20, C-23 | Optional transactional-only opt-in; capability truth; STOP/HELP; evidence and fallback; no Employee SMS activation. |
| AI disclosure/governance | C-13, C-16, C-18, C-19, C-20 | Human final decisions; minimization and risk controls; honest provider statements; no secret new purpose. |
| Retention/disposition | C-07, C-08, C-10, C-11, C-12, C-13, C-14, C-18, C-20 | Conditional targets; guards/workers/receipts; minimum evidence; archives; no automatic destruction. |
| Accessibility | C-03, C-13, C-19, C-23, C-24 | WCAG 2.2 AA target without certification; support/alternative path; controlled consequential translations. |

## C-01 through C-24 reconciliation

| Item | Draft coverage | Current source truth | Future engineering or policy dependency | Confidence and review status |
| --- | --- | --- | --- | --- |
| C-01 Operator and contact identity | Terms and Privacy name Reliance Technologies LLC and `colivera080124@gmail.com`; no physical-address claim | Live support contract currently resolves a different Product Owner-approved customer-support mailbox | Reconcile legal-plan contact and live support contact before activation; verify entity naming in registrations and notices | High on PO decision; attorney should confirm required business/address disclosures |
| C-02 Arbitration, class waiver, governing law | Terms omits mandatory arbitration/class waiver and preserves nonwaivable rights under Florida law | Live Terms still contain mandatory arbitration/class waiver | Prospective Terms replacement only; determine forum, notices, and any optional dispute procedure with counsel | Medium; attorney review required before effective Terms |
| C-03 Separate role assent and electronic records | Vendor and accountless Employee drafts use affirmative role-specific actions, exact version, durable-copy concept | Registration evidence exists for Customer; dormant role-assent model exists; no live Vendor/Employee gate | Build separate verified gates, durable copies, material-change rules, and evidence writes | Medium; attorney review for E-SIGN presentation and consumer consent where applicable |
| C-04 Vendor authority, no proxy, no retaliation | Vendor draft expressly prohibits proxy choices and retaliation | Current assignment and identity controls separate actors, but complete Vendor assent is absent | Verified Vendor authority, no-proxy server enforcement, support/escalation for pressure | Medium; employment and anti-retaliation wording needs counsel |
| C-05 Audio and all required parties | Terms, Privacy, Customer, and Employee drafts require all legally required parties and conservative handling when uncertain | Current scope distinguishes audio and Public UI has audio warning; no minor/extra-participant authorization flow | Jurisdiction/location rule, all-party resolver, just-in-time audio display, fail-closed runtime | Medium; attorney review required, especially multi-state recording law |
| C-06 Employee Allow/Decline | Employee job-specific draft provides exact separate Allow and Decline, no override, no auto real-world cancellation | Current exact copy is marked `counsel-review-required`; Phase 3C remains controlled/dormant | Counsel disposition, controlled acceptance, durable receipt, withdrawal/support | Medium-low; attorney review explicitly pending |
| C-07 Prospective withdrawal | Withdrawal and Public drafts stop new dependent capture/Public access while preserving history and outside-copy limits | Current Public choices support changes; general withdrawal workflow is not live | Verified intake, dependency resolution, holds, notices, and immutable events | Medium; attorney review of effect on existing media/Private Proof |
| C-08 Former or reassigned participant | Withdrawal draft provides a path without membership reactivation | Current Service Order and reassignment logic invalidates stale contexts; no complete former-participant request path | Verified alternate identity process and authorized case handling | Medium; security and labor/privacy review required |
| C-09 Standing Public participation | Standing Public draft is optional, Vendor-specific, covers image/likeness/voice/audio, and ceases for new use when membership inactive | Separate existing Employee Public flow; current decisions remain independent of recording | Governed copy, membership-inactivation resolver, withdrawal propagation, no employment gate | Medium-low; publicity/privacy/employment counsel review required |
| C-10 Exact package Public choice | Package draft describes complete package, audio, outside copies, immediate Public/Private transaction, and fresh republish checks | Current exact-package server authorization and history exist; UI lacks complete outside-copy evidence binding | Versioned exact copy, disclosure flags, Browse removal validation, historical-contract compatibility | Medium; Public-display/license wording needs counsel |
| C-11 Retention periods as intended targets | Privacy and Retention label 12-month, 7-year, and 30-day periods as conditional targets | Dormant dry-run planning exists; no active lifecycle worker or effective schedule | Inventory, holds, deletion workers, receipts, backups, monitoring, restore tests | Medium-low until operational controls are proven; attorney review of periods |
| C-12 Minimum evidence after deletion | Retention identifies hashes, identities, decision snapshots, chains, audit/visibility/report/disposition evidence | Existing models preserve substantial immutable evidence; no complete disposition receipt workflow | Define minimum class-by-class fields and test that deletion does not destroy interpretability | Medium; data-minimization and limitation-period review required |
| C-13 Privacy intake and no universal deadline | Privacy-request draft offers categories, verification, reference, outcomes, and applicable-law timing | Dormant privacy case schema exists; no live intake or statutory-right resolver | Secure intake, jurisdiction/identity/agent checks, staff auth, exports/deletion, appeals | Medium-low; attorney review for covered-law applicability and deadlines |
| C-14 Precise GPS limitation | Privacy says workflow-only, no ads/Public use; Retention has conditional 30-day raw target | Stage-specific GPS evidence and current-context gates exist | Data inventory, derived-evidence boundary, raw-value lifecycle worker, holds and monitoring | Medium; verify every log/provider copy before promising deletion |
| C-15 Minors and bystanders | Terms, Privacy, Customer, Employee, and accountless drafts require stop/retake and create no proxy flow | Current safety contract is fail-closed; no minor authorization flow | Preserve operational checks, incident/report path, training and acceptance tests | High on Product Owner rule; counsel review for edge cases |
| C-16 AI human final and honest provider claims | AI draft limits AI to assistance, requires human final decisions, and rejects unverified no-training claims | Current AI modules have flags, evals, guards, review queues, and audit concepts | Current provider/data-flow inventory, feature notices, contractual verification, incident response | Medium; attorney/privacy review per use case |
| C-17 Optional transactional SMS | SMS draft is optional, non-marketing, STOP/HELP, variable frequency/rates, and capability-aware | SMS policy/provider modules exist; Employee SMS OTP is disabled because channel readiness is false | Carrier/provider readiness, registration, opt-in evidence, suppression, fallback, monitoring | Medium; telecommunications counsel review required before activation |
| C-18 Provider categories and inventory | Privacy lists functional provider categories without overclaiming | Azure, messaging, maps, identity, and AI integrations exist in source/configuration | Maintain current provider/subprocessor inventory and propagate requests/retention | Medium; vendor-contract and transfer review needed |
| C-19 Material changes and fresh assent | Terms, Privacy, and role drafts require new versions and fresh assent where appropriate | Dormant governed versions and supersession fields exist; live Terms rely on continued-use wording | Materiality rules, notice delivery, new assent gates, durable copy, no silent migration | Medium; counsel should approve thresholds and notice method |
| C-20 No historical backfill | Every package boundary forbids rewriting or reclassifying prior evidence | Existing immutable histories and dormant infrastructure are additive | Activation migration/procedure must create only prospective versions and preserve old semantics | High; independent deployment verification recommended |
| C-21 Narrow content license | Terms grants only operation/security/audit/support and authorized visibility rights; user retains rights | Current Terms/license language must be compared at activation; Public auth is server separated | Counsel-approved ownership/license language and exact Public dependency enforcement | Medium-low; attorney review required |
| C-22 Disclaimers, liability, indemnity | Terms uses restrained platform disclaimers and defers broad cap/indemnity provisions | Live Terms contain broader provisions | Product risk allocation, insurance, B2B/B2C distinction, conspicuous presentation | Low-medium; attorney drafting required before effective Terms |
| C-23 Electronic signatures and durable copies | Vendor/accountless drafts state electronic intent, exact snapshot, and durable-copy requirement | Evidence models can store versions/hashes; no complete durable-copy workflow for all roles | Consent-to-electronic-record presentation, withdrawal of e-delivery, hardware/software disclosures if required | Medium-low; attorney review for E-SIGN and state-law requirements |
| C-24 Accessibility and language | Accessibility draft targets WCAG 2.2 AA without claiming certification and requires controlled translations | Existing UI has accessibility patterns but no complete conformance evidence or legal-copy translation governance | Baseline audit, assistive-tech tests, remediation, alternatives, versioned reviewed translations | Medium; accessibility counsel/reviewer input recommended |

## Known current-to-draft differences that must remain inactive

1. The current rendered Terms contain mandatory arbitration/class-waiver and continued-use concepts that this draft retires prospectively. This package does not alter the current page.
2. The current Customer recording page still exposes a Decide Later action. The prospective draft does not include it, but this package does not remove it.
3. The current Employee recording-participation identifier remains counsel-review-required. This package does not change that status or activate Phase 3C.
4. Current Share Publicly/Make Private UI does not bind the complete new outside-copy disclosure snapshot. This package does not change a visibility transaction.
5. The Product Owner legal-plan email in these drafts differs from the canonical live customer-support mailbox. Activation requires an explicit contact-purpose decision; this package changes neither address.
6. Retention targets are not implemented promises. No lifecycle worker, deadline, or deletion action is enabled.
7. Privacy request and withdrawal case models are dormant. No route, staff queue, or automated outcome exists.
8. SMS is not a generally proven channel for every flow, and Employee decision SMS is disabled. The draft does not enable it.

## External reference set

These sources guide review but do not by themselves decide applicability:

- Florida Security of Communications Act, including consent provisions: <https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0900-0999/0934/Sections/0934.03.html>
- Florida Digital Bill of Rights definitions and controller scope: <https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.702.html>
- Federal E-SIGN Act, 15 U.S.C. Chapter 96: <https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim>
- FTC business privacy and data-security guidance: <https://www.ftc.gov/business-guidance/privacy-security>
- FTC guidance on AI commitments and undisclosed data use: <https://www.ftc.gov/business-guidance/blog/2024/02/ai-companies-uphold-your-privacy-confidentiality-commitments>
- NIST AI Risk Management Framework: <https://www.nist.gov/itl/ai-risk-management-framework>
- W3C Web Content Accessibility Guidelines 2.2: <https://www.w3.org/TR/WCAG22/>
- U.S. Department of Justice web accessibility guidance: <https://www.ada.gov/resources/web-guidance/>

## Review gates before any effective version

- Product Owner approves each exact item, not merely the package concept.
- Counsel identifies approved, revised, or rejected provisions and any required jurisdiction-specific language.
- Engineering completes every mapped dependency and proves source-to-runtime content identity.
- A fresh version and hash are created for any edit after review.
- No historical evidence is relabeled or backfilled.
- Controlled beta acceptance verifies exact display, actor identity, durable copy, submit-time context, stored snapshot/hash, withdrawal/support path, and accessibility.
- A separate authorization explicitly makes a version effective and deploys it. Silence, a repository commit, or this manifest can never activate content.
