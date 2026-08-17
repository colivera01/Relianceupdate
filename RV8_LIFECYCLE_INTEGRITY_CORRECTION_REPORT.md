# RV-8 Lifecycle Integrity Correction Report

## Scope

This checkpoint corrects only the Product Owner-confirmed RV-8 lifecycle defects at starting commit `54ebf52b6042366e79c8537a921351ec035a6872`. It does not deploy, alter a Product Owner replay record, create a migration, start RV-9, or start Epic 8.

## Root Causes

1. The ordinary permission-link rotation service did not distinguish a wrong-recipient lifecycle from other resendable states, so it could reopen the same request and target the unchanged recipient.
2. Work-record edit supersession was driven primarily by the recording-scope hash. Service/work identity could therefore change without invalidating evidence when the scope selections produced the same hash.
3. The edit dialog could switch to create-mode state while its content was still mounted. Create-only address controls then received undefined values and called `trim()`.
4. The UI did not clearly separate ordinary edits from evidence-bearing edits, recipient correction, immutable location, and post-capture locking.
5. `Check Consent` reused a broader compliance path that could attempt employee Service Order release and emit assignment errors.
6. Local optimistic job state could win over fresher server lifecycle fields after a reload.
7. Canceled records were not consistently excluded from Active Work or presented with their cancellation evidence.
8. Assignment-before-permission was supported by the backend, but the vendor copy could imply assignment itself was blocked.

## Corrections

- Added a fail-closed wrong-recipient guard to ordinary permission resend before transaction, token rotation, delivery, or audit mutation.
- Added manager notification delivery and notification-attempt audit evidence when a customer reports a request as misdirected.
- Added a canonical vendor wrong-recipient state with `Correct Customer Contact`; ordinary resend is hidden and also rejected server-side.
- Expanded material-change detection to service/work type, title, customer identity, and recording-scope facts once permission, certification, or release evidence exists.
- Preserved immutable location-snapshot enforcement and blocked generic edits after capture begins.
- Kept customer-recipient changes after permission starts on the existing audited correction route.
- Made create/edit form initialization and dialog teardown safe, including defensive string normalization in address autocomplete.
- Split status-only `Check Consent` from the employee Service Order release workflow.
- Added an explicit server-authoritative merge helper so refreshed lifecycle fields override stale optimistic values.
- Added canceled lifecycle presentation, filtering, and Activity Timeline details from existing cancellation audit metadata.
- Clarified that employee assignment may occur for scheduling while Service Order release and recording remain gated.

## Wrong-Recipient Lifecycle

The original request and wrong-recipient event remain immutable historical evidence. Reporting the request revokes its existing links and keeps recording locked. Ordinary resend now fails before any request rotation and cannot target the unchanged recipient. The vendor receives a notification and sees a corrective action instead of resend. The existing manager-authorized recipient-correction route supersedes operational authority and creates the corrected request without deleting the old record. The customer confirmation page says the request was misdirected, the provider must correct it, no further customer action is required, and the page may be closed.

## Material-Change Supersession

After evidence processing has begun, changes to recording scope, service/work type, work title, or customer identity are treated as material. The current permission is superseded, employee certification is invalidated, active links are revoked, pending notifications are neutralized, and a new assessment/request or notice is generated through the existing transaction. Prior evidence is preserved. Customer recipient changes after permission begins must use the audited recipient-correction workflow. The immutable saved service-location snapshot cannot be rewritten through edit.

## Editability Policy

- Before capture, ordinary supported non-evidence details may be edited and audited.
- Evidence-bearing changes after permission, certification, or Service Order release require supersession and fresh applicable evidence.
- Customer contact correction after a permission request begins uses the dedicated correction workflow.
- The saved location snapshot is immutable; a different service location requires the approved new-record/correction path.
- Once linked capture evidence exists, generic work-record editing fails closed.
- Submitted or captured Service Video evidence is never rewritten by this correction.

## UI / State Refresh

- `Check Consent` now retrieves permission status only. It does not require assignment, release a Service Order, or invoke recording authorization.
- Successful server reloads replace lifecycle-sensitive optimistic fields with authoritative server values.
- Wrong-recipient, pending, accepted, declined, release, cancellation, and correction states render from canonical status.
- Canceled records remain in All/history, are excluded from Active Work, display no active next step, and show actor, reason, and timestamp in the detail timeline.
- Assignment remains available for scheduling where authorized; copy explains that release and recording still depend on the remaining canonical gates.

## Files Changed

### Application

- `src/app/api/consent/[token]/wrong-recipient/route.ts`
- `src/app/api/vendors/[vendorId]/dashboard/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.ts`
- `src/app/consent/[token]/page.tsx`
- `src/app/vendor/jobs/[jobId]/page.tsx`
- `src/app/vendor/jobs/page.tsx`
- `src/components/AddressAutocompleteInput.tsx`
- `src/lib/consent/request-service.ts`
- `src/lib/notifications/send-permission-wrong-recipient.ts`
- `src/lib/vendor-job-client-state.ts`

### Tests

- `e2e/rv8-product-owner-replay-corrections.spec.ts`
- `src/app/api/consent/permission-management-routes.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/route.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/material-scope-change.integration.test.ts`
- `src/lib/consent/request-service-resend.test.ts`
- `src/lib/consent/wrong-recipient-customer-copy.test.ts`
- `src/lib/notifications/send-permission-wrong-recipient.test.ts`
- `src/lib/vendor-job-client-state.test.ts`

## Validation

- Clean dependency installation: `npm ci` passed; 601 packages installed and Prisma client generated.
- Focused and broader Vitest regression: 13 files passed, 96 tests passed.
- Playwright: 8 scenarios passed in Chromium using a temporary database-free configuration and fully mocked API fixtures. No SQL database was contacted, seeded, or reset. The temporary configuration was removed after execution.
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `NODE_OPTIONS=--max-old-space-size=8192 npm run build` passed on Next.js 15.5.21; 206 App Router pages were generated and legacy Support/Notifications pages built successfully.
- Diff integrity: `git diff --check` passed. Line-ending notices are repository checkout behavior, not whitespace errors.
- Expected local warnings: Azure Storage, notification providers, and `DATABASE_URL` were intentionally absent from the isolated validation environment. Tests used mocks and the production build completed.

## Regression Impact

The recording gate, manager-review lock, exact-stage correction, stale-upload protection, employee mutation lock, manager authority, immutable location snapshots, permission/OTP authority, pre-save preview, account-linked customer email rule, Private proof, audio-off capture, three-stage evidence, and duplicate protection remain unchanged and covered by the selected RV-8/Epic 4/Epic 5 regressions. No reviews, ratings, Trust Score inputs, Public proof, publication, AI, retention/deletion governance, or legal-governance behavior was added or redesigned. The obsolete 72-hour review process was not introduced.

## Git

- Branch: `codex/rv8-residence-location-correction`
- Starting commit: `54ebf52b6042366e79c8537a921351ec035a6872`
- Final commit: recorded after commit creation
- Pushed: recorded after push verification
- Migrations: none

## Deployment

Deployment was not performed.

## Existing Product Owner Records

The `Breaker Replacement` package and all other Product Owner replay records were not queried, advanced, approved, rejected, corrected, rewritten, or otherwise modified. No shared database was used by this checkpoint.

## Next Recommended Action

Stop at Product Owner beta deployment approval. Do not continue Manager Review, start RV-9, or start Epic 8.
