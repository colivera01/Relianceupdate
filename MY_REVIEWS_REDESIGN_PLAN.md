# My Reviews Real-Data Redesign Plan

## 1) Product Goal
- Reposition `My Reviews` as a simple customer feedback hub.
- Focus on customer actions and status, not analytics/moderation/admin controls.
- Use real customer-scoped data only; remove all mock-first behaviors.

## 2) Final Sections (target UX)
- **Pending Reviews**
  - Completed services the customer can still review.
  - Primary action: `Leave Review`.
- **Submitted Reviews**
  - Reviews already submitted by the customer.
  - Read-only summary + `View Proof` when available.
- **Proof-Based Reviews**
  - Subset of submitted reviews linked to booking proof/media session.
  - Emphasize trust trail: service -> proof -> submitted rating.

## 3) Remove From Current Page
- Pricing and payment language.
- Category filters and advanced filter matrix.
- Helpful/replies counters.
- Edit/delete actions.
- Grid/list toggle.
- Creation-type filters (`manual`/`auto`).
- Mock-only fields and derived fake metadata.

## 4) Proposed API Contract
- **Endpoint:** `GET /api/reviews/me`
- **Response shape:**

```json
{
  "pending": [],
  "submitted": [],
  "proofBased": []
}
```

- **Suggested item shapes (minimum):**
  - `pending[]`: `bookingId`, `vendorId`, `vendorName`, `serviceName`, `serviceDate`, `status`.
  - `submitted[]`: `reviewId`, `bookingId`, `vendorId`, `vendorName`, `serviceName`, `rating`, `comment`, `submittedAt`, optional `mediaSessionId`.
  - `proofBased[]`: `reviewId`, `bookingId`, `vendorId`, `vendorName`, `serviceName`, `rating`, `submittedAt`, `mediaSessionId`, optional `proofStage`.

## 5) Backend Logic Plan
- **pending**
  - Source: bookings owned by authenticated customer.
  - Criteria:
    - booking status is completed (`COMPLETED`).
    - no existing review for that booking.
- **submitted**
  - Source: reviews where `review.userId == authenticated customer`.
  - Include linked booking/vendor/service info for rendering.
- **proofBased**
  - Source: submitted reviews with proof linkage.
  - Criteria:
    - has `mediaSessionId` and/or booking proof association resolvable from review + booking media model.

## 6) Frontend Rewrite Plan
- **Rewrite file:** `src/app/(user)/reviews/page.tsx`
- **Data source:** replace local mock arrays with `GET /api/reviews/me`.
- **Layout**
  - Single-column stacked cards grouped by section.
  - Keep section headers compact and action-oriented.
- **Card actions**
  - `Pending`: `Leave Review` -> route to booking proof/review entry (`/my-bookings/[bookingId]`).
  - `Submitted`: optional `View Proof` when media/proof link exists.
  - `Proof-Based`: always show `View Proof` CTA when proof path is resolvable.
- **Content rules**
  - Show service, vendor, date, rating/comment where applicable.
  - No pricing/payment language.
  - No admin/analytics controls.
- **States**
  - Loading skeleton.
  - Empty state per section.
  - Error state with retry.

## 7) Risks / Open Questions
- **Missing fields risk**
  - Current review records may not consistently include all customer-facing display fields (e.g., service name on review row).
  - May require joins to booking/service/vendor or response-level normalization.
- **Route assumptions**
  - `Leave Review` assumes proof/review entry remains `/my-bookings/[bookingId]`.
  - `View Proof` assumes proof media is accessible from booking context and customer authorization.
- **Ownership assumptions**
  - Must enforce strict customer ownership for both bookings and reviews (`userId` match).
  - Avoid exposing vendor/internal moderation attributes in customer API.
- **Data consistency**
  - Existing mocked `GET /api/reviews` behavior can cause drift if page accidentally falls back to legacy route.
  - Need explicit migration to `GET /api/reviews/me` as sole source for this page.

## Recommended Implementation Order
1. Add `GET /api/reviews/me` route with customer auth + ownership enforcement.
2. Implement backend section builders (`pending`, `submitted`, `proofBased`) and normalize DTOs.
3. Rewrite `src/app/(user)/reviews/page.tsx` to single-column sectioned UI using the new API.
4. Wire CTAs (`Leave Review`, `View Proof`) to booking/proof routes with graceful fallback.
5. Remove legacy mock-only UI logic and run smoke checks for customer review journeys.
