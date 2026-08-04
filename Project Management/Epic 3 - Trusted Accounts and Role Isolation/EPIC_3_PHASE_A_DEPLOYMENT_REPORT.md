# Epic 3 Phase A Deployment Report

**Environment:** Reliance beta

**Azure App Service:** `app-reliance-beta-wcus`

**Resource group:** `rg-reliance-beta-eastus`

**Deployment date:** 2026-08-04

**Status:** Deployed and operationally validated

## Objective

Deploy the previously approved Epic 3 Phase A deterministic allow-list package without application, dependency, migration, database, or broad secret changes. Validate startup, public routes, protected role boundaries, permission and recording gates, notification-worker authentication, media visibility, and image optimization against beta.

## Deployment Artifact

| Item | Value |
|---|---|
| Source commit | `59d696f55f01e670846800822d295aa558a36f03` |
| Package | `reliance-beta-59d696f-epic3-phase-a-202608040430.zip` |
| SHA-256 | `f254987e61e4e26cc69864657a056b3cc977a3a82a2d8c568919af634803fd55` |
| Local package size | 67,643,484 bytes |
| Packaging strategy | Deterministic allow-list ZIP mounted with `WEBSITE_RUN_FROM_PACKAGE` |

The local approved ZIP and the uploaded Azure blob were compared byte-for-byte before mounting. The App Service deployment markers now identify the package and source commit above.

## Scope Preserved

- No application source was changed.
- No dependency was changed.
- No migration was created or modified.
- No database schema or product data was changed.
- No authentication, authorization, consent, recording, review, Trust Score, publication, or retention behavior was redesigned.
- Epic 3 Phase B and Epic 4 were not started.

## Database Readiness

The beta database was already current before deployment:

- 36 migrations applied.
- `PlatformRoleGrant` exists.
- Exactly one active administrator grant exists for the verified beta administrator actor.
- The superseded incorrect actor identifier has zero active administrator grants.
- No database operation was required during this deployment checkpoint.

## Operational Secret Synchronization

Exactly one operational secret was regenerated: `INTERNAL_NOTIFICATION_WORKER_SECRET`.

Azure masks this value after storage, so the existing App Service value could not be recovered for synchronization with the Logic App. A new cryptographically secure value was generated in memory and written only to:

1. The beta App Service setting with the same name.
2. The secure `workerSecret` parameter in `logic-reliance-beta-permission-notifications`.

No database credentials, session secrets, AI keys, notification-provider credentials, beta-gate credentials, device-pairing secrets, or other application settings were rotated. No secret value appears in this report, logs, responses, screenshots, or committed files.

## Configuration Recovery Event

During the first package-mount attempt, a Windows Azure CLI command parsed the SAS query string incorrectly and replaced the App Service setting collection with only three values. Deployment was immediately rolled back to the previous known package before product traffic validation.

Recovery actions:

1. Restored all 52 prior settings from the existing local configuration snapshot and approved local environment source.
2. Verified the restored values matched the pre-deployment snapshot byte-for-byte.
3. Regenerated only the unrecoverable masked worker synchronization secret, as documented above.
4. Revalidated the rollback package and service health.
5. Mounted the approved package through the Azure Resource Manager API to avoid shell query-string parsing.
6. Verified 53 settings after the final mount: the original 52 preserved settings plus the approved worker secret.

This event was resolved before final smoke testing. It did not alter the beta database, product records, or the approved package. The safer direct ARM/allow-list process should remain the required deployment path.

## Startup And Route Verification

| Check | Result | Evidence |
|---|---|---|
| App Service state | Pass | `Running` |
| `/api/health` | Pass | HTTP 200 |
| `/api/health/schema` anonymous access | Pass | HTTP 401, protected after Phase A |
| Homepage `/` | Pass | HTTP 200 |
| Explore Proof `/browse` | Pass | HTTP 200 |
| Support `/support` | Pass | HTTP 200 |
| Notifications `/notifications` | Pass | HTTP 200 |
| Image optimizer | Pass | HTTP 200, `image/png` |

The schema-health route rejects anonymous requests. Admin dashboard access was validated separately with an admin-scoped session and active database grant. Its cookies are intentionally scoped to admin routes, so an admin browser does not attach them to `/api/health/schema`; no code or cookie scope was changed in this checkpoint.

## Live Authorization And Workflow Smoke Tests

A disposable Playwright suite ran against `https://beta.relianceonline.org` with synthetic `@reliance.test` users and synthetic work records. All fixtures were removed after execution.

**Result:** 7/7 tests passed in 34.2 seconds.

| Test | Result |
|---|---|
| Public shell and compatibility routes | Pass |
| Customer dashboard and customer blocked from vendor/admin routes | Pass |
| Vendor manager dashboard and employee denied manager API access | Pass |
| Customer media endpoint excludes Private proof and returns approved Public proof | Pass |
| Database-granted administrator opens admin dashboard | Pass |
| Permission page and OTP entry render without exposing raw OTP | Pass |
| Mobile wrong-role state remains blocked and readable | Pass |

Additional checks:

- Employee mutation of `/api/vendor/profile` returned HTTP 403.
- A pending customer-residence permission could not create a media session; the server returned HTTP 409 with `VERIFIED_PERMISSION_REQUIRED`.
- Customer, vendor, employee, and administrator boundaries were derived from current server-side actor, membership, ownership, and grant data.
- No raw permission token or OTP appeared in tested API payloads or captured screenshots.
- Permission activity did not create a review, rating, Trust Score input, publication approval, or Public service video.
- Synthetic cleanup verification returned zero remaining test users, vendors, work records, media sessions, media assets, and role grants.

## Notification Worker

| Check | Result |
|---|---|
| Missing worker secret | HTTP 401 |
| Incorrect worker secret | HTTP 401 |
| Correct synchronized secret | HTTP 200; `success: true`; zero due items |
| Logic App state | Enabled |
| Logic App provisioning | Succeeded |
| Scheduled executions after synchronization | Succeeded |

Earlier scheduled runs failed while the matching secret was unavailable. Runs after synchronization succeeded. No live SMS handset delivery was attempted because Telnyx remains an external provider dependency; this is not an application defect.

The five scheduled runs observed during the final monitoring period all completed with `Succeeded` status, including the run beginning at `2026-08-04T14:51:45Z`.

## Monitoring

The beta service was monitored from `2026-08-04T14:22:47Z` through `2026-08-04T14:52:44Z` (29.95 minutes). The monitor polled `/api/health`, the beta-gated homepage, and App Service state once per minute.

- Health result: **30/30 passed**
- Homepage result: **30/30 passed**
- App Service result: **Running at every five-minute checkpoint**
- Observed failures: **0**

## Screenshot Evidence

The screenshot package is indexed at:

`Project Management/Epic 3 - Trusted Accounts and Role Isolation/08_Screenshots/SCREENSHOT_INDEX.md`

It contains live beta desktop views for Explore Proof, customer, vendor, employee, administrator, permission, and OTP states, plus a mobile wrong-role blocked state. All screenshots use synthetic data and contain no passwords, OTPs, raw permission tokens, or secrets.

## UX Review

### Customer

The permission and OTP pages clearly explain why the customer is present, that audio is off, and that Private is the starting audience. The blocked wrong-role state prevents customer access to vendor tools and remains readable on mobile.

### Vendor

The vendor dashboard loads for an active manager and preserves the existing navigation and business context. No unrelated vendor workflow changed.

### Employee

The assigned-work view loads for the employee, while manager-only mutation remains denied. Recording remains locked when verified permission is pending.

### Admin

The admin dashboard opens only for the database-granted administrator. The operator surface is information-dense but functional; no redesign was included in this deployment.

## Authorization Results

- Direct wrong-role navigation is blocked.
- Customer, vendor, employee, and admin views do not authorize one another by URL, browser metadata, or cached role labels.
- Vendor authority requires a current qualifying membership.
- Admin authority requires an active database grant and an admin-scoped session.
- Protected mutations return authorization errors without exposing protected content.
- Recording creation continues to use the canonical server-side permission decision.

## Rollback Readiness

The prior known package remains available:

- Package: `reliance-beta-08de960-epic1-operational-closeout-202608021730.zip`
- Source commit: `08de960c768463f2fea7c407d7bb39e6dcfacb3b`

Rollback requires changing only the run-from-package reference and deployment markers, then restarting and rerunning health checks. The database is forward-compatible and requires no rollback for this deployment.

## Regression Statement

### Existing Functionality Intentionally Preserved

- Epic 1 verified permission states and canonical recording lock.
- Epic 2 public platform shell, Explore Proof, and language hierarchy.
- Customer, vendor, employee, and admin dashboards.
- Public/private Service Video filtering.
- Support and Notifications compatibility routes.
- Notification worker schedule and authorization boundary.
- Image optimizer and standalone Azure packaging behavior.

### Existing Functionality Intentionally Unchanged

- Permission policy and consent rules.
- Customer OTP workflow content and verification rules.
- Recording stages, media publication, review, Trust Score, retention, and deletion.
- SMS provider configuration and Telnyx operational status.

### Areas Verified Unaffected

- Public route rendering.
- Role dashboards.
- Permission pages and OTP entry.
- Recording lock for pending permission.
- Public/private filtering.
- Notification worker authentication.
- Image optimization.

### Potential Regression Risks Reviewed

- App settings drift after the configuration recovery event.
- Package/blob mismatch.
- Stale database migrations.
- Role leakage and direct-route access.
- Worker secret mismatch.
- Private media exposure.
- Raw OTP or permission-token exposure.

### Known Unrelated Issues

- The admin audit compatibility writer first probes a legacy `action` column and logs SQL error 207 before its Prisma fallback succeeds. The tested operation completes, but the noisy fallback should be removed in a future approved task.
- Live SMS handset validation remains deferred until Telnyx is operational.

## Remaining Blockers

No Phase A application, database, deployment, or monitoring blocker was found in the completed validation suite.

## Final Decision

The approved Epic 3 Phase A package is deployed and operational on beta. Health, route, authorization, recording-lock, notification-worker, media-visibility, image-optimizer, and monitoring gates passed. Epic 3 Phase B and Epic 4 remain paused pending Product Owner direction.
