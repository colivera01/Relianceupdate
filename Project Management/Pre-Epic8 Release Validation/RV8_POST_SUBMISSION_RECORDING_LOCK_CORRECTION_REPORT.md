# RV-8 Post-Submission Recording Lock Correction Report

## Checkpoint

- **Objective:** Canonically lock all recording and upload activity after a complete three-stage Service Video package enters manager review, while preserving the existing stage-specific manager-correction workflow.
- **Repository:** `C:\Users\Cesar Olivera\Project Reliance-rv8-residence`
- **Branch:** `codex/rv8-residence-location-correction`
- **Starting commit:** `97d4b5bbed6a3309dc15d1b755ac2e6c0b676be9`
- **Deployment:** Not performed. Beta remains unchanged pending Product Owner review.
- **Database/migrations:** No schema or migration changes.

## Root Cause

Submitting the completed package changed the work record to `AWAITING_REVIEW`, but the canonical recording gate evaluated permission, assignment, certification, and location without treating manager review as a higher-priority lock. Those earlier requirements remained valid, so reopening the employee link could continue to expose replacement language and recording affordances.

The correction workflow also lacked an exact stage input at every mutation boundary. A broad correction state could therefore not reliably distinguish the one manager-requested stage from the two submitted stages that must remain locked.

## Implemented Behavior

### Canonical Gate

- `AWAITING_REVIEW` work records are blocked before permission, certification, or location facts can reopen recording.
- A current package with `AWAITING_MANAGER_REVIEW` is also blocked, closing the work-record/package transition boundary.
- The canonical block is `MANAGER_REVIEW_IN_PROGRESS` and states:
  - Why: The completed Service Videos were submitted for manager review.
  - Who acts next: Vendor manager.
  - Next step: Wait for manager review.
- Current manager correction evidence is resolved from the active package decision.
- During `CORRECTION_REQUESTED`, only the exact targeted stage may continue through the normal permission, certification, location, and lifecycle gates.
- A missing stage or a non-target stage fails closed.

### Server Enforcement

The canonical stage-aware gate now protects:

- media-session creation;
- upload initialization before an upload attempt or signed upload URL is created;
- upload proxy/retry before request bytes are read or Blob Storage is mutated;
- upload completion/finalization before another candidate is accepted;
- employee stage save before media bytes, stage state, or audit state are changed;
- employee location verification before location work can reopen a submitted stage.

Direct requests during manager review return the canonical locked response. The tests verify no duplicate media session, upload attempt, candidate asset, or stage save is created.

### Employee Experience

After submission, the employee sees:

- `Service Videos submitted`;
- `Manager review is in progress.`;
- `Recording is locked while your manager reviews this service order.`;
- `Locked for manager review` on all three stages.

The submitted view suppresses `Saved - tap to replace`, pre-submission replacement guidance, camera controls, and upload controls. Refreshing the page or opening the same assignment link in a fresh browser page leaves every stage locked.

When a manager formally requests a correction, the UI uses canonical targeted-stage data. Only the requested stage shows `Correction requested - tap to replace`; every other stage says it is locked because no correction was requested.

## Files Changed

### Canonical Gate and Employee API

- `src/lib/consent/recording-gate.ts`
- `src/app/api/employee/jobs/route.ts`
- `src/app/api/employee/jobs/[jobId]/verify-location/route.ts`
- `src/app/api/employee/jobs/[jobId]/stage/route.ts`

### Media Mutation APIs

- `src/app/api/vendors/[vendorId]/media/sessions/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/init/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/proxy/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`

### Employee UI

- `src/app/employee/jobs/page.tsx`

### Tests

- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts`
- `src/app/api/employee/jobs/[jobId]/recording-certification/recording-certification.integration.test.ts`
- `src/app/api/employee/jobs/[jobId]/verify-location/verify-location.integration.test.ts`
- `src/app/api/employee/jobs/[jobId]/stage/post-submission-lock.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/media-sessions-consent.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/init/route.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/proxy/route.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/media-upload-complete-stage-video-duration.integration.test.ts`
- `e2e/epic5-private-service-video.spec.ts`

## Security and Privacy Impact

- The change reduces authority and exposure; it does not broaden access.
- Server decisions, not browser state, control manager-review and correction-stage access.
- Permission remaining allowed, a valid certification, or a verified location cannot override manager review.
- Existing lifecycle restrictions continue to fail closed even for a requested correction stage.
- No raw token, OTP, credential, SAS value, or worker secret was introduced or logged by the correction.

## Side-Effect Verification

The changed gate and mutation routes do not create or modify reviews, ratings, Trust Score inputs, permission decisions, Public eligibility, or publication approvals. Focused blocked-path tests verify they return before creating recording sessions, upload attempts, media candidates, stage saves, or related audit mutations. Existing permission, private-proof, and public-proof behavior outside this recording lock remains unchanged.

## Validation Results

### Focused Canonical and API Regression

Command:

```text
npx vitest run <9 affected recording/session/upload/lifecycle test files>
```

Result: **Passed - 9 files, 54 tests.**

Coverage includes:

- all three stages locked in manager review;
- package-transition lock;
- session creation rejection;
- upload initialization rejection;
- upload proxy/retry rejection before bytes or state mutation;
- upload completion rejection;
- direct stage-save rejection;
- location-verification rejection;
- exact-stage correction reopening;
- corrected package resubmission to `AWAITING_REVIEW`.

### Broader Epic 4 and Epic 5 Regression

Result: **Passed - 18 files, 90 tests.**

Expected local test-environment warnings reported missing Azure Storage configuration and no live database. They did not produce test failures.

### Playwright

Command:

```text
PLAYWRIGHT_SKIP_GLOBAL_DB_SETUP=1 npx playwright test e2e/epic5-private-service-video.spec.ts
```

Result: **Passed - 4 tests.**

The browser tests cover mobile manager-review locking, refresh, a fresh browser page/link, exact-stage manager correction, normal pre-submission saved state, and truthful upload retry state.

The combined Epic 4/Epic 5 Playwright run completed earlier in this checkpoint with **8 tests passed** before the final exact-stage browser regression was added. The final affected Epic 5 file was then rerun independently and passed all four tests.

### TypeScript

Command:

```text
npx tsc --noEmit --pretty false --incremental false
```

Result: **Passed.**

### Production Build

Command:

```text
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

Result: **Passed.** Next.js `15.5.21` compiled successfully and generated 205 static pages. Expected local environment warnings noted absent `DATABASE_URL` and Azure Storage credentials; the production build completed successfully.

### Diff Integrity

Command:

```text
git diff --check
```

Result: **Passed.**

## Regression Statement

### Existing Functionality Intentionally Preserved

- Canonical permission, assignment, release, certification, precise-location, audio-off, authority, and lifecycle gates.
- Three-stage recording before submission.
- Truthful upload, retry, and duplicate-protection behavior.
- Stage-specific manager correction and replacement-version evidence.
- Corrected-package resubmission to manager review.

### Existing Functionality Intentionally Unchanged

- Customer recording permission and OTP workflows.
- Work-record location-source selection and immutable location snapshots.
- Manager approval behavior after the employee submission.
- Private/Public proof, reviews, Trust Score, notifications, AI, retention, deletion, and legal governance.

### Areas Verified Unaffected

- Pre-submission employees can still record and replace saved stages.
- A valid manager correction reopens only its targeted stage.
- Existing recording gates still apply to a correction stage.
- No unrelated customer, vendor, admin, publication, or review state is created by blocked recording requests.

### Potential Regression Risks Reviewed

- Work-record and package status can transition at slightly different times; either manager-review signal now locks recording.
- Upload routes need the stage before evaluating a targeted correction; the gate remains before external storage or durable upload mutation.
- Reopening a submitted link on a different browser cannot rely on stale client state because the API returns fresh canonical stage access.

### Known Unrelated Items

- The pre-existing RV-8 execution-log modification and post-submission failure report were not changed or included in this correction.
- Local tests/build emit expected warnings because live database, email/SMS, and Azure Storage settings are intentionally unavailable in the clean local environment.

## Rollback Considerations

This is an additive gate and UI correction with no data migration. Reverting the scoped commit restores the prior behavior, but would also restore the release-blocking ability to reach recording/replacement paths during manager review. No database rollback is required.

## Remaining Gate

- Deployment was not performed.
- Physical-device replay against beta was not continued.
- Manager review of the RV-8 package was not continued.
- RV-9 and Epic 8 were not started.

The correction is ready for Product Owner review and a separately approved deployment checkpoint.
