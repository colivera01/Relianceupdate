# RV-8 UX and Active-Session Correction Report

## Corrections Implemented

This checkpoint improves permission-status feedback, material-edit warnings, work-record lifecycle context, canceled-record navigation, vendor session behavior, and Decide Later wording. It does not change recording permission authority, evidence, recording gates, media, publication, reviews, Trust Score, lifecycle governance, or database schema.

## Permission Refresh UX

- Renamed the work-record action from `Check Consent` to `Refresh Permission Status`.
- The action reads only the canonical permission status. It does not assign an employee, release a Service Order, authorize recording, or alter permission evidence.
- Feedback now appears beside the affected work-record card and truthfully distinguishes waiting, approved, declined, wrong-recipient, and refresh-failure outcomes.

## Material Edit Confirmation

- Material evidence-bearing edits are detected separately from ordinary edits.
- Before a material edit is submitted, the vendor sees a plain-language confirmation explaining that any existing permission will no longer authorize the changed Service Order, prior evidence remains preserved, a new permission request is required, and employee recording may lock.
- `Go Back` performs no mutation. `Continue and Request New Permission` proceeds through the existing authoritative server-side supersession behavior.

## View Details Lifecycle

- The work-record card and View Details now use the same shared lifecycle presentation resolver.
- View Details prominently states the current lifecycle, why the record is in that state, who acts next, and what resolves it.
- No new lifecycle state or parallel authority resolver was introduced.

## Canceled Records UX

- Added a first-class `Canceled` filter while preserving the existing filters.
- Canceled records remain excluded from Active Work and available as read-only historical records.
- Their primary message is `Service Order canceled`, with recording and further work described as permanently closed.

## Session Security Model

### Idle timeout

Vendor access uses the existing vendor-configured idle timeout. The default remains 30 minutes and the existing supported configuration range remains 5 minutes through 24 hours.

### Renewal behavior

Loading a protected vendor page and throttled meaningful activity renew the server-signed idle activity marker. The signed session's original issue time and absolute expiration are preserved. An already idle-expired session cannot be revived.

### Absolute maximum lifetime

The existing seven-day signed-session lifetime remains the absolute maximum. Sliding idle renewal cannot extend it.

### Warning behavior

A visible warning appears before the effective idle or absolute deadline. The warning begins up to five minutes before expiration, with a minimum one-minute warning for shorter configured idle windows. It provides `Stay signed in` and `Sign out` actions and displays a countdown.

### Authorization revalidation

Protected vendor API requests rebuild the actor and active vendor memberships from the database before applying the session timeout. Disabled, revoked, inactive, missing, or unauthorized membership cannot be restored by client activity or cookie renewal.

### Unsaved work

The session guard detects edits in forms and dialogs and warns that unsaved changes may be lost. It does not persist sensitive form data or drafts in browser storage.

## Decide Later

The behavior is unchanged. Copy now clarifies that no decision is saved, recording stays locked, the customer may return later, and the provider is not told that permission was approved or declined.

## Validation

- Focused UX/session unit and API tests: 38 passed across 7 files.
- RV-8, Epic 4, and Epic 5 recording, upload, manager-review, lifecycle, supersession, authority, and permission regressions: 132 passed across 16 files.
- Playwright: 10 passed in Chromium using API-mocked fixtures with `PLAYWRIGHT_SKIP_GLOBAL_DB_SETUP=1`. No shared database fixture was created, changed, seeded, or reset.
- TypeScript: passed with `npx tsc --noEmit --pretty false --incremental false`.
- Production build: passed with the established 6144 MB Node heap setting.
- Diff integrity: `git diff --check` passed.
- Physical Android validation: pending Product Owner deployment/replay; not performed in this non-deployment checkpoint.
- Physical iPhone validation: pending; no approved physical iPhone session was available.

The first Playwright invocation exposed test-harness prerequisites rather than runtime defects: the environment-gated visual fixture flag was absent, the fixture service lacked canonical vendor/publication fields, and the fixture bypassed the vendor layout that normally mounts the session guard. The final isolated run corrected those fixture conditions and passed all 10 scenarios.

## Regression Impact

- Consent-authority validation remains unchanged.
- Wrong-recipient correction and material-change supersession remain server-authoritative.
- Immutable location snapshots, cancellation lifecycle, manager-review recording lock, exact-stage correction, stale-upload protection, audio-off capture, three-stage evidence, employee preview, customer email requirement, Private Service Video access, and manager-only authority remain intact.
- No review, rating, Trust Score input, Public proof, publication, AI, notification, retention/deletion, or legal-governance behavior was added or changed.
- The obsolete 72-hour review process was not introduced.

## Files Changed

- Vendor jobs card, edit confirmation, canceled filter, and permission refresh UI.
- Vendor job detail lifecycle presentation and API response context.
- Customer Decide Later copy.
- Vendor session cookie, timeout, request-actor enforcement, guard API, and warning UI.
- Shared lifecycle and material-edit helpers.
- Focused unit, API, integration, and Playwright coverage, including the environment-gated RV-8 test fixture.
- This report.

## Git

- Branch: `codex/rv8-residence-location-correction` (push target)
- Starting commit: `18588f6a0609d557a2a521e7876bdf1de906f40c`
- Final commit: recorded after the scoped checkpoint commit
- Pushed: recorded after push verification
- Migrations: none

## Deployment

Deployment was not performed.

## Existing Product Owner Records

No Product Owner record was created, changed, advanced, approved, rejected, corrected, or published. No shared beta database operation was performed.

## Next Recommended Action

Stop at Product Owner deployment review. After approval, deploy the exact scoped commit and perform the approved beta and physical-device validation without advancing unrelated replay records.
