# Next.js 15.5.21 Security Remediation Report

**Checkpoint:** Epic 3 Phase A dependency security remediation

**Repository:** `C:\Users\Cesar Olivera\Project Reliance`

**Branch:** `cursor-latest-build`

**Starting commit:** `43e7ef152ba24afc6a96f4d70e7b44f7bfe5cd02`

**Dependency commit:** `ff5f7e9`

**Date:** 2026-08-03

**Deployment performed:** No

## Objective

Upgrade the active production framework from `next@15.3.3` to `next@15.5.21` to remove the reachable Critical Next.js advisory without beginning Epic 3 Phase B, changing application workflows, or mixing unrelated dependency upgrades into this checkpoint.

## Starting State

| Package | Starting version |
|---|---:|
| `next` | `15.3.3` |
| `react` | `19.1.0` |
| `react-dom` | `19.1.0` |
| `eslint-config-next` | Not installed |
| Next optional `sharp` | `0.34.2` |
| Next `postcss` | `8.4.31` |

Production audit baseline: 1 Critical, 16 High, 7 Moderate, 1 Low.

The worktree already contained unrelated `tsconfig.tsbuildinfo` and `output/` changes. They remained outside the checkpoint. Existing tracked screenshot fixtures and `test-results/` metadata were touched by test execution and are also excluded from the security commit.

## Official Compatibility Review

The Next.js 15.5 release and Next.js 15 upgrade guidance were reviewed before the update. Relevant conclusions:

- The repository already uses React and React DOM 19.1.0, so no React upgrade was required.
- App Router, route handlers, async request APIs, middleware, and legacy Pages Router compatibility remain supported in the selected release.
- Next.js 15.5 adds route export validation and generated route types. That validator exposed the repository's split router roots: App Router under `src/app` and Pages Router under root `pages`.
- Standalone output remains supported. `outputFileTracingRoot` is now pinned to this repository because a parent lockfile otherwise caused Next to infer `C:\Users\Cesar Olivera` as the workspace root.

No application behavior was changed to suppress a warning.

## Files Changed

| File | Reason |
|---|---|
| `package.json` | Pin `next` to the approved exact version `15.5.21` |
| `package-lock.json` | Resolve Next 15.5.21 and only its required SWC/optional image dependency tree |
| `next-env.d.ts` | Preserve the Next 15.5 generated route-type reference |
| `next.config.js` | Pin standalone output tracing to the repository root |
| `pages/_app.js` -> `src/pages/_app.js` | Keep the legacy Pages Router under the same `src` root as App Router |
| `pages/support.js` -> `src/pages/support.js` | Preserve `/support` while satisfying Next 15.5 route validation |
| `pages/notifications.js` -> `src/pages/notifications.js` | Preserve `/notifications` while satisfying Next 15.5 route validation |

The three Pages Router files retain their existing components and behavior. Only their location and relative imports changed.

## Final Dependency State

| Package | Final version | Result |
|---|---:|---|
| `next` | `15.5.21` | Upgraded and pinned |
| `react` | `19.1.0` | Unchanged |
| `react-dom` | `19.1.0` | Unchanged |
| `eslint-config-next` | Not installed | Unchanged |
| Next optional `sharp` | `0.34.5` | Required transitive update |
| Next `postcss` | `8.4.31` | Unchanged transitive version |

Prisma, Playwright, Tailwind, Azure SDK packages, Twilio, Axios, and all other direct dependencies were not upgraded.

## Security Result

`npm audit --omit=dev --json` after the update reports:

| Severity | Before | After |
|---|---:|---:|
| Critical | 1 | 0 |
| High | 16 | 17 |
| Moderate | 7 | 7 |
| Low | 1 | 1 |
| Total | 25 | 25 |

The Critical Next.js core advisory is removed. Next is still included in High findings through its installed PostCSS 8.4.31 and Sharp 0.34.5 dependency paths. npm's proposed resolution for those findings is a Next 16 major upgrade, which is outside this checkpoint. Other High findings include Playwright, Prisma configuration/CLI paths, Axios/form-data, glob/minimatch-related packages, Lodash, and other transitive packages. They remain for the separately approved package-by-package assessment.

No new peer-dependency conflict was reported by `npm ci` or `npm ls`.

## Validation Results

### Installation, Types, and Build

| Validation | Result |
|---|---|
| Clean `npm ci` | Pass; 589 packages installed and Prisma client generated |
| `npx tsc --noEmit --pretty false --incremental false` | Pass |
| Production build with 6 GB Node heap | Pass |
| App Router static generation | Pass: 197/197 |
| Legacy Pages Router generation | Pass: `/support`, `/notifications` |
| Route-count comparison | Unchanged: 197 App Router generated pages; both compatibility routes retained |
| `git diff --check` | Pass; line-ending warnings only |

The final production build compiled in approximately two minutes and completed in 320 seconds.

### Focused Unit and Integration Suites

| Suite | Result |
|---|---:|
| Support and Notifications | 31/31 pass across 10 files |
| Epic 1 permission workflow | 53/53 pass across 13 files |
| Epic 2 proof-first shell | 23/23 pass across 5 files |
| Epic 3 Phase A | 36/36 pass across 11 files |
| Authentication, admin session, middleware, and beta gate | 41/41 pass across 6 files |
| Public/private Service Video and lifecycle filtering | 24/24 pass across 5 files |

The full repository unit run still contains the same 12 unrelated stale fixture/copy failures recorded before this dependency checkpoint. No changed checkpoint file is in those failing workflow surfaces.

### Browser Validation

| Browser suite | Result | Classification |
|---|---:|---|
| Epic 3 Phase A role isolation | 5/5 pass | Current canonical security suite |
| Public shell, canonical recording gate, and permission UX | 14/14 applicable scenarios pass | Framework and changed-route regression passes |
| Vendor permission recovery legacy fixture | 0/2 | Fixture tries to fabricate vendor authority with browser API mocks; the current server boundary correctly rejects it because no database membership exists |
| Auth redirect legacy fixture | Blocked on first of 3 | Synthetic login users were absent because global database setup was intentionally skipped; API correctly returned `USER_NOT_FOUND` |

The two fixture limitations were reproduced in isolation. No application authorization was weakened to make browser mocks bypass the current database authority model.

### Standalone and Route Probes

The generated standalone package contains Next 15.5.21, React/ReactDOM 19.1.0, Sharp 0.34.5, and PostCSS 8.4.31. After adding the documented runtime `public` and `.next/static` assets, the standalone server returned:

- `200`: `/`, `/browse`, `/support`, `/notifications`, `/vendor/support`, `/admin/notifications`
- `200` with protected boundary behavior: `/vendor/dashboard`, `/user-dashboard`, `/employee/jobs`, `/admin/dashboard`
- `200`: `/consent/standalone-probe` with safe missing-request handling
- `405`: GET `/api/internal/notifications/process`, confirming the worker route does not accept the wrong method
- `200 image/png`: `/_next/image` optimized `reliance-logo.png` to a 4,672-byte response

Active account, consent, dashboard, and media fetches use explicit `no-store` behavior. No active `next/image` component dependency was found; the optimizer was nevertheless verified directly.

## Impact Assessment

### API Impact

No API contract, status mapping, request body, response body, authorization rule, or audit event was changed.

### Database and Migration Impact

None. No Prisma schema or migration changed, and no database migration is required.

### Notification Impact

No templates, delivery providers, retry behavior, or worker behavior changed. The worker route remains present and method-restricted.

### AI, Dashboard, and Legal Impact

No AI workflow, dashboard metric, frozen document, policy, agreement, consent language, review behavior, Trust Score behavior, publication behavior, or recording workflow changed.

## Azure Packaging Finding

The raw `.next/standalone` trace contains a copied `.env` file. Its contents were not opened, printed, staged, or exposed. This checkpoint does not prove whether the existing Azure packaging process excludes that file before creating the deployment ZIP.

This is a deployment-readiness blocker until one of the following is demonstrated:

1. the Azure packaging script explicitly excludes `.env` and `.env.*`; or
2. the package is assembled from an allowlist that cannot include local environment files.

This finding does not require an application redesign, but the current raw standalone directory must not be deployed as-is.

## Backward Compatibility and Rollback

App Router and Pages Router routes are preserved. React remains on the same version. There are no data migrations. Rollback is limited to restoring the previous package/lockfile, removing the generated route reference, restoring the three Pages Router files to the root, and removing `outputFileTracingRoot` if the older framework is restored.

## REGRESSION STATEMENT

### Existing functionality intentionally preserved

- Epic 1 permission decisions and canonical recording lock.
- Epic 2 homepage, Explore Proof, public provider profile, and role shell.
- Epic 3 Phase A database actor, ownership, membership, admin isolation, and direct-route denial.
- Support and Notifications routes under both public and role-specific paths.
- Public/private media filtering, reviews, Trust Score, notifications, and admin moderation.

### Existing functionality intentionally unchanged

- Authentication lifecycle and Epic 3 Phase B features.
- Recording, location, publication, retention, deletion, consent, review, Trust Score, AI, and legal behavior.
- Azure deployment configuration outside Next standalone root tracing.

### Areas verified unaffected

- Production compilation and route generation.
- Public, customer, vendor, employee, and admin route rendering.
- Direct-route authorization and admin/general session isolation.
- Permission and OTP UI routes.
- Notification worker route.
- Image optimization and static asset delivery.

### Potential regression risks reviewed

- Next 15.5 route-type validation: resolved by co-locating both routers under `src`.
- Standalone trace root: pinned to the repository and inspected.
- React compatibility: no React version change required.
- Middleware/cookie/header behavior: focused and browser authorization suites pass.
- Caching/revalidation: protected and mutable routes retain explicit no-store behavior.

### Known unrelated issues

- 12 previously recorded full-suite failures remain in owning workflows.
- Two vendor recovery Playwright cases use a stale browser-only authority fixture.
- The auth redirect smoke requires its controlled database users.
- Browserslist data is stale and Next emits a future `allowedDevOrigins` development warning.
- Remaining production-tree High advisories require a separate decision.

## Deployment Readiness Decision

**Critical framework blocker:** Resolved.

**Framework/build compatibility:** Validated.

**Epic 3 Phase A ready for automatic beta deployment:** No.

**Reason:** The raw standalone package includes `.env`, and remaining runtime High advisories still require their approved separate assessment. No deployment was performed.

Phase B and Epic 4 remain unauthorized.
