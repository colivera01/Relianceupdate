# Booking domain — live-data completion audit

**Date:** 2026-04-12  
**Scope:** Customer booking surfaces, `bookingsSDK`, `useBookings*`, and `src/app/api/bookings/*` for list / detail / create / cancel / media vs mock or non-persisted behavior.

**Legend:** **fully DB-backed** — Prisma read/write for the booking row and related entities the feature claims to show. **hybrid** — core booking from DB plus UI-only data, non-persisted POST fields, or parallel code paths (SDK vs `fetch`). **local/mock** — no server persistence or fake data. **placeholder** — UI shell with no backend.

---

## 1. Pages

### 1.1 `src/app/(user)/bookings/page.tsx`

| Area | Classification | Notes |
|------|----------------|-------|
| Entire page | **placeholder** | Server `redirect('/my-bookings')` only; no booking UI or data. |

---

### 1.2 `src/app/(user)/my-bookings/page.tsx`

| Action / behavior | Classification | Notes |
|-------------------|----------------|-------|
| Load list (`GET /api/bookings?userId=…`) | **fully DB-backed** | `prisma.booking.findMany` + `mapBookingToContract`. Uses `x-user-id` + query `userId` via `resolveCustomerUserId`. |
| Tab / search / sort | **local** | Client-side filters on the loaded list (`my-bookings` helpers); no extra API. |
| Cancel (`POST /api/bookings/[id]/cancel`) | **fully DB-backed** | Prisma `status: CANCELED`; then UI merges returned status. |
| Load media (`GET /api/bookings/[id]/media`) | **fully DB-backed** | Prisma `mediaAsset` scoped to booking + customer visibility rules. |
| Review capture (`SmartVideoPlayer`) | **hybrid** | Uses separate review APIs; booking row supplies context only. |

**Overall:** **hybrid** — list/cancel/media are DB-backed; presentation and review flows layer client logic on top.

---

### 1.3 `src/app/(user)/booking/[serviceId]/confirmation/page.tsx`

| Action / behavior | Classification | Notes |
|-------------------|----------------|-------|
| Load booking (`GET /api/bookings/[id]`) | **fully DB-backed** | Prisma + ownership check + contract mapping. `x-user-id` + `resolveCustomerUserId`. |
| Receipt download | **local** | Builds a **`.txt`** blob in the browser; not stored or served from DB. |
| Share (`navigator.share`) | **local** | Uses current URL only. |

**Overall:** **hybrid** — confirmation data is live; receipt is a client artifact.

---

### 1.4 `src/app/(user)/booking/[serviceId]/page.tsx` (wizard; in scope for “booking domain”)

| Action / behavior | Classification | Notes |
|-------------------|----------------|-------|
| Service + availability | **fully DB-backed** | `GET /api/services/[id]`, `GET /api/availability/vendor/...`. |
| Slot check | **fully DB-backed** | `POST /api/availability/check` before create. |
| Create booking (`POST /api/bookings`) | **fully DB-backed** | Prisma `booking.create`; `x-user-id` / `user_id` for actor. |
| Payment step UI | **resolved** (was **placeholder**) | **2026-04-12:** Wizard no longer shows card/PayPal inputs; final step is **Review & confirm** with explicit **no in-app payment** copy. |
| `user_notes`, `client_email`, `client_phone`, `custom_fields` | **resolved** (was **hybrid**) | **2026-04-12:** Persisted under **`Booking.customerMetadata`** and exposed as **`booking.customer_metadata`** on the contract; response **`meta`** is a deprecated mirror. |
| Booking amount | **resolved** (was **hybrid**) | **2026-04-12:** Wizard sends catalog **`amount`**; **`POST`** also defaults **`amount`** from **`Service.price`** when omitted. |

**Overall:** **hybrid** — list/cancel/media and create row persistence are DB-backed. **Resolved (2026-04-12):** SDK/hooks customer identity matches live **`fetch` + `x-user-id`** (§4.4; **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**). Customer pages still use direct **`fetch`** (no migration to hooks in that pass).

---

## 2. SDK and hooks

### 2.1 `src/sdk/bookings.ts`

| Method | Classification | Notes |
|--------|----------------|-------|
| `listBookings` / `getBooking` / `createBooking` / `updateBooking` / `deleteBooking` / `cancelBooking` | **resolved** (was **hybrid**) | **2026-04-12:** Uses **`fetch`** + **`credentials: 'include'`**, **`resolveCustomerUserId`**, and **`x-user-id`** on booking routes; **`listBookings`** defaults **`userId`** query when listing as a customer (parity with **`/my-bookings`**). Optional trailing **`authUserIdFromCaller`** (typically **`useAuth().user.id`**). Implementation detail: **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**. |

### 2.2 `src/hooks/useBookings.ts`

| Hook | Classification | Notes |
|-------|----------------|-------|
| `useListBookings`, `useGetBooking`, mutations | **resolved** (identity; was **hybrid**) | **2026-04-12:** **`useAuth().user.id`** passed into **`bookingsSDK`**; query keys include actor (**`_authUserId`** / **`bookingKeys.detail(id, user?.id)`**). Audited customer pages still use direct **`fetch`** (duplicate stack only). **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**. |

---

## 3. APIs (`src/app/api/bookings/*`)

| Route | Classification | Notes |
|-------|----------------|-------|
| `GET/POST /api/bookings` | **resolved** (create extras + amount; was **hybrid**) | **2026-04-12:** **POST** writes **`customerMetadata`** + **`amount`** to **`Booking`**; contract includes **`customer_metadata`**; **`meta`** deprecated mirror. Optional slot check unchanged. |
| `GET/PUT/DELETE /api/bookings/[id]` | **fully DB-backed** | Prisma read/update/soft-cancel (`DELETE` sets `CANCELED`). Auth via `getUserIdFromRequest` (no `x-user-id` in type defs but server supports it — see `src/lib/auth.ts`). |
| `POST /api/bookings/[id]/cancel` | **fully DB-backed** | Prisma cancel + optional reason in response metadata. |
| `GET /api/bookings/[id]/media` | **fully DB-backed** | Prisma media for booking + customer authorization. |

---

## 4. Highest-impact gaps (not fully “live” end-to-end)

1. **Customer contact + notes + custom fields on create** — **Resolved (2026-04-12):** Stored in **`Booking.customerMetadata`** and returned on booking contract as **`customer_metadata`** (see **`BOOKING_CREATE_PERSISTENCE_NOTES.md`**).

2. **Payment step** — **Resolved (2026-04-12):** Placeholder card UI removed; wizard and confirmation state clearly that **no** in-app payment is processed.

3. **`amount` / pricing on create** — **Resolved (2026-04-12):** Wizard sends **`amount`**; API persists service price when body omits **`amount`**.

4. **Dual client stacks (customer identity on SDK)** — **Resolved (2026-04-12):** **`bookingsSDK`** / **`useBookings`** now mirror live pages (**`x-user-id`**, **`resolveCustomerUserId`**, list **`userId`** default where applicable). Remaining nuance: pages still use **`fetch`** alongside the SDK (optional future migration to hooks). **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**.

5. **`/bookings` route** — Redirect-only; fine for routing, but any expectation of a second booking hub is unmet.

---

## 5. Smallest implementation sequence (toward consistently DB-backed)

1. **Persist create-side extras (minimal schema)** — **Done (2026-04-12):** **`customerMetadata`** JSON on **`Booking`** + **POST** mapping (see notes doc).

2. **Set `amount` from the wizard** — **Done (2026-04-12):** Wizard passes **`amount`**; API still defaults from **`Service.price`** if omitted.

3. **Payment step** — **Done (2026-04-12):** Confirm-only flow + honest copy. Medium term: integrate a real payment + store reference on the booking.

4. **Unify customer identity on SDK** — **Done (2026-04-12):** **`bookingsSDK`** + **`useBookings`** attach **`x-user-id`** and align query/body behavior with **`/my-bookings`** / wizard / confirmation (**`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**). Optional follow-up: migrate customer pages to **`useBookings`** to remove duplicate **`fetch`**.

5. **Optional:** Use **`useGetBooking`** on the confirmation page for cache consistency with list mutations (after step 4).

---

## 6. Summary table (requested pages / layers)

| Surface | Classification |
|---------|----------------|
| `/bookings` | **placeholder** (redirect) |
| `/my-bookings` | **hybrid** (DB list/actions + client UX) |
| `/booking/[serviceId]/confirmation` | **hybrid** (DB detail + local receipt) |
| Booking wizard `/booking/[serviceId]` | **hybrid** (DB service/availability/create; **resolved:** no fake payment UI; persisted create extras + amount — see §1.4) |
| `bookingsSDK` + `useBookings` | **hybrid** (pages still **`fetch`**; **resolved:** customer identity / **`x-user-id`** parity — **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`**) |
| `api/bookings/*` core CRUD | **hybrid** to **fully DB-backed** (**resolved:** **POST** persists **`customerMetadata`** + **`amount`**; detail/list include contract **`customer_metadata`**) |
