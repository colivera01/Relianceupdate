# Core user-flow integration test audit

**Date:** 2026-04-11  
**Scope:** Smallest **high-value** integration-style test plan for hardened **customer** flows (booking, favorites, reviews, booking media).  
**Sources:** Current App Router pages, `src/app/api/*` handlers, `vitest.config.ts` (`src/**/*.test.ts`, Node env).

**Legend:** **API test** — call route handler or HTTP against app with controlled deps. **Contract test** — request/response shape + status matrix without full DB. **E2E** — browser automation (not in repo today; optional later).

---

## 1. Booking create → confirmation → my-bookings

### Routes involved

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/services/[id]` | Wizard loads service + vendor |
| `GET` | `/api/availability/vendor/[vendorId]?serviceId=…` | Wizard slots |
| `POST` | `/api/availability/check` | Pre-create slot validation |
| `POST` | `/api/bookings` | Create row (`x-user-id`, `user_id`, `customerMetadata`, `amount`, …) |
| `GET` | `/api/bookings/[id]` | Confirmation loads booking |
| `GET` | `/api/bookings?userId=…` | My Bookings list |

### Page / component entry points

- **`src/app/(user)/booking/[serviceId]/page.tsx`** — wizard; `fetch` create + `resolveCustomerUserId` / `x-user-id`.
- **`src/app/(user)/booking/[serviceId]/confirmation/page.tsx`** — `bookingId` query; `GET /api/bookings/[id]`.
- **`src/app/(user)/my-bookings/page.tsx`** — list + cancel + media (separate flows below).

### Minimum test cases

1. **`POST /api/bookings`** with `x-user-id` + required vendor/service/time: **201/200** and response `booking.id` + persisted `customer_metadata` / `amount` when body includes extras (align with **`BOOKING_CREATE_PERSISTENCE_NOTES.md`**).
2. **`GET /api/bookings/[id]`** with same `x-user-id`: **200** and `booking.user_id` matches caller; wrong user **403**.
3. **`GET /api/bookings?userId=`** with matching `x-user-id`: created booking appears in list; mismatched query vs auth **401** per `getUserIdFromRequest` rules.

### Mock vs live

| Piece | Recommendation |
|--------|----------------|
| **Prisma** | **Mock** (`vi.mock('@/server/db')`) or **test DB** one migration + seed script — mocks are faster for CI; test DB catches schema drift. |
| **Availability** | Stub **`checkVendorSlotAvailability`** / slot responses if testing only persistence; otherwise include **`POST /api/availability/check`** in the same suite with fixed vendor/service windows. |
| **Next runtime** | Prefer **direct handler tests** (import route `GET`/`POST`, construct `NextRequest` with headers) over spinning full Next server unless you add Playwright later. |

### Highest-risk regressions

- Missing **`x-user-id`** / **`user_id`** → create or list **401** in dev.
- **`customerMetadata`** / **`amount`** not persisted → confirmation and list wrong totals or empty contact.
- Ownership on **`GET [id]`** → customer A reads customer B’s booking (**403**).

---

## 2. Booking cancel

### Routes involved

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/bookings/[id]/cancel` | Sets status `CANCELED`; JSON body (`reason`, …) |

### Page / component entry points

- **`src/app/(user)/my-bookings/page.tsx`** — `cancelBooking` → `fetch` + `x-user-id` + JSON body.

### Minimum test cases

1. Authorized customer: **200**, booking status `canceled` / contract reflects cancel.
2. Wrong `x-user-id`: **403**.
3. No auth: **401**.
4. Unknown id: **404**.

### Mock vs live

- **Mock Prisma** `findUnique` + `update` + optional hydrate `findUnique` — assert `getUserIdFromRequest` path and `existing.userId` check.

### Highest-risk regressions

- Cancel succeeds without ownership (**security**).
- Empty **`POST` body** where `request.json()` is required (wizard/SDK now send body; regression if removed).

---

## 3. Favorites add / remove / list (discover, favorites page, service detail)

### Routes involved

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/users/favorites` | List (+ query `userId`, header `x-user-id`) |
| `POST` | `/api/users/favorites` | Add (`serviceId`, `userId` in body) |
| `DELETE` | `/api/users/favorites/[id]` | Remove by favorite id |

### Page / component entry points

- **`src/app/(user)/discover/page.tsx`** — `useFavoritesOptional`, `useAddFavorite`, `useRemoveFavorite`.
- **`src/app/(user)/favorites/page.tsx`** — `useFavorites`, `useRemoveFavorite`.
- **`src/app/(user)/service/[serviceId]/page.tsx`** — direct `fetch` list/add/remove (same APIs).

### Minimum test cases

1. **List** with aligned `userId` query + `x-user-id`: **200**, shape matches contract.
2. **Add** duplicate / invalid service: expected **4xx** from route behavior.
3. **Remove** own favorite vs other user’s favorite: **200** vs **403/404**.

### Mock vs live

- **Mock Prisma** `Favorite` + `Service`/`User` as needed; or thin **API handler** tests with mocked `getUserIdFromRequest`.
- **Do not** mock `favoritesSDK` in “integration” tests that aim to catch **SDK ↔ API** drift — test **`/api/users/favorites`**; SDK is already covered by **`FAVORITES_IDENTITY_ALIGNMENT_AUDIT.md`** patterns.

### Highest-risk regressions

- **`x-user-id`** omitted on discover vs service detail path → inconsistent list/toggle (**identity**).
- Remove by **service id** vs **favorite id** mismatch on service page (URL construction bugs).

---

## 4. Review create / expire — authorization & ownership

### Routes involved

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/reviews/window/start` | Opens window (consent / booking rules) |
| `POST` | `/api/reviews/create` | Submit review; window ↔ booking ↔ vendor ↔ media checks |
| `POST` | `/api/reviews/window/expire` | Customer-only expire |

Supporting (lower priority for *this* audit’s “minimum”):  
`POST /api/reviews/prompt-event`, `POST /api/reviews/sentiment`.

### Page / component entry points

- **`src/components/reviews/SmartVideoPlayer.tsx`** — `fetch` to `window/start`, `create`, `expire` (with `x-user-id` when userId set).
- **`src/app/(user)/my-bookings/page.tsx`** — embeds player with booking context + `userId` prop.

### Minimum test cases

**Create (`/api/reviews/create`)**

1. Happy path: active window, matching `bookingId`/`vendorId`, booking `userId` = caller, valid `submittedVia`, rating 1–5 → **200** (mock Prisma transaction).
2. **`REVIEW_WINDOW_CONTEXT_MISMATCH`**: window `bookingId` or `vendorId` ≠ body → **409**.
3. Window missing `mediaSessionId` → **400**.
4. Optional `mediaSessionId` in body ≠ window → **409** (`REVIEW_WINDOW_MEDIA_MISMATCH`).
5. Booking `userId` ≠ caller → **403**.
6. No auth → **401**.

**Expire (`/api/reviews/window/expire`)**

1. Window exists, booking `userId` = caller, status `active` → **200** / window `expired`.
2. Booking `userId` ≠ caller → **403** (“Only the booking customer…”).
3. No auth → **401**.

### Mock vs live

- **Heavy Prisma mock** or **test DB** with one `ReviewWindow` + `Booking` + `User` — logic is concentrated in handlers; **route-level tests** give best ROI (see **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`**).

### Highest-risk regressions

- Cross-user review submission (**trust**).
- Mismatched window vs booking/vendor/media (**409** paths silently removed).
- Expire allowed for non-owner (**403** bypass).

---

## 5. Booking media load (my-bookings)

### Routes involved

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/bookings/[id]/media` | Customer-visible assets + videos for booking |

### Page / component entry points

- **`src/app/(user)/my-bookings/page.tsx`** — `loadBookingMedia` → `GET` + `x-user-id`.

### Minimum test cases

1. Booking owner + `x-user-id`: **200**, `assets` / `videos` arrays (may be empty).
2. Non-owner: **403** (“booking does not belong to this user”).
3. No auth: **401**.
4. Unknown booking: **404**.

### Mock vs live

- **Mock** `prisma.booking.findUnique` + `mediaAsset.findMany` with visibility filters from **`getApprovedActiveBaseWhere`** / **`getVisibilityStatusesForAudience('customer')`** — assert customer filter is applied (no leaking vendor-only visibility).

### Highest-risk regressions

- **403/401** regressions exposing other customers’ media.
- Visibility filter regression (vendor-only assets shown to customer).

---

## 6. Recommended implementation order (smallest → highest cumulative value)

1. **`POST /api/reviews/create` + `POST /api/reviews/window/expire`** — Dense branching, past hardening; all **JSON + `getUserIdFromRequest`**; no UI. **Vitest** + mocked Prisma (or extract pure helpers if you refactor later).
2. **`GET /api/bookings/[id]/media`** — Small handler; **403/401** critical.
3. **`POST /api/bookings/[id]/cancel` + `GET /api/bookings/[id]` + `GET /api/bookings`** — Booking ownership + list auth; complements persistence tests for **`customerMetadata`** on create.
4. **`GET/POST /api/users/favorites` + `DELETE …/favorites/[id]`** — Straightforward CRUD + identity.
5. **`POST /api/bookings` + `POST /api/availability/check`** (optional bundle) — Highest setup cost; add after (3) so create path reuses same Prisma mock/seed patterns.

**Tooling:** Reuse existing **Vitest** (`src/**/*.test.ts`). Prefer **one file per domain** (e.g. `src/app/api/reviews/create/route.test.ts`) only if Next allows clean imports; otherwise **colocated** `*.test.ts` next to `src/lib/*` extracted testables or **HTTP supertest** against `next dev` (heavier). The repo already uses Vitest for **`src/lib/*.test.ts`** — follow that style first.

**E2E (optional phase 2):** Playwright against `next build` + `next start` + test DB: single smoke “book service → see confirmation → see my-bookings” — expensive; defer until API matrix is green.

---

## 7. Summary

| Flow | Primary APIs | Top regression class |
|------|----------------|------------------------|
| Booking journey | `POST /bookings`, `GET /bookings/[id]`, `GET /bookings` | Identity + persisted fields |
| Cancel | `POST /bookings/[id]/cancel` | Ownership |
| Favorites | `/api/users/favorites*` | `x-user-id` / query parity |
| Reviews | `create`, `expire` (+ optional `start`) | 401/403/409 matrix |
| Media | `GET /bookings/[id]/media` | 403 + visibility filters |

This document is **audit-only**; it does not add tests to the repo.
