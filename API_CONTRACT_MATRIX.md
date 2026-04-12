# API Contract Matrix

## Scope
- Compared `src/sdk/*` and active hooks usage against implemented `src/app/api/*`.
- Prioritized: bookings, services, reviews, search, availability, vendor flows.
- Prioritization principle: active UI paths first, speculative SDK completeness deferred.

## Legend
- `Aligned`: SDK/hook path exists and shape is usable.
- `Mismatch`: SDK/hook path missing or incompatible with API response.
- `Documented`: intentionally not fixed in this pass.

## Bookings
- `GET /api/bookings` -> **Aligned** (stabilized canonical shape).
- `GET /api/bookings/[id]` -> **Aligned** (SDK unwrapped `booking` object in this pass).
- `POST /api/bookings` -> **Aligned** (SDK payload now mapped to snake_case contract).
- `PUT /api/bookings/[id]` -> **Aligned** (now DB-backed).
- `POST /api/bookings/[id]/cancel` -> **Aligned** (returns canonical booking + metadata).
- `POST /api/bookings/[id]/confirm` -> **Removed from active SDK** (not used by current UI).
- `POST /api/bookings/[id]/complete` -> **Removed from active SDK** (not used by current UI).
- `GET /api/bookings/user/[userId]` -> **Removed from active SDK** (not used by current UI).
- `GET /api/bookings/vendor/[vendorId]` -> **Removed from active SDK** (not used by current UI).

## Services
- `GET /api/services` -> **Aligned**.
- `GET /api/services/[id]` -> **Aligned** (dynamic params fixed).
- `POST /api/services` -> **Aligned**.
- `PUT /api/services/[id]` -> **Partially aligned** (route exists but still mock update behavior).
- `DELETE /api/services/[id]` -> **Partially aligned** (route exists but still mock delete behavior).
- `GET /api/services/categories` -> **Aligned**.
- `GET /api/services/discover` -> **Aligned**.
- `GET /api/services/popular` -> **Mismatch** (not implemented).
- `GET /api/services/category/[category]` -> **Mismatch** (not implemented).
- `GET /api/services/vendor/[vendorId]` -> **Mismatch** (not implemented).
- `GET /api/services/search` -> **Mismatch** (not implemented; search route is `/api/search`).

## Reviews
- Active UI usage today:
  - `/api/reviews?serviceId=...` in service detail page
  - `/api/vendors/[vendorId]/reviews/public` in public vendor page
  - admin moderation routes in `/admin/reviews`
- Minimum viable real review contract (active paths):
  - list reviews by service
  - create review
  - public vendor reviews
  - admin moderation queue/update
- `GET /api/reviews` -> **Aligned** (active).
- `POST /api/reviews` -> **Aligned** (active baseline).
- `GET /api/vendors/[vendorId]/reviews/public` -> **Aligned** (active).
- `/api/admin/reviews/moderation-queue` + `/api/admin/reviews/[reviewId]/moderate` -> **Aligned** (active).
- SDK endpoints below are currently speculative/not active UI-critical:
  - `GET /api/reviews/[id]`
  - `PUT /api/reviews/[id]`
  - `DELETE /api/reviews/[id]`
  - `POST /api/reviews/[id]/helpful`
  - `POST /api/reviews/[id]/reply`
  - `GET /api/reviews/service/[serviceId]`
  - `GET /api/reviews/vendor/[vendorId]`
  - `GET /api/reviews/user/[userId]`
  - `GET /api/reviews/stats`

## Search
- `GET /api/search` -> **Aligned** (base search route exists).
- Actual current frontend:
  - `/search` page is currently local mock UI (no live SDK/search integration)
  - active discovery path uses `/api/services/discover` and `/api/services/categories`
- Decision:
  - base `/api/search` is sufficient for current active live usage
  - specialized subroutes deferred
- `GET /api/search/services` -> **Deferred subroute**
- `GET /api/search/vendors` -> **Deferred subroute**
- `GET /api/search/suggestions` -> **Deferred subroute**
- `GET /api/search/popular` -> **Deferred subroute**
- `GET /api/search/trending` -> **Deferred subroute**
- `GET /api/search/filters` -> **Deferred subroute**
- `POST /api/search/analytics` -> **Deferred subroute**
- `GET /api/search/history` -> **Deferred subroute**

## Availability
- `GET /api/availability/vendor/[vendorId]` -> **Aligned** (params fix applied).
- `PUT /api/availability/vendor/[vendorId]` -> **Aligned** (params fix applied).
- Required for booking static-slot replacement (minimum contract):
  - vendor availability calendar/date windows
  - available slot list for chosen date/service
  - booking-time conflict validation
- `POST /api/availability/check` -> **Candidate next active endpoint**
- `GET/PUT /api/availability/vendor/[vendorId]/schedule` -> **Deferred until booking slot UI migration starts**
- `POST /api/availability/vendor/[vendorId]/emergency` -> **Document only**
- `GET/PUT /api/availability/vendor/[vendorId]/response-time` -> **Document only**

## Vendor Flows
- Vendor profile/device/storage/media/session routes used by vendor hooks -> **Mostly aligned**.
- `/api/vendors/[vendorId]/jobs/[jobId]/actions` -> **Exists**, UI alignment still partial.
- Legacy `/api/vendor/*` endpoints vs `/api/vendors/[vendorId]/*` split -> **Partially mismatched by design** (dual namespaces).

## Fixed in this pass
- Bookings SDK `getBooking()` response unwrapping fixed.
- Bookings SDK `createBooking()` payload key mapping fixed.
- Dynamic route param usage fixed in key stabilized routes.
- Vendor jobs upload/session orchestration extracted into `src/lib/vendor-job-media.ts` with explicit lifecycle states.
- Removed non-active booking SDK calls (`confirm`, `complete`, `user`, `vendor` variants).
- Simplified search SDK to rely on base `/api/search` + documented deferred subroutes.

## Documented only (not mass-refactored here)
- Search/reviews/availability extended endpoint families.
- Review SDK endpoint set beyond active UI-critical contract.
- Full namespace consolidation between `/api/vendor/*` and `/api/vendors/[vendorId]/*`.

## Recommended next tasks
1. Keep booking endpoint scope as-is unless UI adds explicit confirm/complete flow.
2. If `/search` page is moved to live backend, wire it to base `/api/search` first.
3. Implement only minimum review contract needed for active pages before adding any speculative review subroutes.
4. Expand typed contract tests for active domains as routes stabilize.
