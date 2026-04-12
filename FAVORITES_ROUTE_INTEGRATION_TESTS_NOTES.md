# Favorites route integration tests (pass 3)

**Date:** 2026-04-11  
**Source:** `CORE_USER_FLOW_INTEGRATION_TEST_AUDIT.md` §3 (favorites).

## What was added

- **`src/app/api/users/favorites/favorites-routes.integration.test.ts`** — Vitest suite calling:
  - **`GET`** / **`POST`** from `src/app/api/users/favorites/route.ts`
  - **`DELETE`** from `src/app/api/users/favorites/[id]/route.ts`

## Mocking (aligned with passes 1–2)

| Dependency | Mock |
|------------|------|
| `@/server/db` | **`vi.hoisted`** `prisma`: **`favorite.count`**, **`favorite.findMany`**, **`favorite.upsert`**, **`favorite.findFirst`**, **`favorite.delete`**, **`mediaAsset.findMany`**, **`service.findUnique`**, **`user.upsert`** |
| `@/lib/auth` | **`getUserIdFromRequest`** |
| `@/lib/public-review-aggregates` | **`getVendorReviewAggregatesForPublic`** → avoids **`prisma.review.groupBy`** in GET |

**Not mocked:** `getApprovedActiveBaseWhere` / `getVisibilityStatusesForAudience` on GET media branch (real `where` on **`mediaAsset.findMany`** when favorites exist).

## Coverage matrix

### `GET /api/users/favorites`

| Case | Behavior |
|------|----------|
| No identity | **401** when auth and `userId` query are both absent (after `trim` / fallback). |
| Empty list | **200**, `favorites: []`, **`mediaAsset.findMany`** not called. |
| Auth wins over query | With auth **`alice`** and `?userId=bob`, **`count` / `findMany`** use **`userId: 'alice'`**. |
| Normalized row + preview + aggregates | **200**, mapped fields, **`previewMediaUrl`**, mocked vendor aggregates. |

### `POST /api/users/favorites`

| Case | Behavior |
|------|----------|
| No identity | **401** (no auth, no header, no body `userId`). |
| **`x-user-id`** | Resolves **`userId`** for **`user.upsert`** / **`favorite.upsert`** when **`getUserIdFromRequest`** is null. |
| Missing **`serviceId`** | **400** `serviceId is required`. |
| Unknown service | **404**, **`user.upsert`** skipped. |
| Upsert success / duplicate | **200**; route uses **`upsert`** (no **409** duplicate error — idempotent). |
| Body alias | **`service_id`** accepted like **`serviceId`**. |

### `DELETE /api/users/favorites/[id]`

| Case | Behavior |
|------|----------|
| No identity | **401**. |
| Empty **`id`** | **400** `Favorite id is required`. |
| No row for user | **404** `Favorite not found` (another user’s favorite is not visible — **404**, not **403**). |
| By favorite id | **200**, **`delete`** by resolved internal id. |
| By **`serviceId`** | **200**; **`findFirst`** **`OR`** matches **`serviceId`**. |

## Run

```bash
npx vitest run src/app/api/users/favorites/favorites-routes.integration.test.ts
```

## Follow-ups

- **`GET`** with only query **`userId`** (no auth) — current product behavior; add explicit contract tests if policy tightens.
- E2E discover/favorites pages (out of scope for this pass).
