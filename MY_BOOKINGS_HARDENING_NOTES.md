# `/my-bookings` hardening notes

**Date:** 2026-04-12  
**Shared logic:** `src/lib/my-bookings.ts`  
**Page:** `src/app/(user)/my-bookings/page.tsx`  
**Video player:** `src/components/reviews/SmartVideoPlayer.tsx` (only consumer today is this page)

---

## What changed

### 1. Status normalization (single source)

All customer-visible status rules for this surface now flow through `src/lib/my-bookings.ts`:

| Helper | Purpose |
|--------|---------|
| `normalizeBookingStatusKey` | Lowercase trim; empty → `unknown`. |
| `isTerminalCancelledStatus` | `canceled` or `cancelled` (final cancellation). |
| `isCompletedStatus` | `completed` or `complete` (treated as finished / past by status). |
| `isCancelRequestedFlowStatus` | In-flight cancellation (e.g. `cancel_requested`, `cancellation_pending`, keys containing `cancel_request`). Never true for terminal cancelled. |
| `bookingMatchesTab` | **Cancelled** tab = terminal cancelled only. **Past** = not terminal and (schedule in the past **or** completed). **Upcoming** = everything else. |
| `classifyCancelBookingAction` | Cancel control: **hidden** if terminal cancelled or completed; **disabled** + reason if cancel-in-progress or schedule date already passed; **enabled** otherwise. |
| `formatMyBookingsStatusDisplay` | Status line in the card (stable copy for known states). |
| `shouldEnableReviewCaptureForStatus` | `false` only for terminal cancelled (see below). |

The page no longer mixes `status === 'canceled'` with `.includes('cancel')` for different behaviors.

### 2. Search UX

- Placeholder and `aria-describedby` hint list **service name, vendor name, title, client name, booking ID**.
- `bookingMatchesSearch` also searches **`client_name`** (capability expanded slightly; aligns with hint).

### 3. Date / tab hardening

- `resolveBookingScheduleInstant` parses `booking_date` with optional `booking_time`, then falls back to `created_at`, then **Unix epoch** if both are unusable (stable **Past** bucket; see “Conditional / edge” below).
- Tab membership uses the same instant for all three tabs.

### 4. Row sanitization

- `sanitizeMyBookingsRow` runs on list load: guarantees **non-null** `service` / `vendor` display objects and valid ISO strings for `created_at` / `updated_at` (fallbacks when malformed).

### 5. Action classification

| Action | Behavior |
|--------|----------|
| **Refresh** | Disabled while `loading` to avoid overlapping fetches. |
| **Cancel Booking** | Hidden when not applicable; otherwise disabled with **inline reason** when cancel is blocked; enabled only when `classifyCancelBookingAction` returns `enabled`. |
| **Load Authorized Media** | Disabled when `vendor_id` is missing or while a load is in progress; `title` explains why. |
| **Video track chips** | Unchanged (selection only; no network). |
| **Playback / review** | If `blobUrl` or `mediaSessionId` missing → explicit copy. If `vendor_id` missing → explicit copy (load already disabled). |

### 6. Watch / review gating

- `SmartVideoPlayer` accepts optional **`reviewCaptureEnabled`** (default `true`).
- On `/my-bookings`, it is set to `shouldEnableReviewCaptureForStatus(statusKey)` so **terminal cancelled** bookings still play video but **do not** call `/api/reviews/window/start` or show review overlays.
- All other statuses keep prior review behavior when media is playable.

---

## What remains conditional or backend-driven

1. **Default list limit** — `GET /api/bookings` still defaults to `limit=10` server-side; this page does not yet request a higher limit or paginate (unchanged from audit).
2. **Cancel API** — Server may reject cancellation for business rules not mirrored in the client; the button only reflects schedule + status heuristics.
3. **Media payload** — `blobUrl` / `mediaSessionId` presence depends on storage and `GET /api/bookings/[id]/media` normalization.
4. **Review APIs when capture is on** — Still **no `x-user-id`** on `SmartVideoPlayer` fetches; consent / auth behavior is entirely defined by those routes (`/api/reviews/*`). Turning `reviewCaptureEnabled` off avoids those calls for terminal cancelled rows only.
5. **Schedule fallback to epoch** — Rows with completely broken dates sort into **Past**; operators should fix upstream data if that appears often.

---

## Files touched (scope)

- `src/lib/my-bookings.ts` (new)
- `src/app/(user)/my-bookings/page.tsx`
- `src/components/reviews/SmartVideoPlayer.tsx`
- `CHANGELOG_LATEST.md`
- `MY_BOOKINGS_HARDENING_NOTES.md` (this file)

For a full endpoint and field matrix, see `MY_BOOKINGS_FUNCTION_AUDIT.md`.
