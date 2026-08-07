# RV-8 Recording Location Deadlock Correction Report

**Date:** 2026-08-06

**Repository:** `reliance-admin`

**Branch:** `codex/epic3-beta-admin-grant-correction`
**Starting commit:** `845e2473462aadfae4318724b7f508f140186e57`

## Objective

Correct only the RV-8 deadlock that prevented an assigned employee from satisfying the canonical residence location gate. Preserve the server-side requirement that recording remain locked until the saved service location is verified.

## Root Cause

The canonical server gate correctly returned `LOCATION_VERIFICATION_REQUIRED`. The employee page collected location evidence only from the stage-opening handler, but disabled every stage whenever any canonical block existed. The employee therefore could not invoke the action required to resolve the location block.

The vendor compliance page separately excluded customer residence from its location-required display, producing inconsistent guidance across the two active surfaces.

## Files Changed

| File | Change |
|---|---|
| `src/app/employee/jobs/page.tsx` | Includes customer residence in the existing employee location flow; permits a stage action only when the canonical block is `LOCATION_VERIFICATION_REQUIRED`; labels that action `Verify location to record`; names the correct residence location in guidance. |
| `src/app/vendor/jobs/page.tsx` | Includes customer residence in location-required compliance copy. |
| `e2e/epic4-recording-gates.spec.ts` | Adds a focused mobile regression proving that a residence location block can invoke verification while a declined residence remains locked. |

No database, migration, API, permission, authorization, media-session, upload, review, Trust Score, publication, or lifecycle implementation was changed.

## Security And Privacy Impact

- The canonical server decision remains authoritative.
- Recording remains locked until server-verified location evidence exists.
- Only `LOCATION_VERIFICATION_REQUIRED` becomes actionable from a stage.
- Declined, pending, expired, wrong-recipient, superseded, no-channel, certification, assignment, moderation, and lifecycle blocks remain locked.
- No client metadata overrides the server gate.

## Validation

| Command | Result |
|---|---|
| `npx vitest run` for canonical gate, certification, location, employee lifecycle, and media-session suites | 38 passed |
| Epic 4 Playwright suite | 5 passed |
| Epic 5 Playwright suite | 2 passed |
| `npx tsc --noEmit --pretty false --incremental false` | Passed |
| `git diff --check` for scoped files | Passed |
| `npm run build` with the established 8 GB heap | Blocked by pre-existing undeclared `uuid` dependency |

Playwright initially could not launch because its pinned Chromium binary was absent. `npx playwright install chromium` installed the required local test binary; the unchanged suite then passed.

## Build Blocker Classification

The starting commit contains `import { v4 as uuidv4 } from 'uuid'` in `src/app/api/admin/seed/route.ts`, but its committed `package.json` has no `uuid` dependency. This correction did not touch that route or the dependency graph. A clean production package cannot be built until that separate reproducibility defect is approved and corrected.

## Screenshot Evidence

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-05-residence-location-verification-action.png`

The screenshot shows the canonical explanation and an explicit `Verify location to record` action on each stage. It does not claim recording is unlocked before verification.

## Regression Statement

Existing permission decisions, employee certification, location distance checks, recording APIs, media-session enforcement, upload states, manager review, Private proof, Public proof, reviews, Trust Score, and lifecycle behavior were intentionally preserved.

The focused declined-residence regression proves that a non-location permission block still disables all stages and issues no protected recording request. Epic 5 upload-state regressions also remain green.

## Release Status

The code correction is locally validated but not deployed. RV-8 remains open. Required next actions are:

1. Approve and correct the separate undeclared `uuid` build dependency.
2. Build and inspect the deterministic allow-list package.
3. Deploy the corrected package to beta.
4. Repeat RV-8 on the physical device from location verification through three-stage capture and manager submission.

RV-9 and later gates remain paused.
