# Changelog (Current Session)

Scope: current active session changes in working tree (from current repo state).

## 2026-04-22 — Reliance handoff refresh (vendor lifecycle + auth + media execution)

**Handoff docs:** `PROJECT_STATE.md` prepended with a matching **2026-04-22** refresh section.

### Product/lifecycle framing
- Added/updated handoff and execution docs for lifecycle framing and "My Services" naming alignment:
  - `PRODUCT_FLOW_REALIGNMENT.md`
  - `OPERATIONAL_PHASE_IMPLEMENTATION.md`
  - `VENDOR_JOB_LIFECYCLE_DESIGN.md`
  - `MY_SERVICES_UI_RENAME.md`
  - `MY_SERVICES_PAGE_FRAMING.md`
  - `ROLE_SURFACES_SYSTEM_AUDIT.md`

### Vendor lifecycle/context backend
- Added lifecycle/context helpers:
  - `src/lib/vendor-context.ts`
  - `src/lib/vendor-status.ts`
  - `src/lib/vendor-job-operational-phase.ts`
- Added context API:
  - `src/app/api/vendor/context/route.ts`
- Updated vendor API/page consumers to use aligned lifecycle assumptions across dashboard/jobs/services/profile flows.

### Auth/session and customer profile hardening
- Updated login/session contract path and fallback behavior:
  - `src/app/api/auth/login/route.ts`
  - `src/app/auth/login/page.tsx`
  - `src/contexts/AuthContext.tsx`
  - `src/lib/client-session.ts`
  - `src/lib/auth.ts`
- Updated customer profile/session wiring:
  - `src/app/api/customer/profile/route.ts`
  - `src/app/(user)/user-dashboard/page.tsx`
  - `src/sdk/auth.ts`

### Admin + media execution updates
- Admin approvals and moderation routes/pages refreshed:
  - `src/app/api/admin/vendors/approve/route.ts`
  - `src/app/api/admin/vendors/reject/route.ts`
  - `src/app/api/admin/vendors/bulk-approve/route.ts`
  - `src/app/api/admin/vendors/bulk-reject/route.ts`
  - `src/app/api/admin/vendors/pending/route.ts`
  - `src/app/api/admin/media/[assetId]/moderate/route.ts`
  - `src/app/admin/vendors/approval-queue/page.tsx`
  - `src/app/admin/media-moderation/page.tsx`
- Vendor execution/media routes and clients updated:
  - `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
  - `src/app/api/vendors/[vendorId]/dashboard/route.ts`
  - `src/app/api/vendors/[vendorId]/media/route.ts`
  - `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts`
  - `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`
  - `src/lib/vendor-job-media.ts`
  - `src/lib/media-visibility.ts`

### Test coverage additions/updates
- Added or expanded integration suites:
  - `src/app/api/admin/media/admin-media-moderation.integration.test.ts`
  - `src/app/api/vendors/[vendorId]/dashboard/dashboard.integration.test.ts`
  - `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
  - `src/app/api/vendors/[vendorId]/media/vendor-media-archive.integration.test.ts`
  - `src/app/api/vendors/[vendorId]/memberships/memberships.integration.test.ts`
  - `src/app/api/bookings/booking-crud.integration.test.ts`
- Updated notes:
  - `MEDIA_EXECUTION_FLOW_INTEGRATION_TESTS_NOTES.md`

## 2026-04-19 — Handoff refresh: vendor jobs, My Services linkage, auth/login, customer profile

**Handoff docs:** `PROJECT_STATE.md` prepended with **2026-04-19** section; this changelog entry summarizes the same batch.

### Vendor team + job assignment
- **`src/lib/vendor-team-members.ts`:** shared ACTIVE membership fetch for UI.
- **`src/app/vendor/employees/page.tsx`:** real roster (removed mock Maria/James CRUD).
- **`src/app/vendor/jobs/page.tsx`:** `teamMembers`, assignment by **`assignedMembershipIds`**, dashboard **`assignedMembershipIds`** on jobs; employee-view filter uses membership ids when available.
- **`src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`:** `ASSIGN_JOB` validates ACTIVE memberships, writes **`vendor_job_assigned_membership_ids`** + resolved display names.
- **`src/app/api/vendors/[vendorId]/dashboard/route.ts`:** returns **`assignedMembershipIds`** per job.

### My Services (customer) + vendor-created jobs
- **`src/app/api/bookings/route.ts`:** vendor staff (`ACTIVE` **`VendorMembership`** for `vendor_id`) requires **`client_email`**, resolves customer **`User.id`** by email, sets **`Booking.userId`**; non-vendor flow unchanged (`auth` / body **`user_id`**).
- **`src/lib/resolve-booking-owner-user-id.ts`:** case-insensitive email → user id helper for booking create.

### Auth session + customer profile + login UX
- **`src/contexts/AuthContext.tsx`:** `login(user, token?)`, **`AuthUser`** includes **`both`**; migrate legacy **`localStorage.user`** → **`userData`**; dev-only hydrate/login logs.
- **`src/app/auth/login/page.tsx`:** single write path via `login()`; safe JSON parse with wrong-port hint; dev alerts include **`code`** / **`details`**.
- **`src/lib/client-session.ts`:** legacy **`user`** fallback; dev header preview logs.
- **`src/app/api/customer/profile/route.ts`:** `getUserIdFromRequest` + dev bearer tokens; profile by session user (Prisma +/`dev-registered-users`); includes **`id`** on profile.
- **`src/app/(user)/user-dashboard/page.tsx`:** waits for `useAuth`, **`getClientSessionHeaders(authUser.id)`** for profile fetch.
- **`src/app/api/auth/login/route.ts`:** normalized email lookup; dev **`USER_NOT_FOUND`**, **`INVALID_PASSWORD`**; **non-production:** on Prisma failure after password OK, continue with dev-registry **`id`** + JSON **`devWarning`** (Azure **40615** / DB down).

## 2026-04-15 — Integration coverage: execution flow stabilization (vendor jobs/media/admin moderation)

- Added **route-level integration suites** (Vitest, mocked Prisma/auth like existing passes):
  - **`src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`**
  - **`src/app/api/admin/media/admin-media-moderation.integration.test.ts`**
  - **`src/app/api/vendors/[vendorId]/media/vendor-media-archive.integration.test.ts`**
  - **`src/app/api/vendors/[vendorId]/memberships/memberships.integration.test.ts`**
- Coverage now includes:
  - **Vendor job actions:** success/error transitions for `ARCHIVE_JOB`, `MOVE_CONTENT_TO_ARCHIVE`, delete eligibility and transactional linked-content archival behavior.
  - **Admin media moderation:** auth/validation and canonical moderation/visibility transitions (`approve_*`, `set_visibility_*`, reject path).
  - **Content archive listing behavior:** empty states, ownership guards, archive/restore status transitions, enriched archive row mapping.
  - **Vendor employees API path:** memberships manager guard + empty/normalized list behavior.
- Added **`MEDIA_EXECUTION_FLOW_INTEGRATION_TESTS_NOTES.md`** with behavior matrix and intentionally uncovered gaps.
- Verification: `npx vitest run` against the 4 new suites passed (**26 tests**).

## 2026-04-15 — Reliance handoff refresh (auth-login E2E audit sync)

- **`AUTH_LOGIN_E2E_FAILURE_AUDIT.md`:** Added a focused audit of the E2E smoke login failure mode where `/auth/login` does not transition after submit.
- **Root cause documented:** in mock mode, MSW `POST /api/auth/login` returns a nested `data.user` payload while `src/app/auth/login/page.tsx` expects top-level `user`, causing success-path runtime error and no redirect.
- **`PROJECT_STATE.md`:** Prepend refreshed with current auth-login E2E findings, risk statement, and immediate mitigation path (force live mode for smoke or align MSW login handler contract).
- **Operational handoff update:** auth-login mode mismatch is now explicitly listed as a top risk and as the first next-task item so execution order matches observed failures.

## 2026-04-12 — E2E smoke pass 3 (review happy path: window start → create)

- **`e2e/review-smoke.spec.ts`:** Playwright smoke — login → **`/my-bookings`** ( **Past** ) → **Load Authorized Media** → **`SmartVideoPlayer`** triggers **`POST /api/reviews/window/start`** → **`video.play()`** → overlay **Positive** → **Quick Review** → **`POST /api/reviews/create`**; asserts **`success`** + persisted **`review.id`** on the create response, modal closes, no red inline error. No mocks for consent or review CRUD.
- **`e2e/global-setup.ts`:** Deletes any prior **`E2E Review Smoke`** booking chain, then seeds (in a **transaction**) a **completed** booking, **`MediaSession`**, approved **`video/mp4`** **`MediaAsset`** (public sample URL), and accepted **`video_access`** **`ConsentRecord`**; fixture adds **`reviewBookingId`** (plus optional vendor/media session ids). Clear **P2021** error if consent/review/media tables are missing (migrations required).
- **UI:** **`data-testid`** **`e2e-smart-video-player`**, **`e2e-quick-review-panel`** (`SmartVideoPlayer`, `QuickReviewPanel`).
- **`playwright.config.ts`:** Chromium **`--autoplay-policy=no-user-gesture-required`** for stable soft-prompt timing after programmatic play.
- **`package.json`:** script **`test:e2e:smoke:review`**.
- **`E2E_SMOKE_IMPLEMENTATION_NOTES.md`:** Pass 3 coverage, seed notes, hooks, limitations.

## 2026-04-12 — E2E smoke pass 2 (favorites journey)
- **`e2e/favorites-smoke.spec.ts`:** Playwright smoke — **`/favorites`** idempotent cleanup → **`/discover`** (search) → **`/service/[id]`** toggle **on** → **`/favorites`** assert **`favorites-row-<serviceId>`** → **View Service** → toggle **off** → assert row removed; real favorites APIs + DB (no mocks).
- **UI:** **`data-testid`** / **`aria-label`** on Discover favorite control, service header favorite, favorites row + remove (`discover`, **`service/[serviceId]`**, **`favorites`** pages).
- **`package.json`:** script **`test:e2e:smoke:favorites`**.
- **`E2E_SMOKE_IMPLEMENTATION_NOTES.md`:** Pass 2 coverage, commands, selector hooks.

## 2026-04-12 — E2E smoke: first successful live run
- **`npm run test:e2e:smoke`** passed end-to-end: **booking create → confirmation → my-bookings** (real APIs + DB).
- **Prerequisite observed:** target **DB schema alignment** (e.g. **`users.phone`**, **`bookings.customerMetadata`**) before booking create could succeed; drift/baseline context in **`DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md`** / **`DB_BASELINE_READINESS_CHECKLIST.md`**.
- **`GET /placeholder-service.jpg` 404** in dev logs during the run — **non-blocking** for smoke.

## 2026-04-12 — DB baseline / schema drift notes (documentation)
- **`DB_BASELINE_AND_SCHEMA_DRIFT_NOTES.md`:** First live **E2E smoke** run showed **schema drift** (**`users.phone`** missing) and **`migrate deploy`** blocked by **`P3005`** (non-empty, unbaselined DB). **Current blocker:** migration **baseline** and/or **schema alignment** before smoke can pass end-to-end.
- **`DB_BASELINE_READINESS_CHECKLIST.md`:** Pre-flight checklist for **Azure SQL** (path A vs B, preconditions, critical columns, migration risks, post-fix verification, shared-DB caution).

## 2026-04-11 — E2E smoke pass 1 (booking journey)
- **Playwright:** `@playwright/test`, root **`playwright.config.ts`** (`webServer`: **`npm run dev`**, **`globalSetup`**: **`e2e/global-setup.ts`**), scripts **`test:e2e`** / **`test:e2e:smoke`**.
- **`e2e/global-setup.ts`:** Prisma upserts **`e2e-smoke-customer`** user, vendor **`e2e-smoke-vendor@reliance.test`**, published **E2E Smoke Service**; writes gitignored **`e2e/smoke-fixture.json`**.
- **`e2e/booking-smoke.spec.ts`:** One Chromium flow — login → Discover search → service → booking → confirmation URL + **`booking-confirmation-reference`** → **My Bookings** row **`my-bookings-row-*`** (real APIs, no route mocks).
- **`src/lib/dev-registered-users.ts`:** Dev login row for **`e2e-smoke-customer`** aligned with Prisma id.
- **UI:** Minimal **`data-testid`** on booking slots, confirmation id, and my-bookings rows (`booking` + **`my-bookings`** pages).
- **`E2E_SMOKE_IMPLEMENTATION_NOTES.md`:** Tooling, env, commands, limitations.
- **E2E smoke first run (exec note):** Smoke reached the live DB; **`globalSetup`** failed on schema drift (**`users.phone`** missing on target). **Next:** deploy migrations to align the database, then rerun **`npm run test:e2e:smoke`**.

## 2026-04-11 — Availability + review window start integration tests (pass 5)
- **`src/app/api/availability/availability-check.integration.test.ts`:** **`POST /api/availability/check`** — **400** validation (missing **`vendorId`** / **`booking_date`** / **`booking_time`**); **200** available / unavailable using **real** **`checkVendorSlotAvailability`** against hoisted **`prisma.booking.findMany`**; **`serviceId`** optional **`where`** shape.
- **`src/app/api/reviews/review-window-start.integration.test.ts`:** **`POST /api/reviews/window/start`** — **400** required fields; **404** booking/vendor and media session mismatches; **403** missing accepted **`video_access`** consent; **200** existing vs newly created window + mocked **`scheduleReviewReminder`**; hoisted **`prisma`** + **`getOrCreateActiveReviewWindow`** real.
- **`AVAILABILITY_REVIEW_START_INTEGRATION_TESTS_NOTES.md`:** Scope, mocks, matrix, run command.
- Updated `CORE_ROUTE_TEST_COVERAGE_SNAPSHOT.md` to reflect availability + review window start coverage and revised next-batch targets.

## 2026-04-11 — Booking CRUD route integration tests (pass 4)
- **`src/app/api/bookings/booking-crud.integration.test.ts`:** Vitest integration-style tests for **`GET`/`POST /api/bookings`** and **`GET`/`PUT`/`DELETE /api/bookings/[id]`** — list **401** / vendor-only **200** / auth-scoped **`userId`** vs query; create **400**/**404**/**401**/**409** `SLOT_UNAVAILABLE` (mocked **`checkVendorSlotAvailability`**) / **200** with **`customerMetadata`** + **`amount`** or service-derived price; detail **401**/**404**/**403**/**200**; **PUT** ownership + **`status`** casing; **DELETE** soft-cancel **200**; hoisted **`prisma`** + **`getUserIdFromRequest`** (aligned with passes 1–3).
- **`BOOKING_CRUD_ROUTE_INTEGRATION_TESTS_NOTES.md`:** Scope, mocks, matrix, run command.

## 2026-04-11 — Core route test coverage snapshot (documentation only)
- **`CORE_ROUTE_TEST_COVERAGE_SNAPSHOT.md`:** Summary of the three **`*.integration.test.ts`** suites (reviews create/expire, booking media/cancel, favorites), behaviors covered, highest-value **gaps** (bookings list/create/detail, availability, review **`window/start`**, optional consent/aux review routes), **recommended next batch** (bookings **`GET`/`POST`** + **`[id]`** routes first), and the **route-level + mocked Prisma/auth** strategy.

## 2026-04-11 — Favorites route integration tests (pass 3)
- **`src/app/api/users/favorites/favorites-routes.integration.test.ts`:** Vitest integration-style tests for **`GET/POST /api/users/favorites`** and **`DELETE /api/users/favorites/[id]`** — GET 401 / empty list / auth-scoped `userId` / normalized rows + media preview + mocked **`getVendorReviewAggregatesForPublic`**; POST 401 / **`x-user-id`** resolution / 400 missing **`serviceId`** / 404 unknown service / 200 upsert + **`service_id`** alias; DELETE 401 / 400 empty id / 404 / 200 by favorite id or **`serviceId`**; hoisted **`prisma`** + **`getUserIdFromRequest`** (same pattern as passes 1–2).
- **`FAVORITES_ROUTE_INTEGRATION_TESTS_NOTES.md`:** Scope, mocks, matrix, run command.

## 2026-04-11 — Booking route integration tests (pass 2)
- **`src/app/api/bookings/booking-media-cancel.integration.test.ts`:** Vitest integration-style tests for **`GET /api/bookings/[id]/media`** (401 / 403 / 404 / 200, **`findMany`** `where` matches **`getApprovedActiveBaseWhere`** + customer **`visibilityStatus.in`**, normalized **`assets`** + **`images`** / **`videos`** split) and **`POST /api/bookings/[id]/cancel`** (401 / 403 / 404 / 200, **`cancellation_reason`** / **`refund_requested`** from body, optional empty body); hoisted **`prisma`** + **`getUserIdFromRequest`** mock (same pattern as review pass 1).
- **`BOOKING_ROUTE_INTEGRATION_TESTS_NOTES.md`:** Scope, mocks, matrix, run command.

## 2026-04-11 — Review route integration tests (pass 1)
- **`src/app/api/reviews/review-create-expire.integration.test.ts`:** Vitest integration-style coverage for **`POST /api/reviews/create`** (401, 403 owner mismatch, 409 context/media mismatch, 200 success with mocked **`$transaction`** + audit) and **`POST /api/reviews/window/expire`** (401, 403, 200 non-active short path, 200 active expire with notify mock); **`vi.hoisted`** Prisma + mocks for **`getUserIdFromRequest`**, **`createAdminAuditLog`**, **`notifyReviewWindowClosedWithoutSubmission`**.
- **`REVIEW_ROUTE_INTEGRATION_TESTS_NOTES.md`:** Scope, mocks, matrix, run command.

## 2026-04-11 — Core user-flow integration test audit (audit only)
- **`CORE_USER_FLOW_INTEGRATION_TEST_AUDIT.md`:** Maps booking create → confirmation → my-bookings, cancel, favorites (discover / favorites / service detail), review create & expire authorization, and booking media to **routes**, **page entry points**, **minimum cases**, **mock vs test-DB** guidance, **regression priorities**, and a **smallest-first implementation order** (Vitest-aligned; optional E2E deferred).

## 2026-04-12 — Booking SDK customer identity alignment
- **`src/sdk/bookings.ts`:** Replaced **`api`**-only calls with **`fetch`** + **`credentials: 'include'`**; optional **`authUserIdFromCaller`** (use **`useAuth().user.id`**) drives **`resolveCustomerUserId`** and the **`x-user-id`** header on all booking routes; **`listBookings`** defaults **`userId`** query when listing as a customer (parity with **`/my-bookings`**); **`createBooking`** maps extended snake/camel fields and fills **`user_id`** from resolver when missing; **`cancelBooking`** sends a JSON body like the live cancel **`fetch`**.
- **`src/hooks/useBookings.ts`:** **`useAuth()`** passes **`user?.id`** into the SDK; list/detail query keys include the actor so identity switches invalidate cache (**`favoritesSDK`** pattern).
- **`BOOKING_SDK_IDENTITY_ALIGNMENT_NOTES.md`:** Audit vs live pages, gaps, and usage notes.

## 2026-04-12 — Booking create persistence hardening
- **`prisma/schema.prisma` + migration `20260412120000_booking_customer_metadata`:** Optional **`customerMetadata`** (`NVARCHAR(MAX)` JSON string) on **`Booking`** for structured create-side customer fields. **SQL Server / Prisma 6:** **`Json`** is unsupported — metadata is stored as **`String`**; several FK **`onDelete` / `onUpdate`** values were set to **`NoAction`** on **`Review`** (user + vendor), **`ReviewWindow`** (booking + media session + vendor; **`review`** remains **`SetNull`**), and **`ConsentRecord`** (vendor) so the schema validates under single–cascade-path rules (see Prisma P1012 docs).
- **`src/app/api/bookings/route.ts`:** **`POST`** builds **`customerMetadata`** from **`user_notes`**, **`client_email`**, **`client_phone`**, **`custom_fields`**; persists **`amount`** from body or **`Service.price`**; hydrates **`customer_metadata`** on the contract; **`meta`** remains a deprecated mirror of the same data.
- **`src/lib/booking-shape.ts`:** Maps **`customer_metadata`**; **`total_price`** uses numeric **`amount`** when present (including **0**) instead of treating **0** as missing.
- **`src/app/api/bookings/[id]/route.ts`**, **`src/app/api/bookings/[id]/cancel/route.ts`:** **`select`** includes **`customerMetadata`** for contract mapping.
- **`src/app/(user)/booking/[serviceId]/page.tsx`:** Sends **`amount`** from catalog price; removes placeholder payment step; **Review & confirm** + explicit no-payment copy; submit from review.
- **`src/app/(user)/booking/[serviceId]/confirmation/page.tsx`:** Surfaces persisted **`customer_metadata`** (contact, address, notes), vendor vs service address, and no-payment clarification on totals.
- **`BOOKING_CREATE_PERSISTENCE_NOTES.md`:** Field audit and decisions. **`BOOKING_LIVE_DATA_COMPLETION_AUDIT.md`:** Resolved markers for create extras, amount, payment UI, and POST **`meta`**-only behavior.

## 2026-04-12 — Booking domain live-data completion (audit only)
- **`BOOKING_LIVE_DATA_COMPLETION_AUDIT.md`:** Classifies `/bookings` (redirect), `/my-bookings`, confirmation, booking wizard, `bookingsSDK` / `useBookings`, and `api/bookings/*` as **fully DB-backed**, **hybrid**, **local**, or **placeholder**; calls out POST **`meta`**-only fields, zero **`amount`** from wizard, placeholder payment UI, and SDK vs **`fetch`** + **`x-user-id`** drift; recommends smallest sequence (persist extras, pass amount, simplify payment, unify identity, optional hook migration).

## 2026-04-12 — SDK/API contract correction pass 3
- **`src/sdk/services.ts`:** Removed SDK methods with **no** Next routes (`getPopularServices`, `getServicesByCategory`, `getServicesByVendor`, `searchServices`, `uploadServiceMedia`, `deleteServiceMedia`, `searchServicesCatalog`). Module doc states canonical paths (`discoverServices`, `getCategories`, vendor media via `/api/vendors/...`, service search via **`searchSDK`**). **`createService`** maps **`vendor_id`** / **`vendorId`** into the POST body expected by **`/api/services`**.
- **`src/hooks/useServices.ts`:** Dropped hooks that only wrapped removed SDK methods; trimmed **`serviceKeys`**.
- **`src/sdk/search.ts`:** **`getSearchSuggestions`** returns empty suggestions when **`q`** is blank (avoids **`GET /api/search`** `400`).
- **`src/sdk/reviews.ts`:** Surface reduced to **`listReviews`** only; removed unimplemented route stubs.
- **`src/sdk/auth.ts` + `src/hooks/useAuth.ts`:** **`getAvailableProfiles`** sends required **`userId`** query via **`resolveCustomerUserId`**; **`toggleProfile`** POSTs **`userId`** + **`targetProfileType`** (from **`targetProfile`**). Hooks pass **`user?.id`** into the SDK.
- **`src/sdk/index.ts`:** Re-exports **`./favorites`** (`favoritesSDK`) with a one-line canonical-vs-**`usersSDK`** note.
- **`src/sdk/users.ts`:** File-level warning for admin/preference methods that still **404**.
- **`src/examples/sdk-usage.ts`:** Switched example discovery to **`useDiscoverServices`**; service creation uses **`useCreateService`**.
- **`SDK_API_CONTRACT_ALIGNMENT_AUDIT.md`:** Pass 3 **resolved** markers for services, search suggestions, reviews, auth, barrel, consumers.

## 2026-04-12 — SDK/API contract correction pass 2
- **`src/sdk/users.ts`:** `listFavorites` / `addFavorite` / `removeFavorite` now target **`/api/users/favorites`** and **`/api/users/favorites/[id]`** (aligned with implemented routes). JSDoc defers identity edge cases to **`favoritesSDK`**. **`updateFavoriteNotes`** and **`checkFavorite`** removed (no backing API; no in-repo callers).
- **`src/sdk/bookings.ts` — `updateBooking`:** Builds **`PUT /api/bookings/[id]`** body with snake_case **`booking_date`**, **`booking_time`**, **`client_name`**, **`user_notes`**, plus **`status`** / **`title`**; accepts camelCase aliases (**`bookingDate`**, **`bookingTime`**, **`clientName`**) on the input object for backward compatibility.
- **`SDK_API_CONTRACT_ALIGNMENT_AUDIT.md`:** Marked pass 2 items **resolved** / **removed** / **done** in §1.1, §1.8, §3–§4, §5.

## 2026-04-12 — SDK/API contract correction pass 1
- **`src/sdk/availability.ts` — `checkAvailability`:** Uses **`POST /api/availability/check`** with JSON `vendorId`, `booking_date`, `booking_time`, optional `serviceId`. Accepts legacy param names **`date`** / **`time`**; normalizes time strings; maps API **`reason`** onto **`message`** for older consumers; **`alternatives`** remains unused (`undefined`).
- **`src/sdk/services.ts` — `getService`:** Unwraps **`{ service }`** from **`GET /api/services/[id]`** so **`useGetService`** and other callers receive a **`Service`**-shaped object; narrow defensive fallback if the payload were ever flat.
- **`SDK_API_CONTRACT_ALIGNMENT_AUDIT.md`:** Rows for `checkAvailability` and `getService`, §3–§4, and consumer summary updated to mark these items **resolved** / **done**.

## 2026-04-12 — SDK ↔ API contract alignment (audit only)
- **`SDK_API_CONTRACT_ALIGNMENT_AUDIT.md`:** Matrix of each `src/sdk/*` method vs `src/app/api/*` routes (method, path, query/body, headers); notes on `useBookings`, `useServices`, `useFavorites`, `useAuth`, vendor media hooks; highest-risk mismatches (availability check verb/params, `getService` response shape, `usersSDK` favorites paths, missing service subroutes, service media POST); minimal fix order; `src/sdk/index.ts` favorites export gap.

## 2026-04-12 — Favorites + service detail customer identity alignment
- **`src/sdk/favorites.ts`:** Optional **`authUserIdFromCaller`** on list/add/remove; resolves id with **`resolveCustomerUserId`** (replaces **`getLocalUserId`**); keeps **`userId`** query, **`x-user-id`**, and POST **`userId`** in sync with that resolution.
- **`src/hooks/useFavorites.ts`:** **`useAuth()`** passes **`user?.id`** into the SDK; query keys include **`_authUserId`** so favorites queries invalidate when the session user changes.
- **`src/app/(user)/service/[serviceId]/page.tsx`:** **`useAuth`** + **`resolveCustomerUserId(user?.id)`** for favorites fetch and toggle (removes **`localStorage.user`-only** helper); effect deps include **`user?.id`**.
- **`FAVORITES_IDENTITY_ALIGNMENT_AUDIT.md`:** Scope, prior gaps, and API notes.

## 2026-04-12 — Booking identity alignment (outside `/my-bookings`)
- **`src/lib/customer-user-id.ts`:** Shared **`resolveCustomerUserId`** — `useAuth().user.id` → **`userData`** → legacy **`user`** (same order as `/my-bookings` previously inlined).
- **`src/app/(user)/my-bookings/page.tsx`:** Imports shared resolver (no behavior change).
- **`src/app/(user)/booking/[serviceId]/confirmation/page.tsx`:** **`useAuth`** + shared resolver for **`GET /api/bookings/[id]`** + **`x-user-id`**; removes **`localStorage.user`-only** path; **`loadBooking`** tied to **`user?.id`** via **`useCallback`/`useEffect`**.
- **`src/app/(user)/booking/[serviceId]/page.tsx`:** **`useAuth`** + shared resolver for **`POST /api/bookings`** (`user_id` + **`x-user-id`**); removes inline **`localStorage.user`** read.
- **`BOOKING_IDENTITY_ALIGNMENT_AUDIT.md`:** Audit of scope, call sites, and query-param notes.

## 2026-04-12 — Booking–media–review trust-chain documentation refresh
- **`BOOKING_MEDIA_REVIEW_CHAIN_AUDIT.md`**, **`BOOKING_MEDIA_REVIEW_FLOW_MAP.md`:** Aligned with **`SmartVideoPlayer`** **`x-user-id`** on all review fetches when **`userId`** is set, **watch-only** when **`userId`** is missing, **`reviewApisEnabled`** wording, and server rules for **`/api/reviews/create`** (window ↔ booking/vendor + optional **`mediaSessionId`**) and **`/api/reviews/window/expire`** (auth + booking ownership).
- **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`:** Matrix and narrative updated; **`create`** / **`expire`** gaps marked resolved; **`window/start`** + **`prompt-event`** / **`sentiment`** kept as **lower-priority** follow-ups only.
- **`PROJECT_STATE.md`:** Short note on materially hardened trust loop vs optional server targets.

## 2026-04-12 — Review route server hardening pass
- **`POST /api/reviews/create`:** After `assertReviewWindowActive`, enforces **`reviewWindow.bookingId` / `vendorId`** match the submitted `bookingId` / `vendorId` (`409` + `REVIEW_WINDOW_CONTEXT_MISMATCH` on mismatch); rejects windows with empty **`mediaSessionId`** (`400`); if the client sends optional **`mediaSessionId`**, it must match the window (`409` + `REVIEW_WINDOW_MEDIA_MISMATCH`).
- **`POST /api/reviews/window/expire`:** Requires **`getUserIdFromRequest`** (`401`); loads **`booking`** by **`reviewWindow.bookingId`** and requires **`booking.userId`** match the caller (`403`); unchanged behavior for **active** windows once authorized. Non-active responses still require ownership.
- **`window/start` / `prompt-event` / `sentiment`:** Short **TODO** comments pointing to **`REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md`** for optional follow-up (no behavior change).

## 2026-04-12 — Review chain identity alignment
- **`SmartVideoPlayer`:** Optional prop **`userId`**; internal **`reviewApisEnabled`** = `reviewCaptureEnabled` ∧ trimmed `userId`. All review `fetch` calls (`/api/reviews/window/start`, `prompt-event`, `sentiment`, `create`, `window/expire`) send **`{ "Content-Type": "application/json", "x-user-id": userId }`** when capture is active. If `userId` is missing, **no** review APIs run — **watch-only** (consent logic on server unchanged when calls run).
- **`/my-bookings`:** Passes **`userId={resolveCustomerUserId(user?.id)}`** into `SmartVideoPlayer` (same source as booking list/media `x-user-id`).
- **`BOOKING_MEDIA_REVIEW_CHAIN_AUDIT.md`:** New §4 “Identity alignment” + updates to API headers, failure modes, and hardening list.

## 2026-04-12 — Booking media + review + consent chain audit
- **BOOKING_MEDIA_REVIEW_CHAIN_AUDIT.md:** End-to-end audit of entry points (`/my-bookings`, confirmation page, consent token page), UI/component chain, API routes (always vs conditional), identity/`x-user-id` vs consent-gated review start, business rules (media, playback, `reviewCaptureEnabled`, watch-only), failure modes, and scoped hardening notes.
- **BOOKING_MEDIA_REVIEW_FLOW_MAP.md:** Concise step-by-step flow map (my-bookings path, consent prerequisite, identity summary).

## 2026-04-12 — `/my-bookings` hardening pass
- **`src/lib/my-bookings.ts`:** Centralized booking status rules (terminal cancel vs cancel-in-progress vs completed), tab membership, cancel-button classification, schedule instant resolution with malformed-date fallbacks, search matching (including `client_name`), row sanitization for safe rendering, and sort helper.
- **`src/app/(user)/my-bookings/page.tsx`:** Uses shared helpers for filters, status display, cancel affordances (disabled + reason instead of ambiguous hide/show), search placeholder + accessible hint aligned to searchable fields, sanitized API rows, disabled Refresh while loading, disabled media load when `vendor_id` missing or load in flight, and passes `reviewCaptureEnabled` into the video player from status rules.
- **`src/components/reviews/SmartVideoPlayer.tsx`:** Optional `reviewCaptureEnabled` (default true) skips review window start and all review overlays when false; video remains playable with controls.
- **Docs:** `MY_BOOKINGS_HARDENING_NOTES.md` added; see that file for remaining backend dependencies and edge cases.

## 2026-04-12 — Handoff documentation refresh
- **ROUTE_MAP.md:** Regenerated full App Router page list (including `/admin/review-audit`, `/consent/[token]`); full API list (**102** routes) including consent, smart-review, availability check, admin review-audit, dev notifications test; updated “pages calling APIs”, dev-only, and resolved `/admin/vendors` / `/my-bookings` notes.
- **SCHEMA_MAP.md:** Corrected `Review` fields; documented `ReviewWindow`, `ReviewPromptEvent`, `ReviewSentiment`, `ConsentRecord`, `ConsentEvent`; expanded key relationships (consent + notification audit).
- **UI_MAP.md:** Aligned with current wiring — `/my-bookings` connected, `/consent/[token]`, admin vendors hub, Book New Service → Discover; removed stale “broken vendors” claim.
- **RELIANCE_PRODUCT_ALIGNMENT.md:** Expanded Prisma model inventory; API inventory updated (favorites, consent, availability check, review subroutes, admin audit); softened outdated auth stub wording; removed stale “availability/check missing” gap.
- **PROJECT_STATE.md:** Added “Handoff refresh” section pointing to the above.

## 2026-04-11 — Recovery + consolidation pass
- **ClientProviders:** Single canonical implementation in `src/components/ClientProviders.tsx` (tooltip + auth + optional MSW). `src/app/layout.tsx` now imports `@/components/ClientProviders`. Removed root `components/ClientProviders.tsx`.
- **Legacy components:** Moved former root-level admin/support prototypes into `components/legacy-pages-router/` with a README. Updated `pages/support.js` and `pages/notifications.js` import paths. Removed duplicate `components/ui/` tree; legacy modules use `@/components/ui/*` from `src/components/ui/`.
- **UI:** Added `src/components/ui/popover.tsx` (restored from pre-removal content) so typecheck passes for `legacy-pages-router/ReviewManagement.tsx`.
- **Cleanup:** Deleted unused `src/components/SupportTickets.tsx`. Replaced root `temp-create-job-check.cjs` with `scripts/dev/vendor-job-dashboard-persist-check.cjs` + `scripts/dev/README.md`.
- **Handoff:** Reconciled stale follow-up about `/admin/vendors` (see “What still needs follow-up” below).

## Files changed

### Environment and package
- `.env.local`
  - What changed: local environment file added/staged.
  - Why: local runtime setup.
  - Follow-up: unstage and keep out of commits.
- `.env.new`
  - What changed: alternate env file added/staged.
  - Why: local configuration variant.
  - Follow-up: unstage and keep out of commits.
- `package.json`, `package-lock.json`
  - What changed: dependency/runtime config updates.
  - Why: support newly added publish/media/favorites functionality.
  - Follow-up: verify clean install + lockfile consistency in CI.

### Governance and handoff docs
- `RELIANCE_PRODUCT_ALIGNMENT.md`
  - What changed: new/expanded product alignment notes.
  - Why: align implementation status to roadmap.
  - Follow-up: keep synchronized with actual route/schema status.
- `PROJECT_STATE.md`, `ROUTE_MAP.md`, `SCHEMA_MAP.md`, `UI_MAP.md`, `CHANGELOG_LATEST.md`
  - What changed: current handoff docs refreshed to latest codebase.
  - Why: provide accurate transfer/status artifacts.
  - Follow-up: rerun refresh after each substantial backend/frontend integration batch.
- `MEDIA_MODERATION_PLAN.md`, `PUBLIC_BROWSE_AUDIT.md`, `USER_SURFACE_AUDIT.md`
  - What changed: audit/planning docs added/updated.
  - Why: operational clarity for governance/public browse/user surface quality.
  - Follow-up: reconcile findings with implementation tickets.

### Database and Prisma
- `prisma/schema.prisma`
  - What changed: schema expanded for publishing controls, moderation, favorites, media governance, audit logs.
  - Why: enable admin governance + customer discovery + media lifecycle.
  - Follow-up: validate all migrations and route assumptions end-to-end.
- `prisma/migrations/migration_lock.toml`
  - What changed: migration lock updated.
  - Why: migration chain changed.
  - Follow-up: ensure migration history is clean on fresh DB.
- `prisma/migrations/20260408173000_add_publish_controls/*`
  - What changed: publish-control migration files added.
  - Why: vendor/service publish states.
  - Follow-up: verify deploy-safe SQL variant.
- `prisma/migrations/20260408190000_add_admin_audit_logs/migration.sql`
  - What changed: admin audit log table migration added.
  - Why: governance traceability.
  - Follow-up: ensure audit events are emitted by all admin mutation routes.
- `prisma/migrations/20260408201500_add_review_governance_foundation/*`
  - What changed: review moderation foundation migration added.
  - Why: review governance controls.
  - Follow-up: validate moderation visibility behavior in public endpoints.
- `prisma/migrations/20260409102000_add_favorites_foundation/*`
  - What changed: favorites storage foundation added.
  - Why: persist user favorites.
  - Follow-up: verify uniqueness/pagination and cross-page consistency.
- `prisma/migrations/20260409103000_mediaasset_moderation_foundation/migration.sql`
  - What changed: media moderation metadata migration added.
  - Why: moderation queue and state transitions.
  - Follow-up: verify index/select performance on moderation queue.

### Frontend pages
- `src/app/(user)/discover/page.tsx`
  - What changed: moved to connected discover + favorites flows.
  - Why: replace static discovery with API-backed listing.
  - Follow-up: finalize deferred filters when backend truth exists.
- `src/app/(user)/favorites/page.tsx`
  - What changed: connected favorites UI and remove action.
  - Why: persist user favorites.
  - Follow-up: add optimistic UI + better auth-edge handling.
- `src/app/(user)/service/[serviceId]/page.tsx`, `src/app/(user)/booking/[serviceId]/page.tsx`, `src/app/(user)/booking/[serviceId]/confirmation/page.tsx`
  - What changed: service/booking paths updated to current API contracts.
  - Why: support live booking and public media/service detail.
  - Follow-up: fully align with final booking lifecycle model.
- `src/app/(user)/bookings/page.tsx`, `src/app/(user)/my-bookings/page.tsx`
  - What changed: partial updates while still mixed with local/mock handling.
  - Why: incremental migration.
  - Follow-up: complete DB-backed list/action behavior.
- `src/app/browse/page.tsx`, `src/app/vendors/[vendorId]/page.tsx`
  - What changed: public browse/vendor profile path improvements.
  - Why: trust-safe public marketplace flow.
  - Follow-up: tighten consistency between browse cards and vendor public payload.
- `src/app/vendor/jobs/page.tsx`
  - What changed: major media/session integration updates.
  - Why: operational job workflow + media lifecycle.
  - Follow-up: split file and reduce complexity.
- `src/app/SidebarLayout.tsx`
  - What changed: navigation updates for new routes/features.
  - Why: expose new surfaces.
  - Follow-up: remove stale links and verify role-based visibility.
- `src/app/admin/reviews/page.tsx`, `src/app/admin/audit-logs/page.tsx`, `src/app/admin/media-moderation/page.tsx`, `src/app/admin/publish-management/page.tsx`
  - What changed: admin governance UIs added/expanded.
  - Why: moderation + publish controls + audit visibility.
  - Follow-up: harden admin auth and error states.

### API routes and backend logic
- Admin APIs added:
  - `src/app/api/admin/audit-logs/route.ts`
  - `src/app/api/admin/media/moderation-queue/route.ts`
  - `src/app/api/admin/media/[assetId]/moderate/route.ts`
  - `src/app/api/admin/publish/route.ts`
  - `src/app/api/admin/services/[serviceId]/publish/route.ts`
  - `src/app/api/admin/vendors/[vendorId]/publish/route.ts`
  - `src/app/api/admin/reviews/moderation-queue/route.ts`
  - `src/app/api/admin/reviews/[reviewId]/moderate/route.ts`
  - What changed: governance endpoints for publish/review/media/audit.
  - Why: move admin actions off mock logic.
  - Follow-up: enforce strict admin auth and add integration coverage.
- Public/vendor APIs added:
  - `src/app/api/vendors/[vendorId]/public/route.ts`
  - `src/app/api/vendors/[vendorId]/reviews/public/route.ts`
  - `src/app/api/services/discover/route.ts`
  - `src/app/api/services/categories/route.ts`
  - `src/app/api/services/[id]/media/route.ts`
  - What changed: public marketplace serving routes.
  - Why: support discover + vendor profile pages.
  - Follow-up: ensure only allowed public assets/reviews are exposed.
- Favorites APIs:
  - `src/app/api/users/favorites/route.ts`
  - `src/app/api/users/favorites/[id]/route.ts`
  - What changed: favorites persistence endpoints added/updated.
  - Why: support user discover/favorites flows.
  - Follow-up: enforce ownership checks + pagination contract stability.
- Booking/media/vendor updates:
  - `src/app/api/bookings/route.ts`
  - `src/app/api/bookings/[id]/route.ts`
  - `src/app/api/bookings/[id]/cancel/route.ts`
  - `src/app/api/bookings/[id]/media/route.ts`
  - `src/app/api/vendors/[vendorId]/dashboard/route.ts`
  - `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts`
  - `src/app/api/vendors/[vendorId]/media/route.ts`
  - `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts`
  - `src/app/api/vendors/[vendorId]/media/[assetId]/download/route.ts`
  - `src/app/api/vendors/[vendorId]/media/upload/init/route.ts`
  - `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`
  - `src/app/api/vendors/[vendorId]/media/sessions/route.ts`
  - `src/app/api/vendors/[vendorId]/media/sessions/[sessionId]/route.ts`
  - What changed: bookings + media/session pipeline and vendor ops improved.
  - Why: support job execution and media evidence lifecycle.
  - Follow-up: resolve dynamic route param warning, DB retry strategy, and download CORS edge cases.
- Service/vendor route adjustments:
  - `src/app/api/services/[id]/route.ts`
  - `src/app/api/vendors/[vendorId]/media/storage/route.ts` and related vendor storage endpoints
  - What changed: contract and payload refinements.
  - Why: align UI and backend for storage/governance.
  - Follow-up: finalize schema-contract docs and tests.

### Hooks, SDK, and shared libs
- `src/hooks/useFavorites.ts` (new), `src/sdk/favorites.ts` (new), `src/hooks/useServices.ts`, `src/sdk/services.ts`, `src/hooks/index.ts`
  - What changed: new favorites/discover integration and hook exports.
  - Why: React Query-backed API consumption for user marketplace.
  - Follow-up: cache invalidation and error normalization.
- `src/hooks/useMediaSessions.ts` (new), `src/hooks/useVendorMedia.ts`
  - What changed: media session workflow and upload coordination.
  - Why: unify job/media API interactions.
  - Follow-up: typed transition guards and retries.
- `src/lib/admin-audit.ts` (new), `src/lib/admin-auth.ts` (new), `src/lib/public-review-aggregates.ts` (new), `src/lib/media-visibility.ts` (new)
  - What changed: governance/public visibility helpers added.
  - Why: centralize policy logic and audit writing.
  - Follow-up: increase test coverage for policy edge cases.
- `src/lib/auth.ts`, `src/lib/membership-auth.ts`, `src/lib/api.ts`, `src/lib/azure-blob-storage.ts`, `src/server/db.ts`, `src/types/api.ts`
  - What changed: auth extraction, membership guards, API client/contracts, Azure storage logic, DB/runtime support.
  - Why: support new integrated workflows.
  - Follow-up: production hardening and secrets-safe logging.

### Other
- `scripts/dev/vendor-job-dashboard-persist-check.cjs` (formerly `temp-create-job-check.cjs` at repo root)
  - What changed: dev-only HTTP smoke check for booking + vendor dashboard; moved under `scripts/dev/` with README.
  - Why: keep the repo root free of ad-hoc scripts.
  - Follow-up: edit IDs/port in the script before running locally.

## What still needs follow-up
1. Remove `.env.local` and `.env.new` from staged changes before any commit.
2. ~~Fix the known broken page dependency in `/admin/vendors`.~~ **Done:** `/admin/vendors` uses a stable hub page (see `PROJECT_STATE.md`); no missing `VendorManagement` import.
3. Complete booking list/action migration to fully DB-backed behavior.
4. Align SDK endpoint expectations with actual implemented API routes.
5. Add integration tests for:
   - media upload init -> complete -> moderation -> download/public visibility
   - publish management and audit-log emission
   - favorites add/remove/list across discover and favorites pages
