# USER_SURFACE_AUDIT

## Scope

Audited customer/user-facing routes and dependencies:

- `/user-dashboard`
- `/discover`
- `/my-bookings`
- `/bookings`
- `/favorites`
- `/reviews`
- `/messages`
- `/profile-settings`

Also reviewed related backend/API surfaces for bookings, profile, favorites, reviews, discover/services, and customer-authorized media access.

---

## Page-by-Page Audit

### `/user-dashboard`

- **Primary file:** `src/app/(user)/user-dashboard/page.tsx`
- **Rendered sections/components:**
  - Profile header and summary
  - `ProfileToggle` and `AddVendorProfile`
  - Quick stats, trending services, nearby vendors, community highlights
- **Actions/buttons:**
  - Retry
  - profile-mode toggle
  - add-business-profile visibility toggle
  - card-level buttons (`Book Now`, `View Details`, heart/favorite)
- **Intended purpose:** personalized customer dashboard with service/vendor highlights
- **Connected vs mock:** **Partially connected**
  - Connected: profile fetch
  - Mock: most dashboard metrics/cards/highlights
- **Data mapping:**
  - Direct fetch: `GET /api/customer/profile` (Bearer `temp-jwt-token`)
  - No SDK/hook abstraction
- **Route quality:** `/api/customer/profile` is partial/mock-auth (temp token + in-memory data)
- **Notable mismatch/risk:**
  - UI expects `profile.id`, route payload can omit it; fallback `"temp-id"` is used
  - stats/favorites/reviews counts are hardcoded

### `/discover`

- **Primary file:** `src/app/(user)/discover/page.tsx`
- **Rendered sections/components:**
  - Search, advanced filters, sort controls
  - Vendor cards grid
- **Actions/buttons:**
  - filter/search/sort
  - favorite heart toggle
  - `Call`, `Message`, `Share`
  - `View Profile` -> `/vendor/[id]`
- **Intended purpose:** customer discovery marketplace
- **Connected vs mock:** **Fully mocked**
  - hardcoded vendor/category datasets, no backend fetch
- **Data mapping:**
  - No hooks/SDK/fetch
  - Should align to `GET /api/services/discover` (already real)
- **Route quality mismatch:**
  - page is vendor-centric with mock fields (`distance`, availability labels, etc.)
  - real discover route is service-centric and trust-safe

### `/my-bookings`

- **Primary file:** `src/app/(user)/my-bookings/page.tsx`
- **Rendered sections/components:**
  - Header + tabs (upcoming/past/cancelled)
  - filters/sort controls
  - list/calendar toggle
  - booking cards
- **Actions/buttons:**
  - `+ New Booking`, `Start Booking`, `Browse Services`
  - card actions (reschedule/cancel/review/rebook/download/contact/calendar)
- **Intended purpose:** customer booking history and actions
- **Connected vs mock:** **Fully mocked**
  - in-file booking arrays, mostly placeholder handlers
- **Data mapping:**
  - No current API integration
  - Relevant routes exist but are mixed (`/api/bookings`, `/api/bookings/[id]`, `/api/bookings/[id]/cancel`)

### `/bookings`

- **Primary file:** `src/app/(user)/bookings/page.tsx`
- **Rendered sections/components:**
  - Stats cards
  - tabs/search/filter
  - expandable booking rows/cards
  - cancel/reschedule/review modal flows
- **Actions/buttons:**
  - refresh/new booking
  - expand and mutate booking state in UI
  - share/download UI actions
- **Intended purpose:** full booking operations and history
- **Connected vs mock:** **Fully mocked**
  - extensive local arrays and local mutations
- **Data mapping:** no hooks/fetch/SDK calls
- **Mismatch risk:** UI booking shape richer than current backend responses

### `/favorites`

- **Primary file:** `src/app/(user)/favorites/page.tsx`
- **Rendered sections/components:**
  - favorites header
  - search/filter/sort/view mode
  - grid/list favorite cards
- **Actions/buttons:**
  - remove favorite (local)
  - contact -> `/messages?vendor=<id>`
  - book -> `/booking/<id>`
  - details -> `/service/<id>`
- **Intended purpose:** saved vendor/service list for quick re-engagement
- **Connected vs mock:** **Fully mocked**
  - local `mockFavoriteVendors`
- **Data mapping:**
  - Page itself: no API calls
  - Related backend: `/api/users/favorites` exists but mock/partial
  - Missing expected route: `/api/users/favorites/[id]` (delete)
- **Mismatch risk:** UI expects richer favorite schema than backend currently returns

### `/reviews`

- **Primary file:** `src/app/(user)/reviews/page.tsx`
- **Rendered sections/components:**
  - review feed (grid/list)
  - filters by status/type/category/rating
  - pending review prompts
- **Actions/buttons:**
  - edit/delete published review
  - view booking/vendor
  - write review for pending
- **Intended purpose:** customer’s own review history and workflow
- **Connected vs mock:** **Fully mocked**
  - in-file review dataset; no backend reads
- **Data mapping:**
  - Not wired to `/api/reviews` (which is also mock/partial)
  - Public-safe backend exists only for vendor public reviews: `/api/vendors/[vendorId]/reviews/public`
- **Mismatch risk:**
  - UI expects fields not represented in current backend schema
  - likely runtime issue: empty-state condition references undefined `reviewType`

### `/messages`

- **Primary file:** `src/app/(user)/messages/page.tsx`
- **Rendered sections/components:**
  - conversation list/sidebar
  - message thread view
  - compose area
  - settings/new-message/attachment/emoji dialogs
- **Actions/buttons:**
  - send message (local optimistic append)
  - pin/archive/delete selection
  - reactions/copy/report placeholders
- **Intended purpose:** customer-vendor messaging
- **Connected vs mock:** **Fully mocked**
  - local conversations/messages data
- **Data mapping:** no messaging API integration found

### `/profile-settings`

- **Primary file:** `src/app/(user)/profile-settings/page.tsx`
- **Rendered sections/components:**
  - profile/account form
  - location and security controls
  - password and 2FA controls
  - quick account actions
- **Actions/buttons:**
  - edit/save/cancel
  - profile update via API + localStorage fallback
  - password update placeholder
  - toggle location/2FA
- **Intended purpose:** customer account/profile management
- **Connected vs mock:** **Partially connected**
  - GET/PUT profile calls exist
  - many stats remain hardcoded
- **Data mapping:**
  - `GET /api/customer/profile`
  - `PUT /api/customer/profile`
- **Mismatch risk:** UI address composition differs from API split fields (`city/state`) and is brittle

---

## Connected vs Mock Breakdown

- **Fully mocked:** `/discover`, `/my-bookings`, `/bookings`, `/favorites`, `/reviews`, `/messages`
- **Partially connected:** `/user-dashboard`, `/profile-settings`
- **Fully backend connected:** none of the listed customer pages today

---

## Route / Hook / API Mapping (Key)

- **Real & trust-aligned (available but underused by customer pages):**
  - `GET /api/services/discover`
  - `GET /api/bookings/[id]/media` (customer ownership checks)
  - `GET /api/services/[id]/media?audience=customer` (authorized customer flow)
  - `GET /api/vendors/[vendorId]/reviews/public` (approved + public only)
- **Partial/mixed/mocked routes currently used or adjacent:**
  - `GET/PUT /api/customer/profile` (temp auth / in-memory)
  - `GET /api/bookings` (mock), `POST /api/bookings` (partially real)
  - `GET/PUT/DELETE /api/bookings/[id]` (mock)
  - `/api/bookings/[id]/cancel` (mock)
  - `/api/users/favorites` (mock/partial)
  - `/api/reviews` (mock/partial)
- **Missing route expected by UI flows:**
  - `/api/users/favorites/[id]` (delete)
  - messaging endpoints for `/messages`

---

## Customer Trust / Auth Alignment

### What is aligned

- Customer media authorization routes are implemented server-side and safe.
- Public discovery and public vendor review exposure routes are trust-safe.

### What is not aligned yet

- Most customer pages do not consume trust-safe routes.
- Profile/auth flow still uses temporary token behavior.
- Favorites/reviews/messages remain local or mock and bypass authorization and governance logic.
- Booking pages are disconnected from customer-authorized booking/media truth.

---

## Cross-Page Dependency Map

- **Public marketplace -> customer journey:**
  - `/browse` + `/service/[id]` + `/vendors/[vendorId]` should feed into booking/favorites/review actions.
- **Bookings -> media/reviews:**
  - booking history pages should call real booking APIs and customer-authorized media routes.
- **Favorites:**
  - should connect to service/vendor records already exposed on public-safe surfaces.
- **Reviews:**
  - customer review creation/listing should align with governance fields and moderation outcomes.
- **Messages:**
  - requires authenticated conversation APIs before real cross-page integration.
- **Profile/account:**
  - should provide authenticated identity/state used by bookings, favorites, reviews, messages.

---

## Gap Analysis and Phase O Priorities

### 1) Booking path (highest priority)

- Fix customer booking create/read contract end-to-end.
- Ensure authenticated user context instead of UI-injected IDs.
- Wire booking history UI (`/my-bookings` or `/bookings`) to real routes.

### 2) Discover alignment

- Replace `/discover` mock page data with `GET /api/services/discover`.
- Preserve service-first trust-safe shape (avoid fake distance/availability claims).

### 3) Favorites completion

- Create missing favorites item route (`/api/users/favorites/[id]`).
- Normalize favorite data contracts and wire `/favorites` page fully.

### 4) Profile auth hardening

- Replace temp-token profile model with real auth/session-backed user identity.
- Keep profile as single source of truth for customer data.

### 5) Review workflow alignment

- Replace customer `/reviews` mocks with real, governance-aware backend routes.
- Keep public exposure strictly tied to approved + public rules.

### 6) Messages foundation

- Create authenticated messaging APIs and then wire `/messages`.

---

## Discover Alignment Recommendations

- Treat `/api/services/discover` as canonical discovery backend.
- Refactor `/discover` UI from vendor-centric mock cards to service-centric real results.
- Reuse successful public browse query/filter patterns where practical.
- Keep trust-safe omission behavior (no invented verified/featured/distance/availability).

---

## Exact Files Likely Needing Updates (Phase O)

- `src/app/(user)/booking/[serviceId]/page.tsx`
- `src/app/api/bookings/route.ts`
- `src/app/(user)/my-bookings/page.tsx`
- `src/app/(user)/bookings/page.tsx`
- `src/app/(user)/discover/page.tsx`
- `src/app/(user)/favorites/page.tsx`
- `src/app/api/users/favorites/route.ts`
- `src/app/api/users/favorites/[id]/route.ts` (new)
- `src/app/(user)/service/[serviceId]/page.tsx`
- `src/app/(user)/profile-settings/page.tsx`
- `src/app/api/customer/profile/route.ts`
- `src/app/(user)/reviews/page.tsx`
- `src/app/api/reviews/route.ts`
- `src/app/(user)/messages/page.tsx`
- `src/app/api/messages/route.ts` (new + likely thread/message subroutes)

