# Reliance Product Identity Alignment Audit

Source of truth: `RELIANCE_PRODUCT_IDENTITY.md`

Audit goal: identify where the current UI, navigation, wording, CTAs, or workflow framing presents Reliance as a marketplace, booking app, or service catalog instead of a proof-of-service, transparency, and trust platform.

No architecture changes are recommended in this document. Jobs, Services, Reviews, Trust Score, Videos, Booking records, Consent, and Moderation should remain intact.

## Severity Definitions

- **Critical:** Directly contradicts the proof-of-service mission.
- **High:** Creates marketplace expectations instead of proof expectations.
- **Medium:** Uses marketplace language when proof language would be stronger.
- **Low:** Minor wording or navigation inconsistency.

## Critical Findings

### 1. Public Brand Language Still Calls Reliance A Marketplace

**Conflicting pages/files**

- `src/components/public/PublicSiteFooter.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/forgot-password/page.tsx`
- `src/app/page.tsx`

**Conflicting wording**

- "Reliance. Public marketplace."
- "Return to a marketplace where trust signals stay separate."
- "continuation of the same marketplace journey"
- "Reliance marketplace"

**Why this conflicts**

The product identity explicitly says Reliance is not a general service marketplace. Calling the product a marketplace is the clearest direct contradiction because it teaches first-time users to compare Reliance to booking/lead platforms instead of proof-of-service platforms.

**Recommended correction**

Replace marketplace identity language with proof identity language:

- "Reliance. Proof-of-service platform."
- "Return to a platform where proof signals stay separate."
- "Reliance keeps service videos, customer reviews, and Trust Score visible as separate proof signals."
- "Reliance proof platform" or simply "Reliance."

### 2. Public Service Page Makes Booking The Primary Action

**Conflicting pages/files**

- `src/app/(user)/service/[serviceId]/page.tsx`

**Conflicting CTAs/wording**

- "Review this service before you book"
- "Book Now"
- "Sign in to Book"
- "Create or sign in to a free customer account before booking or saving this service."
- "booked today"

**Why this conflicts**

The product identity says service pages should become supporting context for proof. This page currently makes service booking the most obvious conversion path, which positions Reliance like a marketplace/scheduling product.

**Recommended correction**

Reframe the primary page goal:

- Primary CTA: "View Provider Proof" or "Contact Provider"
- Secondary CTA: "Request Service" if the booking flow remains available
- Heading: "Review completed work before you choose"
- Replace "booked today" with real proof context such as "Public proof available" or "Completed work examples available"
- Keep `/booking/[serviceId]` intact behind a secondary request flow until the future booking strategy is decided.

### 3. Registration Promises Booking And Scheduling As Core Benefits

**Conflicting pages/files**

- `src/app/auth/register/page.tsx`

**Conflicting wording**

- "Book appointments instantly"
- "Manage bookings and schedules easily"
- "customers book"
- "service listings"
- "Service Availability" as a launch-facing registration section

**Why this conflicts**

This creates the expectation that Reliance is a booking/scheduling app. The approved identity says scheduling may exist, but it must not be the primary product identity.

**Recommended correction**

Reframe registration benefits:

- Customer: "See real completed work before choosing a provider."
- Customer: "Access service videos, reviews, and Trust Score context."
- Vendor: "Turn completed jobs into public proof."
- Vendor: "Build credibility with service videos, reviews, and Trust Score evidence."
- Replace "customers book" with "customers understand what you offer" or "customers can request service after reviewing proof."

## High Findings

### 4. Public Navigation Uses Browse As A Marketplace Signal

**Conflicting pages/files**

- `src/components/public/PublicSiteHeader.tsx`
- `src/components/public/PublicSiteFooter.tsx`
- `src/app/vendors/[vendorId]/page.tsx`
- `src/app/help/page.tsx`

**Conflicting navigation**

- "Browse"
- "Find a Service"
- "Explore Services"
- "Browse public services"

**Why this conflicts**

"Browse" is not always wrong, but current surrounding language makes it feel like browsing a service marketplace. The product identity says Browse should be the public visitor version of proof discovery.

**Recommended correction**

Rename public-facing navigation/CTAs:

- "Browse" -> "Explore Proof"
- "Find a Service" -> "See Public Proof" or "Explore Verified Work"
- "Explore Services" -> "Explore Proof"
- "Browse public services" -> "Explore public proof"

Keep the `/browse` route for compatibility.

### 5. Signed-In Discover Feels Like A Service Catalog

**Conflicting pages/files**

- `src/app/(user)/discover/page.tsx`
- `src/components/UserSidebar.tsx`

**Conflicting wording**

- Sidebar: "Discover"
- Page heading: "Browse Services"
- "Use search, category, and price sorting to narrow the full marketplace."
- "Nearby Services"
- "Available Near You"
- "View Service"

**Why this conflicts**

The product identity says Discover should be the signed-in customer's proof-first exploration experience. Current wording still emphasizes service catalog filtering and location-based marketplace discovery.

**Recommended correction**

Reframe Discover:

- Sidebar: "Explore Proof"
- Page heading: "Explore Public Proof"
- "Nearby Services" -> "Proof Near You" or "Providers With Proof Near You"
- "Available Near You" -> "Public Proof Near You"
- "View Service" -> "View Proof" where media/reviews exist; otherwise "View Service Offered"
- Explain that services are filters/context, not the main product.

### 6. Public Browse Is Service-First Instead Of Proof-First

**Conflicting pages/files**

- `src/app/browse/page.tsx`

**Conflicting wording**

- "Browse services with reviews, videos, and clear provider details"
- "Search public services, compare providers..."
- "Public services customers can browse right now"
- "Loading public services"
- "The marketplace is active"
- "No public services are available yet"
- "Create a free account to message vendors and book services directly"

**Why this conflicts**

Browse should introduce the proof concept first. Today it describes services as the primary inventory and proof signals as attachments.

**Recommended correction**

Reframe the page:

- Heading: "Explore public proof before choosing a provider"
- Subheading: "Compare completed work, public service videos, reviews, and Trust Score context."
- Metric: "Public proof examples" instead of "Public services"
- Loading: "Loading public proof"
- Empty: "No public proof is available yet"
- CTA: "Create a free account to save proof examples or contact providers"

Phase 2 should later change cards to proof-first cards, but Phase 1 can be copy-only.

### 7. Customer Dashboard Is Still Booking/Service First

**Conflicting pages/files**

- `src/app/(user)/user-dashboard/page.tsx`
- `src/components/UserSidebar.tsx`

**Conflicting wording/navigation**

- "Browse services, track bookings..."
- "Active Services"
- "Find Services"
- "Browse services and compare providers before you book."
- "My Services"
- "My Bookings"

**Why this conflicts**

The customer dashboard should help customers understand their service records, proof, videos, and review eligibility. Current wording makes the account feel like a marketplace account.

**Recommended correction**

Reframe dashboard:

- "Active Services" -> "Active Service Records"
- "Find Services" -> "Explore Public Proof"
- "My Services" -> "My Service Records" or "My Work & Proof"
- "My Bookings" -> "Service Records"
- Dashboard description: "Review your service records, approved videos, saved providers, and review status from one place."

### 8. Vendor Growth Language Still Depends On Marketplace Discovery

**Conflicting pages/files**

- `src/lib/vendor-growth-summary.ts`
- `src/app/vendor/dashboard/page.tsx`
- `src/app/vendor/services/page.tsx`
- `src/app/vendor/profile/page.tsx`

**Conflicting wording**

- "customers can discover and book you in the marketplace"
- "published services are what place your business into public marketplace discovery"
- "Promotions only help once customers can click into a published service from the marketplace"
- "Business profile is currently visible in the public marketplace"
- "services customers will be able to view and book"

**Why this conflicts**

Vendor growth should be about building public proof and credibility. Marketplace discovery language makes vendors think the goal is catalog visibility rather than verified proof.

**Recommended correction**

Reframe vendor growth:

- "Public marketplace discovery" -> "public proof discovery"
- "published services" -> "Services Offered"
- "customers can discover and book" -> "customers can understand your work and request service"
- "visible in the public marketplace" -> "visible in public proof discovery"
- "Promotions help increase proof visibility when your profile has enough public proof."

## Medium Findings

### 9. Vendor Services Page Is Close, But Still Uses Book/Draft Framing

**Conflicting pages/files**

- `src/app/vendor/services/page.tsx`

**Conflicting wording**

- "book once Reliance publishes them"
- "before booking"
- "prepares the service customers can book"
- "Service published: the service becomes publicly discoverable and bookable"
- `service_draft` AI mode label internally

**Why this conflicts**

The page has improved with "Your Service Menu," but it still should be clearer that services are supporting context for public proof, not standalone marketplace inventory.

**Recommended correction**

Copy-only changes:

- "Your Service Menu" can stay.
- Add: "These are the types of work customers can understand and compare against your public proof."
- "bookable" -> "available for customers to review and request"
- "draft" -> "service setup" or "unpublished service"

### 10. Vendor Profile Public Section Uses Services/Listings Before Credibility

**Conflicting pages/files**

- `src/app/vendors/[vendorId]/page.tsx`

**Conflicting wording**

- "Public services"
- "Approved listings currently shown to customers"
- "Public service listing"
- "View Service"
- Header CTA: "Explore Services"

**Why this conflicts**

Vendor profiles should be credibility profiles. Services can remain, but proof, videos, reviews, and Trust Score should lead the mental model.

**Recommended correction**

Reframe sections:

- "Public services" -> "Services Offered"
- "Approved listings" -> "Visible proof and service context"
- "View Service" -> "View Service Proof" where proof exists, otherwise "View Service Offered"
- Header CTA -> "Explore Public Proof"

### 11. Reviews Page Still Uses Booking As Customer Mental Model

**Conflicting pages/files**

- `src/app/(user)/reviews/page.tsx`

**Conflicting wording**

- "completed booking"
- "booking-linked feedback"
- "Open the booking"
- "View booking"
- "Why some completed bookings still are not reviewable"

**Why this conflicts**

Reviews are conceptually tied to real service activity. The customer does not need to think in database/booking terms unless support requires an ID.

**Recommended correction**

Reframe customer-facing review language:

- "completed booking" -> "completed service record"
- "booking-linked feedback" -> "service-record feedback"
- "View booking" -> "View service record"
- Keep Booking ID visible only as a support reference.

### 12. Help Center Describes Service Discovery And Booking Too Prominently

**Conflicting pages/files**

- `src/app/help/page.tsx`

**Conflicting wording**

- "discover publicly listed local services"
- "manage bookings"
- "Booking or saving a service"
- "Browsing services"
- "Find a Service"

**Why this conflicts**

Help should teach the proof-of-service model, especially for first-time users.

**Recommended correction**

Reframe help topics:

- "Understanding public proof"
- "Viewing service records and videos"
- "When reviews become available"
- "How Trust Score differs from reviews"
- "Contacting a provider after reviewing proof"

### 13. Auth And Email Verification Mention Bookings First

**Conflicting pages/files**

- `src/lib/auth-email-verification.ts`
- `src/lib/auth-next.ts`

**Conflicting wording**

- "manage bookings"
- "future booking updates"
- "Back to Booking"
- "this booking"
- "browsing local services"

**Why this conflicts**

Auth messaging should reinforce the platform identity at the exact moment a customer or vendor is forming their first impression.

**Recommended correction**

- "manage bookings" -> "access service records, videos, and reviews"
- "future booking updates" -> "future service-record updates"
- "Back to Booking" -> "Back to Service Request" if preserving flow
- "browsing local services" -> "exploring public proof"

## Low Findings

### 14. CSS/Class Names Still Say Marketplace

**Conflicting files**

- `src/app/globals.css`
- Multiple pages using `reliance-marketplace-shell`

**Why this conflicts**

This is mostly internal/class naming and does not directly affect users. It can wait.

**Recommended correction**

Optional later cleanup:

- Keep current class names short-term to avoid broad churn.
- If refactoring styles later, rename to `reliance-proof-shell` or `reliance-public-shell`.

### 15. Admin Copy Still Uses Marketplace In Publishing/Promotions

**Conflicting pages/files**

- `src/app/admin/publish-management/PublishManagementClient.tsx`
- `src/app/admin/promoted-listings/page.tsx`
- `src/lib/promoted-listings.ts`

**Conflicting wording**

- "public Reliance marketplace"
- "service discovery"
- "browse featured"
- "marketplace volume"

**Why this conflicts**

Admin language is less customer-facing, but it influences future operational decisions and owner mental models.

**Recommended correction**

- "public Reliance marketplace" -> "public Reliance proof surface"
- "service discovery" -> "proof discovery"
- "browse featured" -> "featured proof placement"
- "marketplace volume" -> "public proof inventory"

## Recommended Correction Order

### Phase 1: Copy And Navigation Only

Do first. Low architecture risk.

1. Public header/footer navigation.
2. Homepage hero and preview language.
3. Auth/login/register language.
4. Customer sidebar labels.
5. Browse/Discover headings, empty states, and CTAs.
6. Customer dashboard labels.
7. Help center topic labels.

### Phase 2: Browse/Discover Proof-First Experience

Keep existing service API initially, but reframe cards and sorting:

1. Lead cards with public proof when available.
2. Show service as work type/context.
3. Change "View Service" to "View Proof" when proof exists.
4. Add "proof available" states.
5. Add proof-first empty/loading states.

### Phase 3: Service Pages Become Supporting Context

1. Move proof/video/reviews/trust above booking/request CTA.
2. Make Contact/Request secondary and trust-informed.
3. Remove urgency-style marketplace claims unless backed by real data.
4. Treat services as work types connected to public proof.

### Phase 4: Vendor Profiles Become Credibility Profiles

1. Lead with public proof summary.
2. Keep Trust Score maturity high.
3. Show videos/reviews before Services Offered.
4. Make Services Offered supporting context.

### Phase 5: Evaluate Booking/Scheduling

Do not remove now.

Later decision:

- Keep booking as optional secondary request flow.
- Rename public booking flow to service request.
- Keep booking records internally as job/service-record linkage.
- Only remove customer-facing scheduling if product testing confirms it distracts from proof.

## Global Recommended Replacement Map

| Current | Recommended |
| --- | --- |
| Marketplace | Proof-of-service platform |
| Browse | Explore Proof |
| Find a Service | See Public Proof |
| Discover | Explore Proof |
| Browse Services | Explore Public Proof |
| Public services | Public proof / Services Offered, depending on context |
| Service listing | Service Offered / Work Type |
| Book Now | Request Service / Contact Provider |
| Sign in to Book | Sign in to Request Service |
| My Services | My Service Records / My Work & Proof |
| Booking | Service Record / Work Record, customer-facing |
| Booking ID | Reference ID, with Booking ID only for support |
| Available Near You | Proof Near You / Providers With Proof Near You |
| Published service | Published Service Offered |
| Service draft | Service setup / Unpublished service |
| Promoted listing | Featured proof placement |

## Summary

Reliance does not need an architecture rewrite to align with the approved identity. The most urgent work is copy and navigation discipline.

The current platform already has the correct proof engine: jobs, media, reviews, Trust Score, moderation, and vendor profiles. The main conflict is that public and customer-facing surfaces still often describe the system as a marketplace where services are browsed and booked.

The first implementation pass should be a language and navigation reframing pass, not a schema or workflow change.
