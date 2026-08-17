# RV-8 Final Product Owner Replay UX Correction Report

## Objective

Complete the three approved RV-8 replay corrections: finish the canonical vendor work-record card hierarchy, provide an explicit employee pre-save video playback action, and require customer email only for the current account-linked Service Video journey. The existing `Breaker Replacement` replay package remained paused in Manager Review.

## Root Causes

### Work-Record Card Hierarchy

The earlier correction changed individual labels and actions but left multiple independently rendered status treatments on the card. Assignment, consent, readiness, Service Order delivery, lifecycle state, and the primary action could appear together as a mixed cluster. Manager-review actions also appeared in both the main review area and the Actions menu.

### Pre-Save Preview

The recording view created a local playable object URL and rendered browser-native video controls, but it did not provide an explicit Reliance action for starting playback. On physical Android, the native controls were not sufficiently prominent or dependable to fulfill the page promise, `Preview before saving`.

### Customer Email

Recording permission supports verified email or verified mobile. The current beta Private Service Video claim and account-linking path, however, uses the customer's email identity. A vendor-created Service Video work record could previously enter that journey without the email needed for the customer to claim and watch the completed Private proof.

## Corrections

### Canonical Vendor Card

- Replaced the mixed badge cluster with one compact `Work record progress` treatment derived from the existing canonical workflow state.
- Preserved one primary next step and moved the Actions menu into a visually separate control area.
- Before release, the primary action remains `Send Service Order` when authorized.
- After release, `Service Order Sent` appears once as the canonical read-only progress state.
- Manager Review now takes precedence over generic uploaded-video messaging and displays `Awaiting Manager Review`.
- Approve and Request Changes remain in the submitted-video review area and are no longer duplicated in the Actions menu.
- The Actions menu retains only lifecycle-authorized operations, including read-only permission evidence, resend, permitted edit, cancellation, and manager controls where applicable.
- Dangerous cancellation remains visually distinct.

### Explicit Employee Preview

- Added an explicit `Play Preview` action after recording.
- The action starts the same local draft video and changes truthfully to `Pause Preview` or `Replay Preview` based on playback state.
- The resulting flow is `Record -> Play Preview -> Retake OR Confirm & Save`.
- Retake clears the unsaved local draft.
- Confirm & Save uses the same draft and existing upload path.
- Preview creates no upload, media asset, stage evidence, or evidence version.
- Existing retry behavior continues to preserve the local preview after a failed save.
- Audio remains off and stage-duration rules are unchanged.

### Scoped Email Requirement

- Vendor-created work records that include a Service Video recording-scope assessment now require a syntactically valid customer email.
- The server rejects a missing or invalid email with `CUSTOMER_EMAIL_REQUIRED_FOR_SERVICE_VIDEO` and explains that email is needed for secure account-linked Private Service Video access.
- The vendor form presents the same plain-language reason before submission.
- Mobile remains optional and no feature depends on SMS selection.
- Customer-initiated/non-recording booking paths are unchanged.
- Existing legacy edit behavior is not broadened into a global email requirement.
- Customer permission, OTP authority, phone capability, and future phone-only claim possibilities are unchanged.

## Final Work-Record Card Behavior

The card now presents one compact canonical progress statement, one primary next step, and one separate Actions menu. It does not repeat `Service Order Sent`, does not mix raw lifecycle pills with permission and readiness pills, and does not duplicate manager Approve/Request Changes controls. Manager Review clearly states that the submitted Service Videos are awaiting manager review and remain locked.

## Pre-Save Preview Behavior

After a recording stops, the employee sees the captured local clip plus an explicit `Play Preview` button. Playback can be intentionally started before any save request. The employee then chooses Retake or Confirm & Save. Retake clears the draft; Confirm & Save submits that same draft through the existing protected upload path. Retry continues to preserve the same preview when saving fails.

## Email Requirement

Email is required when a vendor creates a work record for the current Service Video/account-linked Private proof journey. It is not made a universal requirement for unrelated non-recording customer workflows. The server enforces the scoped rule; client validation alone is not trusted.

## Files Changed

Application:

- `src/app/api/bookings/route.ts`
- `src/app/employee/jobs/page.tsx`
- `src/app/vendor/jobs/page.tsx`

Tests and disabled-by-default visual fixture:

- `src/app/api/bookings/booking-crud.integration.test.ts`
- `e2e/epic5-private-service-video.spec.ts`
- `e2e/rv8-product-owner-replay-corrections.spec.ts`
- `src/app/test-fixtures/rv8-vendor-jobs/page.tsx`

The visual fixture returns Not Found unless `E2E_VISUAL_FIXTURES=1`; it does not expose a production test surface.

## Validation

- Focused RV-8, Epic 4, Epic 5, recording-gate, evidence, booking, and manager-authority Vitest suite: 7 files passed; 121 tests passed.
- Playwright on Chromium: 8 tests passed. Coverage exercised the explicit preview action and verified the local video entered an actively playing state before save; it also covered desktop/mobile card hierarchy, single Service Order state, separate Actions, and non-duplicated Manager Review controls.
- Playwright used API-mocked, disabled-by-default visual fixtures. It did not seed, reset, or mutate shared Azure SQL data.
- TypeScript: `npx tsc --noEmit --pretty false --incremental false` passed.
- Production build: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` passed on Next.js 15.5.21 and generated all 206 App Router pages plus the legacy Support and Notifications pages.
- Diff check: `git diff --check` passed before report creation and is rerun at the Git checkpoint.
- Physical Android validation: pending Product Owner replay. The implementation addresses the observed Android discoverability defect, but no new physical Android result is claimed in this checkpoint.
- Physical iPhone validation: pending; no approved physical iPhone replay was available.

Expected local warnings concerned absent Azure Storage, database, email, and SMS credentials. No live notification or shared-database operation was performed by the automated tests.

## Current Replay Record

A read-only beta database query after implementation confirmed:

- Work record: `Breaker Replacement` (`cmswlh064004jpifhb5bcdk8y`)
- Work-record status: `AWAITING_REVIEW`
- Current package: version 1 (`cmswlvesg008npifhl15d9p8h`)
- Package status: `AWAITING_MANAGER_REVIEW`
- Package hash prefix: `20dcb7c2b1ab`
- Manager decision: none
- Current saved stage hash prefixes: Completed `aa76c9fc01c7`, Work in Progress `a674890f43b7`, Starting Condition `a9846f8b4a61`

No approval, rejection, correction, publication, or other replay-state mutation was performed.

## Regression Statement

### Existing Functionality Intentionally Preserved

- All three location-source and immutable snapshot rules.
- Customer recording permission and OTP authority.
- Assignment, canonical Service Order release, and initial-delivery behavior.
- Audio-off capture, three-stage recording, upload/retry, duplicate protection, and content hashes.
- Manager-review and authoritative post-submission mutation locks.
- Exact-stage manager correction and resubmission behavior.
- Read-only recording-permission evidence, cancellation lifecycle, and manager-only job management.
- Private proof evidence and customer access rules.

### Existing Functionality Intentionally Unchanged

- Reviews, ratings, Trust Score, Public proof, publication, notifications, AI, retention, deletion governance, legal governance, and frozen documents.
- The obsolete 72-hour review process remains absent.

### Areas Verified Unaffected

Focused regression coverage remained green across booking creation, employee Service Order release, canonical recording gates, post-submission stage locks, vendor media-session consent, vendor manager authority, and Private Service Video evidence.

### Potential Regression Risks Reviewed

- Card state ordering now gives Manager Review precedence over generic upload completion.
- Preview playback uses only the existing local object URL and cannot create durable evidence.
- Email enforcement is limited to vendor-created Service Video records carrying a recording-scope assessment.
- The test-only vendor fixture is unavailable unless explicitly enabled for E2E visual validation.

### Known Unrelated Issues

The clean install continues to report pre-existing dependency advisories. This checkpoint made no dependency changes and did not run an automatic audit fix.

## Git

- Target branch: `codex/rv8-residence-location-correction`
- Starting commit: `24d40c6d21b05bd84721127e4a8349d909658d52`
- Migration: none created or changed.
- Unrelated files in the original worktree remain untouched and excluded.

## Deployment

Deployment was not performed. No Azure setting, database schema, migration, or beta application package was changed.

## Next Recommended Action

Stop at Product Owner beta deployment approval. After an approved deployment, perform physical Android preview validation and physical iPhone validation when an approved device is available. Do not continue the existing Manager Review acceptance until then.
