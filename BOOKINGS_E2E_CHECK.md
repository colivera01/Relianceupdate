# Bookings E2E Check

## Scope
- Completion pass for create -> confirmation -> list -> cancel journey.
- Uses stabilized canonical booking contract from `src/lib/booking-shape.ts`.

## What is now fully real
- Create booking:
  - `/booking/[serviceId]` posts to `/api/bookings` with canonical payload keys.
  - Redirects only on success and only when a persisted `booking.id` is returned.
- Confirmation page:
  - `/booking/[serviceId]/confirmation` reads `bookingId` from URL.
  - Loads booking via `/api/bookings/[id]` with API-backed state (no mock booking object).
  - Supports refresh/reopen because state is fetched from API each load.
- List bookings:
  - `/my-bookings` loads from `/api/bookings` and renders canonical booking shape.
- Cancel booking:
  - `/my-bookings` calls `/api/bookings/[id]/cancel`.
  - Updated status reflects via canonical booking response.

## Contract consistency status
- `/api/bookings` -> canonical shape: **aligned**
- `/api/bookings/[id]` -> canonical shape: **aligned**
- `/api/bookings/[id]/cancel` -> canonical shape in `booking`: **aligned**
- `/booking/[serviceId]` -> payload and handoff: **aligned**
- `/booking/[serviceId]/confirmation` -> consumes canonical `booking`: **aligned**
- `/my-bookings` -> consumes canonical list and cancel status updates: **aligned**

## Confirmation UX states
- Loading state: implemented.
- Missing/invalid booking state: implemented.
- API error state + retry: implemented.
- Refresh/reopen persistence: implemented via server fetch on mount.

## QA / test scenarios

### 1) Create booking -> confirmation shows saved DB booking
- **Implemented path:** yes.
- **Code verification:** create flow now requires `booking.id` before navigation.
- **Manual validation step:** book a service, confirm booking ID appears in URL, and details match persisted booking.

### 2) Refresh confirmation page -> booking still loads correctly
- **Implemented path:** yes (`/api/bookings/[id]` fetch on mount, `cache: no-store`).
- **Manual validation step:** refresh browser on confirmation route and verify same booking details load.

### 3) Navigate confirmation -> my bookings -> same booking appears
- **Implemented path:** yes (confirmation button routes to `/my-bookings`, list reads API).
- **Manual validation step:** click "View All Bookings", find created booking by ID/title.

### 4) Cancel from my bookings -> updated status reflects
- **Implemented path:** yes (cancel endpoint + local status update from API response).
- **Manual validation step:** cancel booking and verify status becomes cancelled in list.

### 5) Invalid booking id on confirmation -> graceful error
- **Implemented path:** yes (error panel + retry + navigation to my bookings).
- **Manual validation step:** open confirmation URL with fake `bookingId` and verify non-crashing error state.

## Remaining mock behavior
- `/booking/[serviceId]` date/time selection UI still uses static local options.
- Confirmation "receipt download" is text-file fallback, not formal PDF receipt generation.

## Blockers
- Availability domain remains mock-backed, preventing full real scheduling slot integrity.
- DB/network connectivity issues can still block runtime bookings in fragile environments.

## Exact remaining gaps before marking bookings fully complete
1. Replace static booking date/time options with real availability slots from persisted backend availability.
2. Add automated integration tests covering create/confirm/list/cancel contract path.
3. Add formal receipt generation service if required by product scope (optional for core booking completeness).
