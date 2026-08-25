# RV-8 Core Admin Service Video Audit and Terminal Disposition Correction Report

## Root Cause

The manager approval route was the terminal Private Proof approval path. It moved a complete package directly to `PRIVATE_APPROVED`, activated customer access, and initiated the customer video-ready notification before a Reliance Admin decision existed.

Admin moderation was also asset-oriented rather than package-oriented. Pending dashboard counts and queue rows could therefore describe media that did not represent one exact, complete, manager-attested package that an Admin could open and decide. The workflow lacked a dedicated durable core Admin Audit decision bound to the manager submission and exact three-stage evidence chain.

## New Core Audit Lifecycle

The corrected V1 lifecycle is:

1. The employee saves Starting Condition, Work in Progress, and Final Result, then submits the complete package for manager review. Recording remains locked.
2. The Vendor Manager may request one exact stage correction, or use `Approve & Submit to Reliance Audit` to attest to and submit the exact current package.
3. Manager submission transitions the package to `AWAITING_ADMIN_REVIEW`. It does not create customer Private Proof access and does not send the customer video-ready notification.
4. Reliance Admin reviews the exact submitted package and records one terminal `PASS` or `REJECT` decision.
5. `PASS` releases customer-only Private Proof for the exact audited package. `REJECT` closes the Service Video work record permanently and preserves all evidence without releasing the rejected videos.

## Manager Attestation

Manager submission now creates immutable `ServiceVideoManagerDecisionEvidence` bound to:

- booking and vendor;
- package ID, version, and hash;
- exact stage evidence IDs, versions, media IDs, and hashes;
- manager user and active manager membership;
- recording assessment, permission, and gate generations represented by the submitted stages;
- submission timestamp;
- canonical attestation JSON and SHA-256 hash;
- evidence version.

Submission reloads and compares the current package, all three current saved stage records, media identities, content hashes, and recording-gate evidence inside the transaction. A changed, incomplete, stale, or ambiguous package fails closed.

## Admin Eligibility

`resolveCoreAdminAuditCandidates` is the canonical package-level resolver for new core Admin Audit eligibility. A candidate must be current, complete, in `AWAITING_ADMIN_REVIEW`, linked to a valid manager submission for the same package version/hash, unreleased to the customer, and without a terminal Admin decision.

The Admin moderation queue and Admin pending statistics use this same resolver. Stranded assets, historical manager-only approvals, incomplete packages, released packages, and already-decided packages do not inflate current pending counts. If Admin cannot open and decide the exact package, it is not counted as pending.

## Admin Notification

The first successful manager transition creates durable, deterministic Admin in-app and email notification evidence. Notification claims accept only `QUEUED` or `FAILED` rows and atomically move them to `SENDING`, so refreshes and concurrent retries cannot duplicate an already claimed delivery.

Failed delivery remains retryable through the same durable notification row. Tests cover first delivery, duplicate suppression, and failed-row retry without creating another notification record.

## Admin PASS

Admin PASS is a serializable transactional transition. Before mutation it verifies the exact manager submission, current package ID/version/hash, exact stage IDs/versions/hashes, current stage/media records, package state, and absence of a prior terminal decision.

The transaction:

1. claims the package for one terminal decision;
2. creates immutable `ServiceVideoAdminAuditDecisionEvidence` with decision hash and Admin actor;
3. marks only the exact audited stage media as customer-private approved;
4. sets the exact package to `PRIVATE_APPROVED`;
5. creates and links the customer `PrivateProofAccessGrant` to the Admin PASS evidence;
6. transitions the work record to the completed/private state;
7. creates durable customer video-ready notification evidence.

Customer delivery occurs only after the PASS transaction commits. The transition does not create a Public proposal, Public media, or Public visibility.

## Admin REJECT

Admin REJECT uses the same exact-package checks and one-winner transaction. Rejection category and explanation are required and become part of the immutable decision evidence and decision hash.

The transaction records the Admin actor and exact evidence chain, sets the package to `ADMIN_REJECTED`, closes the booking in the existing terminal rejected state, keeps all exact media private/rejected, ensures no customer access grant is active, and creates a neutral customer notification with no video link or internal moderation detail.

Admin rejection is terminal. Rerecording, stage replacement, manager correction, employee correction, retry, resubmission, new package creation, restore, stale upload finalization, stage save, and general vendor mutation are prohibited. Recording-gate, employee completion, upload/media mutation, manager-correction, and vendor action paths fail closed for the terminal state.

## Vendor / Employee / Customer UX

Vendor pending state is `Reliance Audit pending` and explains that customer Private Proof has not been released. The Vendor Manager has read-only access while Admin review is pending.

Vendor rejection state is `Reliance Audit Failed`. It presents the authorized rejection category/reason and explains that the historical Service Video work record is closed. Mutation controls are not offered.

Employee pending state remains locked. A stale employee link after Admin rejection resolves to a terminal closed state with no recording, upload, replacement, or retry controls.

The customer receives exact audited Private Proof only after PASS. After REJECT, the customer may receive the neutral statement that approved Service Videos were not released; it provides no rejected-media link, no internal moderation details, and does not imply that the underlying service failed.

## Trust Score Readiness

No Trust Score formula, weight, input, UI, recalculation route, or scoring decision was changed.

The new evidence preserves future-ready facts: vendor, work record, exact package/version/hash, exact stage versions/hashes, manager attestation, Admin PASS/REJECT, rejection category/reason, Admin actor, timestamps, grant linkage, notification linkage, and the distinction between manager-requested correction and terminal Admin rejection.

## Public Boundary

Core Admin Audit is separate from Public publication moderation. Admin PASS releases customer-only Private Proof and nothing public. New publication eligibility requires the core Admin PASS evidence where applicable, while the existing Public proposal, customer approval, publication decision, and exact-media chain remain separate and unchanged.

## Migration

The additive migration is:

`prisma/migrations/20260824213000_add_core_service_video_admin_audit_evidence/migration.sql`

It adds:

- manager package-version and attestation fields;
- package Admin-decision linkage and evidence version;
- `ServiceVideoAdminAuditDecisionEvidence` with a unique terminal decision per package;
- Private Proof grant linkage to the Admin decision;
- supporting indexes.

The migration does not rewrite existing rows, fabricate historical Admin decisions, or alter existing audit evidence. It was validated and Prisma Client was generated locally. It was not applied to beta or production.

## Historical Compatibility

Historical `PRIVATE_APPROVED` packages and customer grants without core Admin Audit evidence remain readable under their historical evidence chain. They are not retroactively placed in the Admin queue and do not receive fabricated decisions.

New corrected-V1 package/grant chains require the dedicated core Admin PASS before customer Private Proof release. Historical and new evidence are distinguished by the new package/grant linkage and audit evidence version.

## Existing Journey 1 Defect Record

The defect-evidence record `cmt39opn40001o3fibt4bn3eq` was not read, changed, submitted, granted, notified, or otherwise mutated during implementation or validation. No code or migration contains a special-case rewrite for it. It remains the preserved evidence of the original bypass.

## Files Changed

Schema and migration:

- `prisma/schema.prisma`
- `prisma/migrations/20260824213000_add_core_service_video_admin_audit_evidence/migration.sql`

Core lifecycle, eligibility, notifications, evidence, gates, and publication:

- `src/lib/service-video-admin-audit.ts`
- `src/lib/service-video-admin-audit-notifications.ts`
- `src/lib/admin-media-moderation-queue.ts`
- `src/lib/service-video-evidence.ts`
- `src/lib/service-video-publication.ts`
- `src/lib/consent/recording-gate.ts`
- `src/lib/vendor-job-lifecycle-presentation.ts`

Admin routes and UI:

- `src/app/admin/media-moderation/AdminMediaModerationClient.tsx`
- `src/app/api/admin/media/[assetId]/moderate/route.ts`
- `src/app/api/admin/media/packages/[bookingId]/moderate/route.ts`
- `src/app/api/admin/stats/route.ts`

Vendor and employee routes/UI:

- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/reject/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.ts`
- `src/app/api/vendors/[vendorId]/dashboard/route.ts`
- `src/app/api/employee/jobs/[jobId]/complete/route.ts`
- `src/app/vendor/jobs/page.tsx`
- `src/app/vendor/jobs/[jobId]/page.tsx`
- `src/app/employee/jobs/page.tsx`

Focused and regression tests:

- `src/lib/service-video-admin-audit.test.ts`
- `src/lib/service-video-admin-audit-notifications.test.ts`
- `src/lib/admin-media-moderation-queue.test.ts`
- `src/lib/service-video-evidence.test.ts`
- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/lib/vendor-job-lifecycle-presentation.test.ts`
- `src/app/api/admin/media/[assetId]/moderate/route.test.ts`
- `src/app/api/admin/media/admin-media-moderation.integration.test.ts`
- `src/app/api/admin/media/packages/[bookingId]/moderate/route.claim.test.ts`
- `src/app/api/admin/stats/route.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.integration.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/reject/route.integration.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
- `src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts`

## Validation

- Focused RV-8/Admin/private-proof/media-lock regression: PASS, 28 files and 199 tests.
- Additional failed-notification retry regression: PASS, 1 file and 4 tests.
- TypeScript (`npx tsc --noEmit --pretty false --incremental false`): PASS.
- Prisma format: PASS.
- Prisma validate: PASS.
- Prisma generate: PASS.
- Production build with 6144 MB heap: PASS.
- `git diff --check`: PASS.
- Playwright discovery/compilation for `epic5-private-service-video.spec.ts` and `rv8-product-owner-replay-corrections.spec.ts`: PASS, 17 tests enumerated.
- Authenticated destructive Playwright execution for the new Admin PASS/REJECT lifecycle: not run because Reliance has no approved disposable SQL Server test environment. Shared beta data was not used for destructive fixtures. The server/API lifecycle is covered by focused transaction, authorization, concurrency, evidence, and regression tests.

The focused suite covers manager submission without customer release, exact package binding, queue/stats alignment, Admin notification deduplication, PASS, REJECT, decision races, duplicate decisions, grant and customer notification creation, historical compatibility, Admin authorization, employee/vendor mutation locks, stale media/upload routes, Private Proof access, and Public boundary behavior.

## Git

- Branch: `codex/rv8-residence-location-correction`
- Starting commit: `1d93fb6fea74041d1ea10fd143041dec2084b6b5`
- Final commit: the scoped commit containing this report; authoritative hash is reported in the Product Owner handoff after creation.
- Push: pending at report authoring; completed status is reported in the Product Owner handoff.
- Migration status: created and validated, not applied.

## Deployment

Deployment was not performed. Azure configuration, beta database state, and mounted beta package were not changed.

## Acceptance

Current Journey 1 remains failed and paused as defect evidence. The existing defect record remains untouched. Acceptance must use a fresh controlled record only after this correction and its additive migration receive separate Product Owner deployment approval.

## Next Recommended Action

Stop at Product Owner implementation review. Do not deploy, restart Journey 1, begin Journey 2, start RV-9, or start Epic 8.
