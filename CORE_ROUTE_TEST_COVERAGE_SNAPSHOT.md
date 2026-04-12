# Core route test coverage snapshot

**Date:** 2026-04-11  
**Purpose:** Single place to see **integration-style route tests** added for **customer** flows (per **`CORE_USER_FLOW_INTEGRATION_TEST_AUDIT.md`** and passes 1–5). Deep per-route notes live in the linked `*_INTEGRATION_TESTS_NOTES.md` files.

---

## 1. Implemented test files and covered routes

| Test file | HTTP | Route(s) |
|-----------|------|----------|
| `src/app/api/reviews/review-create-expire.integration.test.ts` | `POST` | `/api/reviews/create`, `/api/reviews/window/expire` |
| `src/app/api/bookings/booking-media-cancel.integration.test.ts` | `GET`, `POST` | `/api/bookings/[id]/media`, `/api/bookings/[id]/cancel` |
| `src/app/api/users/favorites/favorites-routes.integration.test.ts` | `GET`, `POST`, `DELETE` | `/api/users/favorites`, `/api/users/favorites/[id]` |
| `src/app/api/bookings/booking-crud.integration.test.ts` | `GET`, `POST`, `GET`, `PUT`, `DELETE` | `/api/bookings`, `/api/bookings/[id]` |
| `src/app/api/availability/availability-check.integration.test.ts` | `POST` | `/api/availability/check` |
| `src/app/api/reviews/review-window-start.integration.test.ts` | `POST` | `/api/reviews/window/start` |

**Runner:** Vitest (`vitest.config.ts` — `src/**/*.test.ts`; files use the `*.integration.test.ts` suffix).

**Companion docs:** `REVIEW_ROUTE_INTEGRATION_TESTS_NOTES.md`, `BOOKING_ROUTE_INTEGRATION_TESTS_NOTES.md`, `BOOKING_CRUD_ROUTE_INTEGRATION_TESTS_NOTES.md`, `FAVORITES_ROUTE_INTEGRATION_TESTS_NOTES.md`, `AVAILABILITY_REVIEW_START_INTEGRATION_TESTS_NOTES.md`.

---

## 2. Key behaviors now protected by tests

**Reviews (create / expire)**  
- Unauthenticated **401**; booking owner **403** on create.  
- **409** `REVIEW_WINDOW_CONTEXT_MISMATCH` and `REVIEW_WINDOW_MEDIA_MISMATCH` on create.  
- Happy-path create with **`$transaction`** + **`createAdminAuditLog`** (mocked).  
- Expire: **401** / **403**; **200** when window already non-active; **200** active path with notify side-effect (mocked).

**Bookings (media / cancel)**  
- Media: **401** / **404** / **403**; **`mediaAsset.findMany`** `where` includes approved/active + **customer** visibility set; normalized **`assets`** (**`bytes`** string), **`images`** / **`videos`** split.  
- Cancel: **401** / **404** / **403**; **200** with **`booking.update`** to **`CANCELED`**, **`mapBookingToContract`** on hydrate, **`cancellation_reason`** / **`refund_requested`** from JSON (including omitted fields).

**Bookings (CRUD / list — pass 4)**  
- List **401** without user/vendor context; **vendorId**-only list; auth **`userId`** overrides conflicting query; pagination + contract mapping.  
- Create **400**/**404**/**401**/**409** `SLOT_UNAVAILABLE` (**`checkVendorSlotAvailability`** mocked); **200** with **`customerMetadata`** string + **`meta`**; **`amount`** explicit or from **`service.price`**.  
- Detail **401**/**404**/**403**/**200**; **PUT** ownership + **`status`** uppercasing; **DELETE** soft cancel (**`CANCELED`**) distinct from **`POST …/cancel`**.

**Favorites**  
- GET **401** with no identity; empty list **200**; **`userId`** list scope prefers **auth** over conflicting query param.  
- GET normalized rows, optional **`mediaAsset`** preview branch, mocked **`getVendorReviewAggregatesForPublic`**.  
- POST **401** / **400** / **404**; identity via **`x-user-id`**; **200** **`upsert`** (idempotent); **`service_id`** alias.  
- DELETE **401** / **400** / **404**; **200** by favorite id or by **`serviceId`** (`OR` lookup).

**Availability (pass 5)**  
- **`POST /api/availability/check`:** route **400** validation; **200** with **real** **`checkVendorSlotAvailability`** against mocked **`prisma.booking.findMany`** (free vs reserved slot); optional **`serviceId`** on **`where`**.

**Review window start (pass 5)**  
- **`POST /api/reviews/window/start`:** **400** required fields; **404** booking/vendor and media session alignment; **403** without accepted **`video_access`** consent; **200** reuse vs create + **`scheduleReviewReminder`** (mocked) when **created**.

---

## 3. Highest-value remaining untested routes (customer flows)

Still high leverage for the same “wizard → my-bookings” and review-start journeys, but **not** yet covered by `*.integration.test.ts` (or only partially):

| Area | Routes (examples) | Why it matters |
|------|-------------------|----------------|
| **Availability vendor calendar** | `GET` `/api/availability/vendor/[vendorId]` | Wizard date grid; not yet covered by integration tests. |
| **Booking POST edge branches** | `POST` `/api/bookings` (no **`service_id`**, auto-create service path) | Heavier **`service.findFirst`** / **`service.create`** chains; pass 4 uses explicit **`service_id`** for most create tests. |
| **Review aux** | `POST` `/api/reviews/prompt-event`, `POST` `/api/reviews/sentiment` | Lower than start/create/expire for **trust**, but part of **`SmartVideoPlayer`** chain. |
| **Consent (customer token path)** | `/api/consent/*` | Separate trust surface if consent is required before review start. |

**E2E / browser:** Not in repo for these flows; optional later.

---

## 4. Recommended next test batch only

**Single batch:** **`GET /api/availability/vendor/[vendorId]`** (and optionally **`POST /api/reviews/prompt-event`** + **`sentiment`**) — vendor discovery slot payload + **`SmartVideoPlayer`** aux routes; or **`/api/consent/*`** customer-facing mutations if consent flow is prioritized over aux review telemetry.

---

## 5. Current test strategy (short)

Tests are **route-level integration**: real Next **`GET`/`POST`/`DELETE`** handlers are invoked with **`NextRequest`/`Request`** and JSON bodies. **`@/server/db` (`prisma`)** and **`getUserIdFromRequest`** are **mocked** (`vi.hoisted` + `vi.mock`) so suites run fast without a live DB. Cross-cutting libs are mocked only when necessary (**`createAdminAuditLog`**, **`notifyReviewWindowClosedWithoutSubmission`**, **`getVendorReviewAggregatesForPublic`**, **`checkVendorSlotAvailability`** on booking create, **`scheduleReviewReminder`** on review window start). **`POST /api/availability/check`** keeps **real** **`checkVendorSlotAvailability`** with mocked **`prisma.booking.findMany`**. Pure helpers (**`assertReviewWindowActive`**, **`getApprovedActiveBaseWhere`**, **`mapBookingToContract`**, **`getOrCreateActiveReviewWindow`**) stay real where they define the contract under test. This is **not** E2E: no browser, no Next server boot.
