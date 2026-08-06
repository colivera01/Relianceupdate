# Reliance Epic 8 - Trust Score and Evidence-Based Dashboards Implementation Plan

**Status:** Proposed for Product Owner review; implementation is not authorized
**Prepared:** 2026-08-05
**Repository:** `colivera01/Relianceupdate`
**Branch:** `codex/epic3-beta-admin-grant-correction`
**Planning baseline:** Current executable repository plus the frozen governing documents listed below

> Numbering note: the frozen roadmap originally labels this scope as Epic 9. The Product Owner-approved implementation order and Project Management workspace label it Epic 8. This plan uses Epic 8 without rewriting the frozen roadmap.

## 1. Scope Confirmation

Epic 8 will make every current Trust Score and dashboard metric derive from one named, testable evidence definition. It will reconcile customer, vendor, public, and admin surfaces while preserving role-appropriate detail.

The implementation may:

- consolidate duplicated metric queries and client-side formulas;
- version the Trust Score evidence dictionary and calculator;
- add source-level provenance to snapshots if the final implementation audit confirms it is required;
- make recalculation and reconciliation idempotent and auditable;
- correct misleading metric labels, fallback values, freshness states, and empty states;
- align current dashboard counts with canonical work-record, review, media, publication, and lifecycle evidence;
- expose admin-only reconciliation and diagnostic evidence; and
- add tests, screenshots, reports, checklist evidence, and a scoped Git checkpoint.

The implementation will not:

- change recording permission or recording gates;
- change Private or Public approval authority;
- change withdrawal, dispute, retention, or deletion decisions;
- create a review, rating, Trust Score input, permission, publication approval, or Public video from silence or a participant's privacy choice;
- treat a customer review as a Trust Score input in Version 1;
- let AI calculate, override, or invent metric evidence;
- introduce score-change marketing pressure;
- rewrite frozen policies or governing documents;
- begin Epic 9, Epic 10, Epic 11, or Epic 12; or
- apply migrations or deploy without a later, separate Product Owner checkpoint.

## 2. Success Definition

Epic 8 succeeds when all current metric surfaces answer four questions from the same evidence:

1. What is being measured?
2. Which finalized records count and which do not?
3. When was the value last reconciled?
4. Why can this role see this amount of detail?

Success also requires:

- the same controlled fixtures produce the same result on vendor, customer, public, and admin surfaces;
- no measurable value silently becomes `0` when evidence is absent or temporarily unavailable;
- genuine approved customer reviews remain Customer Rating evidence, separate from Trust Score;
- no review, Private choice, publication decline, permission decision, withdrawal, or silence creates a positive or negative Trust Score result;
- manager-approved Private proof counts as verified completion on the same basis as equivalent Public proof;
- Public visibility adds no Trust Score bonus;
- pending disputes and unresolved moderation do not become finalized negative outcomes;
- finalized validated operational outcomes are preserved as historical facts without exposing restricted media;
- recalculation is idempotent, versioned, auditable, and rollback-aware; and
- every affected page has truthful loading, empty, unavailable, and stale-data states.

## 3. Checklist Items Included

The frozen roadmap maps this epic to:

- `TRUST-01` through `TRUST-06`;
- `REV-04`;
- `PROD-10`, `PROD-11`, and `PROD-13`;
- `ADM-07` and `ADM-08`;
- relevant `TEST-01` through `TEST-03` and `TEST-11`;
- `SHOT-01`, `SHOT-02`, and `SHOT-04`; and
- related `DOC-*` deliverables.

The current master checklist does not yet contain individual `TRUST-*`, `REV-04`, `ADM-07`, or `ADM-08` rows. Epic 8 implementation must add or reconcile those rows without renumbering or rewriting unrelated checklist history. No row becomes Beta Ready from local code alone.

Shared product rows affected by the current checklist are:

| Row | Epic 8 evidence expected | Completion boundary |
|---|---|---|
| `PROD-02` | Four proof signals remain distinct | Preserve completed status; add regression evidence only |
| `PROD-10` | Customer counts and trust context use canonical sources | Customer journey and live refresh remain release-shared |
| `PROD-11` | Vendor cards, Analytics, and work-record counts reconcile | Live cache/freshness and role replay remain release gates |
| `PROD-13` | Admin sees source records, versions, and reconciliation state | Admin authorization and export replay required |
| `TEST-08` | Optional reviews remain neutral to Trust Score | Repository scan plus unit/integration/browser proof |
| `TEST-11` | Epic 1-7 workflows do not regress | Full regression and build evidence |

## 4. Dependencies Verified

| Dependency | Current state | Epic 8 treatment |
|---|---|---|
| Epic 1 genuine optional reviews | Completed and frozen | Preserve review ownership/moderation; no-review stays neutral |
| Epic 3 Phase A role isolation | Completed and deployed | Rebuild actor and authority server-side for protected metric endpoints |
| Epic 4 recording gates | Completed and frozen | Gate decisions never become Trust Score inputs |
| Epic 5 Private Service Videos | Completed and frozen; release gates open | Manager-approved valid Private proof is a verified-completion source |
| Epic 6 Public Service Videos | Completed and frozen; release gates open | Public visibility adds no score value; exact-media state affects public display only |
| Epic 7 lifecycle | Completed and frozen; release gates open | Least-exposure access state is respected without rewriting finalized operational history |
| Current Trust Score foundation | Present in executable code | Preserve and reconcile rather than replace wholesale |
| Metric dictionary | Partly encoded in code, not one frozen operational artifact | Codify one versioned implementation dictionary during Epic 8 |

Epic 8 implementation must use controlled local fixtures until the pending Epic 5-7 migrations and deployments receive separate approval. It must not assume beta contains schemas that have not been applied.

## 5. Frozen Governing Documents

The following govern this epic and must not be edited:

- `RELIANCE_PRODUCT_IDENTITY.md`
- `RELIANCE_PRODUCT_IDENTITY_ALIGNMENT_AUDIT.md`
- `RELIANCE_PLATFORM_LANGUAGE_GUIDE.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_ARCHITECTURE_V1.md`
- `docs/legal-consent-audit/RELIANCE_RECORDING_AND_CONSENT_WORKFLOW_SPEC_V1_1.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_IMPLEMENTATION_DECISION_REGISTER.md`
- `docs/legal-consent-audit/RELIANCE_CONSENT_UX_SPECIFICATION_V1.md`
- `Project Management/RELIANCE_IMPLEMENTATION_ROADMAP_V2.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`

The executable repository remains the current implementation baseline. If implementation requires changing a frozen requirement, work stops for Product Owner review.

## 6. Current Repository Audit

### 6.1 Existing Trust Score foundation

| Capability | Current implementation | Assessment |
|---|---|---|
| Finalized outcome layer | `src/lib/trust-score-outcome-foundation.ts`; `VendorOperationalOutcome`; `BookingServiceIssue` | Strong base. Inputs are distinct from reviews and only finalized/validated events affect score math. |
| Calculator | `src/lib/trust-score-calculator.ts` | Version 1 uses four weighted operational components and renormalizes when a denominator is absent. |
| Snapshot storage | `VendorTrustScoreSnapshot` in `prisma/schema.prisma` | Stores component values/counts, version, hash, source/reason, current flag, and detail JSON. |
| Read shaping | `src/lib/trust-score-read.ts` | Separate public, vendor, and admin payloads already exist. |
| Public maturity | `src/lib/public-trust-score-presentation.ts` | Provides Building/Early Stage/Emerging/Established presentation without changing score math. |
| Historical repair | `src/lib/trust-score-historical-backfill.ts`; admin backfill/rebuild routes | Existing idempotency tests provide a useful base, but source-level reconciliation needs review. |
| Role APIs | public, vendor, and admin Trust Score routes under `src/app/api/` | Audience boundaries exist; authorization and fallback behavior require regression confirmation. |
| Event triggers | manager approval, cancellation, admin package moderation, reported-content paths | Recalculation is distributed and can drift when new finalized lifecycle events are added. |

### 6.2 Existing metric surfaces

| Surface | Current source | Audit observation |
|---|---|---|
| Vendor dashboard | `/api/vendors/[vendorId]/dashboard` plus client-side calculations | Trust Score snapshot is included, but multiple fallback fields and `0` fallback can hide not-yet-measurable state. |
| Vendor Analytics | `deriveVendorAnalyticsMetrics` over the dashboard response | Completion and review coverage are recalculated client-side, creating a second definition path. |
| Public Trust Score | `/api/vendors/[vendorId]/trust-score` | Snapshot-based and public-safe; maturity context exists. |
| Vendor Trust Score | `/api/vendor/trust-score` | Own-vendor snapshot with improvement guidance; unavailable reads currently fall back to no snapshot. |
| Admin Trust Score | admin vendor Trust Score, recalculate, rebuild, and backfill routes | Internal detail exists, but a complete named-source reconciliation view/export is not yet verified. |
| Customer dashboard | bookings, favorites, and own-review summary APIs | Current counts are independent; there is no customer-specific Trust Score and none should be invented. |
| Reviews | moderated genuine review queries and public aggregates | Reviews correctly remain a separate proof signal; approved review definitions must be shared consistently. |

### 6.3 Confirmed strengths to preserve

- The Trust Score calculator does not read or write `Review`.
- No measurable component lowers a score merely because it lacks a denominator.
- Snapshots are versioned and use an input hash for idempotency.
- Public, vendor, and admin response shapes intentionally expose different detail.
- Public maturity language prevents a low-history score from appearing overly authoritative.
- Countable-data filters exist for demo/seed/test exclusions.
- Genuine approved customer-review queries already centralize parts of rating aggregation.
- Current Trust Score unit, public, vendor, admin, historical-backfill, and rebuild tests provide a substantial regression base.

### 6.4 Gaps Epic 8 must address

1. `src/app/vendor/dashboard/page.tsx` says the Trust Score comes from “completed proof, reviews, and reliability,” while the calculator intentionally excludes reviews. This is misleading active copy.
2. Vendor dashboard fallback logic can turn no snapshot or unavailable data into a displayed score of `0`, which is not the same as “not yet measurable.”
3. Dashboard, Analytics, public-profile, and admin metrics do not all use one canonical metric registry.
4. Completion rate, public-review count, approved-service-video count, and lifecycle counts have duplicated server/client fallback formulas.
5. Current `inputHash` proves aggregate input counts, not the identity of every source row used in a snapshot.
6. Recalculation triggers are distributed across routes; a new finalized event can be persisted without a guaranteed synchronized snapshot refresh.
7. Cache and fallback paths may temporarily show different values without a visible freshness or stale-data state.
8. Public maturity thresholds are encoded in presentation code but not included in one reviewed metric dictionary.
9. Existing historical backfill must be rechecked against Epic 5-7 evidence and exclusion rules before use.
10. Admin reconciliation/export capable of naming source evidence is incomplete.
11. The current master checklist lacks the roadmap's dedicated Trust Score row group.

## 7. Canonical Metric Dictionary Proposed For Epic 8

Approval of this plan approves the following Version 1 definitions unless the Product Owner changes a listed decision before implementation.

### 7.1 Reliance Trust Score

| Component | Definition | Counts | Does not count |
|---|---|---|---|
| Verified workflow completion, 30% | Completed finalized work records divided by finalized terminal work records | Genuine non-demo completed/canceled operational outcomes | Pending work, silence, permissions, reviews, audience choice |
| Video verification success, 25% | Latest finalized package approval divided by latest finalized package approval/rejection outcomes | Evidence-complete manager/admin package decision according to the current approved workflow | Pending review, upload attempts, Public choice, removed public visibility |
| Dispute-free completion, 30% | Completed work without a validated/refund-approved service issue divided by completed work | Finalized validated service issues | Pending/rejected concerns, privacy choice, withdrawal alone |
| Operational reliability, 15% | Terminal work without cancellation, late completion, rejected package, or validated issue divided by terminal work | Finalized operational events only | Missing review, Private proof, recording decline, unmeasurable components |

Rules:

- An unmeasurable component remains unavailable and its weight is renormalized; it is not zero.
- If no component is measurable, the score is “Building,” not `0`.
- Private and Public proof receive identical verified-completion treatment when the underlying approved package is otherwise equivalent.
- Public visibility itself contributes no points.
- Customer reviews and star ratings do not enter Trust Score Version 1.
- Pending, restricted, held, withdrawn, or deleted access states do not by themselves rewrite finalized operational outcomes.
- A validated service-quality dispute may affect the appropriate operational component; a privacy/publication withdrawal alone may not.
- Prerecorded fallback media remains ineligible for public Trust Score proof presentation as required by the decision register.

### 7.2 Separate dashboard metrics

| Metric | Canonical rule |
|---|---|
| Customer Rating | Average of genuine, customer-submitted, approved, public reviews tied to eligible real work records. No review means no rating input. |
| Public Reviews | Count of those same approved, public, genuine reviews. |
| Completed Work Records | Count of eligible work records in canonical completed state, excluding demo/seed/test records under the shared exclusion policy. |
| Manager Review | Count of work records whose canonical next responsible participant is the vendor manager. |
| Public Service Videos | Count of exact package versions with a currently valid complete Public evidence chain and no restricting lifecycle state. |
| Private Service Videos | Count of evidence-complete manager-approved packages available only to authorized participants. |
| Approved Service Packages | Count of evidence-complete manager-approved package versions regardless of Private/Public audience; label must not imply Public. |
| Active Work | Count by the canonical work-record phase, not a client fallback inferred from display text. |
| Freshness | Server-generated `computedAt`/`asOf` plus an explicit stale/unavailable state; the UI never substitutes `0` for an unavailable read. |

## 8. Expected Repository Impact

### Routes and pages

- `src/app/page.tsx` and public proof/vendor profile surfaces that show score or evidence counts
- `src/app/vendor/dashboard/page.tsx`
- `src/app/vendor/analytics/page.tsx`
- `src/app/(user)/user-dashboard/page.tsx` and customer trust-context surfaces
- `src/app/admin/dashboard/page.tsx` and the admin vendor/reporting surfaces
- shared loading, unavailable, and metric-detail components

### APIs

- `src/app/api/vendors/[vendorId]/dashboard/route.ts`
- `src/app/api/vendor/dashboard/route.ts` if still active after route inventory
- public/vendor/admin Trust Score routes
- admin recalculate, rebuild, and historical-backfill routes
- customer summary APIs only where current reachable metrics require reconciliation
- a narrowly scoped admin reconciliation/export endpoint if existing endpoints cannot provide named evidence safely

### Database

- Existing `VendorOperationalOutcome`, `BookingServiceIssue`, `VendorTrustScoreSnapshot`, `Review`, booking, media package, publication, and lifecycle models remain.
- Expected migration count: zero or one additive migration.
- Recommended migration if source-level provenance cannot be represented safely with current immutable records: add snapshot-to-source evidence rows keyed by snapshot, source type, source ID, contribution type, and source version/hash.
- No destructive migration, no review conversion, no historical fabrication, and no rewrite of valid snapshots.

### Components and shared libraries

- `src/lib/trust-score-calculator.ts`
- `src/lib/trust-score-read.ts`
- `src/lib/trust-score-outcome-foundation.ts`
- `src/lib/trust-score-historical-backfill.ts`
- `src/lib/public-trust-score-presentation.ts`
- `src/lib/vendor-analytics.ts`
- `src/lib/public-review-aggregates.ts`
- `src/lib/metrics-exclusion.ts`
- `src/components/vendor/VendorTrustScoreCard.tsx`
- new or existing shared metric-definition, reconciliation, freshness, and explanation helpers

### Notifications

No score-change marketing notification is planned. Existing notifications must not imply that silence, reviewing, publishing, or choosing Private improves a score. Any operational reconciliation failure alert must be admin-only.

### AI

No AI calculation, weighting, evidence selection, or score override. AI may not create explanatory claims beyond deterministic approved metric text. Broader AI work remains Epic 9.

### Dashboards

Customer, vendor, public, and admin surfaces will consume canonical server-side summaries rather than independently reconstructing figures.

### Policies

No policy rewrite. Epic 8 will produce verified implementation definitions that Epic 11 may later use; they do not become legal text automatically.

### Estimated size

- **Files:** approximately 25-45
- **Migration:** zero or one additive migration
- **Screenshots:** approximately 16-22
- **Complexity:** Large
- **Risk:** High

## 9. Security And Privacy Considerations

- Public endpoints expose only publicly listed active vendors, public-safe aggregate counts, maturity context, and current valid Public evidence.
- Vendor endpoints require current active membership for the exact vendor.
- Admin source evidence, row identifiers, recalculation reasons, hashes, and export functions require current database-backed admin authority and the path-scoped admin session.
- Customer endpoints expose only the customer's own work records and public vendor evidence already available to anyone.
- Employee actions must not expose vendor-wide analytics or create score inputs outside finalized authorized workflows.
- Metric APIs rebuild actor, ownership, membership, and platform authority from current database state.
- No response exposes customer contact details, consent evidence, Private media, raw internal metadata, secrets, or unrelated tenant records.
- Reconciliation and backfill operations require idempotency keys, audit records, bounded scope, and abuse/rate controls.

## 10. API Protection And Role Matrix

| Actor | May see | May trigger | Must never access |
|---|---|---|---|
| Public | Public score summary, maturity, approved review aggregate, valid Public proof count | None | Source row IDs, Private counts tied to identifiable work, recalc controls, internal issues |
| Customer | Own service history plus public vendor evidence | None | Vendor internal metrics, other customers, score recalculation |
| Vendor manager | Own vendor score, components, definitions, freshness, improvement context | Normal workflow events only; no arbitrary score write | Another vendor, admin source metadata, direct score override |
| Employee | Assignment-specific operational state only | Existing authorized work actions | Vendor score internals, customer aggregates, score/review creation |
| Admin | Full source reconciliation, version, freshness, audit, bounded recalc/backfill | Authorized audited reconciliation | Raw secrets, ability to fabricate participant activity, unsupported score edits |

Expected errors:

- `401` for no valid authenticated session on protected routes;
- `403` for an authenticated actor without the required role/membership;
- non-disclosing `404` where resource existence would reveal another tenant;
- `409` for stale-version or concurrent recalculation conflicts;
- `422` for an invalid controlled reconciliation request; and
- `503` with truthful retry guidance when source data is unavailable, never a fabricated zero.

## 11. UX Considerations

### Customer and public

- Keep Service Videos, Customer Reviews, Trust Score, and Services Offered visibly distinct.
- Show “Trust Score building” when no reliable score is measurable.
- Pair any score with maturity and evidence coverage; never show a bare authoritative number.
- Explain that Private choices and no review do not lower the score.
- Do not expose internal weights unless the approved public explanation calls for them.

### Vendor

- Each card answers what it measures, current value, evidence count, freshness, and the legitimate operational path that changes it.
- Remove pressure to seek publication or reviews merely to improve the score.
- Separate Customer Rating from Trust Score visually and in copy.
- Replace fallback zeros with Building, No data yet, or Temporarily unavailable as applicable.

### Employee

- Do not add vendor-wide score pressure to the assigned-work experience.
- If an approved operational event contributes later, the employee sees the truthful workflow outcome, not score manipulation guidance.

### Admin

- Show formula version, snapshot time, source counts, named source evidence, exclusions, last trigger, and reconciliation result.
- Make recalculation a controlled diagnostic action, not an editable score field.
- Clearly distinguish current snapshot, historical snapshot, stale snapshot, and failed reconciliation.

All screens must include loading, success, failure, empty, insufficient-evidence, and stale-data states where relevant.

## 12. Backward Compatibility

- Preserve current Trust Score URL paths and response fields where they are accurate.
- Add fields rather than silently changing consumer contracts; deprecate inaccurate aliases only after all in-repository consumers move.
- Preserve every genuine review and existing valid operational outcome.
- Do not convert old missing snapshots into zeros or reviews.
- Recalculate using an incremented score/definition version when formula inputs or source rules materially change.
- Keep prior snapshots for historical evidence; do not mark a prior snapshot current after a newer successful snapshot.
- Existing dashboards remain usable during rollout through compatibility shaping, but all calculations move server-side before the compatibility aliases are retired.

## 13. Primary Risks And Mitigations

| Risk | Level | Mitigation |
|---|---|---|
| Historical outcome rows do not match Epic 5-7 truth | High | Dry-run reconciliation, exclusion report, no mutation until reviewed |
| Score changes surprise vendors | High | Versioned definitions, before/after fixture report, maturity/context, no marketing notification |
| Client and server display different counts | High | One server registry and contract tests for every role |
| Private/Public choice affects score accidentally | Critical | Explicit neutrality tests using otherwise identical fixtures |
| Pending dispute becomes a negative signal | Critical | Count only finalized validated/refund-approved issue states |
| Recalculation races create two current snapshots | High | Transactional current-snapshot switch, uniqueness strategy, concurrency tests |
| Cache serves stale or withdrawn Public evidence | Critical | Canonical invalidation, freshness metadata, no-store where exposure state matters |
| Admin export leaks customer/private evidence | Critical | Minimal fields, admin authority, fixture-based disclosure tests |
| Backfill fabricates history | Critical | Existing source records only, dry run, idempotency, immutable audit, rollback plan |
| Current dashboard copy misstates review influence | High | Central copy test and repository wording scan |

## 14. Rollback Strategy

- Keep the previous application package and score-calculation version deployable.
- If an additive provenance migration is used, rollback application code without dropping evidence tables.
- Preserve prior snapshots and source outcomes; rollback changes which version is served, not the historical evidence.
- Run backfill in dry-run mode first and save only counts/hashes, never secrets or customer data.
- If reconciliation differs unexpectedly, stop writes, retain the last known valid snapshot, mark the display stale/unavailable, and investigate.
- Do not restore misleading fallback zeros or review-based Trust Score copy during rollback.

## 15. Estimated Implementation Sequence

1. Reconfirm repository, branch, status, migrations, and unrelated worktree changes.
2. Freeze the Version 1 metric dictionary in implementation tests and an Epic 8 evidence document; do not change frozen product documents.
3. Inventory every metric consumer, event producer, cache, fallback, and exclusion path.
4. Build one canonical metric registry and server-side dashboard-summary layer.
5. Strengthen Trust Score provenance and transactional snapshot recalculation; add the additive migration only if required.
6. Normalize finalized event triggers from Epic 5-7 without changing those workflows.
7. Migrate vendor, public, customer, and admin APIs to canonical summaries while preserving compatible response fields.
8. Update role UI copy, maturity, definitions, freshness, and complete states.
9. Add admin reconciliation/dry-run/export with strict authorization and audit evidence.
10. Run controlled historical reconciliation and compare before/after without deploying or mutating beta.
11. Run focused, cross-epic, security, browser, accessibility, build, and wording validation.
12. Capture desktop/mobile screenshots and complete the four-role UX critique.
13. Update the Epic 8 reports, checklist, Project Dashboard, lessons, debt, demo, and Git checkpoint.
14. Commit and push only approved Epic 8 changes; stop for Product Owner review before migration or deployment.

## 16. Test Plan

### Unit tests

- Each component numerator/denominator and weight.
- Empty denominator renormalization and all-unmeasurable behavior.
- No-review, silence, permission, Private/Public choice, publication decline, withdrawal, and deletion neutrality.
- Manager-approved equivalent Private/Public packages produce identical verification treatment.
- Pending/rejected disputes remain neutral; validated/refund-approved issues follow the approved rule.
- Genuine approved reviews affect Customer Rating only.
- Demo/seed/test/vendor exclusions are consistent.
- Maturity thresholds and wording do not alter score math.
- Input hash/provenance stability and score-version changes.

### Integration tests

- Finalized completion, cancellation, moderation approval/rejection, validated issue, late completion, and correction paths.
- One current snapshot under retries and concurrent recalculation.
- Dry-run and committed rebuild are idempotent.
- Vendor/public/admin endpoints return the same score with role-appropriate fields.
- Dashboard/Analytics counts match the canonical registry.
- Stale cache invalidation and unavailable database handling.
- Admin reconciliation/export authorization and disclosure minimization.
- Existing valid reviews remain visible and moderated under current rules.

### Authorization and security tests

- Public inactive/unlisted vendor denial.
- Customer ownership boundaries.
- Vendor cross-tenant IDOR denial.
- Employee vendor-wide metric denial.
- General-session admin denial and current admin grant requirement.
- Direct-route, guessed-ID, malformed filter, large export, and repeated-recalc controls.

### Cross-epic regression

- Epic 1 permission events create no metric input.
- Epic 2 proof-signal language remains distinct.
- Epic 3 role isolation remains fail closed.
- Epic 4 gate diagnostics create no metric input.
- Epic 5 Private proof remains a complete valid outcome.
- Epic 6 Public choice creates no score bonus.
- Epic 7 withdrawal/restriction narrows access without fabricating a service failure.
- Phase 1 optional-review/no-review neutrality remains intact.

### Browser and visual tests

- Public vendor profile, Explore Proof, customer dashboard, vendor dashboard, Analytics, and admin reporting.
- Desktop and mobile loading, success, empty, Building, unavailable, stale, and access-denied states.
- No clipping, hidden freshness, unreadable badges, or horizontal scrolling.
- Keyboard/focus and status announcements for metric explanation and admin controls.

### Quality commands

- focused unit and integration tests;
- Trust Score and review regression suites;
- Epic 1-7 focused regressions;
- role-authorization and IDOR suites;
- Playwright desktop/mobile suites;
- TypeScript;
- Prisma validate/generate if schema changes;
- linting or repository-supported focused lint checks;
- production build with the established heap setting;
- dependency and secret scans appropriate to changed files;
- `git diff --check`; and
- post-implementation search for misleading review/Trust Score and fallback-zero wording.

Only commands actually run will be reported as passed.

## 17. Screenshot Plan

Screenshots stay in the Epic 8 evidence folder and are not committed unless explicitly required by the approved evidence rules.

### Desktop

1. Public vendor profile - Trust Score building.
2. Public vendor profile - early-stage score with evidence coverage.
3. Public vendor profile - established score with Customer Rating separate.
4. Vendor dashboard - canonical metrics and freshness.
5. Vendor Analytics - reconciled metrics and definitions.
6. Customer dashboard - own history and public trust context.
7. Admin reconciliation - current snapshot and named evidence.
8. Admin dry-run result - unchanged/idempotent.
9. Admin failure/stale state.
10. Access denied for wrong vendor/non-admin.

### Mobile

11. Public Building state.
12. Public scored state.
13. Vendor dashboard metrics.
14. Vendor metric explanation.
15. Customer trust context.
16. Admin reconciliation summary.

### Comparisons and state evidence

17. No review versus genuine approved review: Customer Rating changes, Trust Score does not.
18. Equivalent Private versus Public proof: no visibility bonus.
19. Public withdrawal: public count changes, finalized verified-completion evidence does not.
20. Pending versus validated dispute.
21. Loading versus success.
22. Temporarily unavailable versus legitimate zero count.

## 18. PRODUCT OWNER DEMO CHECKLIST

| Validate | Exact action and expected observation |
|---|---|
| Expected workflow | Create controlled work records for completed Private proof, equivalent Public proof, canceled work, late completion, approved/rejected package, pending dispute, validated dispute, no review, and genuine approved review. Reconcile once, then reopen every metric surface. |
| Expected notifications | Confirm no message pressures review/publication, promises a score increase, or treats silence as an outcome. Any reconciliation failure alert is admin-only. |
| Expected dashboard updates | Trigger each finalized eligible event and refresh customer, vendor, Analytics, public, and admin pages. Matching metrics update together and show an accurate `as of` time. |
| Expected database state | Inspect source outcomes, issues, current snapshot, prior snapshot, input hash, and source provenance. Re-run calculation and confirm no duplicate current snapshot or drift. |
| Expected admin state | Open reconciliation, compare named source records to the displayed calculation, run dry-run and committed modes, verify audit evidence, and export only the controlled vendor. |
| Expected customer state | Confirm the customer sees only own records and public vendor context. Choosing Private or leaving no review creates no penalty, warning, or score change. |
| Expected vendor state | Confirm Customer Rating and Trust Score are separate, each metric is explained, no missing value appears as zero, and internal actions cannot directly edit a score. |
| Expected employee state | Complete or view an assigned workflow and confirm no score controls, vendor-wide metric detail, or pressure copy appears. |
| Expected Trust Score behavior | Compare expected and actual four-component math; verify no-review, permission, Private/Public choice, and withdrawal neutrality; validate only finalized approved evidence. |
| Expected review behavior | Leave one record without a review and submit one genuine moderated review. Customer Rating changes only for the genuine review; Trust Score Version 1 remains unchanged. |
| Expected audit history | Confirm calculator version, source IDs/hashes, trigger, actor for admin actions, timestamps, dry-run result, and current-snapshot transition are reconstructable without fabricated customer events. |
| Expected screenshots | Verify all desktop/mobile, Building/scored, loading/failure/empty/stale, role, no-review/review, Private/Public/withdrawn, and admin reconciliation images in the screenshot index. |

## 19. REGRESSION STATEMENT Plan

The final Engineering Report must explicitly distinguish new Epic 8 work from preserved behavior.

### Existing functionality intentionally preserved

- genuine optional customer reviews and moderation;
- current Trust Score's four operational components unless Product Owner approval changes the metric dictionary;
- three-stage capture, manager approval, Private access, exact-media Public decisions, and lifecycle restrictions;
- role isolation and public/private data boundaries;
- public maturity presentation where consistent with the approved dictionary; and
- existing route compatibility.

### Existing functionality intentionally unchanged

- permission, recording, publication, withdrawal, deletion, retention, notification delivery, AI authority, and legal policy behavior;
- customer/vendor/employee/admin account lifecycle; and
- all frozen governing documents.

### Areas to verify unaffected

- Epic 1 through Epic 7 focused regressions;
- no review/rating/Trust Score/publication side effects from unrelated decisions;
- direct media access and cache invalidation;
- registration and role-bound dashboards;
- notification worker and internal worker authentication; and
- Azure standalone packaging/build output.

### Potential regression risks reviewed

- historical score drift;
- stale dashboard values;
- wrong-tenant metric disclosure;
- Private/Public visibility accidentally influencing score;
- review aggregation leaking into Trust Score;
- unavailable values displayed as zero; and
- backfill duplicates or fabricated history.

### Known unrelated issues

All pre-existing failures, advisories, deferred provider validation, and Epic 5-7 release gates will be documented separately and will not be silently fixed or attributed to Epic 8.

## 20. Expected Deliverables

1. Implemented canonical metric registry and reconciled dashboard experience.
2. Zero or one additive migration with migration evidence, if approved and required.
3. Unit, integration, authorization, regression, Playwright, build, and security results.
4. Desktop/mobile screenshot package and index.
5. Four-role UX review.
6. Engineering Report including the full Regression Statement.
7. Product Owner Demo checklist and results.
8. Lessons Learned.
9. Technical Debt record.
10. Checklist Snapshot and master checklist updates.
11. Project Dashboard update.
12. Scoped Git checkpoint and push.

## 21. Acceptance Criteria

Epic 8 engineering may be presented for approval only when:

1. Every displayed metric reconciles to one named definition and source set.
2. Trust Score and Customer Rating are visibly and technically separate.
3. No-review, silence, permission, Private/Public choice, publication decline, and withdrawal alone produce no Trust Score outcome.
4. Missing or unavailable evidence never appears as a legitimate zero score.
5. Equivalent valid Private and Public packages receive the same verified-completion treatment.
6. Public visibility and current lifecycle access are handled without rewriting finalized operational history.
7. Customer, vendor, public, and admin values agree while exposing only role-appropriate detail.
8. Recalculation/backfill is idempotent, audited, source-traceable, and rollback-aware.
9. Admin cannot directly set a score or fabricate participant activity.
10. All required tests, screenshots, reports, checklist updates, and Git evidence are complete.
11. No frozen document was changed and no later epic was implemented.

## 22. Product Owner Decisions Embedded In Plan Approval

Approval of this implementation plan confirms these recommended defaults:

1. Keep Trust Score Version 1's four current operational components and 30/25/30/15 weights.
2. Keep genuine customer reviews entirely outside Trust Score Version 1; reviews affect Customer Rating only.
3. Give equivalent evidence-complete Private and Public packages equal verified-completion treatment; Public visibility adds no value.
4. Keep Building/Early Stage/Emerging/Established maturity presentation, subject to fixture validation of current thresholds.
5. Add source-level snapshot provenance through one additive migration only if the implementation audit proves current evidence cannot satisfy named-source reconciliation.
6. Prefer event-triggered recalculation plus an audited reconciliation tool; never calculate arbitrary live scores in public requests.
7. Preserve finalized historical outcomes while applying current access restrictions to what may be served publicly.

Any requested change to these defaults must be made before implementation begins.

## 23. Approval Gate

No Epic 8 application code, schema migration, deployment, checklist promotion, or score recalculation is authorized by this plan.

After Product Owner approval, implementation begins at sequence step 1 and stops after the complete Epic 8 evidence package. Epic 9 does not begin automatically.
