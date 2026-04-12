# Availability Readiness

## Goal
Define the minimum real availability contract required to replace static date/time options in `/booking/[serviceId]`.

## Current state
- Booking page now consumes backend availability dates/slots from `GET /api/availability/vendor/[vendorId]`.
- Slot validation route exists at `POST /api/availability/check`.
- Booking create now has a backend conflict guard that returns deterministic 409 when slot is stale.

## Minimum contract needed (active booking flow)

### 1) Read available dates/slots
- Endpoint:
  - `GET /api/availability/vendor/[vendorId]`
- Returns stable slot contract:
  - `availability.vendor_id`
  - `availability.timezone`
  - `availability.dates[]`
    - `date`
    - `available`
    - `slots[]`
      - `time` (24h `HH:mm`)
      - `available` (boolean)
- Example minimum shape:
  - now implemented and used by booking UI.

### 2) Validate slot before create
- Endpoint:
  - `POST /api/availability/check`
- Request includes:
  - `vendorId`
  - `serviceId`
  - `booking_date`
  - `booking_time`
- Response includes:
  - `available` boolean
  - optional `reason` when unavailable

### 3) Booking create conflict guard
- `POST /api/bookings` now rejects stale/unavailable slots with deterministic `409` and `code: "SLOT_UNAVAILABLE"`.

## UI wiring required
1. Replace local `availableDates` with API-provided dates. (done)
2. Replace local `availableTimes` with selected date slot list from API. (done)
3. Disable unavailable slots in UI. (done)
4. Re-validate slot on submit before final create request. (done)
5. Show clear error when slot becomes unavailable. (done)

## Fully working now
- Date/time choices in booking flow are backend-backed and use a stable slot contract.
- Refresh/reopen reflects current booking-derived availability state.
- Race-condition slot conflicts are guarded at check + create layers with user-facing errors.

## Remaining blockers
- Vendor-owned schedule persistence (custom working hours, blackout dates) is not yet implemented.
- Current slot model assumes fixed window and one booking per slot.
- Integration/E2E automation coverage is still pending.

## Recommended implementation order
1. Add persisted vendor schedule and blackout sources behind current slot contract.
2. Add integration/E2E tests for read/check/create conflict and booking page stale-slot UX.
3. Add service-duration-aware slot locking only if product scope requires multi-slot occupancy.
