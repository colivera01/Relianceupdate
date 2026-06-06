# E2E smoke implementation notes (passes 1–3)

**Date:** 2026-04-11 (pass 1); **pass 2** 2026-04-12; **pass 3** 2026-04-12  
**Plan:** `E2E_SMOKE_TEST_PLAN.md` — **§1** booking journey; **§2** favorites toggle across Discover / service / favorites; **§3** review happy path (window start → quick review create).

**Connectivity:** If `globalSetup` or the running app reports Prisma **cannot reach the database server** (e.g. Azure SQL on `database.windows.net`), treat that as **DB network / firewall / VPN reachability** from the machine running the test — not as a bug in the booking UI, Playwright flow, or smoke assertions.

**Schema:** On targets not yet aligned with **`prisma/schema.prisma`**, common blockers include missing **`users.phone`**, missing **`bookings.customerMetadata`**, and other drift — **prerequisite:** baseline/migrate or align the DB before **`npm run test:e2e:smoke`** (see **`DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md`**). **Pass 3 (review smoke)** additionally requires consent/review/media tables (e.g. **`dbo.consent_records`**, **`review_windows`**, **`media_sessions`**, **`media_assets`**) — if **`global-setup`** throws **P2021** / “table does not exist”, apply migrations to **`DATABASE_URL`** before **`npm run test:e2e:smoke:review`**.

**First successful live smoke (2026-04-12):** **`npm run test:e2e:smoke`** passed end-to-end: **booking create → confirmation → my-bookings** against real routes and Azure SQL. **DB schema alignment** (including columns such as **`users.phone`** and **`bookings.customerMetadata`**) was required on the target before **`POST /api/bookings`** could succeed. **`playwright.config.ts`** runs the dev server with **`NEXT_PUBLIC_API_MODE: 'live'`** so MSW does not intercept login; stop any existing process on port **3000** if **`reuseExistingServer`** reuses a mock-mode dev server. Server logs may show **`GET /placeholder-service.jpg` 404** during the booking UI — **non-blocking** for smoke assertions.

## Tooling

- **@playwright/test** (Chromium project only).
- **Global setup:** `e2e/global-setup.ts` uses **Prisma** (`DATABASE_URL`) to upsert data — no mocks for `/api/bookings` or Prisma inside the browser test.
- **dotenv** (existing dependency) loads `.env.local` / `.env` from the repo root before Prisma runs.

## Test files

- **`e2e/booking-smoke.spec.ts`:** login → Discover (search) → service → booking wizard → confirmation → my-bookings.
- **`e2e/favorites-smoke.spec.ts` (pass 2):** login → **`/favorites`** cleanup (remove smoke **`serviceId`** if present) → **`/discover`** (search) → **`/service/[serviceId]`** → **`service-page-favorite-toggle`** add → **`/favorites`** row **`favorites-row-<serviceId>`** → **View Service** back → toggle remove → **`/favorites`** asserts row gone. Real **`GET/POST/DELETE`** favorites APIs + DB; no route mocks.
- **`e2e/review-smoke.spec.ts` (pass 3):** login → **`/my-bookings`** → **Past** tab → seeded row **`E2E Review Smoke`** → **Load Authorized Media** → **`SmartVideoPlayer`** ( **`POST /api/reviews/window/start`** on mount) → programmatic **`video.play()`** → soft overlay → **Positive** → **Quick Review** → **`POST /api/reviews/create`**; asserts JSON success + **`review.id`**, panel closes, no inline error. Persisted **`Review`** is asserted via the **create** response body; customer **`/reviews`** now reads from **`GET /api/reviews/me`** and is outside this smoke.

## Seed / fixture assumptions

1. **`DATABASE_URL`** must be set so global setup can run (`npx playwright test` runs `globalSetup` before `webServer`).
2. **Dev login user** `e2e-smoke-customer` is defined in `src/lib/dev-registered-users.ts` (password default `E2E_Smoke_dev_only_9!`, override with **`E2E_CUSTOMER_PASSWORD`** in CI).
3. **Prisma `User`** with the same **`id`** (`e2e-smoke-customer`) and email `e2e-smoke-customer@reliance.test` is **upserted** in global setup so `POST /api/bookings` satisfies the `User` FK.
4. A **vendor** (`e2e-smoke-vendor@reliance.test`) and **service** named **E2E Smoke Service** are created or updated with **`isPubliclyListed: true`** / **`isPublished: true`** so Discover and `GET /api/services/[id]` succeed.
5. Generated **`e2e/smoke-fixture.json`** (gitignored) contains `serviceId`, `serviceNameSearch`, and `customerEmail` for booking/favorites specs. **Pass 3** also writes **`reviewBookingId`** (and optional **`reviewVendorId`** / **`reviewMediaSessionId`** for debugging) after deleting any prior **`E2E Review Smoke`** booking chain and creating a fresh **completed** booking with **approved** `video/mp4` asset (**`customer_only`** visibility), **`MediaSession`**, and accepted **`video_access`** **`ConsentRecord`** (real **`POST /api/reviews/window/start`** + **`/api/reviews/create`** paths; no mocks of consent or review CRUD).

## Commands

- **Install browsers (one machine / CI image):** `npx playwright install chromium`
- **Run booking smoke only:** `npm run test:e2e:smoke`
- **Run favorites smoke only:** `npm run test:e2e:smoke:favorites`
- **Run review smoke only:** `npm run test:e2e:smoke:review`
- **Run all Playwright tests:** `npm run test:e2e`

Playwright starts **`npm run dev`** as `webServer` unless `CI` is set; with `CI` set it always boots a fresh server. **`webServer.env`** forces **`NEXT_PUBLIC_API_MODE=live`** for the spawned server. Override URL with **`PLAYWRIGHT_BASE_URL`** (default **`http://127.0.0.1:3000`**) if needed.

## UI hooks (`data-testid`)

Minimal attributes for stable steps:

- Booking wizard: `booking-slot-date-YYYY-MM-DD`, `booking-slot-time-HH:mm` (available slots only).
- Confirmation: `booking-confirmation-reference` (shows persisted booking id).
- My Bookings: `my-bookings-row-<bookingId>`.
- Favorites (pass 2): Discover **`discover-favorite-toggle-<serviceId>`** (optional for extensions); service header **`service-page-favorite-toggle`** + **`aria-label`** Add/Remove; favorites list **`favorites-row-<serviceId>`** and remove **`favorites-remove-<favoriteId>`** + **`aria-label` "Remove from favorites"**.
- Review capture (pass 3): **`e2e-smart-video-player`** ( **`SmartVideoPlayer`** root), **`e2e-quick-review-panel`** ( **`QuickReviewPanel`** modal when open).

## Known limitations

- **Auth:** Still **dev in-memory** login (`/api/auth/login` + `dev-registered-users`); not full DB-backed auth. The smoke still uses **real** booking APIs and Prisma persistence for bookings.
- **Global setup** must succeed before the dev server test; no server is required for setup itself.
- **Discover** relies on the smoke service appearing after text search (`E2E Smoke`); renaming the fixture service requires updating **`SERVICE_NAME`** in `e2e/global-setup.ts` and the search string in the written fixture.
- **Parallel runs:** Single worker / serial describe; multiple simultaneous runs against one DB could fight over the same slots (mitigation: run smoke alone or use a disposable DB per job).
- **Favorites smoke:** If the smoke user has **other** favorites, the test still passes by asserting only the **E2E Smoke Service** row appears then disappears (it does **not** require an empty favorites page at the end).
- **Review smoke:** **`global-setup`** deletes any existing **`E2E Review Smoke`** booking (and related media/consent/reviews) then recreates a clean chain so **`POST /api/reviews/create`** is not blocked by “review already exists”. Chromium is launched with **`--autoplay-policy=no-user-gesture-required`** so **`video.play()`** reliably triggers the soft prompt timer.
