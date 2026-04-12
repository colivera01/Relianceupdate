# My Bookings (`/my-bookings`) — end-to-end audit (codebase-only)

**Source page:** `src/app/(user)/my-bookings/page.tsx`  
**Client rules (status, tabs, cancel UI, search, schedule, review gating):** `src/lib/my-bookings.ts`  
**Hardening summary:** `MY_BOOKINGS_HARDENING_NOTES.md`  
**Last refreshed:** 2026-04-12 (aligned with hardened implementation)

**Booking list API mapping:** `src/lib/booking-shape.ts` → `mapBookingToContract` → **then** `sanitizeMyBookingsRow` in `src/lib/my-bookings.ts` before React state.

---

## 1. UI functions and controls

| Control | Location in `page.tsx` | Behavior |
|--------|-------------------------|----------|
| **Session gate** | `authLoading` / `resolveCustomerUserId(user?.id)` | While `useAuth().isLoading`, shows “Checking your session…”. If no user id after load, shows amber sign-in panel + link to `/auth/login`. |
| **Refresh** | `ButtonLike onClick={fetchBookings}` `disabled={loading}` | Re-runs `fetchBookings`; disabled while a fetch is in progress to avoid overlapping loads. |
| **Book New Service** | `<Link href="/discover" title="Browse services to book (Discover)">` | Navigates to `/discover`. |
| **Search input** | `searchTerm` / `setSearchTerm` | Client-side filter via `bookingMatchesSearch` (§7). Placeholder: `Search service, vendor, title, client name, or booking ID`. Hint paragraph: `id="my-bookings-search-hint"`, wired with `aria-describedby`. |
| **Tabs** | `activeTab` ∈ `upcoming` \| `past` \| `cancelled` | Mutually exclusive filter using `bookingMatchesTab` + `resolveBookingScheduleInstant` (§6). |
| **Action message banner** | `actionMessage` | Shown after cancel attempt (success or error string). |
| **Booking cards** | `filtered.map` | Renders service name, vendor name, id, optional title, price, **display status** from `formatMyBookingsStatusDisplay(booking.status)`, raw date/time strings for rows. |
| **Cancel Booking** | `cancelBooking(booking.id)` | `classifyCancelBookingAction` from `src/lib/my-bookings.ts`: **hidden** if terminal cancelled or completed; **disabled** + inline `reason` if cancel-in-progress (`isCancelRequestedFlowStatus`) or schedule already in the past; **enabled** otherwise. Disabled control is non-clickable (`mode !== 'enabled'` guard). |
| **Load Authorized Media** | `loadBookingMedia(booking.id)` | `GET /api/bookings/[id]/media` with `x-user-id`. **Disabled** when `vendor_id` is missing/blank or while `mediaState.loading`; native `title` explains why. |
| **Media status line** | `mediaState.loading`, `mediaState.total`, `mediaState.error` | Inline feedback. |
| **Video selector chips** | `mediaState.videos.map` + `activeVideoByBooking` | Switches selected asset id per booking. |
| **Smart video + review UI** | `<SmartVideoPlayer … reviewCaptureEnabled={…} />` | Renders only when selected video has `blobUrl`, `mediaSessionId`, and **`vendor_id`** is present. **`reviewCaptureEnabled`** = `shouldEnableReviewCaptureForStatus(statusKey)` — **false** for terminal cancelled → **watch-only** (no review window / overlays); **true** otherwise (§9). |
| **Empty list** | `filtered.length === 0` | `PanelText` with hint to try another tab or Discover. |
| **Error state** | `error` | `PanelText` + optional “Sign in” link if `error` matches `/unauthorized|sign in/i`. |

**Identity resolution (same file):** `resolveCustomerUserId` — order: `user?.id` from `useAuth()`, else `localStorage` key `userData` JSON `.id`, else legacy `user` JSON `.id`.

---

## 2. Exact API endpoints used by the page

| # | Method | Path | Called from |
|---|--------|------|----------------|
| 1 | `GET` | `/api/bookings` | `fetchBookings` |
| 2 | `POST` | `/api/bookings/[bookingId]/cancel` | `cancelBooking` |
| 3 | `GET` | `/api/bookings/[bookingId]/media` | `loadBookingMedia` |

**Indirect (child component):** From `src/components/reviews/SmartVideoPlayer.tsx`, when **`reviewCaptureEnabled`** is **true** (default elsewhere; on `/my-bookings` it is **false** only for **terminal cancelled** bookings per `shouldEnableReviewCaptureForStatus`), the player calls:

| Method | Path |
|--------|------|
| `POST` | `/api/reviews/window/start` |
| `POST` | `/api/reviews/prompt-event` |
| `POST` | `/api/reviews/sentiment` |
| `POST` | `/api/reviews/create` |
| `POST` | `/api/reviews/window/expire` |

When **`reviewCaptureEnabled`** is **false**, none of the above run; the `<video>` element still plays with **native controls enabled**.

Those requests use `Content-Type: application/json` only (no `x-user-id` in that file).

---

## 3. Required request headers / query params

### `GET /api/bookings`

**Implementation:** `src/app/api/bookings/route.ts`

- **Query:** `userId` — set by page: `query.set('userId', userId)` in `fetchBookings`.
- **Header:** `x-user-id: <same userId>` on the list request.
- **Server resolution:** `authUserId = await getUserIdFromRequest(request)` then `userId = authUserId || requestedUserId` (`route.ts` L24–L25). So either Bearer/cookie user (from `src/lib/auth.ts`) **or** query `userId` must yield a non-null `userId` **unless** `vendorId` query is used (not used by this page).
- **Implicit default pagination:** `page` defaults to `1`, `limit` defaults to **`10`** (`route.ts` L18–L21). **The page never passes `limit` or `page`**, so **at most 10 bookings** are returned per load.

### `POST /api/bookings/[id]/cancel`

**Implementation:** `src/app/api/bookings/[id]/cancel/route.ts`

- **Header:** `Content-Type: application/json`.
- **Header:** `x-user-id: <userId>` when resolved.
- **Body (fixed by page):** `{ reason: 'Customer requested cancellation', refund_requested: false }`.
- **Server:** `getUserIdFromRequest(request)` required; booking `userId` must match (`route.ts` L21–L44).

### `GET /api/bookings/[id]/media`

**Implementation:** `src/app/api/bookings/[id]/media/route.ts`

- **Header:** `x-user-id` — page sends when `userId` resolved on media fetch.
- **Server:** `getUserIdFromRequest`; booking must exist and `booking.userId` must equal `userId` (`route.ts` L17–L42).

---

## 4. Response fields the page depends on

### After `GET /api/bookings`

- **Top level:** `json.bookings` — must be an array; otherwise page sets `[]`.
- **Each element:** Each raw object is passed through **`sanitizeMyBookingsRow`** → typed **`MyBookingsRow`** (`src/lib/my-bookings.ts`): guarantees **non-null** `service` / `vendor` objects (fallback names), sane `created_at` / `updated_at` ISO strings, and coerced ids.
  - **Always read:** `id`, `service.name`, `vendor.name`, `status`, `created_at`, `booking_date`, `booking_time`, `title`, `client_name`, `total_price`, `vendor_id` (gating media load + `SmartVideoPlayer`).
  - **Filter/sort:** Tabs + cancel use `normalizeBookingStatusKey` + `resolveBookingScheduleInstant`; search uses §7; sort uses **`safeSortByCreatedAtDesc`** on sanitized rows.
- **`pagination`:** Returned by API (`route.ts` L80–L87) but **ignored by the page** — no UI for next page.

### After `POST /api/bookings/[id]/cancel`

- **Error path:** `json.error` thrown into user message.
- **Success path:** Updates local row `status` from `json.booking.status` **or** `json.status` **or** literal `'cancelled'`. API success payload includes `booking: mapBookingToContract(...)` with lowercase `status` from mapper (`booking-shape.ts`).
- **`json.message`:** Shown in `actionMessage`.

### After `GET /api/bookings/[id]/media`

- **Error:** `json.error`.
- **Success:** `json.assets` — length → `mediaState.total`.
- **`json.videos`:** Must be array; each item mapped in `loadBookingMedia`:
  - `v.id` → string
  - `v.title` or default `'Service Video'`
  - `v.blobUrl` → string or null
  - `v.mediaSessionId` → string or null  
- **Note:** API builds `videos` as `normalized.filter(mimeType starts with "video/")` (`media/route.ts` L101–L106). Each normalized asset includes `id`, `blobUrl`, `mediaSessionId`, `mimeType`, `title`, etc. (`media/route.ts` L81–L99).

---

## 5. How booking data is normalized before rendering

**Server:** `GET /api/bookings` maps each Prisma row with `mapBookingToContract(booking)` (`route.ts` L78).

**Mapper:** `mapBookingToContract` in `src/lib/booking-shape.ts`:

| Output field | Rule |
|--------------|------|
| `id` | `booking.id` |
| `user_id` | `booking.userId` |
| `vendor_id` | `booking.vendorId` |
| `service_id` | `booking.serviceId` |
| `title` | `booking.title` |
| `client_name` | `booking.clientName` |
| `booking_date` | From `at = booking.scheduledFor \|\| booking.date \|\| booking.createdAt` → `toISOString().split('T')[0]` or `null` |
| `booking_time` | Same `at` → time part `split('T')[1].split('.')[0]` or `null` |
| `status` | `String(booking.status \|\| 'PENDING').toLowerCase()` |
| `total_price` | `Number(booking.amount)` if truthy, else `Number(booking.service?.price ?? 0)` |
| `created_at` / `updated_at` | `toISOString()` on `createdAt` / `updatedAt` |
| `service` | If `booking.service`: `{ id, name, description: … \|\| '', price: Number(price) }` else **`null`** |
| `vendor` | If `booking.vendor`: `{ id, name: businessName \|\| name, phone, email, location }` else **`null`** |

**Client after fetch:** `sanitizeMyBookingsRow` replaces null/missing `service` / `vendor` with placeholder objects so **filter, search, and cards do not throw** on missing relations.

---

## 6. Tab filtering rules (Upcoming / Past / Cancelled)

**Code:** `filtered` `useMemo` in `page.tsx` delegates to **`bookingMatchesTab`** + **`resolveBookingScheduleInstant`** + **`normalizeBookingStatusKey`** in `src/lib/my-bookings.ts`.

**Schedule instant** (`resolveBookingScheduleInstant`):

1. If `booking_date` parses (with `booking_time` joined as `YYYY-MM-DDTHH:mm…` when time is non-empty), use that **`Date`** (`source: 'booking_date'`).
2. Else if `created_at` parses, use that instant (`source: 'created_at'`).
3. Else **`new Date(0)`** (`source: 'invalid_fallback'`) — row is treated as in the **past** relative to “now” for tab math (stable bucket).

**Status key:** `normalizeBookingStatusKey(status)` — lowercase trim; empty → `unknown`.

**Derived flags inside `bookingMatchesTab`:**

- `terminal` = `isTerminalCancelledStatus(statusKey)` → `canceled` \| `cancelled`.
- `completed` = `isCompletedStatus(statusKey)` → `completed` \| `complete`.
- `datePast` = schedule instant is **before** `now` (invalid schedule time is excluded from `datePast` via `Number.isNaN` guard on the instant).
- `isPast` = `datePast` **or** `completed`.

| Tab | Row included when |
|-----|---------------------|
| **cancelled** | `terminal` |
| **past** | `!terminal && isPast` |
| **upcoming** | `!terminal && !isPast` |

Sort: **`safeSortByCreatedAtDesc`** (descending `created_at`; NaN timestamps sort as `0`).

**Cancel control (separate from tabs):** **`classifyCancelBookingAction`** — see §1 table and §8; uses the **same** `statusKey` and `scheduleInstant` as tabs, plus `isCancelRequestedFlowStatus` for disabled + reason (not the Cancelled tab).

---

## 7. Search — client-side fields

**Code:** `bookingMatchesSearch(row, searchTerm)` in `src/lib/my-bookings.ts`; invoked from `filtered` `useMemo` when the tab predicate passes.

When `searchTerm.trim()` is non-empty, **case-insensitive substring** match against any of:

- `row.service.name`
- `row.vendor.name`
- `String(row.id)`
- `String(row.title ?? '')`
- `String(row.client_name ?? '')`

**UX copy (current):**

- **Placeholder:** `Search service, vendor, title, client name, or booking ID`
- **Hint** (`#my-bookings-search-hint`): “Matches service name, vendor name, booking title, client name on the booking, or the booking ID.”

Sanitized rows always have string `service.name` / `vendor.name`, so search does **not** throw on null relations.

---

## 8. Card actions — connection status

| Action | Connected? | Evidence |
|--------|--------------|-----------|
| **Cancel Booking** | **Wired + gated** | `POST /api/bookings/:id/cancel` with JSON body + `x-user-id` when **`classifyCancelBookingAction` → `enabled`**; local `status` patch on success. **Hidden** when mode `hidden`; **disabled** + `title` + inline reason when mode `disabled` (no silent primary action). |
| **Load Authorized Media** | **Wired + gated** | `GET /api/bookings/:id/media` + `x-user-id`. **Disabled** without `vendor_id` or while loading; `title` explains. |
| **Video tab buttons** | **Client-only** | Selects among already-fetched `videos`; no extra fetch. |
| **SmartVideoPlayer** | **Chained + conditional review** | Requires `blobUrl`, `mediaSessionId`, and `vendor_id`. Review APIs run only when **`reviewCaptureEnabled`** is true (§9). Terminal cancelled → **watch-only** (`reviewCaptureEnabled` false). |

---

## 9. Media / watch / review dependency chain

1. **User clicks “Load Authorized Media”** (if not disabled) → `GET /api/bookings/[bookingId]/media` with **`x-user-id`**.
2. **API** (`src/app/api/bookings/[id]/media/route.ts`): Ensures booking belongs to user; returns `assets`, `images`, `videos` (video = normalized assets with `mimeType` starting `video/`).
3. **Page** maps each video to `{ id, title, blobUrl, mediaSessionId }`. **`SmartVideoPlayer`** mounts only when **`blobUrl`**, **`mediaSessionId`**, and **`vendor_id`** are all present; otherwise static copy (missing blob/session, or missing vendor).
4. **`SmartVideoPlayer`** (`src/components/reviews/SmartVideoPlayer.tsx`), prop **`reviewCaptureEnabled`** (default **`true`** when omitted):
   - **`reviewCaptureEnabled === true`:** On mount, **`POST /api/reviews/window/start`** with `{ bookingId, vendorId, mediaSessionId }` — **no auth headers**; then prompts / **`POST /api/reviews/prompt-event`**, **`/sentiment`**, **`/create`**, **`/window/expire`** as in the component. Video **`controls`** follow `!accessError` when capture is on.
   - **`reviewCaptureEnabled === false`:** Skips review window start and **all** review overlays / exit / quick / private panels; **`controls`** stay **enabled** on the `<video>` (**watch-only**). No review API calls from this component in that mode.

**On `/my-bookings`:** `reviewCaptureEnabled={shouldEnableReviewCaptureForStatus(statusKey)}` → **`false`** iff **`isTerminalCancelledStatus(statusKey)`** (terminal cancelled still loads media and can play video; no review capture).

**Gap:** Parent page authenticates media list with `x-user-id`; when capture is on, child review calls still have **no `x-user-id`** — behavior is defined by `/api/reviews/*` routes.

**Status badge:** Card shows **human-readable** status via **`formatMyBookingsStatusDisplay(booking.status)`** (e.g. terminal → “Cancelled”, `cancel_requested` → “Cancellation requested”, `complete`/`completed` → “Completed”), not the raw API string alone.

---

## 10. Failure modes (from code paths)

| Condition | Symptom |
|-----------|---------|
| **No user id** (`resolveCustomerUserId` null) | No list fetch; amber sign-in panel. |
| **`GET /api/bookings` 401** | `json.error` shown; if message matches `/unauthorized|sign in/i`, extra sign-in link. |
| **More than 10 bookings for user** | Only first **10** returned — **silent truncation** (API default `limit=10`, page never overrides). |
| **`mapBookingToContract` returns `service: null` or `vendor: null`** | **No throw** after **`sanitizeMyBookingsRow`** — placeholder “Unknown service” / “Unknown vendor” names. |
| **`booking_date` / `booking_time` unusable** | `resolveBookingScheduleInstant` falls back to **`created_at`**, then epoch — tab placement stays **deterministic** (epoch → **Past** vs `now`). |
| **Terminal cancelled (`canceled` / `cancelled`)** | **Cancelled** tab; cancel button **hidden**; **`reviewCaptureEnabled` false** → watch-only player when media plays. |
| **`cancel_requested` / in-flow cancel statuses** | **Not** on Cancelled tab (not terminal); **Cancel** button **disabled** with reason; may still sit on **Upcoming** or **Past** depending on schedule. |
| **Status `complete` / `completed`** | Both treated as **completed** for tabs and cancel hiding (`isCompletedStatus`). |
| **Missing `vendor_id`** | **Load Authorized Media** disabled; if videos were ever shown without vendor, copy explains review capture needs vendor (defense in render). |
| **Media `videos` empty or non-video mime** | No player block; counts may still show from `assets`. |
| **Video missing `blobUrl` or `mediaSessionId`** | Static text: “Video playback unavailable for this media asset.” |
| **`/api/reviews/window/start` fails** (capture **on**) | `accessError` shown; **`controls`** gated by `!accessError` when `reviewCaptureEnabled` is true. |
| **Refresh spam** | Refresh **disabled** while `loading`. |

---

## 11. Remaining recommendations (post-hardening)

Already addressed in code: null-safe rows, unified status/tab/cancel rules, schedule fallback chain, search UX, refresh debounce via disabled state, terminal-cancelled watch-only review gating.

Still open:

1. **Pagination / limit:** In `fetchBookings`, pass e.g. `query.set('limit', '100')` and/or surface `json.pagination` (“Showing X of Y”) — **`page.tsx`** + `GET /api/bookings` already supports `limit` up to 100 (`route.ts`).
2. **Review API auth:** When **`reviewCaptureEnabled`** is true, review fetches still omit **`x-user-id`** — align with `src/app/api/reviews/**/*.ts` expectations if user context is required (`SmartVideoPlayer.tsx` + callers).

---

## File index

| Concern | Path |
|--------|------|
| Page UI + fetch | `src/app/(user)/my-bookings/page.tsx` |
| Client tab / status / search / schedule / sanitize | `src/lib/my-bookings.ts` |
| List/cancel contract | `src/lib/booking-shape.ts` |
| List + pagination | `src/app/api/bookings/route.ts` |
| Cancel | `src/app/api/bookings/[id]/cancel/route.ts` |
| Media | `src/app/api/bookings/[id]/media/route.ts` |
| Video + review chain | `src/components/reviews/SmartVideoPlayer.tsx` |
| User id on requests | `src/lib/auth.ts` (`getUserIdFromRequest`) |
| Session | `src/contexts/AuthContext.tsx` |
