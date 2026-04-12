# Public Browse Audit

## Scope
- Page focus: `src/app/browse/page.tsx`
- Related data clients/hooks/routes reviewed:
  - `src/sdk/services.ts`
  - `src/sdk/search.ts`
  - `src/hooks/useServices.ts`
  - `src/app/api/services/route.ts`
  - `src/app/api/services/[id]/route.ts`
  - `src/app/api/services/[id]/media/route.ts`
  - `src/app/api/bookings/[id]/media/route.ts`
  - `src/app/(user)/service/[serviceId]/page.tsx`

## 1) Current Page Structure (`/browse`)

The page in `src/app/browse/page.tsx` currently renders:

1. Header
- Reliance logo/title
- `Sign Up` and `Sign In` buttons

2. Hero
- Title: "Browse Local Services"
- Marketplace pitch copy

3. Search and Filters panel
- Search bar (`What service do you need?`)
- Category dropdown
- Filters toggle button
- Expanded "Basic Filters" section with:
  - Distance slider
  - Sort-by dropdown
  - Clear-all

4. Popular Categories section
- Category cards with icon, vendor count, description, popular services

5. Featured Vendors Near You section
- Vendor cards showing:
  - Image
  - Vendor name/category
  - Verified/Featured/Availability badges
  - Rating/review count
  - Distance
  - Description
  - Experience
  - Video profile tag
  - Actions: Share, disabled Call/Message, View Profile

6. Empty-state for no vendor results

7. Registration prompt block
- "Want to contact vendors?" + sign-up CTA

8. Final CTA block
- "Sign Up as Customer" + "Join as Vendor"

## 2) Data Source Mapping (Connected vs Mock)

### Search bar
- Status: **Fully mocked/local state**
- Source: client-side `searchQuery` filter over hardcoded `featuredVendors`
- No backend query

### Category dropdown
- Status: **Fully mocked/local state**
- Source: hardcoded `categories` array
- No backend categories endpoint usage

### Filters button / filter controls
- Status: **Fully mocked/local state**
- Source: local `distance`, `sortBy`, and in-memory filtering/sorting
- No backend pagination/sort/filter query

### Popular categories section
- Status: **Fully mocked**
- Source: hardcoded `categories` with fake `count`, descriptions, popular services

### Featured vendors near you
- Status: **Fully mocked**
- Source: hardcoded `featuredVendors` array
- "Near you" is simulated with mock `distance`

### Vendor cards
- Status: **Fully mocked**
- Rating/reviews/verified/availability/experience/video profile are all static local fields

### Ratings/review counts
- Status: **Mocked**
- Not sourced from reviews API aggregation

### Media/images shown
- Status: **Mocked/non-governed**
- Uses static remote image URLs in mock vendor cards
- Not sourced from moderated `MediaAsset` reads

## 3) API / Hook Usage on Browse

### What `/browse` currently uses
- No hooks from `src/hooks` for data loading
- No SDK usage from `src/sdk`
- No `fetch(...)` calls at all
- Entire page is local state + hardcoded arrays

### Related API/SDK assets present but not used by `/browse`
- `src/sdk/services.ts`
  - `listServices()` -> `/api/services`
  - `getService()` -> `/api/services/:id`
  - Many endpoints are defined in SDK but not wired in browse
- `src/hooks/useServices.ts`
  - React Query wrappers around services SDK
  - Not used by `/browse`
- `src/sdk/search.ts`
  - Expects endpoints like `/api/search/*`
  - Those search endpoints are not part of the current browse implementation

### Existing route mismatch worth noting
- `handleViewProfile()` navigates to `/vendor/${vendorId}` from browse cards.
- A public vendor profile route at that pattern is not currently present in `src/app`.

## 4) Public Marketplace Readiness (Using Trust Model)

Given current moderation/visibility enforcement, `/browse` should become a DB-backed discovery surface with backend filtering by default.

### Vendor eligibility rules (recommended)
- Vendor must be active/approved for public listing (explicit vendor-level flag recommended, e.g. `isPubliclyListed`)
- Vendor profile should be complete enough for display (name/category/location at minimum)
- Optional future gate: vendor compliance/verification state for "Verified" badge

### Service eligibility rules (recommended)
- Service status active/published
- Service belongs to a public-listed vendor
- Service has required fields for display (name/category/price/location context)

### Public media eligibility rules (must match trust model)
- Only include media where:
  - `moderationStatus = approved`
  - `visibilityStatus = public`
  - `archiveStatus = active`
  - `deletedAt = null`
- No `customer_only`, `vendor_archive_only`, `private`, pending/rejected/flagged in browse

### Public review visibility rules (recommended)
- Show only approved/public-safe reviews (if review moderation exists)
- Exclude hidden/flagged/internal reviews
- Use aggregated rating + count from approved reviews only

## 5) Dependencies on Other Areas

To power a real discovery page, these domains must feed browse:

1. Vendor profile/services
- Vendor onboarding + profile completeness
- Vendor service creation/activation (`vendor/services`)

2. Admin approval/moderation
- Admin vendor approval/listing governance
- Admin media moderation decisions (already in place for assets)

3. Media visibility
- Public-facing media originates from moderated `MediaAsset` reads only
- Public preview thumbnails/hero images should use public-approved assets

4. Reviews
- User review creation flow
- Admin/moderation policy for what reviews are displayable
- Aggregation pipeline for rating/count

## 6) Gap: Public Detail vs Public Discovery

### Already enforced on public service detail/media
- `GET /api/services/[id]` now returns DB-backed service data and limits media to public-approved-active assets.
- `GET /api/services/[id]/media` supports audience-safe filtering and defaults to public-safe visibility.

### Still missing on `/browse`
- No backend data usage
- No trust-aware route consumption
- No pagination/query-backed filtering
- No real geolocation/distance or eligibility logic
- "Featured"/"Verified"/ratings are not trust-backed

### Needed list/discovery route/query patterns
- Add a public discovery endpoint (recommended):
  - `GET /api/services/discover` or `GET /api/public/services`
- Query support:
  - `q`, `category`, `distance`, `sortBy`, `page`, `limit`
- Response should include only eligible public services/vendors plus public-safe media references and approved review aggregates.
- Enforce moderation/visibility in backend route, not UI.

## 7) Recommended Implementation Order

### Phase A: Backend discovery foundation
1. Create public discovery route:
- Proposed file: `src/app/api/services/discover/route.ts`
2. Implement vendor/service/public-media eligibility filters in that route
3. Return pagination and stable sort

### Phase B: Browse data wiring
1. Replace hardcoded `categories`/`featuredVendors` in `src/app/browse/page.tsx`
2. Wire search/category/filter controls to discovery query params
3. Render cards from API response
4. Add loading/error/empty states tied to backend responses

### Phase C: Trust and UX polish
1. Ensure badges (Verified/Featured/Availability) come from real backend fields
2. Align card media with public-approved assets
3. Fix profile navigation target (replace `/vendor/:id` with real public profile route when available)

## 8) Exact Files/Routes Likely Needing Updates

### Primary UI
- `src/app/browse/page.tsx` (major conversion from mock to live data)

### Primary API
- `src/app/api/services/discover/route.ts` (new; recommended)
- `src/app/api/services/route.ts` (optional, if reusing and extending for public discover semantics)

### Supporting data contracts
- `src/sdk/services.ts` (add `discoverServices()` call)
- `src/hooks/useServices.ts` (add hook for discovery query)
- `src/types/api.ts` (if discover response shape requires new types)

### Related trust routes already available
- `src/app/api/services/[id]/route.ts` (public-safe detail/media already improved)
- `src/app/api/services/[id]/media/route.ts` (audience-aware media route)
- `src/app/api/bookings/[id]/media/route.ts` (customer-authorized booking media)

## Bottom Line
- `/browse` is currently a presentational mock page.
- Public detail/media reads are ahead of discovery in trust enforcement.
- Converting browse to a real marketplace now mainly requires a public discovery API + wiring the page to it.
