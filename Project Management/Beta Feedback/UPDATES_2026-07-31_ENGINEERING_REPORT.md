# Updates 7-31-26 Engineering Report

**Source:** `Updates 7-31-26.docx`
**Implementation date:** 2026-08-01
**Branch:** `cursor-latest-build`
**Starting commit:** `4c89192d806261def0acb05185050180db8006ac`

## Objective

Resolve the six private-beta issues documented in the attachment without changing unrelated consent, recording, publication, account, or review behavior.

## Task Results

### 1. Archived work records refresh immediately

**Before:** The Manage Jobs page could reload its jobs-only payload from the 60-second vendor dashboard cache after an archive action. The archived count changed, but the stale card could remain visible until a manual refresh.

**After:** Jobs-only dashboard requests bypass the dashboard TTL. Archive, assignment, reassignment, and other operational list refreshes now read current state immediately while the lower-risk full dashboard response remains cached.

**Primary file:** `src/app/api/vendors/[vendorId]/dashboard/route.ts`

### 2. Completed-service email opens a focused account handoff

**Before:** A Watch Service Video link could render the normal customer shell while resolving authentication and claim state, exposing navigation that was unrelated to the secure handoff.

**After:** An unauthenticated link opens a focused explanation that registration is free, explains that the work record will be saved under My Service Records, and offers only free registration or sign-in. Authenticated video-ready links also use a focused shell without customer/vendor navigation while the work record is claimed and loaded. The existing secure `next` continuation and work-record claim behavior are preserved.

**Primary file:** `src/app/(user)/layout.tsx`

### 3. Registration policy links preserve form progress

**Before:** SMS Policy, Privacy Policy, and Terms links replaced the registration page, which could interrupt or discard in-progress registration input.

**After:** All three policy links open in a separate browser tab with `noopener noreferrer`, leaving the registration page and entered values in place.

**Primary file:** `src/app/auth/register/page.tsx`

### 4. Manager approval retries no longer report a false failure

**Before:** The first approval request could commit successfully and move the package to admin moderation, while a repeated client request then received `Only jobs in AWAITING_REVIEW can be approved.`

**After:** Approval is idempotent. If the work record is already completed and its required three-stage package exists, a retry returns success without duplicating database updates, moderation resets, audits, Trust Score outcomes, or notifications.

**Primary files:**

- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.integration.test.ts`

### 5. Consent-decision vendor email matches Reliance styling

**Before:** The vendor/employee recording-permission decision notice was plain text only.

**After:** The email uses the shared Reliance email shell, logo, headline, structured vendor/service-order/decision details, and a clear next-step section. The plain-text fallback, SMS behavior, delivery logging, and recipient logic remain intact.

**Primary files:**

- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/send-consent-decision.test.ts`

### 6. Vendor Analytics uses the same work-record metrics as the dashboard

**Before:** Analytics mixed full totals, truncated recent-job/review arrays, and archived media-asset versions. This could show a completion rate and archived count that did not match the Vendor Dashboard.

**After:** Analytics derives lifecycle counts and its completion denominator from the canonical dashboard response. Review coverage uses the approved review count, and the archived pipeline count represents archived service orders instead of archived media versions. Awaiting-review work is now visible in the job-status mix.

**Primary files:**

- `src/app/vendor/analytics/page.tsx`
- `src/lib/vendor-analytics.ts`
- `src/lib/vendor-analytics.test.ts`
- `src/types/vendor.ts`

## Files Changed

- `src/app/(user)/layout.tsx`
- `src/app/api/vendors/[vendorId]/dashboard/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.integration.test.ts`
- `src/app/auth/register/page.tsx`
- `src/app/vendor/analytics/page.tsx`
- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/send-consent-decision.test.ts`
- `src/lib/vendor-analytics.ts`
- `src/lib/vendor-analytics.test.ts`
- `src/types/vendor.ts`
- `Project Management/Beta Feedback/README.md`
- `Project Management/PROJECT_DASHBOARD.md`
- `Project Management/RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`
- `Project Management/Beta Feedback/UPDATES_2026-07-31_ENGINEERING_REPORT.md`

## Repository Impact

### Migrations

None.

### Security Impact

The service-video handoff reveals less navigation before the intended customer is authenticated. Existing claim-token validation, account matching, and work-record authorization remain unchanged.

### API Impact

- Jobs-only vendor dashboard reads are deliberately uncached.
- Manager approval now returns an idempotent success for an already-committed, complete three-stage package.
- No endpoint names, request contracts, or authorization rules changed.

### Database Impact

No schema or migration change. The idempotent approval path performs no write when the first approval already committed.

### Notification Impact

Consent-decision emails now include branded HTML. Plain-text fallback, SMS content, delivery attempts, and audit behavior are preserved.

### AI Impact

None.

### Dashboard Impact

Manage Jobs reads current operational state after mutations. Vendor Analytics now uses canonical lifecycle/service-order values instead of mixing them with recent-list or media-version counts.

### Legal Impact

No policy wording or legal rules changed. Registration policy documents remain available and now open without replacing the in-progress form.

### Backward Compatibility

Existing URLs, API request shapes, claim continuation, archived data, reviews, Trust Score records, notifications, and service-video states remain compatible.

### Rollback Considerations

Each change is code-only. Reverting this checkpoint restores prior caching, shell, link, approval-retry, email, and analytics behavior without a database rollback.

## Testing

### Passed

- Focused new/changed tests: 9 of 9 passed.
- Related regression suite: 57 of 57 passed across vendor dashboard, vendor actions, booking claim, consent links, auth continuation, customer claim logic, and the shared email template.
- Production build: passed after raising Node's heap allowance to 4 GB. Compilation, lint/type validation, static generation for 197 app pages, and build tracing completed.
- `git diff --check`: passed.
- Browser DOM check: registration policy links resolve to `/sms-policy`, `/privacy`, and `/terms`, each with `target="_blank"` and `rel="noopener noreferrer"`.
- Responsive browser review: focused service-video handoff verified at 1440 x 1000 and 390 x 844.

### Repository-wide suite

`npm test` completed with 735 passing and 13 failing tests across 160 files. The 13 failures are in nine pre-existing, unrelated suites involving development email bypass, employee correction/rejection fixtures, admin moderation fixtures, promoted listings, public service fixtures, and outdated employee wording expectations. None of those files were changed for this task.

### Linting

There is no standalone `lint` script. The successful Next production build ran its configured lint/type-validation phase.

## Screenshot Package

Screenshots are intentionally not committed:

- `output/updates-7-31-26/service-video-handoff-desktop.png`
- `output/updates-7-31-26/service-video-handoff-mobile.png`

The desktop and mobile captures show the focused handoff with clear free-registration and existing-account actions, readable hierarchy, and no unrelated account navigation.

## UX Review

### Customer

The email handoff now explains why the customer is there, that registration is free, where the record will be saved, and how to continue. The narrow mobile layout stacks actions and keeps all text readable. Policy links no longer threaten registration progress.

### Vendor

Archived records and approval outcomes now update without contradictory stale states. The permission-decision email is recognizable as a Reliance communication and includes the next action.

### Employee

No employee recording or assignment workflow changed. The employee still receives the existing secure order and permission outcome behavior.

### Admin

Approval retries no longer present a manager-facing error after the package has already reached moderation. Admin moderation state and queue rules are unchanged.

## Regression Statement

### Existing functionality intentionally preserved

- Customer work-record claim and authorization
- Secure `next` continuation through registration/sign-in
- Three-stage recording and manager review
- Admin moderation
- Review and Trust Score creation rules
- Notification recipient selection, SMS, and delivery logging
- Full dashboard caching outside operational jobs-only reads

### Existing functionality intentionally unchanged

- Consent rules and consent-request links
- Public/private media choice
- Publication logic
- Location verification
- Registration submission and legal assent behavior
- Retention and deletion
- Account/session isolation

### Areas verified unaffected

- Vendor action routes
- Booking claim routes
- Consent routes
- Auth continuation utilities
- Shared email template
- Production static rendering

### Potential regression risks reviewed

- Duplicate approval side effects: prevented by the no-write idempotent return and test.
- Stale operational cards: reduced by bypassing cache only for `jobsOnly=1`.
- Customer-shell leakage: prevented for both unauthenticated and authenticated service-video intent.
- Analytics denominator drift: isolated in a pure tested derivation helper.

### Known unrelated issues

The full Vitest suite retains 13 failures in nine unrelated suites. The repository also contained unrelated deleted documentation, a modified TypeScript build-info file, and an existing untracked `output/` folder before this work; these were not restored, staged, or otherwise altered as application scope.

## Known Limitations

- Controlled delivery through the live email provider was not sent during this task; template output and notification integration were tested locally.
- Archive and analytics behavior were verified through API/pure-function coverage and production build, not by mutating live beta customer data.
- The broader Product Owner release screenshot matrix remains incomplete; this maintenance task adds only the two directly relevant handoff captures.

## Completion Boundary

Only the six attachment tasks and their direct verification/documentation were addressed. No later consent epic or unrelated repair was implemented.

## Live Beta Follow-Up

The original implementation checkpoint was pushed to `cursor-latest-build`, but the Azure beta application is configured to deploy from the separate `beta` branch. That deployment branch had not received the customer service-video handoff changes, so the live site continued to render the shared customer shell and linked vendor control.

The follow-up adds explicit regression coverage for the exact email link format used in production (`/my-bookings/{id}?videoReady=1`, without a claim token). The corrected build is deployed by fast-forwarding the existing `beta` branch; no force push or history rewrite is used. Live visual verification is performed against the same URL shape after deployment.
