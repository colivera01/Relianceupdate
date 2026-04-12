# Booking → media → video → review / consent — flow map

Short **current-code** path summary. Details and routes: **`BOOKING_MEDIA_REVIEW_CHAIN_AUDIT.md`**.  
**Server trust (2026-04-12):** **`/api/reviews/create`** enforces review window ↔ booking/vendor (+ optional **`mediaSessionId`**); **`/api/reviews/window/expire`** requires authenticated **booking owner**.

---

## A. Customer: `/my-bookings` → video → review

1. **Open** `/my-bookings` → `GET /api/bookings?userId=…` + `x-user-id`.
2. **Optional:** `POST /api/bookings/[id]/cancel` (separate from media chain).
3. **Load media:** tap **Load Authorized Media** (needs `vendor_id`, session user id) → `GET /api/bookings/[id]/media` + `x-user-id`.
4. **Response** → `assets` / `videos` in UI state; pick a video chip.
5. **If** `blobUrl` + `mediaSessionId` + `vendor_id` → mount **`SmartVideoPlayer`**.
6. **If** `reviewCaptureEnabled` **and** resolved **`userId`** (from `resolveCustomerUserId` on `/my-bookings`):
   - Each review `POST` includes **`x-user-id`** + JSON body.
   - `POST /api/reviews/window/start` `{ bookingId, vendorId, mediaSessionId }`  
     → **requires** DB: `ConsentRecord` `video_access` + **`accepted`** for same triple (unchanged).
   - On success → timed overlays → `prompt-event` / `sentiment` / optional **`create`** (server matches window to body) / **`window/expire`** (server requires same booking owner).
7. **Watch-only:** `reviewCaptureEnabled` **false** (terminal cancelled on `/my-bookings`) **or** **no `userId`** → **video only**, no review API calls.

---

## B. Consent (parallel / prerequisite)

1. Something calls **`POST /api/consent/request`** with `bookingId`, `vendorId`, `mediaSessionId`, `consentType` (e.g. `video_access`) → token + link **`/consent/[token]`** (no in-repo customer UI for “request” today).
2. Customer opens **`/consent/[token]`** → `GET /api/consent/[token]`.
3. **Accept** → `POST /api/consent/accept` → record **`accepted`**.
4. **Then** step A6 `window/start` can succeed for that booking/vendor/session.

---

## C. Booking read without media (same booking id, different UI)

- **`/booking/[serviceId]/confirmation?bookingId=`** → `GET /api/bookings/[id]` + `x-user-id` (local user only) → **no** media/review components in this file.

---

## D. Identity at a glance

| Call | Typical customer header on `/my-bookings` |
|------|-------------------------------------------|
| List + media | **`x-user-id`** (set by page) |
| **All five review routes** from `SmartVideoPlayer` | **`x-user-id`** + `Content-Type: application/json` on every call when **`reviewApisEnabled`** (same resolver as list/media). If `userId` is missing, **no** review calls — **watch-only**. |
| **Server (after client sends headers)** | **`create`** and **`expire`** resolve identity via **`getUserIdFromRequest`**; **`expire`** also checks **booking ownership**. **`window/start` / `prompt-event` / `sentiment`** unchanged on server (consent + window state only where applicable). |

---

## E. Status → review capture (UI only)

| Booking status (normalized) | `reviewCaptureEnabled` on `/my-bookings` |
|-----------------------------|-------------------------------------------|
| `canceled` / `cancelled` | **false** (watch-only) |
| All other keys | **true** when `userId` resolves — full review chain with **`x-user-id`**, still gated by **consent** on server |
