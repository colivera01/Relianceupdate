# RV-8 Location-Source Validation Correction Report

## Checkpoint

- Scope: RV-8 location-source validation correction only
- Repository: `Project Reliance`
- Branch: `codex/rv8-residence-location-correction`
- Starting commit: `500ffcbee23082030e94bff02a9770db2b1c43c1`
- Deployment: Not performed
- Later gates: RV-9 and Epic 8 were not started

## Objective

Ensure that each recording location selection resolves only to its matching approved location source, creates an immutable verified snapshot on the work record, and fails closed before recording when that evidence is missing or inconsistent.

## Finding

The RV-8 failure was a combination of two issues:

1. The original synthetic booking was incorrectly configured. It selected `Customer residence`, but its saved snapshot was typed as `Vendor business address` and sourced from the vendor profile.
2. The application accepted or repaired some recording locations from mutable or mismatched profile data instead of consistently requiring the matching immutable work-record snapshot.

The original record was preserved as historical evidence. It was not relabeled or repaired in place.

## Required Source Matrix

| Selected service location | Approved source | Prohibited substitutions |
| --- | --- | --- |
| Vendor business address | Verified vendor profile | Customer residence or customer business |
| Customer residence | Explicit customer residence or verified customer profile residence | Vendor address or customer business |
| Customer business address | Explicit customer business address supplied for the work record | Vendor address or customer residence |

All three sources require a complete address, valid coordinates, a verified status, a capture timestamp, and a matching snapshot type.

## Corrected Behavior

- Work-record creation rejects an assessment whose location differs from the selected location.
- Partial explicit residence data cannot fall back to a vendor address or another profile source.
- Customer-business work requires its own complete customer-business address.
- The canonical recording gate returns `RECORDING_LOCATION_SNAPSHOT_REQUIRED` when the snapshot is missing, incomplete, unverified, mistyped, or sourced from the wrong participant.
- A previous location-verification attempt cannot override an invalid snapshot.
- Device location verification compares only against the immutable work-record snapshot. It no longer geocodes or substitutes current profile addresses at recording time.
- Existing work records cannot silently change location type or replace their saved snapshot through the vendor action endpoint.
- The employee view shows the saved service location being verified without exposing the customer's wider profile.
- Blocked states identify the missing evidence, the vendor manager as the responsible participant, and the corrective action.

## Controlled Fixture Evidence

### Preserved invalid fixture

- Booking: `cmsbzi95w000fp4fhyc5wn5ye`
- Selected location: Customer residence
- Saved snapshot: Vendor business address / vendor profile
- Treatment: Preserved unchanged as evidence of the invalid historical state

### Corrected controlled fixture

- Booking: `cmsot04di0001sogwo502cmkq`
- Title: `RV-8 Residence Location Validation`
- Customer: Synthetic controlled customer (`Reliance Demo Customer`)
- Selected location: Customer residence
- Snapshot type: Customer residence
- Snapshot source: Customer profile
- Snapshot status: Verified coordinates
- Address: 407 Boxwood Circle, Winter Springs, FL 32708
- Assessment: Complete
- Permission: Pending
- Capture sessions: 0
- Media assets: 0
- Reviews: 0
- Public media: 0

The fixture remains locked pending the normal permission and device-location gates. It was not advanced into recording.

## Files Changed

### Server and shared logic

- `src/app/api/bookings/route.ts`
- `src/app/api/employee/jobs/route.ts`
- `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
- `src/lib/consent/recording-gate.ts`
- `src/lib/job-assignment.ts`
- `src/lib/job-recording-location.ts`

### User experience

- `src/app/vendor/jobs/page.tsx`
- `src/app/employee/jobs/page.tsx`

### Tests

- `src/app/api/bookings/booking-crud.integration.test.ts`
- `src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts`
- `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
- `src/lib/consent/canonical-recording-gate.test.ts`
- `src/lib/job-recording-location.test.ts`

### Evidence

- `Project Management/Pre-Epic8 Release Validation/RV8_CORRECTED_RESIDENCE_EMPLOYEE_STATE.png`

The screenshot is a local corrected-state preview. It is not evidence of a beta deployment.

## Database and Migration Impact

- No schema change
- No migration created
- No existing customer or production work record rewritten
- The corrected synthetic fixture was created as a new controlled record so historical evidence remained truthful

## Security and Privacy Impact

- Recording remains fail-closed when location evidence is uncertain.
- Employee access was not broadened to customer profile data.
- The employee receives only the service location already saved for the assigned work record.
- Profile changes after work-record creation cannot silently alter the authorized verification target.
- Permission authority and the canonical recording-gate design were not changed.

## Validation Results

### Focused regression suite

Command:

```text
npx vitest run "src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts" src/app/api/bookings/booking-crud.integration.test.ts src/lib/job-recording-location.test.ts src/lib/consent/canonical-recording-gate.test.ts src/app/api/employee/jobs/employee-job-lifecycle.integration.test.ts
```

Result: PASS - 5 files, 87 tests.

Coverage includes:

- correct source resolution for all three location choices;
- missing location;
- wrong location type and source;
- profile change after work-record creation;
- residence cannot fall back to vendor address;
- customer business cannot fall back to residence;
- vendor business cannot use a customer location;
- immutable snapshot enforcement;
- canonical recording gate remains locked until the correct saved location is verified.

### TypeScript

Command: `npx tsc --noEmit`

Result: PASS.

### Production build

Command: `npm run build` with `NODE_OPTIONS=--max-old-space-size=8192`

Result: PASS on Next.js 15.5.21. The build generated 205 App Router pages and the two maintained legacy Pages Router pages.

The first build invocation exceeded the command runner's shorter time limit. It did not report a compiler failure. The same build was rerun with a sufficient timeout and completed successfully in 130.4 seconds.

### Diff integrity

Command: `git diff --check`

Result: PASS. Git emitted only expected Windows line-ending notices.

## Regression Statement

### Intentionally preserved

- Existing permission authority and customer decision evidence
- Employee assignment and membership gates
- Precise-device-location verification and configured distance limits
- Three-stage recording workflow
- Manager review, Private proof, Public proof, reviews, and Trust Score behavior

### Intentionally unchanged

- Recording radius and GPS accuracy policy
- Consent links, OTP, notifications, publication, lifecycle, and media storage
- Database schema and migrations
- Beta deployment package

### Areas verified unaffected

- Vendor job actions continue to enforce ownership and authorization.
- Employee job lifecycle responses continue to use the canonical recording gate.
- Existing valid location snapshots continue to verify normally.
- No review, rating, Trust Score input, publication decision, or Public media was created by the corrected fixture.

### Potential regression risks reviewed

- Older invalid work records now remain correctly blocked instead of being repaired from mutable profile data.
- Vendors must provide an explicit customer-business address for customer-business work.
- Address autocomplete failure still permits a complete manually entered address to be server-geocoded; unverifiable input is rejected.

## Known Limitations and Next Gate

- The corrected code has not been deployed to beta.
- Physical-device location replay has not resumed.
- The corrected synthetic fixture remains permission-pending and recording-locked.
- Product Owner approval is required before deployment or resuming RV-8 physical-device validation.

## Checkpoint Verdict

The scoped correction is buildable and regression-tested. Each service-location choice now resolves only to its corresponding approved source, and the recording workflow fails closed when the immutable snapshot is absent or inconsistent.
