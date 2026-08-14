# RV-8 Product Owner Replay Correction Report

## Objective

Correct the seven narrowly scoped Product Owner replay findings without changing recording stages, customer decision authority, Public/Private proof semantics, reviews, Trust Score, publication, AI, or the obsolete 72-hour review concept.

## Root Causes

1. Initial employee delivery was coupled to an explicit vendor release action. Assignment-first and permission-first workflows did not converge on one durable, automatic delivery decision.
2. The vendor card used `Start Starting Condition`, implying that a manager starts employee recording.
3. Accepted recording permission disappeared from the normal vendor workflow after it stopped being a blocker, leaving no durable manager evidence view.
4. Location snapshots could treat raw or incomplete coordinates as usable verified location evidence, including missing geocoding provenance.
5. Work records with immutable evidence exposed deletion as the normal abandonment action even though accepted permission, location, assignment, and audit evidence must survive.
6. The job card mixed status facts, primary actions, and secondary actions into one crowded control area.
7. Recording-scope labels exposed internal compliance concepts and allowed the two recording-necessity booleans to be presented as independent, potentially contradictory choices.

## Corrections

### 1. Automatic Initial Employee Service Order Delivery

- Added one canonical release helper used after assignment and after an accepted customer permission decision.
- Assignment-first and permission-first ordering now converge on the same server decision.
- A unique `BookingNotification` claim identifies the assignment generation and employee membership, preventing duplicate automatic delivery.
- Successful delivery records the released employee membership in durable work-record metadata.
- `Resend Service Order Link` remains an explicit manager action and does not create another initial-delivery claim.
- A failed initial delivery remains truthfully unreleased and returns a delivery failure instead of being described as sent or already released.

### 2. Truthful Vendor Action

- Removed the manager-facing `Start Starting Condition` action.
- Before release, the manager sees `Send Service Order`.
- After release, the card shows the read-only state `Service Order Sent`.
- The employee's Starting Condition stage remains unchanged.

### 3. Read-Only Permission Evidence

- Added a manager-only GET endpoint for the current recording-permission evidence.
- The response includes masked recipient data, canonical scope, decision, verification method, hashes, content version, and timestamps.
- It does not expose raw permission tokens, OTPs, IP addresses, user agents, or secrets.
- No mutation method is exported. Viewing evidence cannot replace or reinterpret the customer's decision.

### 4. Location Snapshot Integrity

- Location snapshots require finite latitude/longitude, reject `0,0`, require valid capture time, and require valid geocoding evidence.
- Customer-entered coordinates are not trusted as verified coordinates without a successful server geocode result.
- Customer residence, customer business, and vendor business selections resolve only from their corresponding source.
- Invalid snapshots return specific canonical reasons and cannot enable recording-dependent progression.

### 5. Manager-Only Cancellation

- Added `Cancel Service Order` for eligible non-completed work records with durable evidence.
- Cancellation is manager-authorized and records actor, reason, and timestamp.
- Hard deletion is limited to disposable `PENDING` drafts with no durable evidence.
- Canceled records fail closed in the canonical recording gate and stale employee capture links are rejected.

### 6. Job-Card Hierarchy

- Canonical workflow facts are presented as compact status information.
- One primary next-step area is separated from the secondary Actions menu.
- Permission evidence, resend, edit, and cancellation remain in Actions only when the current state permits them.
- Dangerous cancellation is visually distinct from ordinary actions.

### 7. Plain-Language Recording Scope

- Replaced independent recording-necessity checkboxes with one mutually exclusive question: `Is recording required to complete this service?`
- `Yes` maps to `serviceCanContinueWithoutRecording=false` and `essentialPrivateRecording=true`.
- `No` maps to `serviceCanContinueWithoutRecording=true` and `essentialPrivateRecording=false`.
- Contradictory legacy pairs do not produce a valid UI selection and must be corrected before submission.
- Authority, property, identifiable-person, camera-framing, and sensitive-scope prompts now use plain questions while preserving the canonical stored values.
- The customer permission page translates the same canonical scope into plain language and preserves the customer's existing allow, decline, and decide-later rights.

## Cancellation Lifecycle

Cancellation preserves:

- immutable service-location snapshot;
- recording-scope assessment;
- accepted permission and decision evidence;
- authority evidence;
- assignment and release history;
- notification and delivery history;
- recording-gate and lifecycle audit history;
- cancellation actor, reason, and timestamp.

Cancellation invalidates or blocks:

- current employee certifications;
- outstanding permission links;
- queued or sending operational notifications;
- employee recording and upload authority;
- stale employee capture-token access.

Unused operational sessions and their unused assets are archived. Existing immutable evidence is not rewritten or fabricated. A replacement service requires a new work record.

## Location Integrity Invariant

Reliance accepts verified work-record location evidence only when the selected canonical location source resolves to an immutable snapshot containing a complete address, finite valid coordinates, non-zero coordinates, valid server geocoding provenance, and a valid capture timestamp. Missing, ambiguous, mismatched, non-finite, `0,0`, or provenance-free location evidence fails closed and cannot be replaced at recording time by mutable profile or browser data.

## UI Behavior

- Before release: canonical status plus `Send Service Order`.
- After release: `Service Order Sent` as a read-only state.
- Accepted permission remains available as read-only evidence.
- Secondary operations remain in the Actions menu.
- Records with durable evidence use `Cancel Service Order`; only evidence-free drafts may expose delete.
- Recording scope follows plain-language question -> understandable answer -> canonical stored evidence.

## Files Changed

Application and shared libraries:

- `src/app/api/bookings/route.ts`
- `src/app/api/consent/[token]/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/recording-permission/route.ts`
- `src/app/consent/[token]/page.tsx`
- `src/app/vendor/jobs/page.tsx`
- `src/lib/consent/recording-gate.ts`
- `src/lib/employee-capture-token.ts`
- `src/lib/employee-service-order-release.ts`
- `src/lib/job-assignment.ts`
- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/send-service-order-canceled.ts`
- `src/lib/recording-scope-presentation.ts`

Tests:

- `e2e/rv8-product-owner-replay-corrections.spec.ts`
- `src/app/api/bookings/booking-crud.integration.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/recording-permission/route.test.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/media-sessions-consent.integration.test.ts`
- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/lib/employee-capture-token.test.ts`
- `src/lib/employee-service-order-release.test.ts`
- `src/lib/job-assignment.test.ts`
- `src/lib/job-recording-location.test.ts`
- `src/lib/notifications/send-consent-decision-release.test.ts`
- `src/lib/recording-scope-presentation.test.ts`

## Validation

- Combined correction suites: 15 files, 150 tests passed.
- RV-8/Epic 4/Epic 5 recording and media regression: 12 files, 58 tests passed.
- Final delivery truthfulness rerun: 2 files, 50 tests passed.
- TypeScript: `npx tsc --noEmit --pretty false --incremental false` passed.
- Production build: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` passed on Next.js 15.5.21; 205 App Router static pages generated and legacy Support/Notifications routes remained present.
- Playwright discovery: 2 changed-workflow tests listed successfully.
- Authenticated Playwright execution: not run against the only available shared Azure SQL configuration because the test creates and deletes disposable manager/vendor fixtures. The test now uses the real signed session and server membership boundary and is ready for a controlled disposable test database.
- `git diff --check`: passed for the scoped correction files.

Expected test stderr included controlled authorization denials and absent local Azure Storage/database configuration. These did not fail the suites or build.

## Regression Impact

- Manager-review recording and upload locks remain server-authoritative.
- Exact-stage manager correction behavior remains unchanged.
- Stale upload authorization and post-submission durable mutation rejection remain green.
- Normal pre-submission recording, upload, retry, replacement, and duplicate protection remain green.
- Private Service Video evidence checks remain green.
- No review, rating, Trust Score input, publication decision, Public media, OTP decision, or customer permission decision is created by these corrections.
- No frozen governing document was changed.

## Git

- Branch: `codex/rv8-residence-location-correction`
- Starting commit: `02a0ca827e7a0ce65124106602a9f0ffd3c9e5e8`
- Migration status: no migration created or changed.
- Unrelated validation execution-log and earlier failure-report work remain excluded from this correction.

## Deployment

Deployment was not performed. Physical-device acceptance remains paused. RV-9 and Epic 8 were not started.

## Next Recommended Action

Review this scoped correction and run the two authenticated Playwright scenarios in the approved disposable test environment before authorizing the beta deployment checkpoint.
