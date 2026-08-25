# RV-8 Core Admin Audit Validation Provenance Report

## Deployment Readiness Verdict

**READY FOR DEPLOYMENT**

No failure was introduced by the Core Admin Audit completeness correction. The same six test cases failed identically at base commit `46684929aa1c40e5dfecd90d8a00159c4e23b226` and correction commit `18b9cd706ce22cefb5779ce1061c46992e61ed9d` under equivalent clean Node/Vitest environments. The failures were stale expectations or incomplete/time-sensitive test fixtures. A test-only follow-up aligns the assertions with approved executable behavior; no runtime code changed.

## Comparison Method

- Current comparison worktree: detached at `18b9cd706ce22cefb5779ce1061c46992e61ed9d`.
- Base comparison worktree: fresh detached worktree at `46684929aa1c40e5dfecd90d8a00159c4e23b226`.
- Base dependencies: clean `npm ci` from the committed lockfile.
- Test environment: same Node, npm, Vitest version, command, file list, and absence of live database/Azure credentials.
- Result before test-only correction: both commits reported exactly **6 failed / 13 passed** across the same 19 tests, with matching assertions and actual values.

## Six Failure Provenance

### 1. Email verification development account fixture

- File/test: `src/lib/email-verification-enforcement.test.ts` — `requireVerifiedEmailForAction > allows dev audit accounts in development`.
- Assertion: `expect(result).toBeNull()`.
- Expected: `null`.
- Actual: HTTP `403` `EMAIL_VERIFICATION_REQUIRED` response.
- Base result: failed identically.
- Current result: failed identically.
- Classification: **PRE-EXISTING** test-fixture defect.
- Determination: executable behavior permits the development bypass for an internal demo/owner record, not solely because an arbitrary `@reliance.test` address is supplied. The fixture set `demo: false` and did not model an owner. The test now models `demo: true` and is named accordingly. Runtime verification enforcement was not weakened.

### 2. Employee capture-device wording

- File/test: `src/lib/employee-stage-capture.test.ts` — `employee-stage-capture > describes capture source for current and future devices`.
- Assertion: phone label equality; the following headset assertion was masked by the first failure.
- Expected: `Paired phone` and `Paired headset`.
- Actual: `This phone` and `Headset capture`.
- Base result: failed identically on `Paired phone` versus `This phone`.
- Current result: failed identically.
- Classification: **INTENTIONALLY OBSOLETE EXPECTATION**.
- Determination: approved product-language commit `1e25920` changed the executable labels to direct current-device wording. The test retained older pairing terminology. Assertions now match the approved UI language; runtime copy was not changed.

### 3. Employee runtime-error wording

- File/test: `src/lib/employee-runtime-errors.test.ts` — `employee runtime errors > keeps non-database errors as normal route failures`.
- Assertion: `response.body.error` equality.
- Expected: `Failed to pair employee device`.
- Actual: `Failed to prepare employee phone`.
- Base result: failed identically.
- Current result: failed identically.
- Classification: **INTENTIONALLY OBSOLETE EXPECTATION**.
- Determination: approved product-language commit `1e25920` changed the active error message from pairing terminology to phone preparation. The test now asserts the current approved language; runtime behavior was not changed.

### 4. Promoted-listings route fixture

- File/test: `src/app/api/admin/promoted-listings/route.integration.test.ts` — `admin promoted listings route > GET keeps category-targeted browse campaigns honest when full browse is suppressed`.
- Initial assertion: response status equality.
- Expected: HTTP `200`.
- Actual: HTTP `500`; the incomplete Prisma mock lacked the AI recommendation-record query used by the separate promotion-readiness chain.
- Base result: failed identically.
- Current result: failed identically.
- Classification: **PRE-EXISTING** test-fixture defect.
- Determination: the AI recommendation lookup was added before the approved base and neither the Core Admin Audit correction nor its base-to-current diff changed promoted-listings runtime code. After adding the proper empty AI-store mock, the test exposed a second time-dependent fixture issue: its June 2026 campaign had expired by the August 2026 validation date. The campaign window now uses bounded relative dates. No promotion, Public, or review runtime behavior changed.

### 5. Admin pending-moderation count

- File/test: `src/app/api/admin/stats/admin-stats.integration.test.ts` — formerly `GET /api/admin/stats > returns dashboard stats with combined pending moderation breakdown`.
- Assertion: deep equality of dashboard stats.
- Expected: `pendingModeration: 2`, with `mediaPackages: 1` and `reviews: 1`.
- Actual: `pendingModeration: 1`, with `mediaPackages: 0` and `reviews: 1`.
- Base result: failed identically.
- Current result: failed identically.
- Classification: **INTENTIONALLY OBSOLETE EXPECTATION**.
- Determination: base commit `4668492` deliberately changed the dashboard count to use the canonical actionable Reliance Audit queue. The fixture's booking is `CONFIRMED`, has no `AWAITING_ADMIN_REVIEW` operational phase, no current manager-attested package, no exact manager decision, and no package/evidence binding. Admin cannot open or decide it in Reliance Audit, so it must not count. The test now explicitly verifies exclusion of non-actionable packages and the canonical booking/stage query shape.

### 6. Review moderation queue fixture

- File/test: `src/app/api/admin/reviews/moderation-queue/route.test.ts` — `GET /api/admin/reviews/moderation-queue > keeps internal test-account reviews visible to admin moderation`.
- Assertion: response status equality.
- Expected: HTTP `200`.
- Actual: HTTP `500`; the incomplete Prisma mock lacked the AI recommendation-record lookup.
- Base result: failed identically.
- Current result: failed identically.
- Classification: **PRE-EXISTING** test-fixture defect.
- Determination: the review moderation route's stored-AI lookup predates the base and is separate from Core Admin Service Video Audit. The test now mocks an empty AI result map. Review/Public runtime code was not changed.

## Admin Stats Failure

The fixture supplies three media rows for one booking, but that booking is only `CONFIRMED`. It does not provide the canonical `AWAITING_ADMIN_REVIEW` operational phase, a current `AWAITING_ADMIN_REVIEW` Service Video package, a manager submission decision bound to the exact package hash/version, or matching durable stage evidence.

`getAdminMediaModerationQueue` first constructs complete three-stage groups, then requires completed work-record state plus `AWAITING_ADMIN_REVIEW`, and finally calls `loadCoreAdminAuditCandidate` to validate the exact current package, manager decision, stage identities, content hashes, and durable media. Only candidates passing those checks are returned and counted.

The current count of zero media packages for this fixture is therefore correct. No legitimate Admin dashboard statistic stopped counting an actionable package. The old expectation represented the inconsistent pre-audit behavior where the presence of three media rows could count even though Admin had no decidable package. The corrected test enforces the Product Owner principle: if Admin cannot open and decide it in Reliance Audit, it does not count as pending Reliance Audit.

## Public / Review Moderation Boundary

Unaffected. The base-to-current runtime diff for the six failing areas changed only Core Admin Audit queue metadata used to display manager attestation. Promoted listings and review moderation routes were unchanged. Their failures were isolated test-fixture omissions for already-existing stored AI recommendation lookups, plus an expired promotion date. The test-only corrections add mocks and current dates; they do not alter Core Admin Audit, Public publication, promoted listings, review moderation, or AI runtime behavior.

## Required Changes

Only test and validation-document changes were required:

- model the internal development account as `demo: true`;
- update two employee wording assertions to approved current copy;
- provide empty stored-AI result mocks in promotion and review route tests;
- use a non-expired relative campaign window;
- update Admin stats expectations to canonical actionable Reliance Audit semantics.

No application runtime, database schema, migration, Trust Score, Private/Public proof, or lifecycle behavior changed.

## Validation After Test-Only Update

- Six provenance files: **6/6 files passed; 19/19 tests passed**.
- Full repository Vitest suite: **212/212 files passed; 1061/1061 tests passed**.
- `git diff --check`: passed before the scoped commit.
- Shared beta database: not accessed or mutated.

## Git

- Core correction commit reviewed: `18b9cd706ce22cefb5779ce1061c46992e61ed9d`.
- Test-only provenance commit: reported in the Product Owner handoff after commit/push.
- Runtime files changed by provenance correction: none.
- Migration: none.

## Existing Journey 1 Defect Record

`cmt39opn40001o3fibt4bn3eq` was untouched. No application workflow or shared-beta data operation was performed.

## Deployment

Not performed.

## Next Recommended Action

Stop for Product Owner review of the test-only provenance commit and authoritative green suite before deployment approval.
