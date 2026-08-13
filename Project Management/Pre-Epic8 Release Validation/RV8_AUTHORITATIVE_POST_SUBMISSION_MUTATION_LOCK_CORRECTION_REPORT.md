# RV-8 Authoritative Post-Submission Mutation Lock Correction Report

## Checkpoint

- **Objective:** Close the three server-side mutation bypass classes identified during the final RV-8 Product Owner review.
- **Starting commit:** `8e91e8be65c4620a1fa7dbf48d8351c542064675`
- **Working branch:** `codex/rv8-residence-location-correction`
- **Deployment:** Not performed.
- **RV-9 / Epic 8:** Not started.
- **Database:** Schema and migrations unchanged. No migration is required for this correction.

## Root Cause By Bypass

### 1. Generic Media-Path Downgrade

Employee-accessible media-session and upload routes allowed booking, stage, or session context to remain optional. An employee could therefore omit Service Video context and enter compatibility behavior intended for generic vendor media. The generic path did not have enough information to evaluate the exact stage-aware recording gate.

### 2. Media-Session PATCH

The media-session update route required an active vendor membership but did not distinguish an employee-owned Service Video session from a manager-operated generic session. Consequently, an employee could update session state without reevaluating the current work record, package, and exact stage.

### 3. Outstanding Upload Authorization

Employee staged uploads previously received direct Blob upload authorization. An authorization issued before submission could remain usable after the package entered manager review. The completion route checked the canonical gate before expensive verification work, but the final Service Video evidence transaction did not independently recheck current package authority. That left a submission/finalization race between the earlier check and the durable write.

## Enforcement Added

### Canonical Context Requirements

- Employee media-session creation now requires the assigned work record, `JOB_SERVICE_VIDEO` session type, and exact canonical stage.
- Employee upload initialization requires the assigned work record and employee-owned staged session.
- Employee upload proxy, completion, status, stage finalization, session update, and media restore all require resolvable work-record and stage context.
- Capture-token booking identity must match the requested work record.
- Missing, invalid, or ambiguous employee Service Video context fails closed rather than falling through to generic media behavior.
- Existing manager-operated generic media compatibility remains available. Repository inspection found no active unrelated employee generic-media workflow to preserve.

### Durable Stage-Aware Guard

`assertServiceVideoStageMutationAllowed` now reads the current work-record and current package state at the mutation boundary:

- `AWAITING_REVIEW` or `AWAITING_MANAGER_REVIEW` blocks all stage mutations.
- `CORRECTION_REQUESTED` permits only the exact stage named by the current manager correction decision.
- Any other existing current package is closed to employee recording mutation.

The guard is executed inside serializable transactions for:

- media-session creation and PATCH;
- upload-attempt creation and status mutation;
- verified stage evidence/media-asset save;
- employee stage finalization;
- employee media restore;
- Service Video package submission.

The work-record operational metadata update now occurs in the same transaction as the accepted stage evidence, preventing a split durable result.

### Outstanding Authorization Neutralization

- Employee Service Video upload initialization now returns the authenticated server proxy path instead of a direct SAS upload URL.
- The proxy evaluates current canonical authority before reading bytes, immediately before Blob upload, and after Blob upload.
- If authority changes while Blob Storage is accepting bytes, the unaccepted candidate is deleted and the request remains blocked.
- Finalization independently rechecks current authority inside the serializable evidence transaction. A pre-submission authorization cannot produce an accepted post-submission media asset, stage version, stage save, or package mutation.
- Legitimate non-Service-Video manager uploads retain their existing direct-upload compatibility path.

## Files Changed

### Server Enforcement

- `src/lib/service-video-evidence.ts`
- `src/lib/consent/recording-gate.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/route.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/[sessionId]/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/init/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/proxy/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/status/route.ts`
- `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts`
- `src/app/api/employee/jobs/[jobId]/stage/route.ts`

### Client Compatibility For Server-Proxy Upload

- `src/app/employee/jobs/page.tsx`
- `src/lib/vendor-job-media.ts`

### Tests

- `src/lib/service-video-evidence.test.ts`
- `src/app/api/employee/jobs/[jobId]/stage/post-submission-lock.integration.test.ts`
- `src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/media-sessions-consent.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/sessions/[sessionId]/media-session-patch-recording-lock.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/init/route.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/proxy/route.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/media-upload-complete-stage-video-duration.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/upload/status/upload-status-recording-lock.integration.test.ts`
- `src/app/api/vendors/[vendorId]/media/[assetId]/media-asset-restore-recording-lock.integration.test.ts`

## Direct-Request And Concurrency Coverage

The regression package proves:

- omitting booking/stage context cannot downgrade employee Service Video operations;
- generic employee media-session and upload paths fail closed;
- employee session PATCH is rejected during manager review;
- employee media restore is rejected during manager review;
- upload init, proxy, status, completion, and employee stage finalization are rejected during manager review;
- a non-targeted correction stage remains blocked;
- the exact manager-requested correction stage proceeds only through the normal canonical gates;
- an authorization initialized before submission cannot finalize after manager review becomes current;
- submission while proxy upload is reading bytes blocks before Blob mutation;
- submission while Blob upload is in flight removes the unaccepted candidate;
- the durable evidence transaction independently rejects a stale pre-authorization;
- blocked requests create no duplicate session, upload attempt, media asset, stage version, or stage save;
- corrected package resubmission restores `AWAITING_REVIEW` and locks all stages again.

## Validation Results

### Focused And Epic 4 / Epic 5 Regression

```text
npx vitest run <15 recording, upload, lifecycle, manager-correction, and evidence test files>
```

**Passed: 15 files, 83 tests.**

An initial broader run exposed two legacy lifecycle-test fixtures that lacked the newly required transaction interface. The fixtures were updated to model the real serializable transaction and durable guard; no runtime enforcement was relaxed. The complete 15-file suite then passed.

### TypeScript

```text
npx tsc --noEmit --pretty false --incremental false
```

**Passed.**

### Production Build

```text
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

**Passed.** Next.js `15.5.21` compiled successfully and generated 205 static pages. The first combined command exceeded its command window while route generation was still running; the standalone build rerun completed in 122.2 seconds. Expected clean-environment warnings reported absent `DATABASE_URL` and Azure Storage configuration.

### Playwright

```text
PLAYWRIGHT_SKIP_GLOBAL_DB_SETUP=1 npx playwright test e2e/epic5-private-service-video.spec.ts
```

**Passed: 4 tests.**

The first invocation stopped in global setup because the isolated clean worktree intentionally had no database fixture. A temporary, non-committed skip fixture was used for this fully route-mocked spec and removed immediately afterward. The browser regression verified manager-review read-only state after refresh and fresh-link opening, exact-stage correction reopening, normal saved-stage behavior, and truthful retry behavior.

### Diff Integrity

```text
git diff --check
```

**Passed.**

## Regression Impact

### Intentionally Preserved

- Normal three-stage recording before package submission.
- Normal pre-submission replacement, upload, retry, and duplicate protection.
- Existing assignment, permission, certification, location, authority, audio-off, and lifecycle gates.
- Stage-specific manager correction and replacement version history.
- Corrected-package resubmission and renewed manager-review lock.
- Manager-operated generic media compatibility unrelated to employee Service Video capture.

### Verified Unaffected

The changed routes and tests do not create or modify:

- customer recording permission or OTP decisions;
- reviews or ratings;
- Trust Score inputs;
- Private/Public proof eligibility;
- publication approvals;
- notifications or AI behavior;
- retention, deletion, or legal-governance state.

The obsolete 72-hour review process was not reintroduced or referenced as a requirement.

## Git And Release State

- The unrelated modified RV-8 execution log and untracked earlier failure report in the primary worktree were not opened for editing and are not part of this correction.
- No application deployment was performed.
- No Azure setting, Blob data, database row, schema, or migration was changed.
- RV-9 and Epic 8 remain paused.

## Conclusion

The manager-review lock is now authoritative across all identified employee-accessible Service Video mutation paths. The correction is ready for the next Product Owner deployment-review checkpoint; it is not deployed by this work.
