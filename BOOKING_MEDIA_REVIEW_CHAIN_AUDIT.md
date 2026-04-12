# Booking → media → video → review / consent chain (codebase audit)

**Scope:** End-to-end flow from a user opening a booking context, loading booking-scoped media, watching video, and entering review capture and/or consent flows.  
**Sources:** `src/app/(user)/my-bookings/page.tsx`, `src/components/reviews/SmartVideoPlayer.tsx`, `src/lib/my-bookings.ts`, `src/app/api/bookings/[id]/media/route.ts`, `src/app/api/reviews/**/*.ts`, `src/app/api/consent/**/*.ts`, `src/app/consent/[token]/page.tsx`, `src/lib/auth.ts`, `src/lib/review-capture.ts`.  
**Implementation snapshot (2026-04-12):** Client sends **`x-user-id`** on every review `fetch` when **`userId`** is set; missing **`userId`** ⇒ **watch-only**. Server enforces **review window ↔ body** on **`/api/reviews/create`** and **auth + booking ownership** on **`/api/reviews/window/expire`** (see route contracts below).

---

## 1. Entry points

### Pages / routes that open a **booking** context

| Surface | Path | Relation to media/review chain |
|---------|------|--------------------------------|
| **My Bookings** | `src/app/(user)/my-bookings/page.tsx` → `/my-bookings` | **Only** in-repo page that calls `GET /api/bookings/[id]/media`, renders `SmartVideoPlayer`, and drives review overlays for a booking. |
| **Booking confirmation** | `src/app/(user)/booking/[serviceId]/confirmation/page.tsx` | Loads **`GET /api/bookings/[id]`** with optional `x-user-id` from legacy `localStorage.user` only. **No** media load, **no** `SmartVideoPlayer`, **no** review APIs. |
| **Bookings redirect** | `src/app/(user)/bookings/page.tsx` | `redirect('/my-bookings')` — no UI. |
| **Booking wizard** | `src/app/(user)/booking/[serviceId]/page.tsx` | Step UI includes a step labeled “review” (booking checkout), **not** smart-review capture. **No** booking media route here. |

### Consent (token) surface (orthogonal URL)

| Surface | Path | Relation |
|---------|------|----------|
| **Consent page** | `src/app/consent/[token]/page.tsx` → `/consent/[token]` | Standalone flow: **`GET /api/consent/[token]`**, **`POST /api/consent/accept`**, **`POST /api/consent/decline`**. Typically reached via link from **`POST /api/consent/request`** (email/SMS). **No** direct import of `SmartVideoPlayer`; accepting consent is a **prerequisite** for `POST /api/reviews/window/start` (see §3). |

### Components

| Component | Used by |
|-----------|---------|
| **`SmartVideoPlayer`** | **`/my-bookings` only** (grep: no other importers). |
| **`ReviewOverlay`**, **`ExitIntentPrompt`**, **`QuickReviewPanel`**, **`PrivateFeedbackPanel`** | Children of **`SmartVideoPlayer`** only. |

### API-only entry (no first-party UI caller in `src/`)

| Route | Note |
|-------|------|
| **`POST /api/consent/request`** | Creates `ConsentRecord` + optional notifications. **No** `fetch('/api/consent/request')` in `src/` outside the route handler itself — e.g. admin tools or external clients would call it. |

---

## 2. UI / component chain (`/my-bookings`)

**Sequence (happy path):**

1. **`MyBookingsPage`** — session gate, `fetchBookings` → list of cards (`sanitizeMyBookingsRow` rows).
2. **Per booking card** — “Load Authorized Media” **enabled** only if `vendor_id` present and not loading (`page.tsx`).
3. **`loadBookingMedia(bookingId)`** — `GET /api/bookings/:id/media` with `x-user-id`; stores `mediaByBooking[bookingId]` (`loading`, `error`, `total`, `videos`).
4. If `videos.length > 0` — “Service Video Review Capture” block: title chips → pick `activeVideoByBooking`.
5. **Gate before player** — requires `video.blobUrl`, `video.mediaSessionId`, and `vendor_id`; else static messages (missing asset vs missing vendor).
6. **`SmartVideoPlayer`** — props: `src`, `bookingId`, `vendorId`, `mediaSessionId`, `reviewCaptureEnabled` from `shouldEnableReviewCaptureForStatus(statusKey)`, and **`userId`** from `resolveCustomerUserId(user?.id)` (same as list/media `x-user-id`).
7. **Inside `SmartVideoPlayer` (when `reviewApisEnabled` = capture on + non-empty `userId`)** — after `POST /api/reviews/window/start` succeeds and `reviewWindowId` is set: timed **`ReviewOverlay`**; “Done watching” → **`ExitIntentPrompt`**; sentiment path → **`QuickReviewPanel`** or **`PrivateFeedbackPanel`**; submit quick review → **`POST /api/reviews/create`**; leave without review → **`POST /api/reviews/window/expire`**.

**Watch-only branch:** same mount through step 6; if **`reviewApisEnabled`** is false (**`reviewCaptureEnabled` false** *or* **missing `userId`**), step 7’s review subtree is not rendered and review APIs are not called (see §5).

---

## 3. API chain

### Always involved for **listing** bookings on `/my-bookings`

| Method | Path | When |
|--------|------|------|
| `GET` | `/api/bookings?userId=…` | Load booking list (`fetchBookings`). Headers: `x-user-id` (same user). |

### Invoked when user loads **booking media**

| Method | Path | Condition |
|--------|------|-----------|
| `GET` | `/api/bookings/[id]/media` | User clicks “Load Authorized Media” (not disabled). Header: **`x-user-id`** (required for `getUserIdFromRequest` on server). |

**Success shape** (`src/app/api/bookings/[id]/media/route.ts`): `{ success: true, bookingId, assets, images, videos }` where `assets`/`images`/`videos` are arrays of normalized objects (`id`, `vendorId`, `mediaSessionId`, `blobUrl`, `mimeType`, `title`, …). **Error:** `401` missing user, `403` wrong owner, `404` booking not found, `500` with `success: false`.

### Conditionally invoked — **review capture** (only if `SmartVideoPlayer` has **`reviewApisEnabled`** = `reviewCaptureEnabled` ∧ non-empty **`userId`**)

| Method | Path | Trigger |
|--------|------|---------|
| `POST` | `/api/reviews/window/start` | On mount / deps change when `reviewApisEnabled`; body `{ bookingId, vendorId, mediaSessionId }`. |
| `POST` | `/api/reviews/prompt-event` | After `reviewWindowId` exists: overlay timers, dismissals, etc. |
| `POST` | `/api/reviews/sentiment` | User picks sentiment on overlay. |
| `POST` | `/api/reviews/create` | Quick review submit. |
| `POST` | `/api/reviews/window/expire` | “Leave” on exit intent without review. |

**Headers on all `SmartVideoPlayer` review fetches** (when review capture is active and `userId` is non-empty): `{ "Content-Type": "application/json", "x-user-id": <trimmed userId> }` — same identity model as `/my-bookings` list/media (`src/components/reviews/SmartVideoPlayer.tsx`). If `userId` is missing, **no** review `fetch` runs (watch-only; see §4).

### Conditionally invoked — **consent** (not from `SmartVideoPlayer`)

| Method | Path | Trigger |
|--------|------|---------|
| `POST` | `/api/consent/request` | External/admin (no in-app customer UI in repo). Body: `bookingId`, `vendorId`, `mediaSessionId`, `consentType` (must be in `CONSENT_TYPES`, `src/lib/consent-flow.ts`). |
| `GET` | `/api/consent/[token]` | User opens `/consent/[token]`. |
| `POST` | `/api/consent/accept` | User accepts on consent page. Body: `token`, `termsVersion`, `privacyVersion`, optional `smsAccepted`. |
| `POST` | `/api/consent/decline` | User declines. Body: `token`, `reason`. |

### Related booking read (no media in this audit’s UI chain)

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/api/bookings/[id]` | Confirmation page; requires `getUserIdFromRequest` (e.g. `x-user-id`). Response `{ booking }` contract-shaped. |

### Route contracts (concise)

### `GET /api/bookings/[id]/media`

- **Auth:** `getUserIdFromRequest` — **required** (else `401`). Booking **`userId`** must match (else `403`).
- **Query:** none.
- **Response:** `{ success: true, bookingId, assets[], images[], videos[] }` or error JSON with `success: false` / `error` (non-2xx).

### `POST /api/reviews/window/start`

- **Auth header:** `x-user-id` is **not required** by the route handler today; the client still sends it when `SmartVideoPlayer` has a `userId` prop for alignment with other review calls. **Consent** checks are unchanged (see below).
- **Body:** `bookingId`, `vendorId`, `mediaSessionId` (all required strings).
- **Server checks:** booking exists and `vendorId` matches; `mediaSession` belongs to booking+vendor; **`consentRecord`** exists with `consentType: 'video_access'`, `status: 'accepted'`, matching `bookingId`, `vendorId`, `mediaSessionId` — else **`403`** `"Video consent is required before review/video access"`.
- **Response (ok):** `{ success: true, reviewWindow, created, reminderDispatch }`.

### `POST /api/reviews/prompt-event` / `POST /api/reviews/sentiment`

- **Body:** `reviewWindowId` + `eventType` / `sentiment` (+ optional `metadata`).
- **Auth:** none; gated by **`assertReviewWindowActive(reviewWindowId)`** (window must exist, `status === 'active'`, not expired).

### `POST /api/reviews/create`

- **Auth:** **`getUserIdFromRequest` required** — else **`401`** `"Authentication required"` (client sends **`x-user-id`** from `SmartVideoPlayer` when capture is active).
- **Body:** `reviewWindowId`, `bookingId`, `vendorId`, `rating`, `comment`, `submittedVia`; optional **`mediaSessionId`** — if present, must equal the window’s **`mediaSessionId`**.
- **Server:** `assertReviewWindowActive` then **window ↔ body**: **`reviewWindow.bookingId` / `vendorId`** must match submitted **`bookingId` / `vendorId`** (`409` + `REVIEW_WINDOW_CONTEXT_MISMATCH`); window must have non-empty **`mediaSessionId`** (`400`); optional body **`mediaSessionId`** mismatch ⇒ **`409`** + `REVIEW_WINDOW_MEDIA_MISMATCH`. Then booking load: **`booking.userId`** must equal authenticated user (`403`); no duplicate review for booking (`409`).

### `POST /api/reviews/window/expire`

- **Auth:** **`getUserIdFromRequest` required** — else **`401`**. Booking loaded by **`reviewWindow.bookingId`**; **`booking.userId`** must match caller (**`403`**). Applies before returning “already inactive” responses so window ids are not cross-user observable.
- **Body:** `reviewWindowId`.

### `GET /api/consent/[token]`

- **Auth:** none.
- **Response:** `{ success: true, consent: { …, canRespond, respondBlockedReason } }` or `404` / errors.

### `POST /api/consent/accept` | `decline`

- **Auth:** none (token is the capability).
- **Body:** `token` (+ versions on accept).

---

## 4. Identity and authorization

### `getUserIdFromRequest` (`src/lib/auth.ts`)

Order: **Bearer JWT** (`userId`/`sub`) → cookies `userId` / `user_id` / `uid` / `session_user_id` → **`x-user-id` header**.

| Step | User id required? | How enforced |
|------|-------------------|--------------|
| **List bookings** | Yes | `GET /api/bookings` + page sends `x-user-id`. |
| **Media list** | Yes | **`GET /api/bookings/[id]/media`** — `401` if no user id; **`403`** if `booking.userId !== userId` (compared as `String`). |
| **Review window start** | No (server) | Validates booking/vendor/session + **accepted `video_access` consent** only. Client sends **`x-user-id`** when available for identity alignment. |
| **Prompt event / sentiment** | No (server) | **`assertReviewWindowActive`** only. Client still sends **`x-user-id`** when `SmartVideoPlayer` runs in capture mode (not used for authorization on these routes today). |
| **window/expire** | **Yes** (server) | **`getUserIdFromRequest`** + **booking owner** must match **`reviewWindow.bookingId`**. Client sends **`x-user-id`** when capture is active. |
| **Review create** | **Yes** (server) | **`401`** / **`403`** as above; plus **active window** must match **`bookingId` / `vendorId`** (and optional **`mediaSessionId`**) from body — see route contract. Client sends **`x-user-id`** via `SmartVideoPlayer`. |
| **Consent token GET/accept/decline** | No | Token-based; IP/UA stored on accept. |
| **Consent request** | Optional | `getUserIdFromRequest` or `'system'` for actor audit. |

### Identity alignment — `SmartVideoPlayer` (`2026-04-12`)

- **Optional prop `userId`:** Parent **`/my-bookings`** passes `resolveCustomerUserId(user?.id)` — the **same** source used for `x-user-id` on `GET /api/bookings` and `GET /api/bookings/[id]/media`.
- **Effective review mode:** `reviewApisEnabled = reviewCaptureEnabled && Boolean(trimmed userId)`. If **`userId` is missing**, the component **does not** call any of the five review routes and behaves **watch-only** (video with native controls), without weakening server-side **consent** checks when calls do occur.
- **Review `fetch` headers:** `POST` to **`/api/reviews/window/start`**, **`/prompt-event`**, **`/sentiment`**, **`/create`**, **`/window/expire`** each use `{ "Content-Type": "application/json", "x-user-id": userId }` when `reviewApisEnabled` is true.
- **Consent unchanged:** `window/start` still requires an **accepted** `ConsentRecord` for `video_access` matching `(bookingId, vendorId, mediaSessionId)`; adding `x-user-id` does not remove or bypass that logic.

### Remaining nuances

1. **`GET /api/bookings/[id]`** uses `booking.userId !== userId` (strict); **media** uses `String(booking.userId) !== String(userId)` — equivalent for typical string ids, slightly different typing edge cases.
2. **Review window start** (server) still does not **require** `x-user-id` for authorization; identity for that step remains consent + FK validation. **`x-user-id`** is sent from the client for consistency and future hardening.

---

## 5. Business rules

### When media can be loaded (UI + API)

- **UI:** Button disabled if no `vendor_id` or already loading; user id required for fetch (else inline “Sign in…”).
- **API:** User must own booking; assets must match **`getApprovedActiveBaseWhere()`**, **`getVisibilityStatusesForAudience("customer")`**, and `mediaSession.bookingId === bookingId` (`src/app/api/bookings/[id]/media/route.ts`).

### When playback is allowed (UI)

- A **video** row with truthy **`blobUrl`** and **`mediaSessionId`**.
- **`vendor_id`** on booking (UI gate); **`SmartVideoPlayer`** still receives `vendorId` for API payloads.

### When review capture is enabled

- **`SmartVideoPlayer`:** Effective capture = **`reviewCaptureEnabled` (default true) ∧ non-empty `userId`**. Review `fetch` calls use **`x-user-id`** on each route.
- **`/my-bookings`:** `reviewCaptureEnabled={shouldEnableReviewCaptureForStatus(statusKey)}` → **`false`** only for **terminal cancelled**; passes **`userId={resolveCustomerUserId(user?.id)}`**. **Completed / cancel_requested / etc.** still request capture **if** `userId` resolves; otherwise watch-only.

### When watch-only mode is used

- **`reviewCaptureEnabled === false`** (e.g. terminal cancelled), **or** **`userId` missing/blank`:** no review `fetch` calls, no overlays; `<video controls={true}>`.

### How booking statuses affect the chain (`/my-bookings` only)

- **Terminal cancelled:** review capture **off**; media button may still run if enabled; playback possible without review APIs.
- **Other statuses:** review capture **on** when video mounts — **subject to consent** on server for `window/start`, not to booking status in that route.

**Note:** `POST /api/reviews/window/start` does **not** read booking `status`; only consent + ids. Cancelled/completed semantics on **server** for review are not additionally enforced in `window/start` beyond consent + FK checks.

---

## 6. Failure modes

| Condition | Effect |
|-----------|--------|
| **Missing `vendor_id`** | UI: cannot load media; cannot mount `SmartVideoPlayer`; explanatory copy. |
| **Missing `mediaSessionId` or `blobUrl` on video asset** | No player; “Video playback unavailable…”. |
| **No `x-user-id` / no auth on media GET** | `401 Unauthorized` from media route. |
| **Wrong user for booking** | Media `403`; booking GET `403`. |
| **No consent row** `video_access` + `accepted` for `(bookingId, vendorId, mediaSessionId)` | `window/start` **`403`** — `accessError` in UI; with `reviewCaptureEnabled` true, **`controls={!accessError}`** disables video controls. |
| **Review window start fails (other errors)** | Same `accessError` path. |
| **`/api/reviews/create` without resolvable user** (e.g. header absent server-side) | **`401`** — submit error in `QuickReviewPanel` path. Mitigated when parent passes **`userId`** into `SmartVideoPlayer`. |
| **`/api/reviews/create` body does not match active window** | **`409`** (`REVIEW_WINDOW_CONTEXT_MISMATCH` or `REVIEW_WINDOW_MEDIA_MISMATCH`) or **`400`** (invalid window media session). |
| **`/api/reviews/window/expire` without auth or wrong user** | **`401`** / **`403`**. |
| **`userId` omitted on `SmartVideoPlayer` while `reviewCaptureEnabled` is true** | **Watch-only:** no review API calls; playback only. |
| **Review window expired / not active** | `assertReviewWindowActive` fails for prompt/sentiment/create. |
| **Consent token missing / not found** | Consent page error; `GET` `404` + `code: CONSENT_NOT_FOUND`. |
| **Consent expired / already accepted** | `accept`/`decline` return `410` / `409` with codes per `src/lib/consent-record-state` usage. |
| **Empty `videos` / empty `assets`** | No player section; `total` may be `0`. |
| **Backend: booking not found** | Media `404`; list unaffected. |

---

## 7. Follow-ups (scoped; current gaps only)

1. **Consent → review discoverability:** If product expects customers to self-serve from `/my-bookings` only, add UI copy or action linking to consent when `window/start` returns consent error (surface `403` message from JSON).
2. **Single booking page:** If confirmation (or future detail) should show media, reuse **`loadBookingMedia`** pattern + `useAuth`/same `x-user-id` as my-bookings to avoid divergent identity (`confirmation` currently only reads `localStorage.user`).
3. **Lower priority (server):** Optional auth + booking-owner checks on **`/api/reviews/window/start`**, **`/prompt-event`**, **`/sentiment`** — see **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`** and TODO comments on those route files.

**Done (no longer listed here):** `SmartVideoPlayer` **`x-user-id`** on all review fetches when capture is active; **`/api/reviews/create`** window ↔ booking/vendor (+ optional media) alignment; **`/api/reviews/window/expire`** auth + ownership.

---

## 8. Output companion

See **`BOOKING_MEDIA_REVIEW_FLOW_MAP.md`** for a short step-by-step diagram-style summary.
