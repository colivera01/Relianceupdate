# E2E Status

Last refreshed: 2026-05-06

## Current passing spec
- File: `e2e/reliance-trust-loop.spec.ts`
- Title: `full proof-to-review trust loop (live routes)`
- Run command: `npx playwright test e2e/reliance-trust-loop.spec.ts`
- Latest run (2026-05-06): `1 passed (3.3m)` against the local dev server (`npm run dev` on `127.0.0.1:3000`) with live Azure SQL.
- Test mode: `chromium`, single worker, fully serial (per `playwright.config.ts`).

## What the trust-loop spec validates
The spec drives one continuous booking through every role and proves attribution lands in the vendor dashboard. Each step in the table below is a hard `expect()` in the spec.

| Step | Surface | Validation |
|---|---|---|
| 1. Customer creates booking | `/auth/login` → `/discover` → `/service/[id]` → `/booking/[id]` → confirmation | `POST /api/bookings` returns 200; `bookingId` present in confirmation URL; row appears at `/my-bookings` |
| 2. Manager assigns employee | `/vendor/jobs` + `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` | Response `ok`; `assignedMembershipIds` includes the seeded employee membership |
| 3. Employee uploads 3 stages | DB seed of `MediaSession` + `MediaAsset` + `POST /api/employee/jobs/[jobId]/stage` for `INTRO` / `IN_PROGRESS` / `COMPLETED` | Each stage call returns `ok`; booking auto-transitions to `AWAITING_REVIEW` |
| 4. Manager approves completion | `POST /api/vendors/[vendorId]/jobs/[jobId]/approve` | Response `ok`; job status `COMPLETED` |
| 5. Admin moderates package | `PATCH /api/admin/media/packages/[bookingId]/moderate` with `{ action: "approve", visibility: "customer_only" }` | Response `ok`; `updatedAssets` is an array |
| 6. Customer consent + proof view | `prisma.consentRecord.create` → `GET /api/bookings/[id]` + `GET /api/bookings/[id]/media` + page `/my-bookings/[bookingId]?proofReady=1` | Both API calls return 200; "Booking Proof" label visible; proof video OR consent prompt visible; `videos[0].downloadUrl` present |
| 7. Customer submits review | `POST /api/reviews/window/start` → `POST /api/reviews/create` | Window id returned; review id returned; `success: true` |
| 8. Vendor dashboard attribution | `GET /api/vendors/[vendorId]/dashboard` | `stats.ratingCount > 0`; `employeePerformance` includes the assigned membership / employee display name |

## Known infrastructure dependencies
- **Next dev server** (`npm run dev`) running on `http://127.0.0.1:3000`. The Playwright config will start it automatically via `webServer` and reuse an existing instance when not in CI.
- **Azure SQL** reachable via `DATABASE_URL` in `.env`:
  - Host: `relianceorgsqlserver.database.windows.net`
  - Database: `reliance-db`
  - The dev machine's public IP must be allowlisted on the Azure SQL firewall.
- **Azure Blob Storage** via `AZURE_STORAGE_CONNECTION_STRING` + `AZURE_STORAGE_CONTAINER` in `.env.local` (uploads + proof video URLs).
- **Notifications providers** (best-effort, do not block the spec):
  - Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED`).
  - Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SMS_ENABLED`).
- **Global setup fixture:** `e2e/global-setup.ts` upserts the smoke customer + vendor + service and writes `e2e/smoke-fixture.json` consumed by the trust-loop spec.

## Azure SQL outage incident + resolution
- **Symptoms (pre-resolution):** Prisma + dependent API routes failed with the Azure SQL paused-database error pattern:
  - `ERROR 42119`
  - `database reached monthly free amount allowance`
  - `paused for remainder of month`
- **Impact:** All DB-backed routes (services, bookings, vendors, dashboard, media, reviews) returned 5xx; the trust-loop spec could not start because `globalSetup` upserts failed at Prisma level.
- **Resolution (verified 2026-05-06):**
  - Azure SQL instance is reachable again; Prisma `$connect()` succeeds.
  - Sample counts now return non-zero rows: `Service.count = 27`, `Booking.count = 19`, `Vendor.count = 10`.
  - Critical APIs return 200:
    - `GET /api/services`
    - `GET /api/bookings` (with `x-user-id`)
    - `GET /api/bookings/[id]`
    - `GET /api/bookings/[id]/media`
    - `GET /api/vendors/[vendorId]/dashboard`
  - No `42119` / "monthly free amount allowance" / "paused for remainder" markers in dev logs or workspace search.
  - Playwright trust-loop run on 2026-05-06: `1 passed`.
- **Detection-on-recurrence guidance:**
  - Run a Prisma connect probe (`prisma.$connect()` + `prisma.service.count()`) before the spec; abort with a clear message if the probe fails.
  - `GET /api/health` and `GET /api/health/schema` are good first checks for runtime database availability + schema drift.
  - Search dev terminal logs for the literal `42119` token to short-circuit broader debugging.

## Other smoke specs (status as of 2026-05-06)
| Spec | Purpose | Status |
|---|---|---|
| `e2e/booking-smoke.spec.ts` | Minimal booking path smoke | Tracked under `npm run test:e2e:smoke`; not exercised in this verification pass |
| `e2e/favorites-smoke.spec.ts` | Customer favorites flow | Tracked under `npm run test:e2e:smoke:favorites`; not exercised in this pass |
| `e2e/review-smoke.spec.ts` | Review create smoke | Tracked under `npm run test:e2e:smoke:review`; not exercised in this pass |
| `e2e/route-smoke.spec.ts` | Page route reachability | Tracked under `npm run test:e2e:smoke:routes`; not exercised in this pass |

The trust-loop spec is currently the broadest coverage we run; the four smoke specs above remain as faster targeted checks.

## Remaining future E2E gaps
1. **Manager rejection branch:** the rejection path (`POST .../jobs/[jobId]/reject`) is unit/integration tested but not yet exercised end-to-end via Playwright (employee re-submits → re-enters `AWAITING_REVIEW` → manager approves on second pass).
2. **Consent decline branch:** `/consent/[token]` accept is exercised via the trust-loop's manual consent record insert; the decline branch and manual link fallback (`POST /api/consent/decline`, `manualLinkRequired` response) are not yet covered E2E.
3. **Customer cancel branch:** `POST /api/bookings/[id]/cancel` (and the resulting state visibility on `/my-bookings`) needs an E2E pass distinct from the smoke spec.
4. **Admin rejection of a moderation package:** the `reject` and `flag` paths of `PATCH /api/admin/media/packages/[bookingId]/moderate` are not yet verified end-to-end with downstream customer-visibility expectations.
5. **Review window expiry:** `POST /api/reviews/window/expire` is exercised only at the API layer; an E2E pass that lets a window TTL into expiry would close the loop.
6. **Vendor-side consent initiation UX:** the consent-request route exists, but a vendor-driven consent flow (request → customer accept → media playback) is not yet covered E2E.
7. **Role toggle transitions:** an E2E spec that exercises `POST /api/profile/toggle` flipping a dual-role user between customer and vendor surfaces would document the role-switching contract.
8. **Auth-mode regression guard:** the historical "stuck on `/auth/login`" mismatch between MSW mock mode and live login payloads is not currently asserted in CI; a thin guard spec or runtime check would prevent regression.

## How to run
```
npm run dev                                  # starts Next on 127.0.0.1:3000
npx playwright test e2e/reliance-trust-loop.spec.ts
```

If `globalSetup` fails with Prisma connectivity errors, verify:
1. `.env` `DATABASE_URL` host/credentials.
2. Azure SQL firewall allows the local IP.
3. Azure SQL instance is not in a paused/quota state (search the error text for the markers in the incident section above).
