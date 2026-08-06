# RV-5 Build Reproducibility Correction Report

**Date:** 2026-08-06

**Repository:** `C:/Users/Cesar Olivera/Documents/Codex/worktrees/reliance-epic3-admin-grant`

**Branch:** `codex/epic3-beta-admin-grant-correction`

**Starting commit:** `19d11ad7825cb24ea066eba9b03f47c724e9620f`

**Scope:** Build dependency correction only. No application behavior, runtime logic, workflow, database, migration, Azure, or deployment change.

## Root Cause

`postcss.config.js` has required both `tailwindcss` and `autoprefixer` since the repository's initial clean commit, `723dc2072f62c9d50052818a64cd4781bac0d33e`.

`tailwindcss` was directly declared, but `autoprefixer` was absent from both `package.json` and `package-lock.json`. Populated developer environments could contain an extraneous `autoprefixer` installation and therefore mask the defect. A clean `npm ci` correctly installed only the committed dependency graph, leaving PostCSS unable to resolve `autoprefixer` and blocking RV-5 before application compilation.

The package, lockfile, and PostCSS configuration at the current branch baseline are unchanged from approved runtime source `5b83125b3f04106c2c4a80365d906b81c1f3990f`.

## Exact Dependency Change

Added the exact build dependency below to `devDependencies`:

```json
"autoprefixer": "10.4.21"
```

`devDependencies` is the appropriate classification because PostCSS runs while producing the application build. The deployed Next.js standalone runtime does not execute the CSS compilation pipeline.

No other direct dependency was added, removed, or intentionally upgraded.

## Package.json Diff

```diff
 "devDependencies": {
+  "autoprefixer": "10.4.21",
   "cross-env": "^10.0.0"
 }
```

## Lockfile Impact

`package-lock.json` now records:

- the root `devDependency` declaration;
- `autoprefixer@10.4.21` and its integrity metadata;
- required browser-data and PostCSS helper transitive packages;
- the lockfile-resolved browser compatibility metadata used by Autoprefixer.

The lockfile update was generated with:

```text
npm install --save-dev --package-lock-only --ignore-scripts --save-exact autoprefixer@10.4.21
```

No force upgrade or `npm audit fix` was used.

## Clean-Install Verification

Validation used a new detached worktree at the starting commit with only the candidate `package.json` and `package-lock.json` changes applied.

Command:

```text
npm ci
```

Result: **Pass**

- 597 packages installed from the committed lockfile.
- Prisma client generation completed.
- `npm ls autoprefixer --depth=0` resolved exactly `autoprefixer@10.4.21`.
- `require.resolve('autoprefixer')` resolved inside the clean worktree's `node_modules`.
- A direct PostCSS dependency check confirmed:
  - `tailwindcss` is declared and resolvable;
  - `autoprefixer` is declared and resolvable.
- No undeclared active PostCSS plugin remains.

Evidence:

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-build-correction/npm-ci.log`

The clean install reported the repository's existing audit findings. Dependency-security remediation was outside this checkpoint and no audit fix was attempted.

## TypeScript

Command:

```text
npm exec tsc -- --noEmit --pretty false --incremental false
```

Result: **Pass**

Evidence:

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-build-correction/typescript.log`

## Production Build

Commands:

```text
NODE_OPTIONS=--max-old-space-size=6144
npm run build
```

Result: **Pass**

- Next.js `15.5.21` compiled successfully.
- Type and lint validation completed.
- 205 static pages generated.
- Build traces completed.
- The App Router route table and legacy `/notifications` and `/support` Pages Router routes were generated.
- `.next/standalone/server.js` was produced.

The isolated worktree intentionally had no database or Azure Storage secrets. Build-time diagnostics reported those values as absent and used the established fallback paths; they did not fail the build or expose a value.

Evidence:

- `C:/Users/Cesar Olivera/Documents/Codex/release-evidence/pre-epic8/rv5-build-correction/production-build.log`

## Diff Integrity

Command:

```text
git diff --check
```

Result: **Pass**

## RV-5 Readiness

The clean-build dependency defect that stopped RV-5 is corrected. A fresh install now resolves the complete active PostCSS dependency set from the committed manifest and lockfile, and the production build succeeds.

RV-5 is expected to pass its build prerequisite after Product Owner approval to resume that gate. Package assembly, secret scanning, exact-ZIP startup, upload, and local/remote hash verification were intentionally not rerun during this correction checkpoint.

No later release gate was executed.
