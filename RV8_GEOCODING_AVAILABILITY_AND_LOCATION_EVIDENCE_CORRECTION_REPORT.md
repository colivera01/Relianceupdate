# RV-8 Geocoding Availability and Location-Evidence Correction Report

Date: 2026-08-19

Branch: `codex/rv8-residence-location-correction`

Starting commit: `f72105da4500fc9bb524518e0d4df8bbfe1cfea1`

## Root Cause

Reliance used the U.S. Census geocoder as its sole authoritative address resolver. Census correctly returned no match for the legitimate Product Owner-entered address `888 City Walk Ln, Oviedo, FL 32765`. The application correctly failed closed, but a single-provider no-match prevented legitimate locations from entering the location-dependent Service Video workflow.

The correction adds a higher-coverage primary provider while preserving Census as a controlled U.S. fallback. It does not permit browser suggestions, profile coordinates, another location type, or invented coordinates to bypass authoritative server verification.

## Provider / Licensing Verification

Current official Microsoft sources were reviewed on 2026-08-19:

- Microsoft Product Terms, Microsoft Azure, Mapping Services section: <https://www.microsoft.com/licensing/terms/en-US/productoffering/MicrosoftAzure/allprograms>
- Azure Maps Get Geocoding API `2025-01-01`: <https://learn.microsoft.com/en-us/rest/api/maps/search/get-geocoding?view=rest-maps-2025-01-01>
- Azure Maps Get Geocode Autocomplete API `2026-01-01`: <https://learn.microsoft.com/en-us/rest/api/maps/search/get-geocode-autocomplete?view=rest-maps-2026-01-01>

The current Product Terms permit a customer to store Azure Maps geocodes while the customer maintains an active Azure account. Reliance therefore stores a minimal normalized acceptance record rather than the full provider response.

Limitations recorded for Product Owner review:

- Stored Azure Maps geocodes depend on maintaining an active Azure account.
- The implementation must not be used to create or combine a separate third-party geospatial database.
- Microsoft does not warrant result accuracy; Reliance continues to apply its own fail-closed quality rules and physical device-location gate.
- No Azure Maps account currently exists in the connected Azure subscription. No resource or credential was created during this checkpoint.

## Architecture

- Primary authoritative resolver: Microsoft Azure Maps.
- Controlled U.S. fallback: U.S. Census geocoder.
- Autocomplete uses Azure Maps when the primary provider is configured. Explicit Census-only mode retains Census suggestions.
- A complete manually entered address is always eligible for server verification; autocomplete selection is never required.
- Server verification re-geocodes new work-record locations. Browser coordinates and previously stored profile coordinates do not become new immutable work-record evidence by themselves.
- Azure no-match, provider unavailability, or insufficient precision may invoke Census fallback.
- Missing Azure configuration, malformed Azure responses, and ambiguous Azure results fail closed instead of silently masking a broken primary configuration.
- Vendor business, customer residence, and customer business sources remain isolated. No cross-source fallback was added.

## Quality Rules

Azure Maps results are accepted only when all of the following are true:

- result type is `Address`;
- confidence is `High` or `Medium`;
- match codes include `Good` and exclude `Ambiguous` and `UpHierarchy`;
- geocode calculation method is `Rooftop`, `Parcel`, `Interpolation`, or `InterpolationOffset`;
- street number, city, state, and five-digit ZIP match the submitted address;
- coordinates are finite, in geographic range, and not `0,0`;
- materially different acceptable candidates are not present.

Census fallback is accepted only for exactly one complete address-level match with matching street number, city, state, and ZIP and valid non-zero coordinates. Locality-only, ZIP-only, road-only, broad hierarchy, malformed, multiple, and zero-coordinate results are rejected.

## Provider Disagreement

The material-conflict threshold is `75 meters`, one half of the current `150-meter` recording radius.

When Azure supplies a weak candidate and Census supplies an otherwise acceptable fallback, a separation greater than 75 meters produces `provider_conflict` and blocks progression. Equivalent results within the threshold may use the Census fallback. The conflict log stores a SHA-256 conflict reference, rounded distance, and threshold; it does not expose provider credentials or raw payloads.

The source location type is never changed to resolve disagreement.

## Durable Location Evidence

New successful snapshots use evidence version 2 and preserve:

- provider identifier;
- provider API/benchmark version;
- provider result identifier when available;
- original entered address;
- normalized provider address;
- accepted result type and precision;
- confidence and match codes;
- fallback-used flag;
- verification timestamp;
- immutable location source/type;
- accepted latitude/longitude in the snapshot;
- provider-evidence SHA-256;
- complete snapshot SHA-256.

The recording gate recomputes both hashes. Rewriting coordinates or provider metadata invalidates the snapshot and fails closed. Full raw provider payloads are not stored.

## UX

The server now returns provider-neutral, truthful outcomes:

- Incomplete: `Enter the complete street, city, state, and ZIP code.`
- No match: `We could not verify this address. Check the address or choose the correct suggested location.`
- Ambiguous/conflicting: `More than one location matched. Choose the exact service address.`
- Temporary outage: `Address verification is temporarily unavailable. Try again later.`
- Unsupported/unverifiable: `Reliance could not verify this address automatically. Check the exact service address and contact support if it is correct.`

The UI regression confirms that a vendor may manually enter `888 City Walk Ln` without choosing autocomplete and sees the authoritative server result beside the work-record form. The user is never instructed to substitute a different service address.

## Migration

No database migration was required. The immutable work-record location snapshot already resides in booking metadata and can hold the additive normalized evidence record.

- New verified snapshots use evidence version 2 and require valid provider and snapshot hashes.
- Historical version-1 snapshots remain readable under their existing validation rules.
- Historical snapshots are not rewritten.
- New work-record snapshots re-verify the selected source, including vendor business addresses, so legacy profile coordinates cannot silently become new version-2 evidence.

## Test Address

Address: `888 City Walk Ln, Oviedo, FL 32765`

- Live Census reproduction on 2026-08-19: zero address matches, confirming the blocker.
- Azure Maps provider-contract regression: PASS. A complete manually entered address is accepted when Azure returns a precise, unambiguous address result, and normalized provider evidence is stored.
- UI manual-entry/error presentation: PASS without autocomplete selection.
- Live Azure Maps lookup: NOT RUN. The connected subscription currently has no Azure Maps account and no approved credential. No infrastructure was created during this checkpoint.

This address therefore proves the Census limitation and the corrected application contract, but it does not yet constitute live Azure acceptance. A live Azure configuration and lookup are required before deployment approval.

## Validation

- Clean install: `npm ci` PASS; Prisma client generated from the committed dependency graph.
- Geocoding/location and recording-certification focused suite: 72/72 PASS.
- Relevant RV-8/Epic 4/Epic 5 regression suite: 158/158 PASS across 17 files.
- Evidence-tampering regression: PASS; changed coordinates invalidate the version-2 snapshot hash.
- Playwright manual-address/no-match scenario: 1/1 PASS in an isolated mocked-API UI fixture with no shared database setup.
- TypeScript: PASS using `npx tsc --noEmit --pretty false --incremental false`.
- Production build: PASS with `NODE_OPTIONS=--max-old-space-size=6144`; static generation completed 206/206 and the existing App Router and Pages Router routes were emitted.
- Prisma schema validation: PASS using a non-connecting placeholder URL; no schema change exists.
- `git diff --check`: PASS.

An initial Playwright attempt lacked the fixture-enablement environment flag and reached the expected fixture 404; the corrected isolated run passed. An exploratory broader unit run also exposed a pre-existing stale label expectation (`Paired phone` versus current `This phone`) in `employee-stage-capture.test.ts`; that unrelated test/code mismatch predates this checkpoint and was not changed.

## Regression Impact

The correction does not change customer permission/OTP, consent authority, employee assignment/release, audio-off enforcement, three-stage capture, manager-review locking, exact-stage correction, cancellation, stale-upload protection, manager authority, sessions, or Private proof behavior.

Relevant recording-gate, authority, location, booking, registration/profile, media-session, post-submission lock, and Service Video evidence regressions are green. Reviews, ratings, Trust Score, publication, AI, retention, and legal governance were not changed.

## Files Changed

- `.env.example`
- `src/lib/geocoding.ts`
- `src/lib/address-autocomplete.ts`
- `src/lib/recording-location-snapshot.ts`
- `src/lib/job-assignment.ts`
- `src/types/api.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/consent/accept/route.ts`
- `src/lib/geocoding.test.ts`
- `src/lib/address-autocomplete.test.ts`
- `src/lib/recording-location-snapshot.test.ts`
- `src/lib/job-assignment.test.ts`
- `src/app/api/bookings/booking-crud.integration.test.ts`
- `src/app/api/employee/jobs/[jobId]/recording-certification/recording-certification.integration.test.ts`
- `e2e/rv8-product-owner-replay-corrections.spec.ts`
- `RV8_GEOCODING_AVAILABILITY_AND_LOCATION_EVIDENCE_CORRECTION_REPORT.md`

## Git

- Starting commit: `f72105da4500fc9bb524518e0d4df8bbfe1cfea1`
- Final commit: the scoped commit containing this report; exact SHA is recorded in the Product Owner checkpoint response and remote branch
- Target branch: `codex/rv8-residence-location-correction`
- Push target: `origin/codex/rv8-residence-location-correction`
- Migration status: no migration created or required

The implementation was prepared in a clean isolated worktree. Unrelated changes in the existing local RV-8 worktree were not touched or included.

## Deployment

NOT PERFORMED.

The correction must not be deployed until Product Owner review and an approved Azure Maps account/credential configuration allow a live primary-provider validation, including the release-blocker address.

## Manage Jobs Acceptance

RV-8 Comprehensive Manage Jobs Batch 1 remains paused. No Product Owner record or `RV8-MJ` evidence record was created, modified, advanced, or deleted. The 54-scenario tracker is preserved unchanged. Batch 2, RV-9, and Epic 8 were not started.

## Next Recommended Action

Product Owner correction review, followed by a separately approved Azure Maps resource/configuration checkpoint and non-destructive live lookup validation. Do not resume Batch 1 until that configuration and exact-address validation pass.
