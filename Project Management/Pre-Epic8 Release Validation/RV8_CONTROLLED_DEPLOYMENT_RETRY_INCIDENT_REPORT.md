# RV-8 Controlled Deployment Retry Incident Report

**Date:** 2026-08-12
**Approved source commit:** `970cd10f34684dbf1299ff0324e0716e5011f19f`
**Branch:** `codex/rv8-residence-location-correction`
**Result:** Stopped before candidate mount validation; beta recovered to the known-good rollback package

## Scope

This checkpoint attempted only the approved RV-8 deployment retry. No application behavior, database schema, migration, or dependency was changed. RV-9 and Epic 8 were not started.

## Provenance And Security Preflight

- Pushed the approved commit and verified the remote branch resolves to the exact commit.
- Created a fresh detached deployment worktree at the approved commit and confirmed it was clean.
- Confirmed `a82b15aff45a917ed4860184d0a2cc326ec86191` is an ancestor.
- `npm ci` passed from the committed dependency graph.
- `npm audit --omit=dev` reported **0 Critical** production advisories. Remaining production findings were 18 High, 7 Moderate, and 1 Low; no dependency remediation was performed in this checkpoint.
- The production build passed with Next.js 15.5.21.

## Deterministic Package Evidence

- Candidate: `reliance-beta-970cd10-rv8-deployment-retry-20260812125040.zip`
- Entries: 3,349
- Size: 69,951,193 bytes
- SHA-256: `11d341d77db85cce9c8552f5614b3ef0eeb64bc8453ba7cfeabaa9cc95e51491`
- Two independent builds produced the same SHA-256.
- `server.js` and `node_modules/next/package.json` are direct ZIP-root entries.
- No entry starts with `./`; there are no directory records, traversal paths, absolute paths, source trees, tests, reports, screenshots, `.env*`, `.next/cache`, source maps, Git metadata, detected private keys, detected storage connection values, or detected SAS URLs.

## Exact-ZIP Validation

- Extracted outside all Git worktrees.
- `require.resolve('next')` resolved inside the extracted package with `NODE_PATH` empty.
- The package started with `NODE_ENV=production` from a write-denied application root.
- Homepage returned 200.
- `/api/health` returned 200.
- Five consecutive image optimizer requests returned 200 with identical image sizes.
- No `.next/cache` directory was created.
- No image-cache `ENOENT`, cache-write failure, or unhandled rejection was observed.

## Upload And Dry Run

- Uploaded to the approved private `deployments` container.
- Generated a read-only HTTPS package reference expiring in 2031.
- Downloaded the remote package and recomputed SHA-256.
- Remote SHA-256 exactly matched the local SHA-256.
- The App Settings dry run retrieved all 53 settings and selected exactly:
  - `WEBSITE_RUN_FROM_PACKAGE`
  - `DEPLOYED_COMMIT`
  - `DEPLOYED_PACKAGE`
- The dry run reported all unrelated settings preserved.

## Mandatory Deployment Failure

The scoped apply operation failed and left a partial approved-setting mutation:

- `WEBSITE_RUN_FROM_PACKAGE` changed to the candidate blob path.
- `DEPLOYED_COMMIT` and `DEPLOYED_PACKAGE` remained on the known-good rollback values.
- The stored candidate reference returned 403.

Inspection proved that the Azure CLI `--settings KEY=VALUE` invocation parsed the SAS URL at `&` separators and persisted only the first query parameter. The package itself remained valid; the defect is in the settings-application transport used by `scripts/release/update_azure_package_settings.py`.

This checkpoint stopped before candidate health, immediate smoke, or physical-device RV-8 replay.

## Recovery

- Restored only `WEBSITE_RUN_FROM_PACKAGE` to a fresh valid reference for the approved rollback ZIP using Azure CLI JSON-file input so the complete value remained intact.
- Removed the temporary input file immediately after the call.
- Confirmed 53 settings before and after recovery.
- Confirmed every unrelated setting fingerprint was preserved.
- Confirmed rollback markers remain:
  - Commit: `90a21ab3e6f8ef3b78d319fb9533aea491369466`
  - Package: `reliance-beta-90a21ab-homepage-20260811225759.zip`
- Confirmed the rollback package reference returns 200 and 69,880,534 bytes.
- Confirmed App Service state is Running.
- Ran five consecutive homepage probes and five consecutive health probes against each hostname. All 20 probes passed:
  - `https://beta.relianceonline.org`
  - `https://app-reliance-beta-wcus.azurewebsites.net`

## Current State

- Beta remains on the known-good rollback package.
- The candidate package is uploaded but is not mounted.
- No candidate smoke test or physical-device replay was attempted.
- RV-8 remains paused.
- RV-9 and Epic 8 remain unstarted.

## Required Next Decision

The deployment retry must not resume until Product Owner approval is given for a narrowly scoped correction to the settings updater so package URLs containing SAS query separators are transmitted atomically. The corrected path must retain the existing 53-setting preservation checks and must be validated without touching beta before another controlled deployment attempt.
