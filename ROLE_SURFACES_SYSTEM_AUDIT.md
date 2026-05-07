# ROLE SURFACES SYSTEM AUDIT

Last refreshed: 2026-05-06 (production-state pass)  
Original audit date: 2026-04-17  
Scope: `src/app/vendor/**`, `src/app/(user)/**`, `src/app/admin/**`, `src/app/employee/**` plus directly linked supporting components/hooks/routes.

---

## Production-state snapshot (2026-05-06)

### Customer surface
- **Live, production behavior:**
  - `/discover`, `/service/[serviceId]`, `/booking/[serviceId]`, `/booking/[serviceId]/confirmation`, `/my-bookings`, `/my-bookings/[bookingId]`, `/favorites`, `/user-dashboard`, `/profile-settings` are all backed by real Prisma routes.
  - `/reviews` is now the customer feedback hub backed by `GET /api/reviews/me` returning `pending` / `submitted` / `proofBased` buckets; the legacy mock-driven review browser was removed in this pass.
  - `/my-bookings/[bookingId]` is the canonical proof page (consent prompt → primary proof video → optional review submission).
- **Identity:** `localStorage.userData` + `authToken` → `getClientSessionHeaders` adds `Authorization: Bearer …` and `x-user-id: …`; server verifies via `getUserIdFromRequest` and ownership filters.
- **Confirmed in trust-loop E2E:** booking POST → confirmation page → proof page (with consent + media) → review create → review visible in `GET /api/reviews/me` and on vendor dashboard `recentReviews`.

### Vendor surface
- **Live, production behavior:**
  - `/vendor` redirects to `/vendor/dashboard`.
  - `/vendor/dashboard` reads `GET /api/vendors/[vendorId]/dashboard` (stats, recentJobs, recentReviews, employeePerformance, storage usage). Cards route to real destinations (`/vendor/jobs`, `/vendor/media`, `/vendor/storage`).
  - `/vendor/jobs` enforces the operational-phase model and surfaces manager-only `Approve` / `Reject` actions for `AWAITING_REVIEW` jobs.
  - `/vendor/media`, `/vendor/storage`, `/vendor/profile` are wired to live data.
- **Auth gate:** `requireVendorMembership` (any active membership) for read; `requireVendorManager` (active `MANAGER` membership) for approve/reject.
- **403 behavior:** `GET /api/vendors/[vendorId]/dashboard` returns `403 FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED` with `suggestedVendorId` when the requesting user has no membership for that vendor.
- **Mock surfaces remaining:** `/vendor/services`, `/vendor/reviews`, `/vendor/analytics`, `/vendor/billing`, `/vendor/availability` (mostly local-state).

### Employee surface
- **Live:** `/employee/jobs` reads `GET /api/employee/jobs` (returns assigned jobs including `AWAITING_REVIEW`).
- **Stage-upload contract:** `POST /api/employee/jobs/[jobId]/start` and `POST /api/employee/jobs/[jobId]/stage` with payload `{ stage: "INTRO" | "IN_PROGRESS" | "COMPLETED" }`. After all 3 stages exist, the booking transitions to `AWAITING_REVIEW`.
- **`canMarkComplete`:** only true while pre-review (`PENDING` / `CONFIRMED`) and all 3 required stage videos exist; otherwise the action is hidden.
- **Rejection visibility:** "Rejected by manager" banner + reason; rejection metadata clears when the employee re-submits.
- **Mobile companion:** `/employee/mobile`.

### Admin surface
- **Live:** `/admin/media-moderation`, `/admin/review-audit`, `/admin/audit-logs`, `/admin/publish-management`, `/admin/notifications`, `/admin/vendors` (and approval queue page).
- **Canonical moderation route:** `PATCH /api/admin/media/packages/[bookingId]/moderate` (`approve`/`reject`/`flag`). Approve fires proof-ready notification (best-effort) and stamps booking metadata to suppress duplicate sends.
- **Review moderation:** `GET /api/admin/reviews/moderation-queue`, `PATCH /api/admin/reviews/[reviewId]/moderate`.
- **Mock surfaces remaining:** `/admin/dashboard`, `/admin/users`, `/admin/admin-users`, `/admin/reports`, `/admin/settings`, `/admin/profile`, `/admin/activity` (placeholder telemetry).

### Role toggle behavior
- **Source of truth:** `VendorMembership` table (linking `userId` ↔ `vendorId` with `role` and `status`).
- **Vendor context resolution:** `GET /api/vendor/context` returns the active vendor for the current user; UI uses this to switch into vendor surfaces.
- **Profile toggle:** `POST /api/profile/toggle` flips the in-app role context for users holding both customer and vendor identities.
- **403 hand-off:** vendor dashboard returns `suggestedVendorId` when the requested vendor doesn't match an active membership; this lets the UI route the user to the vendor they actually belong to instead of dead-ending.
- **Admin elevation:** in dev, admin-only routes accept `x-user-role: admin` + `x-admin: 1` headers (used by the trust-loop spec); production hardening of admin role detection is tracked as a separate item.
- **Trust-loop E2E exercises all four surfaces in one pass** (customer create → manager assign → employee uploads → manager approve → admin moderate → customer view → customer review → vendor dashboard verification).

---

## Original audit (2026-04-17)


## State Legend

- **Real (backend-driven)**: Core page behavior is served by real API routes/data models.
- **Partial (hybrid)**: Some core data is real, but meaningful functionality is still local/mock/incomplete.
- **Mock/local-state**: UI-only behavior with simulated data/state and TODO notes.
- **Broken**: Route exists but key downstream route/API is missing or page link target is unresolved.

---

## 1) Vendor Surface Matrix

| Surface (route) | Purpose | Current state | Dependencies | Current blockers | Role linkage | Navigation visibility |
|---|---|---|---|---|---|---|
| `/vendor` (`src/app/vendor/page.tsx`) | Vendor entrypoint redirect | Real | Next redirect to `/vendor/dashboard` | None | Gateway to vendor lifecycle | Hidden utility route |
| `/vendor/dashboard` | Vendor KPI/home | Partial (mostly real) | `useVendorDashboard` -> `GET /api/vendors/[vendorId]/dashboard`, vendor membership context | CTA flows (availability/pricing) route into mostly mock pages | Receives demand from user bookings/reviews; informs vendor ops | Sidebar visible |
| `/vendor/profile` | Vendor profile/settings/devices/storage | Partial | `GET/PUT /api/vendor/profile`, `GET /api/devices`, `POST /api/device/pairing/request`, `DELETE /api/vendor/devices/:id`, `GET /api/vendors/:vendorId/storage/usage` | Payment/security controls are mixed into profile updates; not all dedicated backend flows present | Vendor identity and readiness impacts user discoverability and admin publish decisions | Sidebar visible |
| `/vendor/profile/pricing` | Vendor service pricing manager | Mock/local-state | Local `serviceCatalog`, local save | No backend persistence/API wiring | Affects services exposed to user discover flow if implemented | Hidden/unlinked (reachable from profile/dashboard flows) |
| `/vendor/services` | Vendor CRUD for services | Partial | `GET/POST /api/services`, `GET/PUT/DELETE /api/services/[id]`, `useVendorProfile` | Vendor-scoped publish/archive missing; page explicitly flags publish blocker | Service records feed user discover/service detail and admin publish moderation | Hidden from sidebar (important operational page) |
| `/vendor/jobs` | Manage jobs, actions, media, assignments | Partial (complex hybrid) | `/api/bookings`, `/api/services`, `/api/vendors/[vendorId]/jobs/[jobId]/actions`, `/api/vendors/[vendorId]/media*`, media helpers in `src/lib/vendor-job-media.ts` | Heavy client orchestration, mixed local state, TODO-backed branches | Execution layer linking user booking -> vendor fulfillment -> media evidence -> admin moderation | Sidebar visible |
| `/vendor/reviews` | Employee/review analytics and performance | Mock/local-state (with partial guards) | Local/mock analytics data; manager role checks; TODO API notes | Core analytics/review data endpoints not wired for actual display | Should consume user review outcomes and feed vendor quality control | Sidebar visible |
| `/vendor/employees` | Team member management | Mock/local-state | Local employee arrays; TODO endpoint notes | CRUD backend missing (`/api/vendor/employees*`) | Employee assignment affects vendor jobs and customer experience | Sidebar visible |
| `/vendor/billing` | Earnings/payment settings | Mock/local-state | Local flags/history; TODO endpoint notes | Payment enable/disable/history/payout APIs not wired to live data | Revenue side of vendor fulfillment lifecycle | Sidebar visible |
| `/vendor/support` | Vendor help hub | Mock/local-state/static | Internal links only | No backend support/ticketing integration | Operational support for vendor retention | Sidebar visible |
| `/vendor/support/chat` | Live support chat | Mock/local-state | Simulated agent responses and connection state | No messaging backend/session/ticket linkage | Could later connect to admin support operations | Hidden (linked from support page) |
| `/vendor/support/contact` | Support ticket submission | Mock/local-state | Local form state + simulated submit | No ticket API/write path | Could bridge vendor issues to admin/support tooling | Hidden (linked from support page) |
| `/vendor/support/faqs` | FAQ content | Mock/static | Hardcoded FAQ list | Content not CMS/API-driven | Indirect support only | Hidden (linked from support page) |
| `/vendor/support/help-articles` | Help article listing/search | Mock/local-state + partial broken links | Hardcoded article catalog | Links to `/vendor/support/help-articles/[articleId]` pages that do not exist | Indirect support only | Hidden (linked from support page) |
| `/vendor/availability` | Weekly vendor availability editor | Mock/local-state | Local schedule state; notes mention `/api/vendor/availability` | Save is simulated; no real persistence from this UI | Should drive user booking slot selection | Hidden/unlinked in sidebar (reached via dashboard CTA) |
| `/vendor/analytics` | Team analytics view | Mock/local-state | Hardcoded employee/review stats | No real analytics fetch | Should reflect user review/job outcome quality | Hidden/unlinked |
| `/vendor/secure-account` | Vendor passkey onboarding | Partial-to-broken | Calls `/api/passkey/register-options` and `/api/passkey/register` | No matching API route handlers found in current route scan | Security readiness for vendor auth posture | Hidden/unlinked |
| `/vendor/register` | Vendor registration form | Mock/local-state | Local form + local approval branch | No registration persistence/approval pipeline wiring | Feeds admin vendor approval lifecycle if implemented | Hidden/entry route (not in vendor sidebar) |

---

## 2) User Surface Matrix

| Surface (route) | Purpose | Current state | Dependencies | Current blockers | Role linkage | Navigation visibility |
|---|---|---|---|---|---|---|
| `/user-dashboard` (inside `src/app/(user)/user-dashboard/page.tsx`) | User home and quick overview | Partial | `GET /api/customer/profile` + mock cards/stats | Major dashboard cards still mock | Starting point for user -> service discovery funnel | Sidebar visible |
| `/discover` | Browse/search discoverable services | Partial (mostly real) | `GET /api/services/discover`, `GET /api/services/categories`, favorites APIs | Some filters deferred (distance/availability/verified-only backend truth) | Consumes vendor services/profile publish state and media visibility | Sidebar visible |
| `/service/[serviceId]` | Service detail and booking entry | Partial | `GET /api/services/[id]`, `GET /api/reviews`, `GET /api/availability/vendor/[vendorId]`, favorites APIs | Reviews endpoint is still mock-backed | User sees vendor offering quality/media approved states | Dynamic (linked from discover/search) |
| `/booking/[serviceId]` | Multi-step booking creation | Partial (core real) | `GET /api/services/[id]`, `GET /api/availability/vendor/[vendorId]`, `POST /api/availability/check`, `POST /api/bookings` | No in-app payment flow; availability edit pipeline still weak on vendor side | Creates booking records that drive vendor jobs/admin audit trails | Dynamic (from service detail) |
| `/booking/[serviceId]/confirmation` | Booking confirmation and receipt/share | Real | `GET /api/bookings/[id]` | None significant | Finalizes user booking handoff to vendor fulfillment | Dynamic (post-booking redirect) |
| `/my-bookings` | Booking history, cancelation, media viewing | Partial (mostly real) | `GET /api/bookings`, `POST/DELETE cancel flows`, `GET /api/bookings/[id]/media` | UX still relies on mixed local state in parts | Connects to vendor job statuses and admin-approved media visibility | Sidebar visible |
| `/favorites` | Saved services management | Real | `GET/POST /api/users/favorites`, `DELETE /api/users/favorites/[id]` | None significant | Depends on discover/service catalog integrity | Sidebar visible |
| `/reviews` | User review history and actions | Mock/local-state | Local `mockReviews`; TODO backend notes | Not wired to real review backend flows | Should feed vendor reputation and admin review moderation | Sidebar visible |
| `/messages` | User messaging UI | Mock/local-state | Local conversation/message mocks | No real messaging backend | Should connect user-vendor communication around bookings | Sidebar visible |
| `/profile-settings` | User profile/preferences/security | Partial | `GET/PUT /api/customer/profile` + local placeholders | Password/location/2FA actions are placeholders; profile route uses development-style auth assumptions | User identity/preferences propagate to booking and personalization | Sidebar visible |
| `/search` | Search results view | Mock/local-state | Local mocked search result list | Not wired to real query endpoint | Should be alternate funnel into service detail | Hidden (reachable via search entry paths) |
| `/bookings` | Legacy alias route | Real (redirect utility) | Redirect to `/my-bookings` | None | Backward compatibility for booking links | Hidden utility route |

---

## 3) Admin Surface Matrix

| Surface (route) | Purpose | Current state | Dependencies | Current blockers | Role linkage | Navigation visibility |
|---|---|---|---|---|---|---|
| `/admin/dashboard` | Platform-level KPI overview | Mock/local-state | Mock stats/trends with TODO endpoint notes | Dashboard metrics not backend-fed | Should monitor user booking/vendor performance/moderation health | Sidebar visible |
| `/admin/users` | User management shell | Mock/local-state via component | `UserManagement` uses `seedUsers` local data | CRUD/bulk endpoints not wired | Should govern user/customer/vendor/admin accounts across platform | Sidebar visible |
| `/admin/admin-users` | Duplicate user management entry | Mock/local-state | Same `UserManagement` component | Redundant route duplicates `/admin/users` behavior | Same as above | Hidden/unlinked duplicate |
| `/admin/vendors` | Vendor management landing links | Partial/static | Internal links to publish, approval, logs, dashboard | No direct data view itself | Connects admin control over vendor lifecycle | Sidebar visible |
| `/admin/vendors/approval-queue` | Approve/reject vendor registrations | Mock/local-state | Simulated pending vendor data/actions | Approval queue not tied to real vendor registration records | Critical bridge for vendor onboarding -> discoverability | Hidden secondary page (linked from vendors page) |
| `/admin/publish-management` | Vendor/service publish toggles | Real | `GET /api/admin/publish`, `PATCH /api/admin/vendors/[vendorId]/publish`, `PATCH /api/admin/services/[serviceId]/publish` | Depends on data quality from vendor-side service/profile readiness | Governs what user can discover/book | Sidebar visible |
| `/admin/media-moderation` | Moderate vendor-uploaded media | Real | `GET /api/admin/media/moderation-queue`, `PATCH /api/admin/media/[assetId]/moderate` | Throughput/UX depends on vendor upload consistency | Determines user-visible booking/service media | Sidebar visible |
| `/admin/reviews` | Review moderation queue | Real | `GET /api/admin/reviews/moderation-queue`, `PATCH /api/admin/reviews/[reviewId]/moderate` | Upstream review creation still partially mock in user flows | Controls public/private review visibility affecting user trust and vendor reputation | Sidebar visible |
| `/admin/review-audit` | Audit of review windows/consent/compliance | Real | `GET /api/admin/review-audit` | Depends on complete upstream review/session data | Oversight layer on user-vendor review lifecycle | Hidden secondary page (linked from vendors/admin flows) |
| `/admin/audit-logs` | Admin action audit stream | Real | `GET /api/admin/audit-logs` | None major observed | Governance for moderation/publish actions | Sidebar visible |
| `/admin/notifications` | Admin notifications inbox | Real | `GET /api/admin/notifications`, `PATCH read/read-all` | Not exposed in primary sidebar nav | Operational awareness for admin actions/events | Hidden (likely badge-driven) |
| `/admin/activity` | Activity monitoring page | Mock/placeholder | `ActivityMonitoring` placeholder component | No real telemetry/activity feed | Should monitor cross-role operational events | Sidebar visible |
| `/admin/reports` | Reports/analytics page | Mock/placeholder | `ReportsAnalytics` placeholder component | No analytics backend integration in page | Should guide product and operational decisions across roles | Sidebar visible |
| `/admin/settings` | Admin settings page | Mock/placeholder | `Settings` placeholder component | Not wired; sidebar does not include direct link | Should govern admin/system-level policy settings | Exists but effectively hidden from main nav |
| `/admin/profile` | Admin profile page | Mock/placeholder | `Profile` placeholder component | Not wired to backend profile/auth settings | Should support admin account governance | Hidden/unlinked |

---

## 4) Built vs Mocked vs Broken Snapshot

### Vendor
- **Real/mostly real:** 2 (`/vendor`, core dashboard data path)
- **Partial hybrid:** 5 (`/vendor/dashboard`, `/vendor/profile`, `/vendor/services`, `/vendor/jobs`, `/vendor/secure-account`)
- **Mock/local-state:** 10 (`reviews`, `employees`, `billing`, support routes, `availability`, `analytics`, `register`, `profile/pricing`)
- **Broken/high-risk links:** help article detail links, passkey APIs likely missing

### User
- **Real/mostly real:** 3 (`favorites`, booking confirmation, `/bookings` redirect)
- **Partial hybrid:** 6 (`user-dashboard`, `discover`, `service/[id]`, booking flow, `my-bookings`, `profile-settings`)
- **Mock/local-state:** 3 (`reviews`, `messages`, `search`)
- **Broken/high-risk links:** none fatal route-level, but key capability gaps (payments, real messaging/reviews)

### Admin
- **Real/mostly real:** 7 (`publish-management`, `media-moderation`, `reviews`, `review-audit`, `audit-logs`, `notifications`, publish/review/media control surfaces)
- **Partial/static:** 1 (`vendors` landing)
- **Mock/local-state:** 7 (`dashboard`, `users`, `admin-users`, `approval-queue`, `activity`, `reports`, `settings`, `profile`)
- **Broken/high-risk links:** duplicate user management route; profile/settings discoverability and wiring gaps

---

## 5) Cross-Role Dependency Chain (Current Reality)

1. **Vendor profile + services readiness**
   - Vendor creates/updates profile and service records.
   - Service discoverability to users depends on service publish state and vendor public listing.

2. **Admin publish gating**
   - Admin publish management toggles `vendor.isPubliclyListed` and `service.isPublished`.
   - User discover/service detail experience only sees items passing this gate.

3. **User booking creation**
   - User booking flow consumes service detail + availability and writes booking records.
   - Booking records become operational workload for vendor jobs.

4. **Vendor job execution + media capture**
   - Vendor jobs/actions route updates booking lifecycle and media archive states.
   - Vendor media visibility/moderation statuses determine what can surface to users.

5. **Admin moderation gate**
   - Admin moderates media and reviews.
   - Moderation decisions control customer-visible media/review quality signals.

6. **User post-service trust loop**
   - User consumes moderated media in bookings and (eventually) submits reviews.
   - Vendor reputation and future user conversion depend on this loop.

### Current chain weaknesses
- Vendor-side operational pages (`employees`, `billing`, `reviews analytics`, `availability UI`) are mostly mock, so job ops are only partially end-to-end.
- User reviews/messages are mock, which breaks the reputation and communication feedback loop.
- Admin dashboard/reports/activity are mostly mock, limiting oversight and prioritization.
- Vendor registration and admin approval queue are not truly connected, weakening onboarding governance.

---

## 6) Redundant / Overlapping / Divergent Surfaces

- **Duplicate admin user management**
  - `/admin/users` and `/admin/admin-users` both route to `UserManagement`.
  - Recommendation: keep one canonical route and redirect the other.

- **Dual vendor layout patterns in codebase**
  - `src/app/vendor/layout.tsx` and `src/app/(vendor)/layout.tsx` expose different nav structures.
  - Risk: role drift and inconsistent discoverability of pages.

- **Vendor support split across multiple mock pages**
  - `/vendor/support`, `/vendor/support/chat`, `/vendor/support/contact`, `/vendor/support/faqs`, `/vendor/support/help-articles` are disconnected from real support backend.
  - Consider consolidating into one integrated support surface when backend exists.

- **Help article dead-end links**
  - `/vendor/support/help-articles` links to `/vendor/support/help-articles/[articleId]` pages that are not present.

---

## 7) Highest-Priority Fix Order (to reach a fully connected system)

1. **Complete vendor onboarding + approval chain**
   - Wire `/vendor/register` to persistent vendor registration records.
   - Connect `/admin/vendors/approval-queue` to those records with real approve/reject actions.
   - This unlocks trustworthy vendor lifecycle entry.

2. **Stabilize vendor operational core for live fulfillment**
   - Prioritize real implementations for `/vendor/availability`, `/vendor/employees`, and `/vendor/billing`.
   - Reduce local-only logic in `/vendor/jobs` where possible and keep state server-sourced.
   - This secures booking-to-execution reliability.

3. **Close user trust/communication loop**
   - Replace user mock pages `/reviews` and `/messages` with real APIs and persistence.
   - Ensure review writes are aligned with admin moderation and vendor reputation surfaces.
   - This restores post-job trust and retention loops.

4. **Align service publishing workflow**
   - Add vendor-scoped publish/archive UX-path support for `/vendor/services` (or canonicalized flow through admin policy).
   - Clarify exactly when a service is user-visible vs admin-pending.
   - This removes current publishing ambiguity.

5. **Harden security/account flows**
   - Implement missing passkey routes used by `/vendor/secure-account` (or disable UI until available).
   - Replace placeholder auth assumptions in customer profile flows.

6. **Upgrade admin oversight surfaces**
   - Replace mock admin dashboard/reports/activity with real aggregated metrics.
   - Keep moderation and publish queues as source-of-truth feeds for these dashboards.

7. **Route and nav cleanup**
   - Remove/redirect duplicate routes (`/admin/admin-users`), fix dead article links, and normalize admin profile/settings routes.
   - Reconcile divergent vendor layout/navigation definitions.

---

## 8) Foundational Dependencies Missing Across Roles

- **Unified auth/session truth** for customer/vendor/admin pages (several areas still use temporary/local assumptions).
- **Messaging domain model + APIs** for user-vendor communication.
- **Review write/ownership validation flow** fully tied to completed bookings.
- **Vendor HR/payments/availability domain APIs** used by currently mock vendor pages.
- **Onboarding approval pipeline** linking vendor registration requests to admin approval queue.
- **Admin observability aggregates** (dashboard/report/activity metrics) built from real transactional tables.

---

## 9) Quick End-to-End Health Readout

- **Best-connected chain today:**  
  `Admin publish/moderation` + `user discover/favorites/booking core` + `vendor dashboard/media/job action APIs`.

- **Most broken chain today:**  
  `Vendor registration -> admin approval -> vendor ops maturity (employees/billing/availability) -> user messaging/reviews -> admin analytics`.

