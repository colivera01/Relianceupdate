# Booking route integration tests (pass 2)

**Date:** 2026-04-11  
**Source:** `CORE_USER_FLOW_INTEGRATION_TEST_AUDIT.md` §2 (cancel), §5 (booking media).

## What was added

- **`src/app/api/bookings/booking-media-cancel.integration.test.ts`** — Vitest suite calling:
  - **`GET`** from `src/app/api/bookings/[id]/media/route.ts`
  - **`POST`** from `src/app/api/bookings/[id]/cancel/route.ts`

## Mocking (same style as pass 1 / review routes)

| Dependency | Mock |
|------------|------|
| `@/server/db` | **`vi.hoisted`** `prisma` with **`booking.findUnique`**, **`booking.update`**, **`mediaAsset.findMany`** |
| `@/lib/auth` | **`getUserIdFromRequest`** |

**Not mocked:** `getApprovedActiveBaseWhere`, `getVisibilityStatusesForAudience` from `@/lib/media-visibility` (used in real **`findMany`** argument); **`mapBookingToContract`** on cancel hydrate path.

## Coverage matrix

### `GET /api/bookings/[id]/media`

| Case | Expectation |
|------|-------------|
| Unauthenticated | **401**, `Unauthorized` |
| Unknown booking | **404**, **`findMany`** not called |
| Other user’s booking | **403**, **`findMany`** not called |
| Visibility contract | **`findMany`** `where` includes **`deletedAt: null`**, **`moderationStatus` / `archiveStatus`**, **`visibilityStatus.in`** = public + customer_only, **`mediaSession.bookingId`** |
| Success | **200**, `success`, `bookingId`, **`assets`** normalized (**`bytes`** string from **`BigInt`**), **`images`** / **`videos`** by **`mimeType`** prefix |

### `POST /api/bookings/[id]/cancel`

| Case | Expectation |
|------|-------------|
| Unauthenticated | **401** |
| Unknown booking | **404**, **`update`** not called |
| Other user’s booking | **403**, **`update`** not called |
| Success | **200**, **`booking.update`** `{ status: 'CANCELED' }`, response **`booking`** contract, **`cancellation_reason`** / **`refund_requested`** from JSON body |
| Body optional fields | **`{}`** → **`cancellation_reason`** / **`refund_requested`** absent on response |

## Run

```bash
npx vitest run src/app/api/bookings/booking-media-cancel.integration.test.ts
```

## Follow-ups (audit order)

- **`GET/POST /api/bookings`**, **`GET/PUT/DELETE /api/bookings/[id]`** (list/detail/update).
- E2E / test DB (not in this pass).
