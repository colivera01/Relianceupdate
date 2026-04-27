# Route Gap Report (2026-04-27)

## Frontend Routes Pointing to Missing Pages
- `/reviews/edit/[reviewId]`
  - Referenced by user reviews page edit action.
  - No matching page route found.
- Legacy vendor layout links to missing pages:
  - `/vendor/bookings`
  - `/vendor/messages`
  - `/vendor/settings`

## Dashboard Cards Routing to Incomplete Targets
- Proof card -> `/vendor/media` (live page; card metrics still placeholder).
- Storage card -> `/vendor/storage` (live page; card metrics still placeholder).
- Jobs and Reviews cards route to existing pages and are operational.

## Route Smoke Verification
- Verified HTTP 200:
  - `/vendor/media`
  - `/vendor/storage`
  - `/vendor/dashboard`
- Dashboard card destinations for Proof and Storage now resolve to real pages.

## API Routes Called by UI That May Fail
- `POST /api/device/pairing/request`
  - Depends on `getVendorIdFromRequest` auth path; susceptible to context/auth mismatch outside local dev assumptions.
- `POST /api/device/heartbeat`
  - Membership resolution logic can fail if `pendingPhoneDeviceUid` linkage is absent.
- Vendor jobs page calls `POST /api/bookings` and `POST /api/consent/request` from a complex UI flow; failures surface as runtime UX errors rather than strongly typed workflow states.
- Duplicate pairing route families (`/api/pairing/*` and `/api/device/pairing/*`) create potential UI-to-API contract ambiguity.

## Mocked Pages Needing Backend Connection
- Vendor:
  - `/vendor/billing`
  - `/vendor/analytics`
  - parts of `/vendor/reviews` still read as placeholder-oriented UX.
- Admin:
  - `/admin/dashboard`
  - `/admin/users`
  - `/admin/reports`
  - `/admin/settings`
  - `/admin/activity`

## Cleanup Priority Suggestions
1. Remove/retire stale `(vendor)` layout links to non-existent pages.
2. Consolidate pairing routes into one canonical API surface.
3. Add route-level smoke checks for all dashboard-linked destinations.
4. Replace dashboard Proof/Storage card placeholder values with backend-driven metrics.
5. Add explicit capability flags in dashboard payload so cards can self-disable if backend dependencies are unavailable.
