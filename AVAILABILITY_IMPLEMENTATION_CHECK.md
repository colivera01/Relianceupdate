# Availability Implementation Check

## What is fully real now
- `GET /api/availability/vendor/[vendorId]` returns a stable backend slot contract:
  - `availability.vendor_id`
  - `availability.timezone`
  - `availability.dates[]` with `date`, `available`, and `slots[]` (`time`, `available`)
- `POST /api/availability/check` validates a requested slot using backend booking state.
- `POST /api/bookings` now rejects stale/unavailable slots with deterministic conflict response:
  - status `409`
  - `code: "SLOT_UNAVAILABLE"`
  - user-consumable error message
- `/booking/[serviceId]` no longer relies on static local `availableDates`/`availableTimes`.
  - Dates and times are populated from API availability
  - Unavailable slots are disabled
  - Submit flow revalidates slot via `/api/availability/check` before create
  - Clear error is shown if the selected slot becomes unavailable

## Temporary assumptions still used
- Slot generation uses a fixed working window (`09:00` through `16:00`) and derives occupancy from existing bookings.
- One booking reserves one slot (no service-duration or multi-slot occupancy logic yet).
- Timezone metadata is stable in response shape, but custom vendor timezone/schedule persistence is not yet wired.

## Remaining blockers
- No persisted vendor-managed availability schedule model is currently applied to slot generation.
- No persisted blackout/holiday source is currently merged into slot generation.
- Automated integration/E2E tests are still missing for full stale-slot user journey.

## Exact remaining gaps before availability is fully complete
1. Add persisted vendor schedule + blackout sources behind current read/check/create contract.
2. Add focused automated tests for:
   - availability read response shape
   - slot validation response semantics
   - booking create conflict rejection
   - booking page stale-slot UX path (selected slot becomes unavailable before submit)
3. If required by product scope, add service-duration-aware conflict logic (multi-slot occupancy).
