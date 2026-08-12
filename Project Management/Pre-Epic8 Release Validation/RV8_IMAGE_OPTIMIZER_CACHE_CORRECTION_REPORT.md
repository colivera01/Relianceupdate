# RV-8 Image Optimizer Cache Correction Report

## Checkpoint

- **Objective:** Prevent Next.js image optimization from writing its runtime disk cache beneath the read-only Azure Run From Package mount.
- **Repository:** `C:\Users\Cesar Olivera\Project Reliance-rv8-residence`
- **Branch:** `codex/rv8-residence-location-correction`
- **Starting commit:** `90a21ab3e6f8ef3b78d319fb9533aea491369466`
- **Scope:** Image optimizer cache behavior only.
- **Deployment:** Not performed. Product Owner deployment approval remains required.

## Root Cause

The approved beta package uses Next.js standalone output with Azure App Service Run From Package. Azure mounts the deployed package at `/home/site/wwwroot` as read-only. Next.js image optimization was active with its default filesystem cache, whose directory is derived from the application build directory as `.next/cache/images`.

An optimizer request could therefore complete and return HTTP 200 while the asynchronous cache write attempted to create `/home/site/wwwroot/.next/cache`. That write failed with `ENOENT`, followed by `Failed to write image to cache` and an unhandled rejection. A successful image response did not make the runtime gate healthy.

Implementation evidence was confirmed in the installed Next.js 15.5.21 runtime at `node_modules/next/dist/server/image-optimizer.js`: disk caching is enabled only when `images.maximumDiskCacheSize` is not zero, and cache reads/writes return without filesystem access when disk caching is disabled.

References:

- Next.js Image configuration documents `images.maximumDiskCacheSize: 0` as the supported way to disable image disk caching: <https://nextjs.org/docs/app/api-reference/components/image>
- Next.js self-hosting documentation states that caches use the local filesystem by default: <https://nextjs.org/docs/app/guides/self-hosting>
- Azure Run From Package documentation states that `wwwroot` is mounted read-only: <https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package>

## Chosen Correction

`next.config.js` now sets:

```js
images: {
  maximumDiskCacheSize: 0,
},
```

This is a supported Next.js 15.5.21 configuration. It preserves the `/_next/image` optimizer and image transformations while disabling only its runtime disk cache. The correction does not add a writable directory, does not change image authorization, and does not disable optimization globally.

The packaged `required-server-files.json` was inspected and confirmed:

- `images.maximumDiskCacheSize = 0`
- `images.unoptimized = false`

## Alternatives Considered

### Relocate the cache to a writable directory

Not selected. The current Next.js image optimizer derives its cache from the build directory, and this application does not have an existing supported image-cache relocation or custom incremental cache implementation. Introducing one would be broader than the confirmed defect.

### Custom image loader or external image service

Not selected. No custom loader is currently configured, and adding a CDN or image service would change architecture, delivery behavior, configuration, and operational dependencies.

### Disable image optimization globally

Not selected. `images.unoptimized: true` would remove optimizer behavior from the application. The supported disk-cache setting fixes the read-only write without that broader behavior change.

## Files Changed

- `next.config.js`
  - Preserves image optimization and disables its filesystem cache.
- `src/lib/deployment/image-optimizer-cache.test.ts`
  - Verifies disk caching is disabled and global unoptimized mode is not enabled.
- `Project Management/Pre-Epic8 Release Validation/RV8_IMAGE_OPTIMIZER_CACHE_CORRECTION_REPORT.md`
  - Records inspection, decision, validation, and release status.

No application route, component, API, schema, migration, dependency, Azure resource, or deployment script changed.

## Runtime Cache Behavior

- **Writable cache path introduced:** None.
- **Writes inside mounted `wwwroot`:** None from the image optimizer.
- **Optimizer endpoint:** Preserved.
- **Transformation result:** Preserved.
- **Disk cache persistence:** Disabled.
- **Restart behavior:** No optimizer disk cache needs to survive a restart.
- **Expected tradeoff:** Repeated direct optimizer requests may repeat transformation work instead of receiving a filesystem-cache hit.

The active repository contains no source imports of `next/image`; current pages use native image elements. The optimizer route remains available and was tested directly because it is reachable at runtime.

## Azure Compatibility

The correction is compatible with Azure Run From Package because it requires no runtime write within `/home/site/wwwroot`. It also avoids maintaining writable application state beside the mounted package.

An exact extracted standalone ZIP was started locally and tested from its extracted package contents. The package contained no `.env` file or `.next/cache` directory before startup, and no `.next/cache` directory appeared after repeated optimizer requests.

## Privacy And Security Impact

- Public/Private Service Video filtering is unchanged.
- Protected customer media authorization is unchanged.
- Signed media access is unchanged.
- Private media remains subject to its existing protected routes and response controls.
- No cache file stores a private URL, SAS value, secret, cookie, token, or user-specific response.
- No public cache is introduced.
- No media becomes Public because of this correction.
- No review, rating, Trust Score input, permission event, lifecycle event, or customer access grant is created.

## Validation Results

### Clean installation

Command:

```text
npm ci
```

Result: **Passed** in a clean detached worktree at the starting commit with only this candidate patch applied. Prisma Client generation completed and 601 packages were installed from the committed dependency graph. Existing dependency advisories were reported and were not changed in this checkpoint.

### Focused configuration and media boundary tests

Command:

```text
npx vitest run src/lib/deployment/image-optimizer-cache.test.ts src/app/api/public/media/[assetId]/route.test.ts src/app/api/bookings/[id]/media/[assetId]/download/route.test.ts src/lib/service-video-publication.test.ts
```

Result: **Passed** - 4 test files, 11 tests.

Coverage included:

- optimizer disk-cache configuration;
- Public media filtering;
- customer Private Service Video asset authorization;
- exact-media publication evidence behavior.

### TypeScript

Command:

```text
npx tsc --noEmit --pretty false --incremental false
```

Result: **Passed**.

### Production build

Command:

```text
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

Result: **Passed** with Next.js 15.5.21. Compilation, type validation, page-data collection, and static generation completed. Missing database and notification environment warnings were expected in the isolated clean worktree and did not fail the build.

### Exact-ZIP package inspection

- Package: `reliance-rv8-image-cache-correction.zip`
- SHA-256: `4acdf7ba509ce18eec88c5ef2f58cf42504916a0c6bc51913ae28f28afe76fa5`
- Size: 70,371,355 bytes
- Forbidden application files: **0**
- `.env` files: **0**
- Packaged `.next/cache`: **Absent**
- Extracted `server.js`: **Present**

Local validation evidence was stored outside the repository at:

`C:\Users\Cesar Olivera\Documents\Codex\release-evidence\pre-epic8\rv8-image-cache-correction-20260812-075250`

The package is a local validation artifact only and was not uploaded or deployed.

### Exact-ZIP startup and optimizer requests

Result: **Passed**.

- Standalone server became ready on `127.0.0.1:3199`.
- Homepage returned HTTP 200.
- `/reliance-logo.png` returned HTTP 200, `image/png`, 415,435 bytes.
- Six consecutive optimizer requests returned HTTP 200, `image/webp`, 49,928 bytes.
- Every optimizer response reported `MISS`, consistent with disk caching being disabled.
- First optimizer request completed in 1,448 ms; subsequent requests completed in 150-160 ms.
- `.next/cache` remained absent after all requests.
- No `Failed to write image to cache` message occurred.
- No `ENOENT` cache error occurred.
- No unhandled rejection occurred.

The isolated exact-ZIP stderr contained only expected warnings for intentionally absent database, storage, email, SMS, and base-URL environment configuration.

### Diff integrity

Command:

```text
git diff --check
```

Result: **Passed**.

## Remaining Limitations

- Optimized images are transformed without a persistent filesystem cache, so repeated requests can consume additional CPU compared with a writable cache or managed image CDN.
- The application currently has no source use of `next/image`, reducing the practical performance impact today. If future work adopts `next/image` broadly, cache/CDN strategy should be reconsidered in its own approved checkpoint.
- This checkpoint did not test Azure after deployment because deployment was explicitly prohibited.
- Existing dependency advisories and isolated missing-environment warnings remain outside this correction.

## Release Decision

The correction is **ready for Product Owner deployment approval**.

It resolves the confirmed Run From Package image-cache write defect without disabling image optimization, adding writable package state, changing media access, or altering any unrelated workflow. RV-8 remains paused, RV-9 has not begun, and Epic 8 has not begun.
