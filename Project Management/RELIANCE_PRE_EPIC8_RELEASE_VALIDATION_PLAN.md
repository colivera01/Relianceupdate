# Reliance Pre-Epic 8 Release Validation Plan

**Status:** Planning only - Product Owner execution approval required

**Prepared:** 2026-08-05

**Target environment:** Reliance controlled beta

**Azure App Service:** `app-reliance-beta-wcus`

**Azure resource group:** `rg-reliance-beta-eastus`

**Beta database:** `reliance-beta-db`

## 1. Purpose

Complete the shared deployment and operational release gates for the following frozen engineering epics before Trust Score implementation begins:

- Epic 5 - Safe Capture Through Private Service Videos
- Epic 6 - Exact-Media Public Proof and Admin Moderation
- Epic 7 - Withdrawal, Disputes, Retention and Final Disposition

This checkpoint validates the cumulative customer experience from authorized recording through Private proof, optional exact-media Public proof, withdrawal, restriction, retention, and verified final disposition.

The efficient and safer release shape is one migration-first deployment of the cumulative approved application, followed by one connected operational replay. Three separate application deployments would repeat risk without improving evidence because Epic 6 depends on Epic 5 and Epic 7 depends on both.

## 2. Scope Boundary

### Included

1. Release-candidate and dependency verification for the cumulative Epic 4-7 runtime.
2. Beta restore-readiness verification before database work.
3. Application of already-approved pending additive migrations.
4. Deterministic allow-list package construction and inspection.
5. One controlled beta application deployment.
6. Startup, health, route, authorization, and monitoring checks.
7. Physical-device recording and upload replay.
8. Private Service Video evidence-chain replay.
9. Exact-media Public proof and moderation replay.
10. Live Azure Blob upload, playback, restriction, deletion, and absence verification.
11. Public and direct-link cache invalidation validation.
12. Lifecycle worker scheduling, authentication, retry, and alert validation.
13. Signed-in customer, vendor manager, assigned employee, and admin replay.
14. Evidence reports, screenshots, checklist evidence, and release decision.

### Excluded

- Epic 8 application implementation or Trust Score recalculation.
- New application code or behavior changes.
- New or rewritten migrations.
- Changes to frozen governing documents.
- Review, rating, Trust Score, AI, notification-language, or legal redesign.
- Telnyx handset certification, which remains `Deferred - External Provider Dependency`.
- Real customer, vendor, employee, or service data.
- Broad secret rotation or unrelated Azure configuration changes.

If validation identifies an application defect, this checkpoint stops. The defect must receive a separately scoped correction and Product Owner approval before deployment resumes.

## 3. Current Verified Baseline

| Item | Current evidence | Execution requirement |
|---|---|---|
| Deployed beta application | A5 package `reliance-beta-df36f11-a5-202608042023.zip`; source commit `df36f113d37149adab2373964663016e4cd845a6` | Reconfirm the mounted package and hash directly from Azure before changes. |
| Database | A5 report records 37 applied migrations | Run `prisma migrate status` against `reliance-beta-db`; documentation is not a substitute for current state. |
| Epic 4 runtime | Approved checkpoint `98c50ae727839d353f0eb357b39ca5c5761bf7ac` | Required prerequisite for Epic 5 recording evidence. |
| Epic 5 runtime | Approved checkpoint `dcf634739b9d0aa726a2916b82862cc11ecb0f82` | Must preserve complete Private evidence chain and truthful upload states. |
| Epic 6 runtime | Approved checkpoint `d6edf5cee81b11d9c1eb9fc5ee9bbbe4fbe96e5d` | Must preserve immutable exact-media approval and fail-closed Public serving. |
| Epic 7 runtime | Core `27fa324ddab3e39222d30b470b2fc42b643ff604`; retention integration `5b83125b3f04106c2c4a80365d906b81c1f3990f` | `5b83125` is the proposed runtime release source, subject to final ancestry and tree verification. |
| Packaging | Deterministic allow-list packaging was validated for Epic 3 and A5 | Rebuild from a clean isolated worktree; never package the dirty developer worktree or raw `.next/standalone`. |
| Notification worker | Existing beta Logic App and synchronized internal worker secret were validated previously | Preserve the secret and existing notification schedule; add/validate lifecycle invocation without exposing the value. |
| Epic 8 | Plan approved, implementation deferred | No Epic 8 code, migration, score changes, or dashboard work may enter this checkpoint. |

## 4. Release-Candidate Provenance

The proposed application source is commit:

`5b83125b3f04106c2c4a80365d906b81c1f3990f`

It includes the approved runtime sequence:

`98c50ae` Epic 4 -> `dcf6347` Epic 5 -> `d6edf5c` Epic 6 -> `27fa324` Epic 7 -> `5b83125` retention integration

Later commits currently visible on the branch are documentation/evidence checkpoints. Before execution:

1. Verify all five runtime commits are ancestors of the release source.
2. Compare `5b83125..current-approved-branch`.
3. Confirm no later runtime, dependency, schema, configuration, or package-builder change is required.
4. Create a clean isolated worktree at the selected source commit.
5. Build and package only from that clean worktree.
6. Record the source commit and full ZIP SHA-256 in the deployment report.

If a later runtime change is found, stop and classify it. Do not silently move the release source.

## 5. Expected Migration Set

The repository contains 42 migration files. The A5 deployment report records 37 applied migrations. The expected pending set is therefore five approved migrations, subject to live verification:

| Order | Migration | Ownership | Required result |
|---:|---|---|---|
| 1 | `20260804231500_add_recording_scope_authority` | Epic 4 prerequisite | Scope assessment and authority evidence available. |
| 2 | `20260804233000_add_recording_gate_evidence` | Epic 4 prerequisite | Canonical recording-gate evidence available. |
| 3 | `20260805193000_add_private_service_video_evidence` | Epic 5 | Upload attempts, content identity, package versions, manager decisions, and Private access evidence available. |
| 4 | `20260805213000_add_exact_media_publication_evidence` | Epic 6 | Exact-media proposals, participant decisions, admin decisions, eligibility, and legacy restrictions available. |
| 5 | `20260805233000_add_media_lifecycle_evidence` | Epic 7 | Withdrawal, dispute, restriction, hold, retention, deletion, appeal, and lifecycle audit evidence available. |

### Migration rules

- Do not edit, replace, squash, or regenerate these migrations.
- Do not continue if the live pending set differs from the expected set.
- Record migration table state and relevant row counts before and after.
- Confirm the target is `reliance-beta-db`, not a local or production database.
- Confirm point-in-time restore capability and record the recovery reference without exposing credentials.
- Use `prisma migrate deploy`; do not use `migrate dev`, schema push, or manual DDL.
- Apply migrations before mounting the new package.
- Do not fabricate evidence for legacy media where the implementation intentionally records `LEGACY_UNKNOWN` or restricts legacy Public state to Private.

## 6. Test Data And Account Controls

Use only controlled beta fixtures:

- one dedicated customer account;
- one dedicated vendor-manager account;
- one dedicated assigned-employee account;
- one dedicated database-granted admin account;
- synthetic names, addresses, work descriptions, and contact details;
- synthetic videos that contain no real customer, home, plate, document, credential, face, or voice;
- a dedicated Azure Blob prefix/container path that can be inventoried and deleted safely.

Use isolated browser profiles or separate browser contexts for each role. Never test multiple identities in ordinary tabs that share one browser session.

Reports and screenshots must not contain passwords, OTPs, raw tokens, SAS query strings, connection strings, internal worker secrets, or private customer data.

## 7. Execution Gates

The gates must run in order. A failure stops all later gates unless the plan explicitly calls for a safe retry.

### Gate RV-0 - Scope And Workspace Safety

**Objective:** Prove the release starts from approved, reproducible inputs.

Actions:

1. Record repository, branch, selected source commit, remote state, and current beta package.
2. Preserve unrelated developer worktree changes without staging or modifying them.
3. Create a clean release worktree at the approved source commit.
4. Confirm frozen documents are unchanged.
5. Confirm no Epic 8 implementation is present.
6. Confirm the release package builder is the deterministic allow-list path previously validated.

**Pass:** The release source is exact, clean, pushed, and reproducible.

**Stop:** Unapproved runtime differences, missing commits, dirty release worktree, or uncertain source provenance.

### Gate RV-1 - Pre-Deployment Regression

**Objective:** Reprove the cumulative application before touching beta.

Run from the clean release worktree:

- clean dependency installation using the committed lockfile;
- Prisma format check, validation, and client generation;
- TypeScript;
- production build with the established Node heap setting;
- Epic 1 permission regression;
- Epic 2 public-shell regression;
- Epic 3 authorization/IDOR/session-isolation regression;
- Epic 4 canonical recording-gate regression;
- Epic 5 Private proof and upload-state regression;
- Epic 6 publication and public-serving regression;
- Epic 7 lifecycle, deletion, and worker regression;
- applicable Playwright suites;
- `git diff --check`.

Record actual commands, counts, skips, and failures. A known baseline failure may be classified only with evidence that the release candidate did not introduce it.

**Pass:** TypeScript and production build pass; all release-critical focused suites pass; no new regression is present.

### Gate RV-2 - Beta Infrastructure And Recovery Preflight

**Objective:** Confirm the environment can be changed and recovered safely.

Verify:

- App Service is `Running`;
- `/api/health` returns HTTP 200;
- current mounted package URL, name, source marker, and hash;
- beta database identity and connectivity;
- point-in-time restore capability;
- current migration state;
- Azure Blob container connectivity using the controlled test prefix;
- existing notification Logic App state;
- App Service settings are inventoried by name only;
- rollback package remains accessible;
- monitoring and logs are available;
- no active incident or concurrent deployment exists.

**Pass:** Recovery, rollback, database, storage, monitoring, and current-package evidence are all available.

### Gate RV-3 - Migration Inventory And Baseline Counts

**Objective:** Create before-state evidence and detect drift.

Record counts for at least:

- users and active role grants;
- vendors and vendor memberships;
- employees and assignments;
- work records/bookings;
- permission requests and decisions;
- media sessions and assets by visibility/moderation state;
- reviews and ratings;
- Trust Score snapshots/outcomes;
- publication-related tables if already present;
- lifecycle-related tables if already present.

Record the migration status and expected five pending migrations. Do not include private row content in the report.

**Pass:** Counts are internally consistent and migration drift is absent.

### Gate RV-4 - Apply Approved Migrations

**Objective:** Bring the beta schema to the cumulative Epic 4-7 state before application mount.

Actions:

1. Run `prisma migrate deploy` once against the verified beta database.
2. Re-run `prisma migrate status`.
3. Confirm all 42 repository migrations are applied, unless the verified repository count changes before execution.
4. Verify new tables, indexes, foreign keys, and expected enum values.
5. Reconcile pre/post counts.
6. Confirm Epic 6 legacy raw-Public rows are inventoried and narrowed to Private exactly as designed.
7. Confirm no review, rating, Trust Score input, permission decision, or customer activity was invented.

**Pass:** Migration state is current and all data transformations match approved migration intent.

**Stop:** Partial migration, drift, unexpected destructive change, fabricated evidence, unexpected Public exposure, or unexplained count loss.

### Gate RV-5 - Build And Inspect The Allow-List Package

**Objective:** Produce a deterministic, secret-free runtime package.

Actions:

1. Build from the clean approved source.
2. Assemble only approved standalone runtime roots, public assets, and `.next/static` assets.
3. Reject `.env*`, Git metadata, source trees, tests, reports, screenshots, temporary files, caches, logs, source maps unless explicitly approved, and local deployment artifacts.
4. Scan entry names and file content for credential patterns without printing matched secret values.
5. Run exact-ZIP startup and route checks.
6. Record package name, size, entry count, source commit, and SHA-256.
7. Upload to the approved private deployment container.
8. Download and compare the remote blob SHA-256 byte-for-byte.

**Pass:** Local and remote hashes match and package inspection finds no secret-bearing or unrelated artifacts.

### Gate RV-6 - Mount The Cumulative Package

**Objective:** Deploy the approved Epic 5-7 cumulative runtime once.

Actions:

1. Preserve all existing App Service settings.
2. Update only the run-from-package reference and approved deployment markers.
3. Use the direct ARM/allow-list process that avoids shell parsing of SAS query strings.
4. Restart the App Service.
5. Confirm `Running`, startup logs, package marker, and mounted source commit.
6. Verify database status is still current.

**Pass:** The intended package is mounted and the application starts without schema, secret, or configuration errors.

### Gate RV-7 - Immediate Smoke And Monitoring

Verify these surfaces before workflow data is created:

- homepage and Explore Proof;
- Support and Notifications;
- customer dashboard and My Service Records;
- vendor dashboard and Manage Jobs;
- employee assigned-work view;
- admin dashboard, publication moderation, and media lifecycle queue;
- permission request and OTP pages;
- notification worker authentication;
- lifecycle worker unauthorized rejection;
- image optimizer;
- direct-route role isolation;
- Private/Public media filtering.

Monitor health, startup/runtime logs, HTTP error rates, database errors, worker failures, and App Service state for at least 30 minutes. Continue monitoring through the connected role replay.

### Gate RV-8 - Epic 5 Physical-Device Replay

Run on at least one supported Android phone and one supported iPhone when available. For each device:

1. Open the assigned employee work-record link.
2. Verify the canonical gate explains any block reason, responsible participant, and resolving action.
3. Complete location and employee requirements using a controlled valid fixture.
4. Record Starting Condition, Work in Progress, and Final Result.
5. Verify visible recording state and stage duration limits.
6. Confirm and save each stage.
7. Verify truthful states: `Uploading`, `Saved`, `Retry Required`, or `Rejected`.
8. Simulate a recoverable network interruption without deleting the local draft.
9. Refresh/reopen and retry the upload.
10. Confirm duplicate retry does not create duplicate canonical media.
11. Submit the package to the manager.
12. Have the manager request one stage correction; replace it and resubmit.
13. Approve the complete package.
14. Confirm the verified customer can see all approved Private stages.
15. Confirm unrelated customers, vendors, employees, and anonymous users cannot access it.

Evidence-chain query must connect:

Work Record -> Assessment Generation -> Permission Evidence -> Recording Gate Decision -> Employee -> Capture -> Package Version -> Manager Decision -> Customer Access

**Pass:** No customer-visible Private Service Video exists if any required link is missing or inconsistent.

### Gate RV-9 - Epic 6 Exact-Media Public Proof Replay

Using the approved Private package:

1. Vendor proposes Final Result only by default.
2. Customer previews the exact selected media and chooses all, some, none/Private, and correction in controlled scenarios.
3. Obtain applicable employee likeness/audio decision only where required.
4. Record vendor representation approval.
5. Confirm incomplete or stale chains cannot enter admin approval.
6. Admin approves one complete exact-media proposal.
7. Confirm only the approved exact version appears on Explore Proof, service detail, vendor public profile, and approved direct route.
8. Replace or presentation-edit the approved media.
9. Confirm old eligibility becomes invalid and the changed version requires a new complete chain.
10. Confirm no raw legacy `public` flag can authorize serving.

Publication chain query must connect:

Recording Evidence -> Private Package -> Customer Decision -> Applicable Participant Decisions -> Vendor Representation Approval -> Admin Moderation -> Public Service Video

**Pass:** Any missing, stale, revoked, superseded, or inconsistent link prevents Public serving.

### Gate RV-10 - Epic 7 Lifecycle Replay

Using controlled Private and Public fixtures:

1. Customer withdraws Public approval.
2. Confirm Public listing and direct media access stop immediately while authorized Private access remains.
3. Refresh, close, and reopen the browser; confirm state remains narrowed.
4. Assigned employee withdraws applicable likeness authority; confirm only the required scope is restricted.
5. Vendor opens a controlled dispute; confirm public/direct reads fail closed.
6. Admin reviews the case, applies and releases an exact-scope hold, and records a neutral decision.
7. Request deletion and confirm truthful status begins as Requested/Restricted, not Deleted.
8. Exercise a forced provider failure; confirm Retry Required or Failed, never Completed.
9. Run a successful controlled purge.
10. Independently query Azure Blob Storage and confirm absence.
11. Only after verified absence, confirm deletion state becomes Completed.
12. Confirm audit, withdrawal, decision, attempt, and final-disposition evidence remains.
13. Confirm exposure never increases automatically during any transition.

**Pass:** The canonical lifecycle resolver always chooses the least-exposure valid outcome and all lifecycle labels are truthful.

### Gate RV-11 - Cache And Direct-Link Validation

For the controlled Public asset:

1. Open listing, page, API, redirect, direct media route, and generated signed URL before withdrawal.
2. Record response status and cache headers without storing the SAS query string.
3. Withdraw or invalidate eligibility.
4. Repeat in the original browser, a private browser, a fresh browser, and a direct HTTP client.
5. Confirm no stale Public page or media route serves the asset.
6. Confirm previously issued short-lived SAS access expires within its configured lifetime and no new SAS is issued.
7. Repeat after media replacement and after lifecycle restriction.
8. Confirm Private routes remain `private, no-store` and ownership-protected.

**Pass:** Canonical read-time eligibility wins over stale page/application caches, and invalid assets cannot receive a fresh serving URL.

### Gate RV-12 - Lifecycle Worker Scheduling

The worker route is:

`POST /api/internal/media-lifecycle/process`

Requirements:

1. Reuse the synchronized `INTERNAL_NOTIFICATION_WORKER_SECRET`; do not expose or rotate it unless a separate operational approval requires rotation.
2. Verify missing/wrong secret returns 401 and configured absence returns 503.
3. Configure or extend the beta scheduler with a secure parameter and an explicit lifecycle action.
4. Do not disturb the existing notification-worker action.
5. Use the approved beta recurrence; if no cadence is currently approved, use a proposed five-minute beta cadence only after Product Owner confirmation.
6. Verify one successful zero-work run.
7. Verify one controlled due-retention run.
8. Verify one retryable deletion run and its later retry.
9. Confirm duplicate worker delivery is idempotent.
10. Confirm the worker cannot create holds, decide disputes, broaden access, or infer authority.
11. Configure failure visibility/alerting and record the operational owner.
12. Observe multiple scheduled runs and confirm Azure reports success.

**Pass:** Due work advances safely; unauthorized calls fail; failures remain visible and retryable; the scheduler never changes policy decisions.

### Gate RV-13 - Four-Role Signed-In Replay

| Role | Required validation |
|---|---|
| Customer | Private proof access; exact-media decision; keep Private; Public withdrawal; deletion request; dispute/status; no vendor, employee, or admin access. |
| Vendor manager | Work-record/package review; correction request; Private approval; publication proposal and representation decision; lifecycle status; no customer or admin authority. |
| Assigned employee | Assigned recording only; truthful upload/retry; correction; applicable likeness decision; withdrawal status; no manager, customer, or admin authority. |
| Admin | Publication moderation and lifecycle case administration from complete evidence; no invention of consent, participant approval, review, rating, or Trust Score input. |

For every role, test direct URLs, browser refresh, logout/login, wrong-account access, and one concurrent isolated session. Record expected 401, 403, 404, or blocked UX without revealing whether inaccessible records exist.

### Gate RV-14 - Side-Effect And Evidence Reconciliation

Compare post-replay counts and exact records against the RV-3 baseline.

Confirm the release created no unauthorized:

- review;
- rating;
- Trust Score input or recalculation;
- recording permission;
- publication approval;
- Public eligibility;
- synthetic customer activity;
- duplicate media/package/access record;
- deletion-completed claim before blob absence.

Confirm all consequential actions have actor, role, work record, exact media identity/version/hash, prior/resulting state, timestamp, and request context without raw secrets.

### Gate RV-15 - Final Monitoring And Decision

After the final consequential action, monitor for at least 30 additional minutes:

- `/api/health`;
- App Service state;
- HTTP 5xx and authorization failures;
- database/migration errors;
- Azure Blob errors;
- worker failures and retry backlog;
- unexpected Public serving;
- notification worker regressions.

Classify every gate as Pass, Fail, Blocked, or Deferred External Dependency. Epic 8 may begin only after all mandatory gates pass and the Product Owner approves the closeout.

## 8. Blob Validation Matrix

| Scenario | Expected database state | Expected Blob state | User-visible result |
|---|---|---|---|
| Upload in progress | Attempt is `UPLOADING` | Blob may be incomplete/not yet verified | Uploading |
| Verified upload | Attempt/media is saved with content identity | Blob exists and properties can be read | Saved |
| Recoverable failure | Attempt is retryable; canonical media unchanged | Prior verified blob preserved; failed candidate may be absent | Retry Required |
| Rejected stage | Rejection/correction evidence retained | Existing version retained but not approved for package | Rejected |
| Private proof | Customer access grant and approved package complete | Blob exists | Authorized customer/vendor access only |
| Public proof | Active exact-version eligibility complete | Blob exists | Public route serves only approved exact version |
| Public withdrawal | Eligibility invalid; Private/lifecycle state recalculated | Blob may remain | Public denied immediately |
| Deletion requested | Requested/Restricted/Queued | Blob may remain | Not represented as deleted |
| Provider failure | Retry Required or Failed | Blob may remain | Retry/failure shown truthfully |
| Verified deletion | Completed only after independent absence check | Blob absent | Deleted/final disposition shown |

## 9. Cache Validation Matrix

| Surface | Before eligibility | While valid | After withdrawal/restriction/version change |
|---|---|---|---|
| Explore Proof | No item | Exact approved item only | Item absent |
| Vendor public profile | No item | Exact approved item only | Item absent |
| Service detail | No Public playback | Exact approved item only | No Public playback |
| Public media API | Denied/not found | Authorized public response | Denied/not found |
| Direct media redirect | No signed URL | Short-lived read URL | No new signed URL |
| Previously issued SAS | Not applicable | Works only during short lifetime | Cannot be revoked by app; must expire within documented lifetime |
| Private media route | Ownership-protected | `private, no-store` | Remains ownership/lifecycle protected |

## 10. Worker Validation Matrix

| Condition | Expected result |
|---|---|
| No configured secret | 503; no work processed |
| Missing/wrong caller secret | 401; no work processed |
| Correct secret, no due work | 200; processed count zero |
| Due Private retention | Restrict and queue according to current rules; no automatic exposure increase |
| Active Public approval | Retention schedule remains active/paused according to approved logic; no deletion |
| Active hold | Held; no purge |
| Retryable provider failure | Retry Required with next attempt; not Completed |
| Successful delete plus independent absence | Completed |
| Duplicate delivery | Idempotent; no duplicate consequential evidence |

## 11. Failure And Rollback Rules

| Failure point | Required response |
|---|---|
| Before migration | Make no environment change; resolve evidence gap. |
| Migration drift or failure | Stop; preserve logs safely; do not mount new package; use database recovery process if required. |
| Package inspection failure | Delete/restrict the candidate package; do not upload or mount it. |
| Package startup failure before lifecycle data | Restore prior run-from-package reference, restart, and run health checks. |
| Authorization or privacy failure | Stop traffic to affected surface; do not continue replay. |
| Failure after Epic 7 restrictions exist | Do not roll back to a package that ignores lifecycle restrictions. Keep the safer package mounted or disable affected media serving/application access while correcting. |
| Stale Public serving | Remove affected public access immediately, preserve evidence, and stop release. |
| Blob deletion uncertainty | Keep state Restricted/Retry Required/Failed; never mark Completed. |
| Worker scheduler failure | Disable only the failing lifecycle action if needed; preserve the notification worker; queued work remains visible. |

Database down-migration is not the normal rollback. The schema changes are additive, and Epic 6 intentionally narrows unsupported legacy Public exposure. Evidence must not be destroyed to imitate rollback.

## 12. Screenshot And Evidence Package

Create a new release-validation evidence folder only during execution. Use synthetic data and redact identifiers.

### Desktop

- customer Private package;
- customer exact-media choice;
- customer keep-Private outcome;
- customer Public withdrawal;
- vendor package review/correction;
- vendor publication proposal;
- employee three-stage saved state;
- employee retry-required state;
- admin publication moderation;
- admin lifecycle queue/hold/deletion;
- Public listing before and after invalidation;
- access-denied/wrong-role states.

### Mobile

- physical-device recording gate;
- each stage recording/upload state;
- retry after interruption;
- customer Private playback;
- exact-media decision;
- withdrawal/deletion status;
- employee correction and likeness state;
- blocked/failure states.

### Operational evidence

- package hash and mounted source marker;
- migration before/after status;
- sanitized Blob existence/absence evidence;
- sanitized cache/direct-route response matrix;
- Logic App lifecycle action and successful run history;
- 30-minute health summaries before and after replay;
- database count reconciliation without row content or secrets.

## 13. Required Reports And Tracker Updates After Execution

Execution must produce:

1. `RELIANCE_PRE_EPIC8_RELEASE_VALIDATION_REPORT.md`
2. A screenshot index with desktop, mobile, operational, success, failure, blocked, loading, and before/after evidence.
3. Updated Epic 5 Engineering Report, UX Review, Product Owner Demo, Technical Debt, Checklist Snapshot, and Git Checkpoint.
4. Updated Epic 6 equivalents.
5. Updated Epic 7 equivalents.
6. Updated `PROJECT_DASHBOARD.md`.
7. Updated `RELIANCE_BETA_READINESS_MASTER_CHECKLIST.md`.
8. A scoped deployment Git checkpoint only if execution generates approved documentation/configuration evidence.

Do not claim a gate passed unless it was actually executed. Preserve a clear distinction between application defects, release evidence gaps, external dependencies, and future Epic work.

## 14. Product Owner Demo Checklist

### Expected workflow

- [ ] Create one synthetic work record using an implemented location/permission path.
- [ ] Assign the controlled employee and confirm only that employee can record.
- [ ] Capture and save all three stages on a physical phone.
- [ ] Recover one interrupted upload without losing the draft or duplicating media.
- [ ] Request and complete one manager correction.
- [ ] Approve a complete package and open it as the verified customer in Private state.
- [ ] Keep one package Private as a complete outcome.
- [ ] Propose exact Final Result media for Public use.
- [ ] Complete all applicable participant, vendor, and admin decisions.
- [ ] Confirm only the exact approved version appears publicly.
- [ ] Change/replace the media and confirm renewed approval is required.
- [ ] Withdraw Public approval and confirm immediate unpublishing.
- [ ] Open a dispute, apply/release a hold, request deletion, force one retry, and verify final Blob absence.

### Expected notifications

- [ ] Existing permission, assignment, correction, and manager-review notifications remain functional.
- [ ] Existing notification worker remains scheduled and authenticated.
- [ ] Lifecycle worker is scheduled/authenticated separately without disrupting notifications.
- [ ] No notification claims Public, Deleted, or Completed before canonical state proves it.
- [ ] SMS handset delivery remains explicitly deferred until Telnyx is operational.

### Expected dashboard updates

- [ ] Vendor and admin surfaces show current package/publication/lifecycle state after refresh.
- [ ] Customer and employee surfaces show only role-appropriate state.
- [ ] No dashboard invents a review, rating, Trust Score change, permission, or Public outcome.

### Expected database state

- [ ] All expected migrations are applied once.
- [ ] Evidence chains are complete and exact-versioned.
- [ ] Legacy Public state is restricted/inventoried as designed.
- [ ] Retry and deletion states are truthful.
- [ ] Completed deletion has independent Blob-absence evidence.
- [ ] Counts reconcile with only controlled fixture activity.

### Expected admin state

- [ ] Admin can moderate complete exact-media proposals.
- [ ] Admin cannot repair missing participant authority or broaden audience.
- [ ] Admin can review lifecycle cases, holds, retries, and appeals without erasing history.

### Expected customer state

- [ ] Private proof is complete and reassuring.
- [ ] Public choice is optional and exact-media specific.
- [ ] Withdrawal stops Public visibility promptly without falsely claiming deletion.

### Expected vendor state

- [ ] Manager can review/correct/approve complete packages.
- [ ] Vendor may propose and represent but cannot override customer, employee, or admin decisions.
- [ ] Lifecycle state and resolving action are clear.

### Expected employee state

- [ ] Recording controls appear only when all canonical gates allow them.
- [ ] Every upload shows Uploading, Saved, Retry Required, or Rejected.
- [ ] Employee authority remains limited to assigned work and applicable personal likeness/audio.

### Expected Trust Score behavior

- [ ] No permission, recording, Private/Public choice, withdrawal, dispute, deletion, or silence creates an unapproved Trust Score input.
- [ ] No score recalculation occurs as part of this validation.

### Expected review behavior

- [ ] No synthetic review or rating is created.
- [ ] Existing genuine reviews remain unchanged and role-filtered.

### Expected audit history

- [ ] Consequential events are reconstructable with actor, role, object, exact version/hash, timestamps, and prior/resulting states.
- [ ] Raw secrets, OTPs, tokens, SAS values, and private Blob URLs are absent.

### Expected screenshots

- [ ] Desktop and mobile role journeys are indexed.
- [ ] Loading, success, failure, empty, blocked, and before/after states are represented where applicable.
- [ ] Screenshots contain only controlled synthetic information.

## 15. Regression Statement Requirements

The final report must state:

### Existing functionality intentionally preserved

- Epic 1 verified permission and fail-closed recording state.
- Epic 2 proof-first product language and navigation.
- Epic 3 database-backed role isolation and admin separation.
- A5 customer registration, required policy evidence, optional SMS, and email verification.
- Epic 4 canonical recording gates, authority, location, and employee certification.
- Genuine optional reviews and their moderation/visibility.
- Existing Trust Score implementation, without recalculation or redesign.

### Existing functionality intentionally unchanged

- Vendor and employee registration agreements.
- Telnyx provider status.
- AI authority and release state.
- Notification wording outside current behavior validation.
- Frozen legal, consent, product, language, UX, and roadmap documents.

### Areas verified unaffected

- authentication and role isolation;
- permission links and OTP;
- customer registration and claim flow;
- reviews and ratings;
- Trust Score inputs;
- notification worker;
- public shell and image optimizer;
- Support and Notifications pages.

### Potential regression risks reviewed

- schema/package ordering;
- old application behavior against forward schema;
- upload retry and duplicate media;
- stale Public cache or SAS access;
- incomplete publication chains;
- lifecycle restriction rollback;
- worker duplicate delivery and provider failure;
- cross-role IDOR access;
- legacy Public-data narrowing.

### Known unrelated issues

List only independently evidenced issues. Do not attribute existing baseline failures or Telnyx provider readiness to Epic 5-7.

## 16. Stop Conditions

Stop and request Product Owner review if any of the following occurs:

- live migration state differs from the expected approved set;
- restore readiness cannot be verified;
- the release package contains an environment file, secret, source tree, test artifact, or unapproved file;
- local and remote package hashes differ;
- TypeScript, production build, or a release-critical test fails;
- a role can access another role's protected resource;
- recording begins without a canonical allowed gate;
- Private proof exists without the complete evidence chain;
- Public proof is served without the complete immutable exact-version chain;
- a stale/revoked/superseded version remains Public;
- withdrawal fails to reduce exposure immediately;
- deletion is called Completed before verified Blob absence;
- worker authentication, idempotency, or retry semantics fail;
- reviews, ratings, Trust Score inputs, permissions, or Public eligibility are fabricated;
- an implementation change is required.

## 17. Completion Standard

This combined validation is complete only when:

1. The cumulative approved package is deployed from a verified clean source.
2. The beta database is current with the approved migrations.
3. Physical-device three-stage capture, upload, retry, correction, manager approval, and Private customer access pass.
4. Exact-media Public proof and moderation pass with immutable version evidence.
5. Withdrawal, disputes, holds, retention, retry, and verified deletion pass.
6. Blob and cache behavior is proven live.
7. The lifecycle worker runs on schedule with secure authentication, idempotency, retry, and visible failures.
8. Customer, vendor, employee, and admin signed-in replay passes.
9. No unauthorized review, rating, Trust Score, permission, publication, or customer activity is created.
10. Required reports, screenshots, tracker updates, and Product Owner decision are complete.

Only then may the active engineering objective move to Epic 8 implementation.

## 18. Approval Gate

This document authorizes no migration, deployment, Azure configuration, physical data creation, or application change.

After Product Owner approval, execute one gate at a time, preserve evidence, and stop immediately on a mandatory failure. Do not begin Epic 8 until the final release-validation report is approved.
