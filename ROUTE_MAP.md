# Route Map

**Last refreshed:** 2026-05-06 (production-state refresh — flows below now reflect the live trust-loop topology).
**Previous refresh:** 2026-04-12 (raw page/API enumeration — preserved further down for reference).

## Production flows (refreshed 2026-05-06)

These are the canonical routes exercised by the green `e2e/reliance-trust-loop.spec.ts` run. Frontend pages and API routes here are confirmed to operate against live Azure SQL.

### Booking flow (customer)
- Page: `/discover` (`src/app/(user)/discover/page.tsx`) → search + service tile.
- Page: `/service/[serviceId]` (`src/app/(user)/service/[serviceId]/page.tsx`) → "Book Now" CTA.
- Page: `/booking/[serviceId]` (`src/app/(user)/booking/[serviceId]/page.tsx`) → date/time picker + customer details form.
- Page: `/booking/[serviceId]/confirmation` (`src/app/(user)/booking/[serviceId]/confirmation/page.tsx`) → confirmation receipt.
- Page: `/my-bookings` (`src/app/(user)/my-bookings/page.tsx`) → customer booking list.
- API:
  - `GET /api/services/discover`, `GET /api/services/categories` (discovery)
  - `GET /api/services/[id]` (service detail)
  - `GET /api/availability/vendor/[vendorId]`, `POST /api/availability/check` (slot availability)
  - `POST /api/bookings` (create) → returns `bookingId` used by the confirmation URL
  - `GET /api/bookings?userId=...` (customer list, also accepts `x-user-id`)
  - `GET /api/bookings/[id]` (single booking, ownership-enforced)
  - `POST /api/bookings/[id]/cancel`

### Proof flow (customer view + manager attestation)
- Page (customer): `/my-bookings/[bookingId]` (`src/app/(user)/my-bookings/[bookingId]/page.tsx`) — canonical proof page; supports `?proofReady=1` deep link from notification.
- Page (vendor): `/vendor/jobs/[jobId]` (`src/app/vendor/jobs/[jobId]/page.tsx`) — manager review surface for the staged 3-video package.
- API:
  - `GET /api/bookings/[id]` — booking detail (ownership enforced).
  - `GET /api/bookings/[id]/media` — customer-visible assets only (`approved` + `customer_only|public` + `active`); returns `assets` / `images` / `videos` plus `downloadUrl` per item.
  - `GET /api/bookings/[id]/media/[assetId]/download` — actual asset stream/redirect.
  - `GET /api/vendors/[vendorId]/media/sessions/[sessionId]` — vendor staged session inspection.
- Stage uploads are produced by the employee flow (see Moderation flow section).

### Moderation flow (employee → manager → admin)
- Employee:
  - Page: `/employee/jobs` (`src/app/employee/jobs/page.tsx`).
  - API:
    - `POST /api/employee/jobs/[jobId]/start`
    - `POST /api/employee/jobs/[jobId]/stage` with `{ stage: "INTRO" | "IN_PROGRESS" | "COMPLETED" }`
    - `POST /api/employee/jobs/[jobId]/complete` (final transition to `AWAITING_REVIEW` once all stages exist)
- Manager (vendor):
  - Page: `/vendor/jobs` (`src/app/vendor/jobs/page.tsx`).
  - API:
    - `POST /api/vendors/[vendorId]/jobs/[jobId]/approve` — sets booking `COMPLETED`, re-queues media as `pending_review`.
    - `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` — requires `rejectionReason`; returns booking to `IN_PROGRESS`.
    - `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` — assignment + lifecycle transitions; refuses `UPDATE_STATUS -> COMPLETED` with `MANAGER_APPROVAL_REQUIRED`.
- Admin:
  - Page: `/admin/media-moderation` (`src/app/admin/media-moderation/page.tsx`).
  - API:
    - `GET /api/admin/media/moderation-queue` — package view (latest `INTRO`/`IN_PROGRESS`/`COMPLETED` per booking).
    - `PATCH /api/admin/media/packages/[bookingId]/moderate` — `approve` (with `visibility`) / `reject` (with `moderationReason`) / `flag`.
    - `PATCH /api/admin/media/[assetId]/moderate` — single-asset decision (legacy path; package route is canonical).

### Review flow (customer → vendor reputation)
- Page (customer): `/my-bookings/[bookingId]` proof viewer hosts `SmartVideoPlayer`, which surfaces the in-video review prompt once consent is accepted; standalone hub at `/reviews` (`src/app/(user)/reviews/page.tsx`).
- API:
  - `POST /api/consent/request` / `POST /api/consent/accept` / `POST /api/consent/decline` / `GET /api/consent/[token]` — consent capture.
  - `POST /api/reviews/window/start` — opens the review window once consent + media linkage exist.
  - `POST /api/reviews/prompt-event` / `POST /api/reviews/sentiment` — in-video signal capture.
  - `POST /api/reviews/create` — final review write; persists attribution (`assignedMembershipId`, `assignedUserId`, `assignedEmployeeName`, `attributionVersion`).
  - `POST /api/reviews/window/expire` — TTL-driven expiry (auth-gated to booking owner).
  - `GET /api/reviews/me` — customer feedback hub (`pending` / `submitted` / `proofBased`).
  - `GET /api/vendors/[vendorId]/dashboard` — surfaces aggregated `stats.ratingCount`, `recentReviews`, `employeePerformance`.

### Role switching (one user, multiple surfaces)
- Identity sources:
  - Browser session: `localStorage.userData` + `localStorage.authToken` (also legacy `auth_token`); helper `getClientSessionHeaders` produces `Authorization: Bearer <token>` + `x-user-id: <userId>`.
  - Server: `getUserIdFromRequest` accepts the bearer token, `x-user-id` header, or `userId` query; vendor surfaces additionally use `requireVendorMembership` / `requireVendorManager` against `VendorMembership`.
- Customer surface: `/user-dashboard`, `/discover`, `/service/[id]`, `/booking/*`, `/my-bookings`, `/my-bookings/[bookingId]`, `/favorites`, `/reviews`, `/profile-settings`.
- Vendor surface (gated by active membership): `/vendor`, `/vendor/dashboard`, `/vendor/profile`, `/vendor/jobs`, `/vendor/media`, `/vendor/storage`, `/vendor/employees`.
- Employee surface (gated by `EMPLOYEE` membership): `/employee/jobs`, `/employee/mobile`.
- Admin surface (gated by admin role headers in dev / future role attribute in prod): `/admin/media-moderation`, `/admin/review-audit`, `/admin/audit-logs`, `/admin/publish-management`, `/admin/vendors`, `/admin/notifications`.
- Switching mechanic: `GET /api/vendor/context` resolves the current user's active vendor membership; `GET /api/vendors/[vendorId]/dashboard` returns `403 FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED` when the supplied user has no membership in the requested vendor and includes `suggestedVendorId` so the UI can route the user back to a vendor they actually belong to. `POST /api/profile/toggle` flips the in-app role context for users who hold both customer and vendor identities.

---



## Raw enumeration (2026-04-12 snapshot)

The lists below are the broad page + API enumeration captured on 2026-04-12. They are not exhaustive of every newer route added since (see "Production flows" above for the canonical 2026-05-06 view).

## Every frontend page/route

- `/`
- `/admin-tools`
- `/admin/activity`
- `/admin/admin-users`
- `/admin/audit-logs`
- `/admin/dashboard`
- `/admin/media-moderation`
- `/admin/notifications`
- `/admin/profile`
- `/admin/publish-management`
- `/admin/reports`
- `/admin/review-audit`
- `/admin/reviews`
- `/admin/settings`
- `/admin/users`
- `/admin/vendors`
- `/admin/vendors/approval-queue`
- `/auth/forgot-password`
- `/auth/login`
- `/auth/register`
- `/auth/reset-password`
- `/bookings`
- `/booking/[serviceId]`
- `/booking/[serviceId]/confirmation`
- `/browse`
- `/consent/[token]`
- `/customer/secure-account`
- `/dashboard`
- `/dashboard/devices`
- `/dashboard/employees`
- `/dashboard/invites`
- `/dashboard/pending`
- `/device/pair`
- `/discover`
- `/employee/mobile`
- `/favorites`
- `/logout`
- `/messages`
- `/my-bookings`
- `/profile-settings`
- `/reviews`
- `/search`
- `/service/[serviceId]`
- `/test-mode`
- `/test-msw`
- `/test-profile-toggle`
- `/user-dashboard`
- `/vendor`
- `/vendor/analytics`
- `/vendor/availability`
- `/vendor/billing`
- `/vendor/dashboard`
- `/vendor/employees`
- `/vendor/jobs`
- `/vendor/profile`
- `/vendor/profile/pricing`
- `/vendor/register`
- `/vendor/reviews`
- `/vendor/secure-account`
- `/vendor/services`
- `/vendor/support`
- `/vendor/support/chat`
- `/vendor/support/contact`
- `/vendor/support/faqs`
- `/vendor/support/help-articles`
- `/vendors/[vendorId]`

## Every API route (102 handlers)

- `/api/admin/audit-logs`
- `/api/admin/db-status`
- `/api/admin/media/[assetId]/moderate`
- `/api/admin/media/moderation-queue`
- `/api/admin/notifications`
- `/api/admin/notifications/[id]/read`
- `/api/admin/notifications/read-all`
- `/api/admin/publish`
- `/api/admin/reset`
- `/api/admin/review-audit`
- `/api/admin/reviews/[reviewId]/moderate`
- `/api/admin/reviews/moderation-queue`
- `/api/admin/seed`
- `/api/admin/seed-from-mock`
- `/api/admin/services/[serviceId]/publish`
- `/api/admin/vendors/[vendorId]/publish`
- `/api/admin/vendors/approve`
- `/api/admin/vendors/bulk-approve`
- `/api/admin/vendors/bulk-reject`
- `/api/admin/vendors/pending`
- `/api/admin/vendors/reject`
- `/api/auth/debug`
- `/api/auth/forgot-password`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/reset-password`
- `/api/auth/reset-password/validate`
- `/api/availability/check`
- `/api/availability/vendor/[vendorId]`
- `/api/bookings`
- `/api/bookings/[id]`
- `/api/bookings/[id]/cancel`
- `/api/bookings/[id]/media`
- `/api/consent/[token]`
- `/api/consent/accept`
- `/api/consent/decline`
- `/api/consent/request`
- `/api/customer/profile`
- `/api/customer/register`
- `/api/dashboard/stats`
- `/api/dashboard/user-growth`
- `/api/dev/notifications-test` (dev-only; guarded)
- `/api/device/heartbeat`
- `/api/device/pairing/confirm`
- `/api/device/pairing/request`
- `/api/devices`
- `/api/headsets/claim`
- `/api/health`
- `/api/join/request`
- `/api/pairing/confirm`
- `/api/pairing/request`
- `/api/passkey/register`
- `/api/passkey/register-options`
- `/api/profile/check-vendor-eligibility`
- `/api/profile/toggle`
- `/api/reviews`
- `/api/reviews/create`
- `/api/reviews/prompt-event`
- `/api/reviews/sentiment`
- `/api/reviews/window/expire`
- `/api/reviews/window/start`
- `/api/search`
- `/api/services`
- `/api/services/[id]`
- `/api/services/[id]/media`
- `/api/services/categories`
- `/api/services/discover`
- `/api/test`
- `/api/test-db`
- `/api/users`
- `/api/users/favorites`
- `/api/users/favorites/[id]`
- `/api/users/profile`
- `/api/vendor/dashboard`
- `/api/vendor/devices`
- `/api/vendor/devices/[id]`
- `/api/vendor/profile`
- `/api/vendor/profile/photo`
- `/api/vendor/register`
- `/api/vendors/[vendorId]/dashboard`
- `/api/vendors/[vendorId]/devices`
- `/api/vendors/[vendorId]/headsets/[deviceId]/assign`
- `/api/vendors/[vendorId]/headsets/[deviceId]/unassign`
- `/api/vendors/[vendorId]/invites`
- `/api/vendors/[vendorId]/invites/[inviteId]`
- `/api/vendors/[vendorId]/jobs/[jobId]/actions`
- `/api/vendors/[vendorId]/media`
- `/api/vendors/[vendorId]/media/[assetId]`
- `/api/vendors/[vendorId]/media/[assetId]/download`
- `/api/vendors/[vendorId]/media/sessions`
- `/api/vendors/[vendorId]/media/sessions/[sessionId]`
- `/api/vendors/[vendorId]/media/storage`
- `/api/vendors/[vendorId]/media/upload/complete`
- `/api/vendors/[vendorId]/media/upload/init`
- `/api/vendors/[vendorId]/memberships`
- `/api/vendors/[vendorId]/memberships/[membershipId]/approve`
- `/api/vendors/[vendorId]/memberships/[membershipId]/deny`
- `/api/vendors/[vendorId]/memberships/[membershipId]/revoke`
- `/api/vendors/[vendorId]/public`
- `/api/vendors/[vendorId]/reviews/public`
- `/api/vendors/[vendorId]/storage/usage`
- `/api/vendors/[vendorId]/storage/verify`

## Frontend pages calling API routes (representative)

- `/auth/login` → `/api/auth/login` (also writes `localStorage.userData`; `AuthContext.login()` syncs session)
- `/auth/forgot-password` → `/api/auth/forgot-password`
- `/auth/reset-password` → `/api/auth/reset-password`, `/api/auth/reset-password/validate`
- `/auth/register` → `/api/profile/check-vendor-eligibility`, `/api/customer/register`, `/api/vendor/register`
- `/logout` → `/api/auth/logout`
- `/customer/secure-account`, `/vendor/secure-account` → passkey routes
- `/device/pair` → `/api/device/pairing/confirm`
- `/user-dashboard`, `/profile-settings` → `/api/customer/profile`
- `/discover` → `/api/services/discover`, `/api/services/categories`, favorites APIs (hooks/SDK)
- `/favorites` → `/api/users/favorites`, `/api/users/favorites/[id]`
- `/service/[serviceId]` → `/api/services/[id]`, `/api/services/[id]/reviews/public`, `/api/availability/vendor/[vendorId]`, favorites
- `/booking/[serviceId]`, `/booking/[serviceId]/confirmation` → `/api/services/[id]`, availability, `/api/bookings`, `/api/bookings/[id]`
- `/my-bookings` → `/api/bookings` (query + `x-user-id`), `/api/bookings/[id]/cancel`, `/api/bookings/[id]/media`; review/consent overlays use review + consent APIs as configured in `SmartVideoPlayer`
- `/consent/[token]` → `/api/consent/[token]`, accept/decline via API from page actions
- `/vendor/profile` → vendor profile, devices, storage usage
- `/vendor/dashboard`, `/vendor/jobs` → vendor dashboard + media/session/booking APIs
- `/dashboard/*` (devices, employees, invites, pending) → memberships, invites, headsets
- `/admin/notifications`, `/admin/audit-logs`, `/admin/publish-management`, `/admin/media-moderation`, `/admin/reviews`, `/admin/review-audit` → matching `/api/admin/*` routes

## Likely unused or dev-only routes

- **Pages:** `/test-mode`, `/test-msw`, `/test-profile-toggle`, `/admin-tools`
- **Ambiguous:** `/dashboard` vs `/vendor/dashboard`
- **API (low UI coupling or dev):** `/api/admin/seed`, `/api/admin/reset`, `/api/admin/seed-from-mock`, `/api/test`, `/api/test-db`, `/api/health`, `/api/join/request`, `/api/pairing/*`, `/api/dev/notifications-test`

## Pages still mocked or thin

- `/messages`, `/reviews` (user-facing review UX still largely mock/disconnected from full capture flows)
- `/bookings` (lightweight vs `/my-bookings`)
- Vendor shells: `/vendor/services`, `/vendor/employees`, `/vendor/analytics`, `/vendor/billing`, `/vendor/reviews` (mixed mock)
- Admin shells: `/admin/dashboard`, `/admin/users`, `/admin/reports`, `/admin/settings`, `/admin/activity`

## Resolved / stable

- **`/admin/vendors`:** stable hub page (links to publish, approval queue, audit); not the legacy monolithic `VendorManagement` UI.
- **`/my-bookings`:** customer list/cancel/media wired to bookings APIs with `AuthProvider` + `userData` identity (see `MY_BOOKINGS_FUNCTION_AUDIT.md`).
