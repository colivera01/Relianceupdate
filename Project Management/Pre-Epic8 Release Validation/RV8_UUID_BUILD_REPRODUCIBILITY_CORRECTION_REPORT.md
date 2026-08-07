# RV-8 UUID Build Reproducibility Correction Report

**Date:** 2026-08-06

**Repository:** `reliance-admin`

**Branch:** `codex/epic3-beta-admin-grant-correction`

**Starting commit:** `ee5101f7c1dba18136b6e06915fd4ac21598a08f`

## Objective

Correct only the clean-build defect caused by the active admin seed API importing `uuid` without declaring it in the root dependency graph. No application source, workflow, database, migration, Azure resource, or deployment was changed.

## Root Cause

`src/app/api/admin/seed/route.ts` imports `v4` from `uuid` and calls it when the non-production seed route executes. The import is bundled during every production build even though the route returns 403 in production. The root `package.json` did not declare `uuid`, so a clean dependency installation could not guarantee that the module existed and Next.js failed while compiling the route.

Repository search found no other external `uuid` package import. Other UUID generation uses the Node or browser `crypto.randomUUID()` API and does not depend on this package.

## Dependency Decision

| Item | Decision |
|---|---|
| Package | `uuid` |
| Exact version | `8.3.2` |
| Classification | Runtime `dependencies` |
| Reason | The non-production admin API can execute at route runtime; it is not test-only or build-only code. |
| Compatibility evidence | The existing lockfile already contained the exact `uuid@8.3.2` CommonJS package through Azure's dependency tree, and the current import shape is compatible with its `v4` export. |

The dependency was added with `npm install --save-exact uuid@8.3.2`. No `npm audit fix`, force install, source rewrite, or unrelated package upgrade was performed.

## Manifest And Lockfile Impact

- `package.json`: added `"uuid": "8.3.2"` under runtime dependencies.
- `package-lock.json`: added the same exact package to the root dependency set.
- The existing `node_modules/uuid` lock entry retained version, registry URL, integrity hash, license, and binary information. npm refreshed its registry deprecation metadata.
- No other package version changed in the committed diff.

## Clean-Worktree Validation

Validation used a fresh detached worktree at the candidate dependency commit:

`C:/Users/Cesar Olivera/Documents/Codex/validation/rv8-uuid-6268cb2`

| Validation | Result |
|---|---|
| Initial clean worktree status | Clean |
| `npm ci` | Passed; 597 packages installed from the committed graph and Prisma Client generated |
| `npm ls uuid --depth=0` | Passed; exactly `uuid@8.3.2` at the application root |
| `require.resolve("uuid")` | Passed; resolved inside the clean worktree's `node_modules/uuid/dist/index.js` |
| Runtime export check | Passed; package version was `8.3.2` and `v4()` generated a UUID-shaped value |
| TypeScript | Passed with `npx tsc --noEmit --pretty false --incremental false` |
| Production build | Passed with `NODE_OPTIONS=--max-old-space-size=8192`; 205 App Router static pages generated and the legacy Pages Router routes compiled |
| Focused admin seed route test | No focused seed-route test exists in the repository |
| `git diff --check` | Passed |
| Final clean worktree status | Clean |

The build emitted expected local-environment warnings for missing database and Azure Storage configuration while collecting page data. These warnings did not fail compilation and did not expose credentials.

`npm ci` reported the repository's existing dependency advisory totals. This checkpoint did not run automated remediation because dependency-audit work is outside its approved scope.

## Evidence

Command logs are stored outside the repository at:

`C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv8-uuid-6268cb2/`

- `npm-ci.log`
- `npm-ls-uuid.log`
- `uuid-resolve.log`
- `typescript.log`
- `production-build.log`
- `git-validation.log`

## Regression Statement

The admin seed route source and behavior are unchanged. Application runtime logic, authorization, permission, recording, upload, review, Trust Score, publication, lifecycle, notification, database, and Azure behavior were intentionally untouched.

The committed package diff contains only the exact direct runtime dependency and npm's corresponding lock metadata, plus this report.

## Readiness Decision

The RV-8 correction commit is now reproducibly buildable from a clean worktree. The package is ready for Product Owner approval to resume deterministic packaging and deployment.

This checkpoint did not deploy, did not resume RV-8, did not start RV-9, and did not begin Epic 8.
