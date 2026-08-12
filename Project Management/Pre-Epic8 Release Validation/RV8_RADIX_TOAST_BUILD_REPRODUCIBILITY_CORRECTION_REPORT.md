# RV-8 Radix Toast Build Reproducibility Correction Report

## Scope

This checkpoint corrects only the undeclared `@radix-ui/react-toast` dependency that prevented the approved cumulative RV-8 source from building from a clean clone. RV-8 remains paused. No application behavior, recording workflow, database schema, migration, Azure resource, or deployment was changed.

## Root Cause

`src/components/ui/toast.tsx` imports `@radix-ui/react-toast`, but neither `package.json` nor `package-lock.json` declared that package. A previously populated local `node_modules` directory masked the missing declaration. A clean `npm ci` correctly reproduced the defect when the production build attempted to resolve the shared toast source.

Repository history shows that the toast source has existed since the initial clean commit, while the package declaration was never committed.

## Verification Before Correction

- Direct package import: `src/components/ui/toast.tsx`
- Internal consumers: `src/components/ui/use-toast.ts`, `src/components/ui/toast-components.tsx`, and `src/components/ui/toaster.tsx`
- The modules are client-side application source and can execute in the browser when the shared `Toaster` is mounted.
- No existing dependency provides the `@radix-ui/react-toast` package/module contract.
- The dependency is therefore a direct runtime dependency, not a development dependency.
- No focused toast test file exists in the current repository.

## Exact Dependency and Version

- Package: `@radix-ui/react-toast`
- Exact version: `1.2.15`
- Classification: direct runtime dependency

Version `1.2.15` was selected conservatively because it is compatible with the repository's existing Radix dependency generation and explicitly supports the installed React 19 major through its peer dependency range. No unrelated Radix package was upgraded.

## Package Changes

### package.json

Added one exact dependency:

```json
"@radix-ui/react-toast": "1.2.15"
```

### package-lock.json

The lockfile root dependency map was updated and npm added only these package entries:

- `node_modules/@radix-ui/react-toast`
- the package-local compatible `@radix-ui/primitive`
- the package-local compatible `@radix-ui/react-dismissable-layer`
- the package-local compatible `@radix-ui/react-presence`

No package entries were removed. No existing dependency version changed.

## Validation Results

Validation is performed from a fresh detached worktree at the correction candidate commit.

| Validation | Result |
| --- | --- |
| `npm ci` | Passed from a fresh detached worktree; 601 packages installed from the committed graph and Prisma Client 6.19.0 generated |
| `npm ls @radix-ui/react-toast --depth=0` | Passed; one direct `@radix-ui/react-toast@1.2.15` installation |
| Node module resolution | Passed; resolved to `node_modules/@radix-ui/react-toast/dist/index.js`, version `1.2.15` |
| TypeScript | Passed with `--noEmit --pretty false --incremental false` |
| Production build | Passed with the established 6 GB heap; Next.js 15.5.21 compiled 205 App Router entries plus `/support` and `/notifications` |
| Focused toast/UI tests | No focused test file exists; production compilation covers the shared component |
| Media-session contract tests | Passed: 23/23 across the generated-model contract, canonical gate, and media-session integration files |
| Release-critical Epic 4/5 and cumulative regression package | Passed: 146/146 across 28 files |
| `git diff --check` | Passed |

A broader historical union of every test file introduced by the original Epic 4 and Epic 5 commits produced 154 passes and one failure in `material-scope-change.integration.test.ts`. The same failure reproduces unchanged at pre-toast commit `813204a717772cd3865340ae2678c909db234250`; it returns the existing fail-closed `409` where the older fixture expects `200`. This checkpoint did not alter that test or any application source, so the result is documented as unrelated baseline behavior rather than attributed to the dependency declaration.

## Behavior and Regression Statement

- No application source was changed.
- No toast component was rewritten.
- The RV-8 media-session evidence correction remains unchanged.
- No permission, recording, review, Trust Score, publication, customer-access, or media-session behavior was modified.
- No database or deployment action is part of this checkpoint.

## Readiness Verdict

The corrected cumulative RV-8 source now installs, resolves the toast module, type-checks, passes the release-critical regression package, and builds reproducibly from a fresh worktree. It is ready for Product Owner review and, only after separate approval, deterministic packaging and deployment.

No package was assembled, uploaded, mounted, or deployed during this checkpoint. RV-8 remains paused, and RV-9 and Epic 8 have not begun.
