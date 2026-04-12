# Booking identity alignment (outside `/my-bookings`)

**Date:** 2026-04-12  
**Goal:** One client-side resolution path for the **customer user id** used on booking APIs, aligned with `/my-bookings`.  
**Shared helper:** `src/lib/customer-user-id.ts` → **`resolveCustomerUserId(authUserId?: string)`**

---

## Resolution order (canonical)

1. **`useAuth().user?.id`** when provided by `AuthProvider`.
2. Else **`localStorage`** key **`userData`** (JSON `.id`).
3. Else legacy **`localStorage`** key **`user`** (JSON `.id`).

**HTTP:** When a resolved id exists, callers send **`x-user-id: <id>`** on booking requests that use `getUserIdFromRequest` on the server.

**Query `userId`:** `GET /api/bookings/[id]` and `POST /api/bookings` **do not** read a `userId` query parameter today — only **`getUserIdFromRequest`** (Bearer / cookies / **`x-user-id`**). List endpoint `GET /api/bookings` still accepts **`userId`** query for parity with older clients; confirmation and booking wizard do not need that query for correctness.

---

## Pages updated (non–`/my-bookings`)

| Page | File | Before | After |
|------|------|--------|--------|
| **Booking confirmation** | `src/app/(user)/booking/[serviceId]/confirmation/page.tsx` | **`localStorage.user` only** via `getUserIdFromLocal()` | **`useAuth()`** + **`resolveCustomerUserId(user?.id)`**; **`loadBooking`** refetched when **`user?.id`** changes |
| **Booking wizard** | `src/app/(user)/booking/[serviceId]/page.tsx` | **`localStorage.user` only** in `handleConfirmBooking` | **`useAuth()`** + **`resolveCustomerUserId(user?.id)`** for **`POST /api/bookings`** body `user_id` and **`x-user-id`** header |

---

## `/my-bookings` (dedupe only)

| Page | File | Change |
|------|------|--------|
| **My Bookings** | `src/app/(user)/my-bookings/page.tsx` | Imports **`resolveCustomerUserId`** from **`@/lib/customer-user-id`**; local duplicate removed. **Behavior unchanged.** |

---

## Call sites: `GET /api/bookings/[id]`

| Caller | Headers |
|--------|---------|
| **Confirmation** | **`x-user-id`** when `resolveCustomerUserId` non-null |

No other App Router **`(user)`** page calls **`GET /api/bookings/[id]`** (repo search). **`src/sdk/bookings.ts`** / **`useBookings`** are unchanged; not used by the updated pages.

---

## Related surfaces (not changed)

| Surface | Reason |
|---------|--------|
| **`/service/[serviceId]`** | Uses **`localStorage.user`** for **favorites**, not booking CRUD — out of scope for this alignment pass. |
| **`/profile-settings`** | Uses **`userData`** for profile; not booking fetch alignment. |

---

## Risks mitigated

- **Confirmation** after login with **`userData`** only: **`useAuth`** + **`userData`** fallback matches **my-bookings**.
- **Booking create** with auth in context but stale **`user`**: prefers **`useAuth().user.id`** first.

---

## Follow-ups (optional)

- Align **`src/sdk/bookings.ts`** / **`useBookings`** with the same header + resolver if those hooks gain first-party page usage.
- Consider **`GET /api/bookings/[id]`** accepting optional **`userId`** query mirroring list route (server change + low value unless unifying middleware).
