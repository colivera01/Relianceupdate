# Epic 3 Phase A Deployment Readiness Correction Report

**Task:** Epic 3 Phase A Deployment Readiness Correction  
**Date:** 2026-08-03  
**Branch:** `cursor-latest-build`  
**Starting commit:** `568132cd38918ac8efe889acb5909266f7561e71`  
**Deployment performed:** No  
**Phase B or Epic 4 work performed:** No

## Objective

Verify the reported production-build failures for the legacy `/support` and `/notifications` pages, apply only a proven minimal correction if one is necessary, and classify every Critical or High production dependency advisory before any dependency change is authorized.

## Scope Result

The proposed narrow investigation was appropriate. One premise did not survive fresh verification: the two legacy pages are valid React pages and the production build now completes successfully without changing them. Removing, moving, or rewriting those routes would therefore be unjustified.

No application source, route, API, UI, notification, permission, database schema, migration, or dependency was changed.

## Build Blocker Investigation

### Files inspected

| File | Current role | Finding |
|---|---|---|
| `pages/support.js` | Legacy Pages Router compatibility page for `/support` | Has a valid default React component export. |
| `pages/notifications.js` | Legacy Pages Router compatibility page for `/notifications` | Has a valid default React component export. |
| `components/legacy-pages-router/SupportTicketsPage.tsx` | Support page implementation imported by the legacy route | Has a valid default component export. |
| `components/legacy-pages-router/AdminNotificationsInbox.tsx` | Notifications implementation imported by the legacy route | Has a valid default component export. |
| `src/app/vendor/support/page.tsx` | Active vendor support experience | Present and unchanged. |
| `src/app/customer/support/page.tsx` | Active customer support experience | Present and unchanged. |
| `src/app/help/page.tsx` | Public/help experience | Present and unchanged. |
| `src/app/admin/notifications/page.tsx` | Active admin notifications experience | Present and unchanged. |

### Why Next.js accepts the files

Each legacy route imports a React component and returns it from a default page component. The imported modules also have valid default React exports. A fresh Next.js production build recognized and emitted both `/support` and `/notifications` in the route table.

### Route preservation checks

The production route table contains both legacy routes and their current role-specific equivalents. Runtime route probes for `/support`, `/notifications`, `/vendor/support`, and `/admin/notifications` all entered normal middleware routing and returned the expected beta-gate redirect in the controlled unauthenticated check. No route was removed or redirected to a different experience by this task.

### Correction decision

**No source correction was required.** The previously reported build failure was not reproducible from the current clean source state. The most likely explanation is stale or interrupted build state, but the exact historical cause cannot be proven from the current implementation.

No build-correction commit was created because there is no valid code correction to commit.

## Dependency Advisory Assessment

Command: `npm audit --omit=dev --json`

Current counts: **1 Critical, 16 High, 7 Moderate, 1 Low**.

The deployed-package inspection below distinguishes a package physically present in `.next/standalone` from a dependency that may be bundled into server output. Absence from that folder alone is not proof that code is unreachable.

### Critical advisory

| Package | Installed / affected | Path and use | Exposure | Patched target and risk | Recommendation |
|---|---|---|---|---|---|
| `next` | `15.3.3`; aggregate affected range includes the installed release | Direct production framework dependency; present in `.next/standalone`; all application routes use it | Directly reachable framework code. The audit includes RCE, source exposure, DoS, SSRF, request-smuggling, and cache-related advisories. | `15.5.21` is the nearest same-major target that clears the reported Next.js core advisories in a clean audit resolution. This is a minor upgrade with broad framework regression scope. | **Upgrade now, but only as a separately approved dependency checkpoint.** Run full build, Epic 1/2/3 regression, route/API smoke, middleware, image, cache, and deployment rollback checks. The Critical advisory remains a deployment blocker until remediated and verified. |

### High advisories

| Package | Installed version and affected range | Dependency path | Runtime use / realistic exposure | Patched target / change risk | Recommendation and required validation |
|---|---|---|---|---|---|
| `postcss` | `8.4.31` through Next and `8.5.5` through Tailwind; affected `<=8.5.22` | Transitive: Next and Tailwind | Next copy is present in standalone. Processing is primarily build/CSS work; no untrusted CSS ingestion was found, but production presence prevents an unreachable finding. | `8.5.25`; override or parent upgrade may be required. Minor-level behavioral risk. | Scoped remediation after Next target is selected; build, CSS snapshots, public/role pages, and mobile visual regression. |
| `sharp` | `0.34.2`; affected `<0.35.0` | Optional transitive dependency of Next | Present in standalone. No direct `next/image` import was found, but the image optimizer surface can still exist. Reduced exposure, not proven unreachable. | `0.35.3`; minor upgrade. Next `15.5.21` still declares `^0.34.3`, so an override or broader framework decision may be needed. | Do not dismiss. Approve a scoped override/upgrade only with image upload/render/optimizer regression. |
| `axios` | `1.15.0`; affected `1.0.0-1.17.0` | `twilio -> axios` | Twilio SMS adapter imports a live runtime client when configured. Current preferred provider is Telnyx, but Twilio remains executable configuration-dependent code. | `1.19.0`; transitive minor upgrade. | Update the Twilio dependency chain in an approved notification maintenance task; test provider initialization, timeout, retry, failure, and redaction. |
| `form-data` | `4.0.5`; affected `4.0.0-4.0.5` | `twilio -> axios -> form-data` | Same configuration-dependent Twilio runtime path. | `4.0.6`; patch. | Safe lockfile-level candidate with SMS adapter regression; do not alter notification behavior in this task. |
| `fast-xml-builder` | `1.1.4`; affected `<=1.1.6` | `@azure/storage-blob -> @azure/core-xml -> fast-xml-parser -> fast-xml-builder` | Azure Blob storage is an active runtime integration. Request data is server-created, which reduces attacker control, but reachability cannot be excluded. | `1.3.0`; minor. | Upgrade the compatible Azure transitive chain with blob upload/read/delete and error-path regression. |
| `lodash` | `4.17.21`; affected `<=4.17.23` | `recharts -> lodash` | Recharts was found only in a legacy audit-log component. No active production route import was found. Low realistic exposure, but package remains in the dependency graph. | `4.18.1`; minor. | Prefer removing the unused dependency path when proven safe, otherwise upgrade Recharts/lodash with analytics/chart regression. |
| `prisma` | `6.19.0`; affected through `6.19.2` in the reported range | Direct production dependency used for CLI/build generation | Prisma CLI is not present in standalone; runtime database access uses `@prisma/client`, which is not named by this advisory. | Audit remediation points to Prisma 7.x, a major upgrade. | **Mitigate temporarily:** keep CLI out of deployed runtime and schedule a separately approved Prisma major-upgrade plan. Do not force-upgrade. |
| `@prisma/config` | `6.19.0`; affected through `6.19.2` | `prisma -> @prisma/config` | Build/migration tooling; absent from standalone. | Parent Prisma 7.x major path. | Same Prisma tooling mitigation and future major-upgrade plan. |
| `effect` | `3.18.4`; affected `<3.20.0` | `prisma -> @prisma/config -> effect` | Build/migration tooling; absent from standalone. | `>=3.20.0`; transitive minor, controlled by Prisma. | Do not override independently without Prisma CLI/generate/migrate regression. |
| `defu` | `6.1.4`; affected `<=6.1.4` | Prisma tooling transitive path | Build/migration tooling; absent from standalone. | `6.1.7`; patch/minor compatible candidate. | Resolve through tested Prisma dependency maintenance; not a deployed-request blocker by itself. |
| `@playwright/test` | `1.52.0`; affected through pre-`1.55.1` stable range | Direct dev/test dependency | Test runner only; absent from standalone. `npm audit --omit=dev` still reports it through the resolved tree. | `>=1.55.1`; minor. | Upgrade in test-tool maintenance and rerun all Playwright projects; not a deployed runtime blocker. |
| `playwright` | `1.52.0`; affected `<1.55.1` | Transitive of `@playwright/test` | Test runner/browser tooling only; absent from standalone. | `>=1.55.1`; minor. | Upgrade with `@playwright/test`; reinstall browsers and run all E2E suites. |
| `glob` | `10.4.5`; affected `10.2.0-10.4.5` | Tailwind/Sucrase build-tool chain | Build-time path; absent from standalone. No attacker-controlled glob CLI input in deployed requests was found. | `>=10.5.0`; patch/minor. | Resolve via compatible parent/lock update with clean install and build regression. |
| `minimatch` | `9.0.5`; affected through `9.0.6` | Build-tool chain through `glob` | Build-time path; absent from standalone. | `>=9.0.7`; patch. | Resolve with the glob chain and rerun build/tests. |
| `brace-expansion` | `2.0.2`; affected through `2.1.3` | Build-tool chain through `minimatch` | Build-time path; absent from standalone. | `>=2.1.4`; patch/minor. | Resolve with the glob chain and rerun build/tests. |
| `picomatch` | `2.3.1`; affected `<=2.3.1` | Tailwind/Sucrase build-tool chain | Build-time path; absent from standalone. | `>=2.3.2`; patch. | Resolve through compatible parent/lock update and rerun build/tests. |

### Dependency decision

- No `npm audit fix`, force upgrade, lockfile rewrite, or dependency edit was performed.
- The Critical Next.js advisory is reachable and remains the controlling deployment blocker.
- A separately approved update to `next@15.5.21` is the recommended first remediation checkpoint.
- PostCSS and Sharp require explicit follow-up because Next `15.5.21` alone does not prove those High advisories resolved.
- Prisma requires a separate major-upgrade decision; its vulnerable CLI/config chain is not in the standalone runtime package.
- Playwright and the Tailwind glob chain are build/test dependencies and should be updated without being misclassified as exposed request handlers.

## Commands And Results

| Validation | Result |
|---|---|
| Focused Support and Notifications unit/integration tests | **31/31 passed** across 10 files |
| Epic 1 regression | **53/53 passed** across 13 files |
| Epic 2 unit regression | **27/27 passed** across 5 files |
| Epic 3 Phase A unit/integration regression | **38/38 passed** across 11 files |
| Epic 2 and Epic 3 Playwright, first attempt | 8 passed, 5 blocked by the beta-access gate, 4 not run; environmental configuration, not product failures |
| Epic 2 and Epic 3 Playwright with controlled `BETA_GATE_ENABLED=false` | Epic 2 passed; one Epic 3 manager-dashboard scenario encountered a transient cold-build/dashboard load failure |
| Isolated Epic 3 Phase A Playwright rerun with gate disabled | **5/5 passed**; all role boundaries confirmed |
| `npx tsc --noEmit --pretty false --incremental false` | **Passed** |
| `NODE_OPTIONS=--max-old-space-size=6144 npm run build` | **Passed**; 197 pages generated and both legacy routes emitted |
| Legacy/current route probes | **Passed** through normal middleware beta-gate behavior |
| `npm audit --omit=dev --json` | 1 Critical, 16 High, 7 Moderate, 1 Low |
| `git diff --check` | **Passed** |

The build logged handled database-count connection errors during static generation, but did not fail. No source change was made in response because those calls already degrade safely and are outside this task.

## Files Changed By This Checkpoint

Only Epic 3 project-management evidence is changed:

- `PHASE_A_DEPLOYMENT_READINESS_CORRECTION_REPORT.md`
- `01_Engineering_Report.md`
- `03_Product_Owner_Demo.md`
- `05_Technical_Debt.md`
- `06_Checklist_Snapshot.md`
- `07_Git_Checkpoint.md`
- `../PROJECT_DASHBOARD.md`

No build-correction source file exists because current source already passes the production build.

## Regression Statement

### Intentionally preserved

- Legacy and role-specific Support and Notifications routes.
- Epic 1 permission, recording-gate, review, Trust Score, publication, and private-media behavior.
- Epic 2 proof-first navigation and public shell behavior.
- Epic 3 canonical actor, ownership, membership, admin isolation, and IDOR controls.

### Intentionally unchanged

- Authentication design, sessions, invitations, password reset, passkeys, MFA, and Phase B lifecycle work.
- APIs, database models, migrations, notifications, dashboards, policies, and frozen documents.
- Dependency versions and lockfile.

### Areas verified unaffected

- Support and Notifications tests: 31/31 passed.
- Epic 1 regression: 53/53 passed.
- Epic 2 regression: 27/27 passed plus browser checks.
- Epic 3 Phase A regression: 38/38 passed plus 5/5 browser checks.
- Production build and type checking passed.

### Potential regression risks reviewed

- Removing an active compatibility route: avoided because no route was removed.
- Hiding a stale build problem with a source rewrite: avoided by clean reproduction.
- Blind dependency upgrades: avoided; no manifest or lockfile changed.
- Misclassifying bundled or optional code as unreachable: avoided; uncertainty is stated explicitly.

### Known unrelated issues

- Existing `tsconfig.tsbuildinfo` and `output/` worktree items were not changed or staged.
- Dependency advisories predate this checkpoint and still require disposition.
- Azure SQL/dashboard latency can make cold browser runs slow; the isolated rerun passed.

## Readiness Decision

| Gate | State |
|---|---|
| Production build | **Pass** |
| Support/Notifications preservation | **Pass** |
| Epic 1/2/3 focused regression | **Pass** |
| Critical dependency advisory | **Blocking** pending approved Next.js remediation and regression |
| Phase A clean beta deployment | **Not ready** |

Phase A should not be deployed yet. The build blocker is cleared by evidence, but the reachable Critical Next.js advisory remains open. Phase B and Epic 4 remain paused.
