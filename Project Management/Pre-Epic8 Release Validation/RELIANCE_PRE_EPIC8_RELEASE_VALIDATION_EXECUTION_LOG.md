# Reliance Pre-Epic 8 Release Validation Execution Log

**Execution started:** 2026-08-05

**Plan:** `Project Management/RELIANCE_PRE_EPIC8_RELEASE_VALIDATION_PLAN.md`

**Rule:** Execute one gate at a time, preserve evidence, and stop on a mandatory failure.

## Gate RV-0 - Scope And Workspace Safety

**Result:** Pass

### Evidence

- Repository: `C:/Users/Cesar Olivera/Documents/Codex/worktrees/reliance-epic3-admin-grant`
- Branch: `codex/epic3-beta-admin-grant-correction`
- Planning checkpoint at execution start: `19d11ad7825cb24ea066eba9b03f47c724e9620f`
- Remote branch matched the planning checkpoint.
- Approved runtime source: `5b83125b3f04106c2c4a80365d906b81c1f3990f`
- Epic 4, Epic 5, Epic 6, and Epic 7 core runtime commits are ancestors of the runtime source.
- Changes after the runtime source are limited to Project Management documentation and controlled screenshot evidence.
- Frozen governing documents have no worktree modifications.
- Existing unrelated developer-worktree changes remain untouched and unstaged.
- Clean detached release worktree created at:
  `C:/Users/Cesar Olivera/Documents/Codex/release-worktrees/reliance-pre-epic8-5b83125`
- The release worktree is clean.
- Runtime-path search found no Epic 8 implementation markers.

### Scope decision

Only the clean detached worktree may be used for dependency installation, tests, builds, and package assembly. The dirty developer worktree must never be packaged.

## Gate RV-1 - Pre-Deployment Regression

**Result:** Pass

### Clean-source validation

- `npm ci`: passed; Prisma client generation completed from the committed lockfile.
- `npm audit --omit=dev --audit-level=high`: no Critical production advisory; 17 High, 7 Moderate, and 1 Low advisories remain under the previously documented dependency classifications. No dependency change was authorized or made.
- `npx prisma validate`: passed with a nonfunctional placeholder SQL Server URL because the isolated release worktree contains no environment secrets.
- `npx prisma generate`: passed.
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `npx prisma format --check`: reported committed schema formatting differences. This reproduces on the exact clean approved runtime source and is recorded as pre-existing formatting debt; the schema was not rewritten during release validation.
- Production build with `NODE_OPTIONS=--max-old-space-size=6144`: passed.
- Generated route listing: 292 route lines across the App Router and compatibility Pages Router output.
- `git diff --check`: passed.

### Automated tests

- Full Vitest run: 180 files passed, 5 files failed; 850 tests passed, 5 tests failed.
- The five failures reproduce the documented unrelated baseline in:
  - `src/lib/email-verification-enforcement.test.ts`
  - `src/lib/employee-runtime-errors.test.ts`
  - `src/lib/employee-stage-capture.test.ts`
  - `src/app/api/admin/promoted-listings/route.integration.test.ts`
  - `src/app/api/admin/reviews/moderation-queue/route.test.ts`
- Release-critical focused Vitest run: 27 files passed; 142 of 142 tests passed.
- Epic 4 and Epic 5 isolated Playwright: 6 of 6 tests passed.
- Epic 6 and Epic 7 isolated Playwright with the repository's `E2E_VISUAL_FIXTURES=1` guard: 9 of 9 tests passed.
- Epic 3 role-isolation Playwright requires seeded database fixtures and is reserved for the beta database/four-role replay gates; the focused authorization and IDOR suite passed in the 142-test release-critical run.

### Invalid attempts retained as evidence

- The first Playwright attempt stopped in global setup because the clean worktree intentionally has no `DATABASE_URL`.
- A second attempt without `E2E_VISUAL_FIXTURES=1` correctly returned 404 for protected Epic 6 and Epic 7 test-only fixture routes. The same tests passed after the documented guard was enabled.

### Evidence files outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-vitest-full.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-focused-vitest.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-playwright.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-playwright-isolated.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-playwright-epic6-7.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv1-production-build.log`

### Gate decision

The approved runtime source passes TypeScript, the production build, all release-critical focused tests, all applicable isolated Epic 4-7 browser tests, and the diff integrity check. The known full-suite failures and Prisma formatting result were not introduced by this release source and do not affect a release-critical path covered by this gate.

## Gate RV-2 - Beta Infrastructure And Recovery Preflight

**Result:** Pass

### Azure application and package

- Subscription and tenant access verified using the Product Owner's Azure account.
- App Service: `app-reliance-beta-wcus` in `rg-reliance-beta-eastus`.
- State: `Running`.
- `https://beta.relianceonline.org/api/health`: HTTP 200 with live mode.
- Mounted package: `reliance-beta-df36f11-a5-202608042023.zip`.
- Deployment marker: `df36f113d37149adab2373964663016e4cd845a6`.
- Mounted package HEAD request: HTTP 200; 67,648,302 bytes.
- Downloaded package SHA-256: `692DC79F2D063BA2FC160B7E9DEE4ABD9288D8C0A3615B29A2CC0E32C492643D`.
- Rollback package `reliance-beta-59d696f-epic3-phase-a-202608040430.zip` remains accessible in the deployment container.
- No failed resource-group activity or active application deployment was found during the one-hour preflight window. Read-only publishing-profile events initiated by this validation completed successfully.

### Database and recovery

- Azure SQL server/database: `sql-reliance-beta-wcus/reliance-beta-db`.
- Database state: `Online` on the Basic service objective.
- Earliest point-in-time restore timestamp: `2026-07-30T03:20:05.436636Z`.
- Prisma connected successfully and found 42 repository migrations.
- Exactly the five expected Epic 4-7 migrations remain pending:
  - `20260804231500_add_recording_scope_authority`
  - `20260804233000_add_recording_gate_evidence`
  - `20260805193000_add_private_service_video_evidence`
  - `20260805213000_add_exact_media_publication_evidence`
  - `20260805233000_add_media_lifecycle_evidence`

### Blob Storage

- Storage account/container: `streliancebetawcus/reliance-beta-media`.
- Container exists and is unlocked.
- A no-customer-data probe was uploaded to the controlled `release-validation/` prefix, read back as a 60-byte blob, deleted, and verified absent.
- The signed-in operator lacks Blob data-plane RBAC, so the Azure CLI used Azure's key-query path without printing or persisting the key.

### Workers, configuration, monitoring, and logs

- Logic App `logic-reliance-beta-permission-notifications` is Enabled and provisioned successfully.
- Recent five-minute worker runs are Succeeded.
- 53 App Service setting names were inventoried; values with secrets were never printed.
- HTTP logging, detailed errors, and failed-request tracing are enabled.
- App Service logs were downloaded successfully for operational evidence.
- No Application Insights resource is currently attached to the resource group; this remains operations/observability debt but does not remove the available App Service logs required by this preflight.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/current-mounted-a5.zip`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv2-appservice-logs.zip`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv2-storage-probe.txt`

## Gate RV-3 - Migration Inventory And Baseline Counts

**Result:** Pass

### Migration baseline

- Repository migrations: 42.
- Applied migrations: 37.
- Pending migrations: the exact five approved Epic 4-7 migrations recorded in RV-2.
- No unexpected migration drift was reported.

### Aggregate before-state counts

- Users: 18.
- Platform role grants: 1 ACTIVE ADMIN.
- Vendors: 6.
- Vendor memberships: 9 total across ACTIVE, PENDING, and REMOVED states.
- Legacy `Employee` rows: 0; current membership-based employee rows include 4 ACTIVE EMPLOYEE memberships.
- Device assignments: 1.
- Work records/bookings: 19 total: 4 ARCHIVED, 1 AWAITING_REVIEW, 1 CANCELED, 3 COMPLETED, and 10 PENDING.
- Permission/consent records: 6 total across ALLOWED_LEGACY, DELIVERED, PENDING, WRONG_RECIPIENT, ALLOWED, and DECLINED; 2 durable verified decision-evidence rows.
- Media sessions: 56 total: 28 ARCHIVED, 1 COMPLETED, and 27 CREATED.
- Media assets: 39 total by visibility: 10 customer-only, 26 Private, and 3 legacy Public.
- Media moderation: 18 approved, 20 pending review, and 1 rejected.
- Reviews: 1 genuine approved Public review with rating 5.
- Trust Score snapshots: 10 internal snapshots, including 1 current.

### Expected pre-migration absence

- `MediaAsset.uploadState` is not yet present and returned the expected pre-migration missing-column result.
- Recording assessment/gate evidence, Private package/access evidence, exact-media publication evidence, Public eligibility, lifecycle cases, and deletion jobs returned expected missing-table results before the approved migrations.
- No new table contained partial or unexpected data.

### Privacy boundary

Only counts and status groupings were queried. The evidence contains no name, email, phone number, token, media URL, free-text customer content, or row-level customer data.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv3-baseline-counts.cjs`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv3-baseline-counts.json`

## Gate RV-4 - Apply Approved Migrations

**Result:** Pass

### Migration execution

- Ran `prisma migrate deploy` once against the verified beta database.
- Applied exactly the five approved Epic 4-7 migrations:
  - `20260804231500_add_recording_scope_authority`
  - `20260804233000_add_recording_gate_evidence`
  - `20260805193000_add_private_service_video_evidence`
  - `20260805213000_add_exact_media_publication_evidence`
  - `20260805233000_add_media_lifecycle_evidence`
- Post-deployment status reports all 42 repository migrations applied and the schema current.
- All five migration-history rows are finished and none is rolled back.

### Schema and data verification

- All 32 expected Epic 4-7 tables were found with the expected indexes.
- The first two recording-scope migrations include the designed foreign keys. The later append-only evidence tables intentionally use no foreign keys, matching their approved SQL definitions.
- Existing aggregate counts for users, role grants, vendors, memberships, work records, permission records, media sessions, the genuine review, and Trust Score snapshots did not change.
- All 39 existing media assets were normalized to the truthful `SAVED` upload state.
- The migration inventoried three legacy raw-Public assets and narrowed all three to Private. Post-migration Public media-asset count is zero.
- The new Epic 4-7 evidence tables are present and empty; the migration did not fabricate recording, publication, lifecycle, review, rating, Trust Score, permission, or customer evidence.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv4-prisma-migrate-deploy.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv4-post-migration-counts.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv4-schema-verification.cjs`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv4-schema-verification.json`

## Gate RV-5 - Build And Inspect The Allow-List Package

**Result:** Mandatory failure - execution stopped

### Failure

- Created a new detached packaging worktree at approved runtime source commit `5b83125b3f04106c2c4a80365d906b81c1f3990f`.
- `npm ci` completed from the committed lockfile.
- The production build failed before application compilation because `postcss.config.js` requires `autoprefixer`, but neither `package.json` nor `package-lock.json` declares or installs that module.
- The clean install contains no `node_modules/autoprefixer`, and no standalone build output was produced.
- Git history shows the PostCSS configuration has referenced `autoprefixer` since the initial clean commit; the missing declaration is therefore pre-existing packaging debt, not an Epic 4-7 runtime change.
- Earlier successful builds were not reproducible from a clean lockfile-only install and must have resolved the undeclared module from a previously populated dependency environment.

### Stop decision

RV-5 requires a clean deterministic build. Installing an untracked local module would hide the dependency defect and would not create a reproducible package. Changing `package.json` or `package-lock.json` is outside this validation-only execution and requires a separately approved narrow build-dependency correction.

No package was assembled or uploaded. Azure App Service settings and the mounted package were not changed. RV-6 and all later gates were not started.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-npm-ci.log`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-production-build.log`

## Execution Resumption - 2026-08-06

The Product Owner approved resumption of the plan and added Gate RV-16, First-Time User Experience Validation. Before attempting any later gate, the existing RV-5 mandatory failure was rechecked against the exact approved runtime source `5b83125b3f04106c2c4a80365d906b81c1f3990f`.

### Blocker reconfirmation

- `postcss.config.js` still actively requires `autoprefixer`.
- Neither `package.json` nor `package-lock.json` declares `autoprefixer`.
- `npm ls autoprefixer --depth=0` in the detached RV-5 packaging worktree reports no installed package.
- The package source remains the approved commit `5b83125b3f04106c2c4a80365d906b81c1f3990f`.
- No new package was built, uploaded, mounted, or deployed.
- No Azure setting, database row, migration, Blob, worker, or application behavior was changed.

### Stop decision

RV-5 remains a mandatory failure. The approved plan prohibits continuing to RV-6 or any later gate after a mandatory failure. A separately approved, narrowly scoped build-dependency correction is required before RV-5 can be rerun. RV-16 is added to the approved sequence but has not been reached.

## Gate RV-5 Re-execution - 2026-08-06

**Result:** Pass

### Clean source and build

- Re-executed RV-5 from the beginning after Product Owner approval of the scoped build reproducibility correction.
- Created a fresh detached packaging worktree at `845e2473462aadfae4318724b7f508f140186e57`.
- Preserved every unrelated modification and untracked artifact in the active development worktree; none entered the candidate.
- `npm ci` completed from the committed dependency graph with `next@15.5.21` and declared `autoprefixer@10.4.21`.
- The production build completed successfully with the established Node heap setting.

### Allow-list package

- Package: `reliance-beta-845e247-pre-epic8-rv5-20260806180821.zip`
- Source commit: `845e2473462aadfae4318724b7f508f140186e57`
- Size: 68,049,988 bytes
- Entries: 3,349
- SHA-256: `0fe0ffe966660d58128ef9620ab6e02ab965c748dda7ce2536a0d0c00c85e55f`
- Allowed roots exactly match the previously approved mounted package shape: `.next`, `node_modules`, `package.json`, `public`, and `server.js`.
- The ZIP contains no `.env*`, Git metadata, root source tree, root tests, project reports, screenshots, `.next/cache`, source maps, or logs.
- The content scan found no confirmed secret. One AWS-key-shaped candidate was a false positive inside Next's compiled AMP validator WebAssembly payload.

### Exact-ZIP and remote verification

- Extracted all 3,349 entries from the exact ZIP.
- Started `server.js` from that extraction and received HTTP 200 from the homepage.
- Uploaded the unique package to the private `deployments` container in `streliancebetawcus`.
- Entra data-plane upload was unavailable because the operator lacks a Storage Blob Data role. Azure CLI management-plane storage-key retrieval was used without printing or persisting the key.
- Downloaded the remote blob and recomputed SHA-256.
- Local and remote hashes match byte-for-byte: `0fe0ffe966660d58128ef9620ab6e02ab965c748dda7ce2536a0d0c00c85e55f`.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/`
- `C:/Users/Cesar Olivera/Documents/Codex/release-packages/pre-epic8/reliance-beta-845e247-pre-epic8-rv5-20260806180821.zip`

RV-5 passed. Sequential execution may proceed to RV-6.

## Gate RV-6 - Mount The Cumulative Package

**Result:** Pass

- Mounted `reliance-beta-845e247-pre-epic8-rv5-20260806180821.zip` on `app-reliance-beta-wcus` using the direct Azure Resource Manager setting-update path.
- Updated only `WEBSITE_RUN_FROM_PACKAGE`, `DEPLOYED_PACKAGE`, and `DEPLOYED_COMMIT`.
- Preserved all 53 App Service settings; all 50 non-deployment values matched exactly before and after the mount.
- Deployment markers identify commit `845e2473462aadfae4318724b7f508f140186e57` and the intended package.
- App Service state is `Running`; the homepage returned HTTP 200.
- Azure startup evidence reports Next.js `15.5.21`, `Ready` in 1,471 ms, successful database connection to `reliance-beta-db`, active Blob connection-string mode, and successful warmup.
- `prisma migrate status` reports all 42 repository migrations applied and the database schema current.
- No schema, secret, or configuration startup error was observed.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv6-mount-result.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv6-appservice-logs.zip`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv6-prisma-migrate-status.log`

RV-6 passed. Sequential execution may proceed to RV-7.

## Gate RV-7 - Immediate Smoke And Monitoring

**Result:** Pass

### Route and authorization smoke

- Confirmed HTTP 200 for the homepage, Explore Proof, Support, Notifications, login, email-verification entry, customer dashboard shell, vendor dashboard shell, employee assigned-work shell, admin dashboard shell, and image optimizer.
- Confirmed the schema-health endpoint rejects an unauthenticated request with 401.
- Confirmed protected customer, vendor, employee, and lifecycle APIs reject anonymous access with 401, while protected admin APIs reject it with 403.
- Confirmed direct unauthenticated calls to both the notification worker and lifecycle worker return 401.
- Confirmed the public discovery API exposes no Private or Customer Only media and no raw media URL. No Public-eligible media currently exists in beta after the approved migration narrowing.
- Confirmed the image optimizer returned HTTP 200 with an image response.

### Signed-in role surfaces

- Verified the customer dashboard, vendor dashboard, employee assigned-work view, admin dashboard, admin publication moderation, admin media lifecycle queue, and admin Recording Permission Audit in isolated general and path-scoped admin sessions.
- Confirmed the dedicated admin session remained active after traversing the general customer, vendor, and employee surfaces, matching the approved separate-session design.
- No cross-role data or admin capability appeared on an unauthorized surface.

### Workers and monitoring

- Confirmed the beta permission-notification Logic App remains enabled on its five-minute recurrence and recorded a successful post-deployment run.
- Collected 31 health samples from `2026-08-06T22:48:01.6712173Z` through `2026-08-06T23:18:16.2106076Z` (30.24 minutes).
- Homepage and `/api/health` returned 200 in every sample. The monitor recorded zero failures.
- App Service remained `Running`; no post-deployment database-schema error, startup failure, worker failure, or HTTP-health failure was observed.

### Operational observation

- The first image-optimizer request after deployment served successfully but logged a failed attempt to create `.next/cache` inside the read-only run-from-package mount. The response remained HTTP 200 and no later monitor failure occurred. This is retained as a non-blocking operational performance observation for release hardening; it did not prevent image delivery.
- The only other post-deployment error-like entry was the expected unauthorized admin-stats probe performed by this gate.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-route-smoke.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-api-isolation-and-filtering.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-notification-worker-schedule.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-30-minute-health.csv`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-30-minute-health-summary.json`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv7-post-monitor-appservice-logs-20260806191924.zip`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/`

RV-7 passed. Sequential execution may proceed to RV-8.

## Gate RV-8 - Epic 5 Physical-Device Replay

**Result:** Fail - mandatory release gate; sequential execution stopped

### Completed steps

- Used a controlled synthetic customer, assigned employee, work record, and customer-residence assessment.
- Confirmed the secure permission request was delivered and the customer selected Allow.
- Confirmed the resulting permission is current, verified, and `ALLOWED`.
- Confirmed the employee received and opened the released service-order link.
- Confirmed the first canonical block correctly required employee recording-scope certification and identified the employee and resolving action.
- Completed the employee certification for the current assessment.

### Mandatory failure

After certification, the employee page changed to `LOCATION_VERIFICATION_REQUIRED` and disabled all three stage cards. The only normal location-verification call is initiated from the stage-opening handler, but the same page disables every stage while the canonical gate reports recording locked. The employee therefore cannot perform the action required to resolve the block.

The state is also inconsistent across active product surfaces:

- The active vendor assessment UI indicates location verification is not required for the selected location, contrary to the frozen workflow requirement that location verification apply across all three location selections.
- The vendor surface reports the permission as verified and the work record ready to record.
- The employee surface reports recording locked because location has not been verified.

The beta database confirms:

- current assessment `COMPLETE`, location `residence`;
- current permission `ALLOWED` with verified decision;
- active employee certification for the current assessment;
- zero location attempts and zero location exceptions;
- repeated canonical metrics for `LOCATION_VERIFICATION_REQUIRED` after certification;
- zero allowed recording-gate decision evidence;
- zero saved media assets in the existing empty sessions.

### Classification and stop decision

- Classification: release-blocking application workflow deadlock and canonical-gate/UI inconsistency. The canonical requirement must remain; the employee needs an actionable path to satisfy it.
- Impact: Starting Condition, Work in Progress, and Final Result cannot be opened, so physical capture and the remainder of RV-8 cannot be completed.
- User error: none identified; the approved on-screen steps were followed.
- Application changes: none made.
- RV-9 through RV-16: not started.

Per the approved stop condition, release validation stopped at RV-8 pending Product Owner approval of a narrowly scoped correction.

### Evidence outside the repository

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/rv8-controlled-state-evidence.md`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-01-employee-service-order-email.png`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-02-employee-certification-required.png`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-03-location-deadlock-all-stages-locked.png`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-04-vendor-ready-to-record-inconsistent.png`

## RV-8 Approved Correction Checkpoint

**Implementation result:** Corrected and locally validated

The approved correction preserves the canonical residence location requirement and removes the employee-page deadlock:

- A stage remains unavailable for every non-location canonical block, including declined permission.
- When the only canonical block is `LOCATION_VERIFICATION_REQUIRED`, each stage exposes `Verify location to record`.
- Selecting a stage invokes the existing employee geolocation and server-side `/verify-location` flow before camera access.
- Residence location guidance now names the customer residence rather than the vendor address.
- The vendor compliance view now truthfully states that customer residence requires both recording permission and location verification.

### Local validation

- Canonical gate, certification, employee lifecycle, location verification, and media-session integration tests: 38 passed.
- Epic 4 Playwright: 5 passed, including the new resolvable residence-location state and the existing declined-residence lock.
- Epic 5 Playwright: 2 passed.
- TypeScript: passed.
- `git diff --check` for scoped files: passed.
- Production build: blocked by an unrelated starting-commit defect. `src/app/api/admin/seed/route.ts` imports `uuid`, while `package.json` at starting commit `845e2473462aadfae4318724b7f508f140186e57` does not declare that dependency. The correction did not change the seed route, `package.json`, or the lockfile.

### Release status

The correction is not yet deployed. RV-8 remains incomplete until the existing build dependency defect receives separate Product Owner approval, a deterministic package is built and mounted, and the physical-device replay confirms that successful location verification opens capture.

### New evidence

- `Project Management/Pre-Epic8 Release Validation/RV8_RECORDING_LOCATION_DEADLOCK_CORRECTION_REPORT.md`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-rerun-845e247/screenshots/rv8-05-residence-location-verification-action.png`

## RV-8 Controlled Deployment Retry - 2026-08-12

**Result:** Fail - mandatory deployment safety gate; candidate not mounted and RV-8 remains paused

### Passed before Azure mutation

- Approved commit `970cd10f34684dbf1299ff0324e0716e5011f19f` was pushed and reproduced from a clean detached worktree.
- The production-only dependency audit reported zero Critical advisories.
- The production build passed.
- Two deterministic allow-list builds produced the same 69,951,193-byte package and SHA-256 `11d341d77db85cce9c8552f5614b3ef0eeb64bc8453ba7cfeabaa9cc95e51491`.
- The package passed forbidden-entry, secret-material, internal dependency-resolution, read-only-root startup, homepage, health, and repeated image-optimizer validation.
- Remote upload/download hash verification passed.
- The settings dry run retrieved all 53 settings, selected exactly the three approved deployment keys, and preserved every unrelated value.

### Mandatory failure

The scoped settings apply path did not transmit the complete SAS-bearing package URL. Azure CLI parsed `&` separators in the `KEY=VALUE` argument and persisted only the first query parameter. This produced a 403 package reference and a partial approved-setting update: the run-from-package value changed while the commit and package markers remained on the rollback values.

The candidate package was not validated or classified as mounted. Immediate candidate smoke and physical-device RV-8 replay were not started.

### Recovery and current state

- Restored the known-good rollback package reference using scoped JSON-file input.
- Preserved all 53 App Settings and all unrelated setting fingerprints.
- Confirmed rollback commit `90a21ab3e6f8ef3b78d319fb9533aea491369466` and package `reliance-beta-90a21ab-homepage-20260811225759.zip`.
- Confirmed the App Service is Running.
- All 20 bounded recovery probes passed across the custom and Azure hostnames: five homepage and five `/api/health` requests per hostname.

RV-8 remains paused pending Product Owner approval of a narrowly scoped settings-transport correction. RV-9 and Epic 8 remain unstarted.

### Evidence

- `Project Management/Pre-Epic8 Release Validation/RV8_CONTROLLED_DEPLOYMENT_RETRY_INCIDENT_REPORT.md`
- `C:/Users/Cesar Olivera/Documents/Codex/release-packages/pre-epic8/reliance-beta-970cd10-rv8-deployment-retry-20260812125040-1.zip`
- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv8-deploy-970cd10/`
