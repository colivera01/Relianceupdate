# RV-8 Simplified V1 Recording Permission Lifecycle Correction Report

## Root Cause

The current customer flow retained two older decision branches that no longer matched the Product Owner's simplified V1 model:

- `Decide Later` created an explicit UI outcome even though taking no action already leaves permission pending and recording blocked.
- `Is recording required to complete this service?` allowed vendors to choose lifecycle semantics that could contradict the current Service Video rule that a required-permission decline closes the Reliance work record.

Those choices also kept historical authority and optional-recording terminology active in newly generated evidence. New V1 behavior now has its own immutable content and assessment versions while historical generations remain readable under their original rules.

## Final V1 Customer Decision Model

- **Allow Recording:** persists the existing verified `ALLOWED` decision and authority evidence. Assignment, Service Order release, certification, location, lifecycle, stage, and manager-review gates still apply.
- **Decline Recording:** atomically persists `DECLINED` evidence and cancels the Reliance work record.
- **This Request Is Not for Me:** preserves the wrong-recipient workflow. It revokes that request generation and requires corrected contact information without canceling the work record.
- **No response:** stores no decision. Permission remains pending and recording remains blocked.

Current V1 customer pages and request notifications expose only the three explicit actions above. `Decide Later` remains available only when rendering an older permission content version.

## Decline Cancellation Lifecycle

The verified decision and cancellation execute inside one Serializable database transaction. A current simplified-V1 decline:

- creates immutable `DECLINED` decision evidence;
- changes the canonical booking status to `CANCELED`;
- records cancellation reason `Customer declined Reliance recording permission`;
- records that the underlying service was not canceled by Reliance;
- revokes all current permission links for the work record;
- removes Service Order release authority from work-record metadata;
- invalidates active employee recording certifications;
- archives operational media sessions that contain no durable media assets;
- cancels queued or sending work-record notifications;
- preserves existing media and all historical consent/evidence records;
- writes a durable consent lifecycle audit event linked to the decision evidence;
- fails closed if the work-record lifecycle changes before the transaction commits.

The canonical recording gate treats the canceled record as terminal. No participant has a remaining Reliance action, and stale permission or employee links cannot reopen recording or upload authority.

The vendor manager receives a clear decline/cancellation notice. Assigned employees also receive the existing team notification path where applicable. Copy states that the Reliance work record is canceled while the underlying service arrangement remains a separate vendor/customer decision.

## Wrong Recipient Lifecycle

Wrong recipient remains distinct from decline:

- durable `WRONG_RECIPIENT` evidence is preserved;
- the current request link is revoked;
- recording remains blocked;
- the work record is not canceled;
- ordinary resend to the unchanged contact remains blocked;
- the vendor is directed to `Correct Customer Contact`;
- audited contact correction creates a new request generation and fresh decision requirement without overwriting the earlier evidence.

## Vendor Creation UX

New V1 Add Work Record no longer displays or submits:

- an authority selector;
- `Is recording required to complete this service?`;
- recording-required/optional Yes/No choices.

The remaining scope assessment asks about property, identifiable people, framing, minors, protected non-participants, sensitive information, identifiers/security details, and location. New assessments derive authority from canonical location/scope rules:

- safe vendor-controlled scope derives vendor-manager authority and does not add customer permission;
- customer locations or permission-triggering content derive verified-customer authority.

Historical schema fields remain populated with deterministic compatibility values for new records and are no longer active vendor choices.

## Customer UX

Current V1 requests explain:

- what Reliance will record;
- that audio is off;
- that recordings start Private;
- that public sharing is a separate later decision;
- that decline closes only the Reliance work record;
- that wrong recipient is only for a request sent to the wrong person/contact.

After decline, the customer sees `Recording declined`, confirmation that Reliance will not record through the work record, confirmation that the Reliance work record is closed, and that no further recording-permission action is required.

## Vendor / Employee UX

Vendor lifecycle presentation now distinguishes:

- waiting for verified customer permission;
- recording allowed with remaining gates still active;
- `Recording Declined - Reliance Work Record Canceled`;
- wrong recipient requiring customer-contact correction.

New V1 copy no longer says `customer or authorized representative` in the ordinary flow.

Employees opening a decline-canceled Service Order see a closed Reliance work record. The server-side canonical gate blocks camera, session, recording, upload, retry, and durable media mutation paths regardless of stale browser or link state.

## Historical Compatibility

Prospective boundaries are:

- permission content: `recording-permission-v2-simplified-v1`;
- scope schema: `recording-scope-v2-simplified-v1`;
- assessment schema: `recording-assessment-v2-simplified-v1`;
- work-record metadata: `SIMPLIFIED_V1`.

Older content versions retain their original UI, notification wording, authority identifiers, recording-required/optional evidence, and non-canceling historical decline behavior. No old consent, booking, media, authority, or cancellation evidence is rewritten.

## Files Changed

Runtime:

- `src/app/api/bookings/route.ts`
- `src/app/api/consent/decline/route.ts`
- `src/app/consent/[token]/page.tsx`
- `src/app/employee/jobs/page.tsx`
- `src/app/vendor/jobs/[jobId]/page.tsx`
- `src/app/vendor/jobs/page.tsx`
- `src/lib/consent/content-version.ts`
- `src/lib/consent/decision-service.ts`
- `src/lib/consent/decline-cancellation.ts`
- `src/lib/consent/delivery-service.ts`
- `src/lib/consent/lookup.ts`
- `src/lib/consent/recording-gate.ts`
- `src/lib/consent/request-service.ts`
- `src/lib/notifications/send-consent-decision.ts`
- `src/lib/notifications/send-consent-link.ts`
- `src/lib/recording/scope-assessment.ts`
- `src/lib/vendor-job-lifecycle-presentation.ts`

Tests:

- `e2e/rv8-product-owner-replay-corrections.spec.ts`
- `e2e/verified-permission-request.spec.ts`
- `src/app/api/consent/consent-flow-routes.test.ts`
- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/lib/notifications/send-consent-decision-release.test.ts`
- `src/lib/notifications/vendor-attributed-sms-copy.test.ts`
- `src/lib/recording/scope-assessment.test.ts`
- `src/lib/vendor-job-lifecycle-presentation.test.ts`

## Validation

- Focused permission, scope, lifecycle, notification, and gate package: **21 files / 111 tests passed**.
- Epic 4/Epic 5 recording and media mutation regressions: **9 files / 60 tests passed**.
- Booking creation, request, resend, permission management, and wrong-recipient regressions: **5 files / 47 tests passed**.
- Final changed-path checks: **43 tests passed**, plus version-aware notification coverage **8 tests passed**.
- Playwright customer permission UX: **9 passed**.
- Playwright vendor creation/card UX: **11 passed** using the documented visual-fixture flag.
- Playwright global database setup was disabled; no shared database was used.
- Prisma `validate`: **passed** with a synthetic schema-only SQL Server URL.
- Prisma `generate`: **passed**.
- TypeScript `npx tsc --noEmit --incremental false`: **passed**.
- Production build with the established 6144 MB heap setting: **passed**.
- `git diff --check`: **passed**.

The first vendor Playwright invocation omitted the fixture-route environment flag and timed out before reaching the Add Work Record UI. It was a test-harness configuration issue; the correctly configured rerun passed all 11 scenarios.

## Git

- Starting commit: `509c30938f42efe61ec94bce84714d982767f4d3`
- Target branch: `codex/rv8-residence-location-correction`
- Final commit: the scoped commit containing this report; exact hash is reported in the Product Owner checkpoint after commit creation.
- Pushed: performed after this report is committed.
- Migrations: none.

## Deployment

Deployment was **NOT performed**.

## Clean Beta Baseline

No Electro LLC acceptance work records, permission decisions, Service Orders, recordings, or other beta data were created or modified during implementation or validation.

## Acceptance Campaign

The previous 54-scenario tracker remains preserved as `HISTORICAL - PRE-SIMPLIFIED-V1 RV-8 ACCEPTANCE`. Its prior PASS counts were not used to certify this workflow. A new simplified-V1 acceptance tracker has not begun.

## Next Recommended Action

Product Owner implementation review of this scoped correction. Do not deploy or begin new acceptance testing until separately approved.
