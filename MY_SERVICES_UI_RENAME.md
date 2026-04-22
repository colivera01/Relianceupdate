# My Services — customer UI wording (booking-backed implementation unchanged)

## What changed (visible copy only)

Customer-facing **“My Bookings”** labels were replaced with **“My Services”** where they describe the hub at `/my-bookings`. **Routes, API paths, Prisma models, and `bookingId` usage are unchanged.**

## Files touched

| File | Change |
|------|--------|
| `src/components/UserSidebar.tsx` | Nav label **My Services**; `href` still **`/my-bookings`**. |
| `src/app/(user)/my-bookings/page.tsx` | Page `<h1>` **My Services**; description, sign-in / loading / empty-state copy aligned to services framing; generic fetch error strings say “services” where user-visible. |
| `src/app/(user)/booking/[serviceId]/confirmation/page.tsx` | Buttons and “What’s Next?” copy reference **My Services**; navigation still **`router.push('/my-bookings')`**. |
| `src/app/(user)/profile-settings/page.tsx` | **View My Services** (still pushes **`/my-bookings`**). |
| `src/app/(user)/reviews/page.tsx` | **View My Services** (still pushes **`/my-bookings`**). |
| `e2e/review-smoke.spec.ts` | Asserts heading **My Services** after visiting **`/my-bookings`**. |

## Intentionally unchanged (compatibility)

- **Route:** `src/app/(user)/my-bookings/` — URL remains **`/my-bookings`**.
- **Redirect:** `src/app/(user)/bookings/page.tsx` → **`redirect('/my-bookings')`**.
- **APIs:** e.g. **`GET /api/bookings`**, **`/api/bookings/[id]/media`**, cancel routes — no renames.
- **Implementation details:** imports from `@/lib/my-bookings`, **`data-testid={`my-bookings-row-${id}`}`**, component `MyBookingsPage`, internal identifiers — kept stable.
- **Vendor surfaces:** e.g. vendor dashboard **“View All Bookings”** / **“Recent Bookings”** — vendor-facing booking language left as-is (not the customer hub rename).

## Confirmation checklist

- Sidebar **My Services** → **`/my-bookings`** → page renders with heading **My Services**.
- Backend behavior and URLs for bookings are **unchanged**.

## Future (optional)

- Rename folder/route from `my-bookings` → `my-services` with a **permanent redirect** from `/my-bookings` once product and analytics are ready.
- Align historical markdown audits (`MY_BOOKINGS_FUNCTION_AUDIT.md`, etc.) only if docs should match new customer terminology.
