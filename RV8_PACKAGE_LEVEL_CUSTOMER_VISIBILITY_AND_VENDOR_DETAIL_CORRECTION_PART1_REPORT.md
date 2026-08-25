# RV-8 Package-Level Customer Visibility and Vendor Detail Correction - Part 1 Report

## Root Cause

The executable workflow still combined three different evidence contracts:

1. the booking's generic `COMPLETED` state;
2. the Core Reliance Audit and Private Proof release lifecycle; and
3. the historical Epic 6 vendor-selected, per-stage Public proposal contract.

That combination allowed generic completion and recording-permission feedback to compete with the current audit state, left stage-level Public controls in the Vendor workflow, and placed privacy/governance operations directly in the operational detail page. The historical customer publication endpoint also needed an explicit contract-version guard so a new package-level proposal could never accept a legacy per-stage customer decision.

## Final Service Video Package Model

For corrected-V1 records, Starting Condition, Work in Progress, and Final Result are treated as one complete Service Video package. The package visibility contract is version 2 and records a customer decision for the exact package rather than reusing historical per-stage decision fields.

The package remains private unless the owning customer affirmatively authorizes the complete package for separate Public review.

## Vendor View Job

Vendor View Job now uses the canonical lifecycle presentation as its primary status. While the package awaits Core Admin Audit, it presents **Reliance Audit Pending**, identifies Reliance Admin as the next actor, explains that Private Proof has not been released, and keeps generic employee recording completion as secondary evidence.

The activity timeline now uses qualified, evidence-backed events such as:

- Employee recording completed
- Submitted to Reliance Audit
- Reliance Audit passed or failed
- Customer Private Proof released
- Customer kept Private
- Customer authorized Public sharing
- Public review pending or Public approved

The unqualified `Completed` event was removed. Recording permission and scope remain visible as completed prerequisite evidence and no longer compete with the current lifecycle.

The read-only Starting Condition, Work in Progress, and Final Result timeline remains available. Vendor stage-selection and customer-visibility decision controls were removed.

## Customer Private-by-Default Model

Core Admin PASS and a matching active Private Proof grant are both required before the customer visibility decision becomes available. Admin PASS alone releases the exact approved package as Private Proof but does not create a Public proposal or make any media Public.

With no customer visibility decision, the state is `PRIVATE_DEFAULT`.

## Customer Keep Private / Share Publicly Decision

The owning signed-in customer receives two package-level options:

- **Keep Private** records an immutable package-level decision and creates no Public proposal.
- **Share Publicly** requires explicit complete-package confirmation and creates a version-2 proposal for separate Reliance Public review.

The customer UI states that Public review is separate and that authorization does not make the package Public immediately. Vendor Managers and Admins may read the resulting state but cannot make the customer decision.

## Exact Package Binding

The new durable decision binds:

- booking and vendor;
- customer user;
- exact package ID, version, and package hash;
- all three stage evidence IDs;
- all three stage versions;
- all three media asset IDs and content hashes;
- a deterministic stage-set hash;
- decision version, evidence version, verification method, timestamp, and decision hash.

All three required stages are loaded from the current Admin-approved package and revalidated before the decision is persisted. A partial or stale package cannot satisfy the corrected-V1 path.

## Public Eligibility

New Public eligibility requires:

- current exact package;
- successful Core Reliance Admin PASS;
- released active Private Proof grant;
- affirmative current customer `SHARE_PUBLICLY` decision;
- exact package/stage binding;
- required participant evidence where applicable;
- separate Public Admin approval.

Legacy vendor creation/approval endpoints reject contract-v2 decisions. The legacy customer per-stage decision endpoint now also rejects contract-v2 proposals with `PUBLICATION_CUSTOMER_STAGE_DECISION_RETIRED`.

## Public Moderation Boundary

Core Reliance Audit, customer package visibility, and Public moderation remain separate evidence chains.

Core Admin PASS does not publish media. Customer `SHARE_PUBLICLY` creates a proposal in Public review. Only the existing Public moderation decision can activate exact-media Public eligibility and set the proposal to Public.

## Vendor Read-Only Visibility

The Vendor sees one of the following evidence-backed states without controls to change it:

- Private by default
- Private
- Public Review Pending
- Public

Historical contract-v1 records remain available under their original stage-based presentation.

## Privacy / Governance Capabilities

The large embedded **Privacy, concerns, and retention** panel was removed from Vendor View Job.

A single **Privacy & Governance** entry is now available in the authorized Vendor Manager Actions menu. The dedicated work-record surface preserves:

- Stop future recording
- lifecycle-aware Public restriction or withdrawal
- Report a concern
- Request stored-media deletion

The underlying lifecycle APIs, actor/authority checks, evidence, retention review, and legal-hold behavior were not removed or weakened. Employees are denied the Vendor Manager surface, while existing customer and employee role-specific lifecycle surfaces remain separate.

No required capability had to remain embedded in Vendor View Job.

## Completed Notification Resend

The pre-PASS **Resend Completed Work Order** control is absent. The post-PASS control is now **Resend Private Proof Access**.

The server permits this resend only after Core Admin PASS released Private Proof and the exact three stages remain approved. It remains manager-authorized and idempotent, does not create recording authority, and does not alter package evidence.

## Historical Compatibility

Existing contract-v1 per-stage proposals, participant decisions, visibility evidence, and governance history remain readable and unchanged. The migration defaults existing proposals to contract version 1 and `LEGACY_STAGE_SELECTION`.

New corrected-V1 records use contract version 2 and `CUSTOMER_COMPLETE_PACKAGE`. No historical evidence was rewritten.

## Migration

Added the narrow additive migration:

`prisma/migrations/20260825190000_add_package_visibility_decisions/migration.sql`

It:

- adds explicit publication proposal contract/version fields;
- makes vendor proposal membership optional for customer-created package proposals;
- adds immutable `service_video_package_visibility_decisions`;
- adds package-visibility binding to Public eligibility;
- makes legacy vendor-decision binding optional for package-level eligibility.

Prisma schema validation and Client generation passed. The migration was **not applied to beta** and no database deployment occurred.

## Trust Score

Trust Score formulas, weights, penalties, recalculation, evidence, and UI were unchanged.

## Current Journey 1 Record

A read-only beta reconciliation after implementation confirmed `cmt84a5yi0001qifh115sk2zs` remained untouched:

- booking status: `COMPLETED`;
- operational phase: `AWAITING_ADMIN_REVIEW`;
- current package version 1: `AWAITING_ADMIN_REVIEW`;
- exact package hash present;
- three exact stages present;
- manager decision: `SUBMITTED_FOR_ADMIN_AUDIT`;
- manager package hash and version match the current package;
- manager attestation and attestation hash present;
- Admin decisions: 0;
- Private Proof grants: 0;
- customer video-ready notifications: 0;
- Public proposals: 0;
- Public eligibility rows: 0;
- public-visible media: 0;
- all three linked stage assets remain private.

No Admin PASS/REJECT, customer visibility decision, Public proposal, resend, or governance action was performed.

## Files Changed

### Schema and evidence contract

- `prisma/schema.prisma`
- `prisma/migrations/20260825190000_add_package_visibility_decisions/migration.sql`
- `src/lib/service-video-publication.ts`
- `src/lib/service-video-visibility-presentation.ts`

### Customer and Vendor application surfaces

- `src/components/service-video/PackageVisibilityCard.tsx`
- `src/components/service-video/MediaLifecycleCard.tsx`
- `src/app/(user)/my-bookings/[bookingId]/page.tsx`
- `src/app/vendor/jobs/[jobId]/page.tsx`
- `src/app/vendor/jobs/[jobId]/privacy-governance/page.tsx`
- `src/app/vendor/jobs/page.tsx`
- `src/lib/vendor-job-lifecycle-presentation.ts`

### API routes

- `src/app/api/bookings/[id]/visibility/route.ts`
- `src/app/api/bookings/[id]/publication/route.ts`
- `src/app/api/bookings/[id]/lifecycle/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/publication/route.ts`

### Tests and visual evidence

- package visibility, route authorization, vendor lifecycle, governance, and compatibility unit/integration tests;
- `e2e/rv8-package-visibility.spec.ts`;
- updated Epic 7 governance and RV-8 Product Owner Playwright coverage;
- RV-8 package visibility fixtures;
- updated Epic 7 desktop/mobile governance screenshots.

## Validation

- Focused and relevant Vitest regression: **113 passed** across 12 files.
- Final package/publication route regression after compatibility closure: **20 passed** across 5 files.
- Playwright RV-8 package visibility, governance, and Product Owner replay: **19 passed**.
- Playwright Epic 5 Private Service Video and Epic 6 historical publication compatibility: **11 passed**.
- TypeScript `tsc --noEmit --incremental false`: **PASS**.
- Prisma `validate`: **PASS**.
- Prisma `generate`: **PASS**.
- Production `next build`: **PASS**.
- `git diff --check`: **PASS**.

Build notes: the isolated worktree uses a local `node_modules` junction, so Next emitted a non-blocking Windows standalone trace symlink warning after successful build output. The build also emitted expected local warnings for unavailable Azure Storage and the intentionally non-running validation database; no runtime secret was used or exposed.

## Git

- Working branch during isolation: `codex/rv8-package-visibility-part1-work`
- Target branch: `codex/rv8-residence-location-correction`
- Starting commit: `400c6842b40fd55d4a9f2bf62fe8d64380ee5ec6`
- Final commit: this report's scoped commit; hash is reported in the completion response because a commit cannot contain its own final hash
- Push status: authoritative remote verification is reported in the completion response
- Migration status: created, not applied
- Worktree status: verified after commit and reported in the completion response

## Deployment

Deployment was **not performed**.

## Part 2

The new audio-scope model was **not implemented**. Existing historical audio evidence remains unchanged. Part 2 remains pending separate Product Owner authorization.

## Next Recommended Action

Stop for Product Owner review of Part 1. Do not deploy, do not Admin PASS/REJECT Journey 1, and do not begin Part 2, Journey 2, RV-9, or Epic 8.
