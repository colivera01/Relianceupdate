# Project State (Execution + Management Stabilization Pass)

## Handoff refresh (2026-04-27 — pairing API consolidation)
- **Canonical pairing API enforced:** pairing contract is now standardized on `POST /api/device/pairing/request`, `POST /api/device/pairing/confirm`, and `POST /api/device/heartbeat`.
- **Duplicate route family removed:** legacy `/api/pairing/request` and `/api/pairing/confirm` handlers were deleted to eliminate contract drift.
- **UI path confirmed canonical:** `/device/pair` continues to call `/api/device/pairing/confirm` (no UI caller dependence on `/api/pairing/*`).

## Handoff refresh (2026-04-27 — deviceUid schema migration + legacy compatibility)
- **Device identity migration implemented:** pairing/heartbeat now use `devices.deviceUid` as canonical lookup key instead of MVP-only `employeeId` storage.
- **Safe DB migration added:** `prisma/migrations/20260427143000_add_deviceuid_column_backfill_legacy_employeeid/migration.sql` adds `deviceUid` if missing, backfills from `employeeId` when null, and creates a filtered unique index on non-null `deviceUid`.
- **Legacy fallback preserved:** during transition, APIs read by `deviceUid` first and fallback to `employeeId` for old rows so existing paired devices continue to work.
- **Legacy field retained:** `employeeId` remains for compatibility and historical rows; new/updated pairing writes now also persist canonical `deviceUid`.

## Handoff refresh (2026-04-27 — vendor media/storage pages added)
- **Broken dashboard destinations fixed:** `/vendor/media` and `/vendor/storage` pages now exist and render successfully.
- **Vendor media page added:** `src/app/vendor/media/page.tsx` now provides Active/Archived/All filtering and uses `GET /api/vendors/[vendorId]/media` when available, with fallback empty-state copy ("Media management is being finalized.").
- **Vendor storage page added:** `src/app/vendor/storage/page.tsx` now uses `GET /api/vendors/[vendorId]/storage/usage` and shows used, limit, percent, and progress bar with fallback copy ("Storage tracking is not fully connected yet.").
- **Dashboard labels clarified:** Proof and Storage cards remain routed to the new pages and now explicitly indicate card-level metrics are pending backend connection.
- **Route smoke verified:** `/vendor/media`, `/vendor/storage`, and `/vendor/dashboard` each return HTTP 200 locally.

## Handoff refresh (2026-04-27 — dashboard actions, pairing MVP, registration templates, review loop, proof notifications, attribution)
- **Vendor dashboard clickable cards shipped:** `/vendor/dashboard` cards now route into actionable views for job filters and reviews; Proof and Storage cards now resolve to real pages (`/vendor/media`, `/vendor/storage`) with card metrics still pending full backend wiring.
- **Device pairing MVP shipped:** vendor can generate a 6-digit pairing code from dashboard (`POST /api/device/pairing/request`), and devices can pair via `/device/pair` + `POST /api/device/pairing/confirm`; heartbeat route added (`POST /api/device/heartbeat`) for liveness.
- **Registration templates + custom services shipped:** vendor registration now supports category templates, inline rename, custom services, duplicate-name validation, and backend precedence of `selectedServices` to prevent template name duplication.
- **Manager review loop enforced:** employee stage flow pushes jobs to `AWAITING_REVIEW`; manager approve/reject endpoints gate final completion and require rejection reason when returning jobs for correction.
- **Customer proof notification wired to moderation:** admin package approve with customer-facing visibility triggers proof-ready email send attempt and records notification metadata to reduce duplicate sends.
- **Review attribution wired end-to-end:** review creation persists assigned membership/user attribution fields; vendor dashboard consumes attribution aggregates for employee performance and top-performer display.

## Handoff refresh (2026-04-27 — review attribution schema drift guard)
- **Review attribution DB drift hotfix applied:** SQL patch path `scripts/db/review-attribution-hotfix.sql` was applied to add missing `dbo.reviews` attribution columns/indexes in baseline databases where Prisma migrate deploy is blocked.
- **Schema drift detection route added:** `GET /api/health/schema` (`src/app/api/health/schema/route.ts`) now checks review attribution columns and the filtered unique booking review index and returns actionable guidance (`Run review-attribution hotfix or migration`) when drift is detected.

## Handoff refresh (2026-04-27 — manager review required before completion)
- **Completion gate is now enforced:** jobs follow `PENDING -> IN_PROGRESS -> AWAITING_REVIEW -> COMPLETED`. Employees can no longer complete jobs directly after uploading stage media.
- **Manager-only approval endpoint added:** `POST /api/vendors/[vendorId]/jobs/[jobId]/approve` (`src/app/api/vendors/[vendorId]/jobs/[jobId]/approve/route.ts`).
  - Requires `ACTIVE MANAGER`.
  - Requires job status `AWAITING_REVIEW`.
  - Requires all 3 staged videos (`INTRO`, `IN_PROGRESS`, `COMPLETED`) present.
  - On success, sets job `COMPLETED`, stamps completion date, and re-queues staged assets to moderation (`pending_review`) so the package enters moderation pipeline.
- **Direct status completion blocked:** `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` now rejects `UPDATE_STATUS -> COMPLETED` with `MANAGER_APPROVAL_REQUIRED`, forcing manager approval flow.
- **Manager-only rejection endpoint added:** `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` (`src/app/api/vendors/[vendorId]/jobs/[jobId]/reject/route.ts`).
  - Requires `ACTIVE MANAGER`.
  - Requires `rejectionReason` (returns `400` if missing).
  - Requires job status `AWAITING_REVIEW` (returns `409` otherwise).
  - On success, moves job `AWAITING_REVIEW -> IN_PROGRESS` and stores booking fields: `rejectionReason`, `rejectedAt`, `rejectedBy`.
- **Vendor jobs UI alignment:** `/vendor/jobs` awaiting-review actions now call approve/reject endpoints; both are manager-only and rejection uses a required-reason modal.
- **Employee flow alignment:** employee jobs API now includes `AWAITING_REVIEW` in surfaced statuses and only exposes "mark complete" behavior while still in pre-review statuses (`PENDING`/`CONFIRMED`) with all required staged uploads.
- **Employee rejection visibility + reset behavior:** employee jobs UI now shows **Rejected by manager** with the rejection reason, and rejection fields are cleared when employee re-submits/fixes the job back into review.
- **Verification completed:** reject route integration test passes (`4/4`).

## Handoff refresh (2026-04-23 — latest build snapshot pushed)
- **Latest build committed and pushed:** branch `cursor-latest-build` includes commit `3cccbbc` ("Latest Reliance build - consent resilience and recording flow UX hardening.") and is now synced to `origin/cursor-latest-build`.
- **Consent + vendor flow updates are in this snapshot:** consent request/accept/decline resilience, consent page UX refinements, vendor jobs flow improvements, notification/env hardening, and updated policy pages (`/privacy`, `/terms`).
- **Current known blocker after retest:** vendor recording still re-enters compliance in some paths due to runtime `recording-compliance` logs showing `no saved snapshot` and `unsatisfied: snapshot missing`; direct upload skip is still not consistently triggered.
- **Debugging instrumentation currently present:** `src/app/vendor/jobs/page.tsx` has temporary recording-compliance logs, source-path tagging, and snapshot persistence logic for deeper runtime tracing.
- **Next recommended execution step:** convert compliance trace logs to JSON-stringified payload logs (key, `savedAt`, source, snapshot body), then rerun the exact Intro -> In Progress -> Completed path plus header/actions entry points to isolate why snapshot hydration remains empty at runtime.

## Handoff refresh (2026-04-23)
- **Consent flow live verification completed:** `POST /api/consent/request` now succeeds end-to-end with real DB writes, returns `status: requested`, and sends provider notifications; `/consent/[token]` + `POST /api/consent/accept` transition records to `accepted`.
- **Media-session compliance gate verified:** staged media session creation for consent-required locations remains blocked until consent is accepted, then proceeds successfully once an accepted token is provided.
- **Admin audit compatibility hardening:** `src/lib/admin-audit.ts` now supports mixed `admin_audit_logs` schemas by trying Prisma `actionType` write first, then falling back to raw SQL that writes whichever action columns exist (`action`, `actionType`, or both). For consent request, audit logging is now explicitly best-effort and non-blocking.
- **Notification env and test route notes:** `POST /api/dev/notifications-test` is non-production only and requires `NOTIFICATIONS_TEST_SECRET` via header `x-notifications-test-secret`. Delivery wiring verified with live provider responses through Resend and Twilio paths.
- **Current provider config expectation:** Resend uses `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`; Twilio uses `SMS_ENABLED`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`; links rely on `APP_BASE_URL`.

## Handoff refresh (2026-04-22)
- **Vendor lifecycle + context normalization:** Added shared vendor-context foundations (`src/lib/vendor-context.ts`, `src/lib/vendor-status.ts`, `src/lib/vendor-job-operational-phase.ts`) and a dedicated route (`GET /api/vendor/context`) so vendor surfaces resolve a consistent lifecycle/status model instead of page-local derivations.
- **My Services framing alignment:** Product-facing naming and flow framing were refreshed toward "My Services" ownership and vendor lifecycle continuity (see `MY_SERVICES_UI_RENAME.md`, `MY_SERVICES_PAGE_FRAMING.md`, `PRODUCT_FLOW_REALIGNMENT.md`, `OPERATIONAL_PHASE_IMPLEMENTATION.md`).
- **Auth/session hardening:** Login/session handoff and profile resolution were tightened across `AuthContext`, login route/page, customer profile route, and client session/header helpers (`src/contexts/AuthContext.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/customer/profile/route.ts`, `src/lib/client-session.ts`, `src/lib/auth.ts`).
- **Admin governance flow updates:** Vendor approval/rejection endpoints and media moderation transitions were updated and connected to current lifecycle assumptions (`src/app/api/admin/vendors/*`, `src/app/api/admin/media/[assetId]/moderate/route.ts`, admin approval/moderation pages).
- **Vendor execution/media flow updates:** Vendor dashboard/jobs/media routes and hooks were refreshed to match the new operational-phase model and media archive behavior (`src/app/api/vendors/[vendorId]/dashboard/route.ts`, `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`, `src/app/api/vendors/[vendorId]/media/route.ts`, `src/lib/vendor-job-media.ts`).
- **Integration coverage expanded:** Added route-level integration suites for admin media moderation, vendor dashboard, vendor job actions, vendor media archive, vendor memberships, and booking CRUD regressions.

## Handoff refresh (2026-04-19)
- **Vendor team vs Manage Jobs:** One roster — `GET /api/vendors/{vendorId}/memberships?status=ACTIVE` via shared `src/lib/vendor-team-members.ts`. `/vendor/employees` lists real ACTIVE members (mock CRUD removed). Job assignment stores **`vendor_job_assigned_membership_ids`** plus server-resolved names in booking metadata; dashboard returns **`assignedMembershipIds`**.
- **My Services / vendor-created bookings:** `POST /api/bookings` detects **ACTIVE vendor membership** for `vendor_id`; requires **`client_email`**, resolves customer **`User.id`** by email, sets **`Booking.userId`** so **`GET /api/bookings`** and **`GET /api/bookings/[id]/media`** work for that customer.
- **Auth client session:** `AuthProvider.login(user, authToken?)` persists the **API token** (no overwrite with a placeholder). Canonical storage: **`localStorage.userData`**, **`localStorage.authToken`** / **`auth_token`**; legacy key **`user`** is migrated to **`userData`** on hydrate. **`getClientSessionHeaders`** reads **`userData`** (and legacy **`user`** fallback).
- **Customer profile:** `GET/PUT /api/customer/profile` uses **`getUserIdFromRequest`** + Bearer dev tokens (`temp-jwt-token`, `temp-token`); profile resolved by session user id against Prisma and/or **`dev-registered-users`**.
- **User dashboard:** Loads profile with **`getClientSessionHeaders(authUser.id)`** (Bearer + **`x-user-id`**), not a hardcoded bearer.
- **Login / Azure SQL:** Dev credentials live in **`src/lib/dev-registered-users.ts`** (e.g. `colivera080124@gmail.com` / `Co080124!`). If Prisma fails after password check (**firewall 40615**, unreachable DB), **non-production** login **still succeeds** using the dev-registry **`id`**, with JSON **`devWarning`** — fix by adding client public IP to **Azure SQL firewall** so ids match Prisma for bookings/My Services.
- **Dev ports:** Default **`npm run dev`** → **`localhost:3000`**. **`package.json`** `seed:dev` / `reset:dev` target **`localhost:3001`** — not the same process unless you start a second server on 3001.

## Handoff refresh (2026-04-15)
- Added **`AUTH_LOGIN_E2E_FAILURE_AUDIT.md`** to capture the current E2E login blocker analysis (`/auth/login` staying on page after submit).
- Current high-confidence root cause: when **`NEXT_PUBLIC_API_MODE=mock`**, the MSW `POST /api/auth/login` response shape (`data.user`) does not match the login page expectation (`user` at top level), causing success-path runtime failure and no redirect.
- Recommended execution guard for smoke runs: force live auth API mode for Playwright `webServer` or align MSW login payload shape with the live route contract.
- Handoff pointers below remain valid; this refresh adds auth-login E2E failure context and concrete recovery options.

## Handoff refresh (2026-04-12)
- Canonical maps and narrative docs were re-synced to the repo: **`ROUTE_MAP.md`** (pages + all 102 API routes), **`SCHEMA_MAP.md`** (Review + smart-review/consent models), **`UI_MAP.md`** (my-bookings, consent, admin vendors hub, notifications footnotes), **`RELIANCE_PRODUCT_ALIGNMENT.md`** (model/API list, gap list trimmed for implemented routes).
- **`CHANGELOG_LATEST.md`** prepend documents this refresh batch.
- Operational audits remain: **`MY_BOOKINGS_FUNCTION_AUDIT.md`**, **`NOTIFICATIONS_INTEGRATION_CHECK.md`**, **`CONSOLIDATION_CHECK.md`**, **`INTERRUPTED_WORK_AUDIT.md`** (older; cross-check if paths changed).

## Recovery + consolidation (2026-04-11)
- **Client providers:** `src/components/ClientProviders.tsx` is the only app-level client wrapper used by `src/app/layout.tsx` (`@/components/ClientProviders`). It combines Radix `TooltipProvider`, `AuthProvider`, and optional MSW when `NEXT_PUBLIC_API_MODE=mock`. The duplicate root `components/ClientProviders.tsx` was removed.
- **Component tree:** Large prototypes that previously sat directly under `components/` were moved to `components/legacy-pages-router/` (see README there). They remain for **Pages Router** only (`pages/support.js`, `pages/notifications.js`). The App Router continues to use `@/components/*` → `src/components/`.
- **Duplicate UI tree:** The parallel `components/ui/` copy was removed; shared primitives live under `src/components/ui/`. `popover.tsx` was added under `src/components/ui/` so legacy `ReviewManagement` (now under `legacy-pages-router`) resolves `@/components/ui/popover`.
- **Scaffold removal:** Empty `src/components/SupportTickets.tsx` deleted (unused).
- **Dev script:** `temp-create-job-check.cjs` removed from repo root; equivalent lives at `scripts/dev/vendor-job-dashboard-persist-check.cjs` (see `scripts/dev/README.md`).

## Notifications (Resend + Twilio) — 2026-04-12
- **Email:** `src/lib/email/resend.ts` sends via Resend HTTPS API using `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO` (`reply_to`), gated by `EMAIL_ENABLED`.
- **SMS:** `src/lib/sms/twilio.ts` uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, gated by `SMS_ENABLED` (trial / unverified-number errors surfaced in logs and API payloads).
- **Orchestration:** `send-consent-link`, `send-review-reminder`, `send-review-expired` under `src/lib/notifications/`; absolute links use `APP_BASE_URL` when set.
- **Consent:** `POST /api/consent/request` loads booking user contact, sends consent link, returns `manualLinkRequired` when no channel succeeds; writes `notification_dispatch` consent events and `notification_attempt` admin audit rows (redacted recipient).
- **Review flows:** No durable scheduler — `scheduleReviewReminder` performs **immediate** best-effort reminder when a window is created; `POST /api/reviews/window/expire` triggers expiry notification and returns `expiryNotification` in JSON.
- **Dev test:** `POST /api/dev/notifications-test` (non-production only; requires `NOTIFICATIONS_TEST_SECRET` + header `x-notifications-test-secret`).
- **Startup warnings:** `src/instrumentation.ts` + explicit `logNotificationEnvWarnings()` on consent/dev routes.

## Booking–media–review trust loop (2026-04-12)
- **Materially hardened:** The customer path from **`/my-bookings`** list/media through **`SmartVideoPlayer`** now aligns identity: the player sends **`x-user-id`** on **every** review `POST` when a **`userId`** is provided (same resolver as booking list/media); **missing `userId`** forces **watch-only** (no review API calls). Server-side, **`POST /api/reviews/create`** enforces **active review window ↔ submitted `bookingId` / `vendorId`** (and optional **`mediaSessionId`**) before writing a review; **`POST /api/reviews/window/expire`** requires **`getUserIdFromRequest`** and that the **booking owner** matches the window’s booking.
- **Optional future hardening (lower priority):** **`POST /api/reviews/window/start`**, **`/prompt-event`**, and **`/sentiment`** still rely on consent + window state / UUID secrecy rather than authenticated booking ownership (TODOs on those route files; details in **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`** and **`BOOKING_MEDIA_REVIEW_CHAIN_AUDIT.md`**).

## Fully working
- Admin governance surfaces remain intact and connected:
  - `/admin/publish-management`
  - `/admin/media-moderation`
  - `/admin/audit-logs`
- Admin vendors hard defect fixed:
  - `/admin/vendors` no longer depends on missing `@/components/VendorManagement`
- Dynamic API `params` fixes applied on affected routes:
  - `src/app/api/bookings/[id]/route.ts`
  - `src/app/api/services/[id]/route.ts`
  - `src/app/api/availability/vendor/[vendorId]/route.ts`
- Bookings core API contract stabilized for shared shape:
  - `/api/bookings`
  - `/api/bookings/[id]`
  - `/api/bookings/[id]/cancel`
- Env tracking stabilized:
  - `.gitignore` repaired and normalized for `.env*`
  - `.env.local` and `.env.new` untracked from git index

## Partially working
- Bookings UI is now mostly real-data backed end-to-end:
  - `/my-bookings` uses live API and real actions (customer id from `AuthProvider` / `localStorage.userData` + `x-user-id`; login syncs context; sidebar display name fixed — see `MY_BOOKINGS_FUNCTION_AUDIT.md`)
  - `/booking/[serviceId]` create flow uses canonical contract and reliable booking ID handoff
  - `/booking/[serviceId]/confirmation` now loads persisted booking via `/api/bookings/[id]`
  - `/booking/[serviceId]` date/time picker now reads backend slot availability and performs pre-submit slot revalidation
  - remaining gap: slot generation is booking-derived and fixed-hour-window based (no vendor-custom schedule persistence yet)
- Vendor jobs remains hybrid:
  - media/session/upload/playback flows are live
  - targeted duplicate/stale-state guards added
  - wider page still contains mixed mock/live orchestration
- **`/vendor/employees`:** roster is **live** (ACTIVE memberships); not the old mock list. Add/invite flows still product TBD.
- DB startup resilience improved:
  - Prisma init no longer hard-crashes app startup on env-fragile failure
  - route-level DB usage still fails at runtime if DB unavailable (expected, now deterministic)
- Smart review capture active path implemented with constraints:
  - API routes added for review window start/events/sentiment/create/expire
  - customer video overlay prompts wired in `/my-bookings` media playback via `SmartVideoPlayer` (see **Booking–media–review trust loop** above for latest client + server enforcement)
  - consent request/accept/decline/token routes added with timestamp/IP/user-agent/version capture
  - remaining gap: vendor-side consent request initiation is API-ready but has limited first-class UI orchestration; email/SMS delivery depends on env + user contact on the booking

## Mocked
- Vendor management pages are still mostly local-state/mock:
  - `/vendor/services`
  - `/vendor/reviews`
  - `/vendor/analytics`
  - `/vendor/billing`
- Admin management pages below still depend on placeholder/component-local mock behavior:
  - `/admin/dashboard`
  - `/admin/users`
  - `/admin/reports`
  - `/admin/settings`
  - `/admin/activity`

## Broken
- No new hard runtime break introduced in this pass.
- Known remaining contract gaps are documented in `API_CONTRACT_MATRIX.md` (not mass-refactored by design).

## What was fixed vs documented
- Fixed now:
  - hard defect in admin vendors page
  - dynamic route params handling defects (targeted)
  - booking API contract consistency and booking create alignment
  - booking confirmation page converted from mock to real API-backed state
  - availability read route now returns stable slot-based contract from backend booking state
  - availability slot check route added at `/api/availability/check`
  - booking create conflict guard added (`SLOT_UNAVAILABLE`, 409)
  - booking page migrated off local static date/time arrays to API-provided slots
  - smart review capture schema foundation (`ReviewWindow`, `ReviewPromptEvent`, `ReviewSentiment`, `ConsentRecord`, `ConsentEvent`)
  - review model fields for explicit customer source and submission channel
  - admin review audit API + UI (`/api/admin/review-audit`, `/admin/review-audit`)
  - consent capture page (`/consent/[token]`) and consent-gated review window start
  - env gitignore/tracking issue
  - vendor jobs duplicate action guard for upload/playback actions
- Documented only (not fully implemented):
  - broader management-layer API build-out
  - non-booking SDK/API mismatches outside stabilized low-risk scope
  - full vendor jobs architecture cleanup

## Top risks now
- **Azure SQL firewall / connectivity:** client IP must be allowed on the server or Prisma routes fail; dev login may fall back to dev-registry **`id`** (see **Handoff refresh 2026-04-19**).
- DB/network availability to SQL Server still causes runtime API failures for routes that require DB (expected when unreachable).
- E2E smoke can fail at login with a "stuck on `/auth/login`" symptom when mock mode is active and auth payload shape diverges from login-page expectations.
- Management pages remain mostly mock and can drift from real backend behavior.
- SDK endpoint drift still exists outside bookings low-risk fixes.
- Vendor jobs page size/complexity still poses regression risk without tests.
- Availability currently assumes fixed slot windows and single-booking-per-slot semantics.
- Review **reminder** email/SMS is immediate best-effort only (no background job queue); durable delayed reminders are not implemented.

## Next recommended tasks
1. Resolve auth-login E2E mode mismatch (force live API mode for smoke or align MSW `POST /api/auth/login` payload with live route contract).
2. Add integration tests for booking create -> confirmation -> list -> cancel flow.
3. Add integration tests for availability read/check and slot-conflict booking rejection.
4. Add vendor-managed schedule persistence (working hours/blackouts) to availability slot generation.
5. Add runtime DB availability guard helper usage in critical routes for clearer 503 responses.
6. Add vendor-side consent-request initiation UX over existing `/api/consent/request` route for media sessions.
7. Add integration tests for smart review capture + consent + admin audit flow.
8. Execute management-layer implementation order from `MANAGEMENT_LAYER_GAP_REPORT.md`.
