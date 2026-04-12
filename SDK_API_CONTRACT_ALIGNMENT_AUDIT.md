# SDK ↔ API contract alignment audit

**Date:** 2026-04-12  
**Scope:** `src/sdk/*`, consuming `src/hooks/*`, and `src/app/api/*`, with emphasis on bookings, favorites, services, availability, reviews, and vendor media.

**Conventions in this doc**

- **Headers (default `api` client):** `Content-Type: application/json` on JSON bodies; `Authorization: Bearer <auth_token>` when `localStorage.auth_token` is set. No automatic `x-user-id` (unlike `favoritesSDK`).
- **Headers (`favoritesSDK`):** `x-user-id` + optional `userId` query when `resolveCustomerUserId` resolves an id; `credentials: include`.

---

## 1. Per-SDK method matrix

### 1.1 `src/sdk/bookings.ts` — `bookingsSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `listBookings` | `/api/bookings` | GET | `userId`, `vendorId`, `status`, `page`, `limit` | default `api` | `src/app/api/bookings/route.ts` | **exact** (identity: auth or `userId` query) |
| `getBooking` | `/api/bookings/[id]` | GET | — | default `api` | `src/app/api/bookings/[id]/route.ts` | **exact** (unwraps `{ booking }`) |
| `createBooking` | `/api/bookings` | POST | `service_id`, `vendor_id`, `booking_date`, `booking_time`, `user_notes` (mapped from DTO) | default `api` | `bookings/route.ts` | **exact** for mapped fields; DTO types vs string ids is a typing concern only |
| `updateBooking` | `/api/bookings/[id]` | PUT | snake_case body: `status`, `booking_date`, `booking_time`, `title`, `client_name`, `user_notes` (SDK maps from camelCase / aliases) | default `api` | `bookings/[id]/route.ts` | **resolved** (pass 2, 2026-04-12) — server still ignores `user_notes` if unsupported |
| `deleteBooking` | `/api/bookings/[id]` | DELETE | — | default `api` | `bookings/[id]/route.ts` sets `CANCELED`, does not hard-delete | **partial** — semantic “cancel” vs delete |
| `cancelBooking` | `/api/bookings/[id]/cancel` | POST | empty body (SDK); API accepts `reason`, `refund_requested` | default `api` | `src/app/api/bookings/[id]/cancel/route.ts` | **exact** |

**Hooks:** `src/hooks/useBookings.ts` — all call paths above.

---

### 1.2 `src/sdk/favorites.ts` — `favoritesSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `listFavorites` | `/api/users/favorites` | GET | `page`, `limit`; plus `userId` when resolved | `x-user-id` when resolved | `src/app/api/users/favorites/route.ts` | **exact** |
| `addFavorite` | `/api/users/favorites` | POST | JSON `{ serviceId, userId? }` | `x-user-id` when resolved | `users/favorites/route.ts` | **exact** |
| `removeFavorite` | `/api/users/favorites/[id]` | DELETE | `userId` on URL when resolved | `x-user-id` when resolved | `src/app/api/users/favorites/[id]/route.ts` | **exact** |

**Hooks:** `src/hooks/useFavorites.ts`.

**Barrel:** `src/sdk/index.ts` re-exports `./favorites` (**resolved**, pass 3, 2026-04-12). Canonical customer favorites: **`favoritesSDK`**; **`usersSDK`** list/add/remove remain for Bearer-only `api` flows (see §1.8).

---

### 1.3 `src/sdk/services.ts` — `servicesSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `listServices` | `/api/services` | GET | `search`, `category`, `vendorId`, filters, pagination | default `api` | `src/app/api/services/route.ts` | **exact** (mock-heavy) |
| `getService` | `/api/services/[id]` | GET | — | default `api` | `src/app/api/services/[id]/route.ts` returns `{ service }` | **resolved** (pass 1) — SDK unwraps `{ service }` |
| `createService` | `/api/services` | POST | snake_case body incl. `vendor_id` (from `vendorId` / `vendor_id` on input) | default `api` | `services/route.ts` | **resolved** (pass 3) |
| `updateService` | `/api/services/[id]` | PUT | `UpdateServiceDTO` | default `api` | `services/[id]/route.ts` | **exact** route exists (verify field names at integration time) |
| `deleteService` | `/api/services/[id]` | DELETE | — | default `api` | `services/[id]/route.ts` | **exact** route exists |
| `getCategories` | `/api/services/categories` | GET | — | default `api` | `src/app/api/services/categories/route.ts` | **exact** |
| `discoverServices` | `/api/services/discover` | GET | `q`, `category`, `sortBy`, `page`, `limit` | default `api` | `src/app/api/services/discover/route.ts` | **exact** |

**Removed (pass 3, 2026-04-12)** — had no App Router handlers: `getPopularServices`, `getServicesByCategory`, `getServicesByVendor`, `searchServices` (use **`searchSDK.searchServices`** → `/api/search`), `uploadServiceMedia`, `deleteServiceMedia`, `searchServicesCatalog`.

**Hooks:** `src/hooks/useServices.ts` — `useListServices`, `useGetService`, `useCreateService`, `useUpdateService`, `useDeleteService`, `useServiceCategories`, `useDiscoverServices` only.

---

### 1.4 `src/sdk/search.ts` — `searchSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `search` | `/api/search` | GET | `SearchParams` | default `api` | `src/app/api/search/route.ts` | **exact** (requires `q` or `category` or `location`) |
| `searchServices` | `/api/search` | GET | `q`, `type: 'service'`, filters | default `api` | `search/route.ts` | **exact** |
| `searchVendors` | `/api/search` | GET | `q`, `type: 'vendor'` | default `api` | `search/route.ts` | **exact** |
| `getSearchSuggestions` | `/api/search` | GET | `q`, `limit` | default `api` | `search/route.ts` | **resolved** (pass 3) — empty `q` returns `{ suggestions: [] }` without calling API |
| `getPopularSearches` | `/api/search` | GET | `q: 'popular'` | default `api` | same | **partial** — no dedicated endpoint; mock filters by substring “popular” |
| `getTrendingSearches` | `/api/search` | GET | `q: 'trending'` | default `api` | same | **partial** — same as above |
| `getSearchFilters` | `/api/search` | GET | `q: 'filters'` | default `api` | same | **exact** (mock returns `filters`) |
| `saveSearchQuery` | — | — | — | — | **no** route | **stale** — client no-op |
| `getSearchHistory` | — | — | — | — | **no** route | **stale** — returns empty |

---

### 1.5 `src/sdk/auth.ts` — `authSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `login` | `/api/auth/login` | POST | `LoginRequest` | default `api` | `src/app/api/auth/login/route.ts` | **exact** |
| `register` | `/api/customer/register` or `/api/vendor/register` | POST | `RegisterRequest` | default `api` | respective routes | **exact** |
| `getCustomerProfile` | `/api/customer/profile` | GET | — | default `api` | `customer/profile/route.ts` | **exact** |
| `updateCustomerProfile` | `/api/customer/profile` | PUT | partial profile | default `api` | same | **exact** |
| `getVendorProfile` | `/api/vendor/profile` | GET | — | default `api` | `vendor/profile/route.ts` | **exact** |
| `updateVendorProfile` | `/api/vendor/profile` | PUT | partial profile | default `api` | same | **exact** |
| `toggleProfile` | `/api/profile/toggle` | POST | JSON `userId`, `targetProfileType` (mapped from `targetProfile` + `resolveCustomerUserId`) | default `api` | `profile/toggle/route.ts` | **resolved** (pass 3) |
| `getAvailableProfiles` | `/api/profile/toggle` | GET | `userId` query (`resolveCustomerUserId`) | default `api` | `profile/toggle/route.ts` | **resolved** (pass 3) |
| `checkVendorEligibility` | `/api/profile/check-vendor-eligibility` | GET | — | default `api` | `profile/check-vendor-eligibility/route.ts` | **exact** |
| `logout` | — | — | clears `localStorage.auth_token` only | — | `src/app/api/auth/logout/route.ts` exists but unused | **partial** — no server logout call |

**Hooks:** `src/hooks/useAuth.ts`.

---

### 1.6 `src/sdk/reviews.ts` — `reviewsSDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `listReviews` | `/api/reviews` | GET | filters | default `api` | `src/app/api/reviews/route.ts` | **exact** |

**Removed (pass 3, 2026-04-12):** SDK methods with no matching routes (`getReview`, `createReview`, `updateReview`, `deleteReview`, helpers, nested list paths, `getReviewStats`). In-app review capture continues via **`/api/reviews/create`**, **`window/*`**, etc., outside this SDK.

---

### 1.7 `src/sdk/availability.ts` — `availabilitySDK`

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `getVendorAvailability` | `/api/availability/vendor/[vendorId]` | GET | optional `dateFrom`, `dateTo`, `serviceId` | default `api` | `availability/vendor/[vendorId]/route.ts` returns `{ availability: { vendor_id, timezone, dates[] } }` | **partial** — response shape ≠ typed `VendorAvailability` |
| `updateVendorAvailability` | `/api/availability/vendor/[vendorId]` | PUT | `UpdateAvailabilityDTO` (`schedule`, `exceptions`, …) | default `api` | route expects `availability_schedule`, `blocked_dates` | **partial** — key mismatch |
| `checkAvailability` | `/api/availability/check` | **POST** | JSON `vendorId`, `booking_date`, `booking_time`, optional `serviceId` (SDK also accepts legacy `date` / `time` aliases) | default `api` | `availability/check/route.ts` | **resolved** (2026-04-12 pass 1) — matches route; return includes `reason` and `message` (= `reason` when set) |
| `getVendorSchedule` | `/api/availability/vendor/[vendorId]/schedule` | GET | `startDate`, `endDate` | default `api` | **no** route | **missing** |
| `setEmergencyAvailability` | `/api/availability/vendor/[vendorId]/emergency` | POST | `{ emergencyAvailable }` | default `api` | **no** route | **missing** |
| `getVendorResponseTime` | `/api/availability/vendor/[vendorId]/response-time` | GET | — | default `api` | **no** route | **missing** |
| `updateVendorResponseTime` | `/api/availability/vendor/[vendorId]/response-time` | PUT | `{ responseTime }` | default `api` | **no** route | **missing** |

**Hooks:** none reference `availabilitySDK`; vendor/customer UIs use direct `fetch` or other patterns.

---

### 1.8 `src/sdk/users.ts` — `usersSDK`

Module comment (pass 3): admin-style methods below still target **missing** routes and will **404** until implemented.

| Function | Endpoint | Method | Query / body | Headers | Matching route | Status |
|----------|----------|--------|----------------|---------|----------------|--------|
| `getUserProfile` | `/api/customer/profile` then `/api/vendor/profile` | GET | — | default `api` | customer + vendor profile routes | **exact** |
| `updateUserProfile` | `/api/vendor/profile` or `/api/customer/profile` | PUT | heuristic on `businessName` | default `api` | same | **partial** — heuristic fragile |
| `getUserById` | `/api/users/[userId]` | GET | — | default `api` | `src/app/api/users/route.ts` is list-only; **no** `/api/users/[id]` | **missing** |
| `updateUserById` | `/api/users/[userId]` | PUT | — | default `api` | **missing** | **missing** |
| `deleteUserById` | `/api/users/[userId]` | DELETE | — | default `api` | **missing** | **missing** |
| `getUserPreferences` | `/api/users/preferences` | GET | — | default `api` | **missing** | **missing** |
| `updateUserPreferences` | `/api/users/preferences` | PUT | — | default `api` | **missing** | **missing** |
| `uploadUserPhoto` | `/api/users/upload-photo` | POST | FormData `photo` | default `api` | **missing** | **missing** |
| `listFavorites` | `/api/users/favorites` | GET | `page`, `limit` (optional `type` param ignored — API is service-only) | default `api` | `users/favorites/route.ts` | **resolved** (pass 2, 2026-04-12) — returns `FavoritesListResponse`; use `favoritesSDK` for `x-user-id` fallbacks |
| `addFavorite` | `/api/users/favorites` | POST | JSON `{ serviceId }` | default `api` | `users/favorites/route.ts` | **resolved** (pass 2) — requires `serviceId`; prefer `favoritesSDK` for explicit customer id |
| `removeFavorite` | `/api/users/favorites/[id]` | DELETE | — | default `api` | `users/favorites/[id]/route.ts` | **resolved** (pass 2) |
| `updateFavoriteNotes` | — | — | — | — | **removed** (pass 2) — no Prisma/API support for favorite notes |
| `checkFavorite` | — | — | — | — | **removed** (pass 2) — use list + client filter or `favoritesSDK` |
| `getUserActivity` | `/api/users/activity` | GET | — | default `api` | **missing** | **missing** |

**Hooks:** none import `usersSDK` in current `src/hooks`.

---

## 2. Vendor media (hooks, no dedicated `src/sdk` module)

| Surface | Endpoint patterns | Method | Notes | Route | Status |
|---------|-------------------|--------|-------|-------|--------|
| `useVendorMedia` | `/api/vendors/[vendorId]/media`, `.../storage`, `.../[assetId]`, `.../upload/init`, `.../upload/complete`, `.../sessions`, `.../sessions/[id]` | GET/POST/PATCH/DELETE | bodies align with `init` (`fileName`, `expectedBytes`, `mimeType`, `deviceId`) | implemented under `vendors/[vendorId]/media/**` | **exact** |
| `useMediaSessions` | same session paths | GET/POST/PATCH | query filters for list | same | **exact** |

---

## 3. Highest-risk mismatches (current user flows)

**Resolved in SDK/API contract correction pass 1 (2026-04-12):** `availabilitySDK.checkAvailability`, `servicesSDK.getService` (see §1.3 / §1.7).

**Resolved in pass 2 (2026-04-12):** `usersSDK` favorites paths (`/api/users/favorites*`), `bookingsSDK.updateBooking` snake_case mapping (see §1.1 / §1.8).

**Resolved in pass 3 (2026-04-12):** `servicesSDK` stub removal + `createService` body mapping + hook cleanup; `searchSDK.getSearchSuggestions` empty-query guard; `reviewsSDK` surface trimmed to `listReviews`; `authSDK` profile toggle + available profiles contract; `src/sdk/index.ts` **`favorites`** export; `useAuth` passes user id into profile SDK calls.

1. **`usersSDK` admin / preferences / activity** — several methods still call **missing** routes (see §1.8 module comment).

---

## 4. Minimal fix order (recommended)

1. ~~**Availability check**~~ — **Done (pass 1, 2026-04-12).**

2. ~~**`servicesSDK.getService`**~~ — **Done (pass 1, 2026-04-12).**

3. ~~**Deprecate or realign `usersSDK` favorites**~~ — **Done (pass 2, 2026-04-12).** (Still prefer `favoritesSDK` for `x-user-id` / storage identity.)

4. ~~**`servicesSDK` stubs**~~ — **Done (pass 3, 2026-04-12).** (Use `discoverServices` + `searchSDK.searchServices`.)

5. ~~**`authSDK.getAvailableProfiles`**~~ — **Done (pass 3, 2026-04-12).**

6. ~~**`updateBooking`**~~ — **Done (pass 2, 2026-04-12).**

7. ~~**Reviews SDK**~~ — **Done (pass 3, 2026-04-12)** — `listReviews` only; capture flows stay in UI/`fetch`.

8. **`availabilitySDK` GET/PUT** — Document actual `{ availability }` response; map PUT body keys to `availability_schedule` / `blocked_dates` or update server to accept DTO keys.

9. ~~**`src/sdk/index.ts`** — Export `favorites`~~ — **Done (pass 3, 2026-04-12).**

---

## 5. Consumer summary

| Hook file | SDK / transport | Notes |
|-----------|-----------------|-------|
| `useBookings.ts` | `bookingsSDK` | Identity for list/detail still depends on `api` auth token + query; no `x-user-id` in SDK; `updateBooking` payload aligned (pass 2) |
| `useServices.ts` | `servicesSDK` | Stub hooks removed (pass 3); `getService` unwrap (pass 1); `discoverServices` for browse |
| `useFavorites.ts` | `favoritesSDK` | Aligned with `/api/users/favorites*`; also re-exported from `src/sdk/index.ts` (pass 3) |
| `useAuth.ts` | `authSDK` | Profile toggle + available profiles pass `userId` / `resolveCustomerUserId` (pass 3) |
| `useVendorMedia.ts`, `useMediaSessions.ts` | direct `fetch` | Aligned with vendor media API tree |

---

## 6. Out of scope

- MSW handlers vs production routes.  
- Full request schema validation for every admin route.  
- Automated contract tests (existing contract files not re-run for this audit).
