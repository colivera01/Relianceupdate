# Project Code Audit (2026-04-27)

## Major App Areas
- Customer surfaces: discovery, booking, my bookings, proof playback, reviews, profile settings.
- Vendor surfaces: registration, dashboard, jobs execution, employees, profile, support, reviews, billing/analytics placeholders.
- Employee surfaces: mobile/job execution pages plus employee job APIs.
- Admin surfaces: vendor approvals, media moderation queue/package moderation, review audit, notifications, reports/settings placeholders.
- Cross-cutting domains: auth/session, memberships, media storage/moderation, consent, notifications, review attribution.

## Key Pages
- Live/used heavily: `/vendor/dashboard`, `/vendor/jobs`, `/vendor/register`, `/device/pair`, `/my-bookings`, `/my-bookings/[bookingId]`, `/reviews`, `/admin/media-moderation`.
- Operational but mixed maturity: `/vendor/reviews`, `/vendor/profile`, `/employee/jobs`, `/admin/vendors`, `/admin/review-audit`.
- Placeholder/lightly wired: `/vendor/billing`, `/vendor/analytics`, `/admin/dashboard`, `/admin/users`, `/admin/reports`, `/admin/settings`, `/admin/activity`.

## Key API Routes
- Vendor dashboard and jobs:
  - `GET /api/vendors/[vendorId]/dashboard`
  - `PATCH|GET|DELETE /api/vendors/[vendorId]/jobs/[jobId]/actions`
  - `POST /api/vendors/[vendorId]/jobs/[jobId]/approve`
  - `POST /api/vendors/[vendorId]/jobs/[jobId]/reject`
- Media flow:
  - `GET /api/admin/media/moderation-queue`
  - `PATCH /api/admin/media/packages/[bookingId]/moderate`
  - `GET /api/bookings/[id]/media`
  - `GET /api/bookings/[id]/media/[assetId]/download`
- Device pairing:
  - `POST /api/device/pairing/request`
  - `POST /api/device/pairing/confirm`
  - `POST /api/device/heartbeat`
- Registration/reviews/consent:
  - `POST /api/vendor/register`
  - `POST /api/reviews/create`
  - `POST /api/consent/request`
  - `GET /api/consent/status`

## What Is Live
- Vendor registration persists selected template/custom services with `selectedServices` precedence.
- Vendor dashboard pulls real vendor/job/review aggregates from `GET /api/vendors/[vendorId]/dashboard`.
- Employee stage progression and manager approval/rejection loop are enforced (`AWAITING_REVIEW` gate before `COMPLETED`).
- Admin moderation queue + package moderation for 3-stage proof packages are live.
- Customer proof retrieval is gated by booking ownership and moderation/visibility policies.
- Review creation includes booking/window validation and employee attribution fields.

## What Is Mocked
- Dashboard proof/storage card metrics currently use hardcoded zero values in UI.
- Several vendor/admin management pages remain mostly static/mock UX shells.
- Older `GET /api/vendor/dashboard` path appears legacy and partially redundant against vendor-scoped dashboard route.

## What Is Hybrid
- `vendor/jobs` is live for core backend actions but still carries large legacy mock scaffolding/comments/UI branches.
- Auth and context behavior mixes real membership checks with dev-friendly fallbacks in some areas.
- Notifications are real-provider capable but still depend on env readiness and best-effort orchestration.

## Known Risks
- Route drift: UI points to missing pages (`/vendor/media`, `/vendor/storage`) and legacy paths still exist in layout variants.
- Device pairing schema drift: `deviceUid` is persisted in `devices.employeeId` via raw SQL workaround.
- Duplicate API surface for pairing (`/api/device/pairing/*` and `/api/pairing/*`) risks contract confusion.
- Jobs page size/complexity raises regression risk and slows onboarding/debugging.
- Dashboard stats and card labels are partially derived client-side from recent arrays, not full canonical server aggregates.
- DB connectivity/transient Azure SQL failures still produce runtime instability on data-heavy routes.
