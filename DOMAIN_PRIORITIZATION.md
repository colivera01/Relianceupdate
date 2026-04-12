# Domain Prioritization

Prioritization rule: build for active UI paths first; defer speculative SDK/API completeness.

## Build Now
- **Vendor jobs media/session lifecycle hardening**
  - Keep active upload/playback path stable.
  - Explicit lifecycle states now in place.
- **Bookings active contract**
  - create -> confirmation -> list -> cancel already active and should remain top-stability domain.
- **Contract tests for stabilized active domains**
  - typed shape checks for bookings and vendor media/session responses.

## Defer
- Search subroutes beyond base `/api/search`:
  - `/api/search/services`
  - `/api/search/vendors`
  - `/api/search/suggestions`
  - `/api/search/popular`
  - `/api/search/trending`
  - `/api/search/filters`
  - `/api/search/history`
  - `/api/search/analytics`
- Extended reviews endpoint family not used by active live UI surfaces:
  - `/api/reviews/[id]`
  - `/api/reviews/[id]/helpful`
  - `/api/reviews/[id]/reply`
  - `/api/reviews/service/[serviceId]`
  - `/api/reviews/vendor/[vendorId]`
  - `/api/reviews/user/[userId]`
  - `/api/reviews/stats`
- Availability extended endpoints until booking slot UI migration begins.

## Remove From SDK
- Booking SDK methods removed from active surface (not used by current UI):
  - `confirmBooking()`
  - `completeBooking()`
  - `getUserBookings()`
  - `getVendorBookings()`
- Matching `useBookings` hooks removed:
  - `useConfirmBooking()`
  - `useCompleteBooking()`
  - `useUserBookings()`
  - `useVendorBookings()`

## Document Only
- Namespace consolidation work (`/api/vendor/*` vs `/api/vendors/[vendorId]/*`) until there is a dedicated refactor window.
- Full reviews SDK/API parity beyond active paths.
- Full search domain productization beyond active discover/browse needs.

## Why this order
- It protects the paths users actively execute today.
- It avoids spending sprint capacity on endpoints with no current UI caller.
- It reduces regression risk from speculative backend expansion.
