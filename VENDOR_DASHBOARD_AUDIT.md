# Vendor Dashboard Audit (2026-04-27)

## Current Dashboard Cards
| Card | Current Value Source | Click Route | Status |
|---|---|---|---|
| Jobs Today | Derived in UI from `recentJobs` date | `/vendor/jobs?filter=today` | Live |
| In Progress | Derived in UI from `recentJobs.status` | `/vendor/jobs?filter=in-progress` | Live |
| Awaiting Review | Derived in UI as `completed - recentReviews.length` | `/vendor/jobs?filter=awaiting-review` | Hybrid (proxy metric) |
| Completed | Derived in UI from `recentJobs.status` | `/vendor/jobs?filter=completed` | Live |
| Proof | Hardcoded (`pendingModerationProofs=0`, `approvedProofs=0`) | `/vendor/media` | Live page, placeholder metrics |
| Reviews | API stats (`rating`, `ratingCount`) | `/vendor/reviews` | Live |
| Storage Usage | Hardcoded (`0 / 50 GB`) | `/vendor/storage` | Live page, placeholder card metrics |

## Data Source for Each Area
- Hook: `useVendorDashboard` calls `GET /api/vendors/[vendorId]/dashboard` with session headers.
- API aggregates:
  - `stats`: bookings, earnings, clients, vendor rating stats.
  - `recentJobs` and `archivedJobs`: mapped from booking + metadata + media package state.
  - `recentReviews`: latest review records.
  - `employeePerformance`: review attribution aggregates by membership.
  - `insights`: month-over-month counts and earnings.
  - `notifications`: unread `adminNotification` rows scoped to vendor.
- UI still computes some summary chips locally from `recentJobs`, not dedicated server fields.

## Missing Routes / Pages
- Legacy layout (`src/app/(vendor)/layout.tsx`) references additional missing pages:
  - `/vendor/bookings`
  - `/vendor/messages`
  - `/vendor/settings`

## Recommended UX Improvements
- Replace dashboard-local derived job counts with explicit server-provided counters (`today`, `inProgress`, `awaitingReview`, `completed`) to avoid drift.
- Wire Proof card to real moderation package summary fields from backend.
- Wire Storage card to backend summary fields from `GET /api/vendors/[vendorId]/storage/usage` (page is live, dashboard card is still static).
- Keep empty-state fallback copy for API failures on newly added pages.
- Keep one canonical vendor layout/navigation map and remove/retire outdated route links.
- Add skeleton loading for cards and route-level fallback errors (e.g., transient DB connectivity).