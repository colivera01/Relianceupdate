# Booking CRUD route integration tests (pass 4)

**Date:** 2026-04-11  
**Source:** `CORE_ROUTE_TEST_COVERAGE_SNAPSHOT.md` (next batch: bookings list/create/detail/update/delete).

## What was added

- **`src/app/api/bookings/booking-crud.integration.test.ts`** — Vitest suite importing handlers from:
  - `src/app/api/bookings/route.ts` — **`GET`** (list), **`POST`** (create)
  - `src/app/api/bookings/[id]/route.ts` — **`GET`** (detail), **`PUT`**, **`DELETE`** (soft cancel via **`CANCELED`**)

## Mocking

| Dependency | Mock |
|------------|------|
| `@/server/db` | Hoisted **`prisma`**: **`booking`**, **`vendor`**, **`service`**
| `@/lib/auth` | **`getUserIdFromRequest`**
| `@/lib/availability-slots` | **`checkVendorSlotAvailability`** (default **`{ available: true }`**; **409** path uses **`available: false`**) |

**Real (not mocked):** **`mapBookingToContract`**, **`buildCustomerMetadataForCreate`** behavior via real **`POST`** body → persisted **`customerMetadata`** string on **`prisma.booking.create`** `data`.

## Coverage matrix

### `GET /api/bookings`

- **401** — no **`userId`** (auth + query) and no **`vendorId`**.
- **200** — list by **`vendorId`** only (no auth), **`where`** vendor-scoped.
- **200** — auth **`userId`** wins over conflicting **`?userId=`** query (list scoped to auth).
- **200** — pagination + **`mapBookingToContract`** on rows.

### `POST /api/bookings`

- **400** — missing **`vendor_id`**.
- **404** — vendor not found.
- **401** — no user after vendor resolution (no auth, no **`user_id`** body).
- **409** `SLOT_UNAVAILABLE` — **`checkVendorSlotAvailability`** returns unavailable when **`booking_date`** + **`booking_time`** present.
- **200** — **`customerMetadata`** JSON string on create + **`meta`** mirror; explicit **`amount`**.
- **200** — **`amount`** from **`service.findUnique`** **`price`** when **`amount`** omitted.

### `GET /api/bookings/[id]`

- **401** / **404** / **403** / **200** owner contract.

### `PUT /api/bookings/[id]`

- **401** / **403** (non-owner).
- **200** — **`status`** uppercased, **`title`**, **`client_name`** passed to **`update`**.

### `DELETE /api/bookings/[id]`

- **401** / **404** / **403** / **200** — **`update`** `{ status: 'CANCELED' }` (distinct from **`POST …/cancel`** route in pass 2).

## Run

```bash
npx vitest run src/app/api/bookings/booking-crud.integration.test.ts
```

## Follow-ups

- **`POST`** without **`service_id`** (auto-pick / auto-create service branches) with heavier **`service.findFirst`** / **`service.create`** mocks.
- **`GET`** list policy tests if product tightens “query **`userId`** without auth” behavior.
