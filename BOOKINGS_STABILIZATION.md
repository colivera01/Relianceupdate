# Bookings Stabilization

## Scope
- Stabilize shared booking domain without adding new product features.
- Align frontend + backend booking contract for list/detail/create/cancel paths.

## Fixed in this pass
- Standardized booking response shape via `src/lib/booking-shape.ts`.
- Updated `/api/bookings` to return mapped canonical booking objects.
- Updated `/api/bookings/[id]`:
  - fixed dynamic `params` usage
  - replaced mock `PUT`/`DELETE` behavior with DB-backed updates
  - enforced user ownership checks for update/delete
- Updated `/api/bookings/[id]/cancel` to return canonical `booking` object.
- Updated `/booking/[serviceId]` create flow to use stabilized API contract:
  - `service_id` now string ID (no lossy `parseInt`)
  - sends `x-user-id` when available
  - aligns payload keys with API
- Updated `/my-bookings` cancel action to consume normalized response safely.
- `/bookings` remains redirect to `/my-bookings` (single entry point retained).

## Current contract (canonical booking shape)
- `id`
- `user_id`
- `vendor_id`
- `service_id`
- `title`
- `client_name`
- `booking_date`
- `booking_time`
- `status`
- `total_price`
- `created_at`
- `updated_at`
- `service` (id, name, description, price)
- `vendor` (id, name, phone, email, location)

## Fully working
- `/api/bookings` list + pagination
- `/api/bookings/[id]` single-read
- `/api/bookings/[id]` update (DB-backed)
- `/api/bookings/[id]` delete-as-cancel (DB-backed status change)
- `/api/bookings/[id]/cancel` explicit cancel endpoint
- `/my-bookings` loading/empty/error/action UI states

## Partially working
- `/booking/[serviceId]` flow creates real bookings, but still uses static date/time options and mixed availability semantics.
- `/booking/[serviceId]/confirmation` still displays mock confirmation payload instead of fetched booking detail.

## Mocked
- Confirmation details page (`/booking/[serviceId]/confirmation`) currently mock-only.

## Blockers
- Availability APIs are still mock-backed and not tightly coupled to persisted booking capacity windows.
- No dedicated booking integration tests yet.

## Recommended next tasks
1. Read booking by `bookingId` on confirmation page and render real data.
2. Add booking contract tests (list/detail/create/cancel status transitions).
3. Add explicit cancellation metadata fields in schema if business requires audit-grade reason tracking.
4. Remove any remaining duplicate booking UI logic once confirmation page is real-data based.
