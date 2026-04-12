# Availability check + review window start — integration tests (pass 5)

**Date:** 2026-04-11  
**Source:** `CORE_ROUTE_TEST_COVERAGE_SNAPSHOT.md` (next batch after booking CRUD).

## Files

| File | Route |
|------|--------|
| `src/app/api/availability/availability-check.integration.test.ts` | `POST /api/availability/check` |
| `src/app/api/reviews/review-window-start.integration.test.ts` | `POST /api/reviews/window/start` |

## `POST /api/availability/check`

### Mocking

- **`@/server/db` (`prisma.booking.findMany`)** — hoisted mock only.  
- **`checkVendorSlotAvailability`** is **not** mocked: the real implementation in `@/lib/availability-slots` runs against the mocked **`findMany`** (same pattern as exercising slot logic without a full DB).

### Cases

- **400** — missing **`vendorId`**, **`booking_date`**, or **`booking_time`** (route validation before slot check).
- **200** **`available: true`** — **`findMany`** returns `[]`; asserts **`serviceId`** appears in **`where`** when sent in body.
- **200** **`available: false`** — **`findMany`** returns a booking whose **`scheduledFor`** matches the requested slot (**HH:mm** alignment).
- **Request shape** — body without **`serviceId`** → **`findMany`** `where` has no **`serviceId`** key.

**Note:** `check` route does **not** use **`getUserIdFromRequest`**.

## `POST /api/reviews/window/start`

### Mocking

- **`@/server/db`** — hoisted **`prisma`**: **`booking.findUnique`**, **`mediaSession.findUnique`**, **`consentRecord.findFirst`**, **`reviewWindow.findFirst`**, **`reviewWindow.create`** (used by real **`getOrCreateActiveReviewWindow`** in `@/lib/review-capture`).
- **`@/lib/review-notifications`** — **`scheduleReviewReminder`** mocked (only invoked when a new window is **created**).

### Cases

- **400** — missing **`bookingId`**, **`vendorId`**, or **`mediaSessionId`**.
- **404** — booking missing; booking **`vendorId`** ≠ body **`vendorId`**; media session missing; media session **`vendorId`** or **`bookingId`** mismatch.
- **403** — no accepted **`video_access`** consent row (**`consentRecord.findFirst`** returns null).
- **200** existing window — **`reviewWindow.findFirst`** returns active window → **`created: false`**, **`scheduleReviewReminder`** not called.
- **200** new window — **`findFirst`** null, **`create`** returns row → **`created: true`**, **`scheduleReviewReminder`** called with expected context.

**Note:** Route does not call **`getUserIdFromRequest`** today (see TODO on handler).

## Run

```bash
npx vitest run src/app/api/availability/availability-check.integration.test.ts src/app/api/reviews/review-window-start.integration.test.ts
```

## Follow-ups

- **`GET /api/availability/vendor/[vendorId]`** (calendar payload).
- Harden **`window/start`** with **`getUserIdFromRequest`** + booking owner match (per **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`**) and extend tests when implemented.
