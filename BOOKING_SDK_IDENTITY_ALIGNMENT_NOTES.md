# Booking SDK — customer identity alignment

**Date:** 2026-04-12  
**Source:** `BOOKING_LIVE_DATA_COMPLETION_AUDIT.md` §2.1, §2.2, §4.4 (dual client stacks). The live-data audit was refreshed **2026-04-12** to mark this work **resolved**; this file remains the implementation reference.

## 1. Live customer-page pattern (reference)

| Surface | Identity |
|---------|-----------|
| `/my-bookings` | `resolveCustomerUserId(useAuth().user.id)`; **`GET /api/bookings?userId=…`** with header **`x-user-id`**; cancel/media with **`x-user-id`**. |
| Booking wizard | Same resolver; **`POST /api/bookings`** with **`x-user-id`** and body **`user_id`**. |
| Confirmation | Same resolver; **`GET /api/bookings/[id]`** with **`x-user-id`**. |

Server routes use **`getUserIdFromRequest`**, which honors **`x-user-id`** (and cookies/session) per `src/lib/auth.ts`.

## 2. Prior SDK / hooks gap

- **`bookingsSDK`** used the shared **`api`** client: **Bearer** from `localStorage` only, **no** **`x-user-id`**, and **`listBookings`** did not mirror the **`userId`** query default used on `/my-bookings`.
- **`useBookings*`** wrapped the SDK without passing session user id, so behavior could diverge from direct **`fetch`** on customer pages.

## 3. What changed

### `src/sdk/bookings.ts`

- Replaced **`api`** usage with **`fetch(..., { credentials: 'include' })`** plus explicit headers (same idea as **`favoritesSDK`**).
- Optional trailing argument **`authUserIdFromCaller?: string`** on each method (typically **`useAuth().user.id`**).
- **`resolveCustomerUserId(authUserIdFromCaller)`** supplies the header value; when the argument is omitted, storage fallbacks still apply (same order as live pages).
- **`x-user-id`** is sent whenever resolution yields a non-empty id.
- **`listBookings`:** if neither **`userId`** nor **`vendorId`** is in params, sets **`userId`** from the resolved id (matches my-bookings list URL).
- **`createBooking`:** maps snake_case / camelCase fields from the payload; sets **`user_id`** from **`user_id` / `userId` / resolved** so POST matches wizard behavior when the body omits **`user_id`**.
- **`cancelBooking`:** sends a JSON body (default reason + **`refund_requested`**) so **`request.json()`** on the route succeeds, matching my-bookings.

### `src/hooks/useBookings.ts`

- Uses **`useAuth()`** and passes **`user?.id`** into **`bookingsSDK`** on every call.
- Query keys include **`_authUserId`** (lists) or **`bookingKeys.detail(id, user?.id)`** so caches invalidate when the session user changes (same pattern as **`useFavorites`**).

## 4. Out of scope (this pass)

- Customer **page** components still use direct **`fetch`**; no migration to hooks.
- **`GET /api/bookings/[id]/media`** is not exposed on **`bookingsSDK`** (unchanged).

## 5. Direct SDK usage (non-React)

Pass the auth user id explicitly when you have it:

```ts
await bookingsSDK.getBooking(bookingId, sessionUserId);
```

Omit the second argument only when relying on **`resolveCustomerUserId(undefined)`** (local storage fallbacks), consistent with legacy behavior but weaker than passing **`useAuth().user.id`**.
