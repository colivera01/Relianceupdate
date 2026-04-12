# E2E smoke test plan (minimal)

**Date:** 2026-04-11  
**Purpose:** Define a **small** set of end-to-end checks that exercise the **full customer journey** in the browser (or Playwright/Cypress equivalent), without replacing route-level integration tests or attempting full regression coverage. **Implementation is out of scope** until tooling and environments are agreed.

**Assumptions:** A logged-in **customer** session (cookie/header strategy TBD), seed or staging data with at least one bookable **service** and **vendor**, and stable selectors (roles, labels, or `data-testid` added when implementing).

---

## 1. Booking create → confirmation → my-bookings visibility

| | |
|---|---|
| **Entry page** | `/discover` or `/service/[serviceId]` (deep link acceptable if discover is heavy). |
| **Steps** | 1. Open a service that shows booking affordance and navigate to `/booking/[serviceId]`. 2. Choose date/time (and any required fields the wizard exposes). 3. Submit booking; wait for navigation to `/booking/[serviceId]/confirmation?bookingId=…`. 4. Assert confirmation shows the persisted booking id (or human-readable summary tied to that id). 5. Navigate to `/my-bookings` (or follow in-app link if present). 6. Assert the new booking appears in the list (same id or stable title/date). |
| **Expected result** | Booking persisted via real **`POST /api/bookings`**; confirmation URL carries **`bookingId`**; **my-bookings** reflects the new row without manual refresh tricks (or with a single explicit refresh if the UI is pull-only—document whichever matches product behavior). |
| **Mocked vs real** | **Real:** Next app routes, booking API, DB (or env that points at a disposable test DB). **Mock (optional):** external email/SMS/payment gateways if wired later; map tiles or analytics only if they block CI. **Avoid mocking** Prisma or `/api/bookings` in this smoke—otherwise it is not E2E for persistence. |

---

## 2. Favorites toggle across discover / service / favorites

| | |
|---|---|
| **Entry page** | `/discover`. |
| **Steps** | 1. From discover, open a card or link to `/service/[serviceId]`. 2. Toggle favorite **on** (heart or equivalent); assert UI state. 3. Open `/favorites`; assert the service appears. 4. Return to `/service/[serviceId]` (or discover) and toggle **off**. 5. Reload `/favorites`; assert the service is gone (or empty state if it was the only favorite). |
| **Expected result** | Favorites list stays consistent with per-page toggle state; identity matches the logged-in customer (same as integration contract: auth header / cookie). |
| **Mocked vs real** | **Real:** **`GET/POST/DELETE`** favorites APIs and DB. **Mock (optional):** heavy third-party media or review aggregate calls **only if** they are flaky in CI and are not the subject of this smoke—prefer real with seeded small payloads. |

---

## 3. Review flow happy path (start → create)

| | |
|---|---|
| **Entry page** | Context that already has a **completed (or review-eligible) booking** with **media session** and **accepted video_access consent**—e.g. deep link from **`/my-bookings`** into the experience that triggers review UI, or a dedicated test harness page **only if** product adds one. If consent is a separate **`/consent/[token]`** step, include it once in the scenario as a real navigation. |
| **Steps** | 1. From the chosen entry, trigger **review window start** (UI action that calls **`POST /api/reviews/window/start`** or equivalent client hook). 2. Assert success (toast, overlay, or inline state). 3. Complete minimal review submission (rating + required fields) so **`POST /api/reviews/create`** runs. 4. Assert success feedback and/or that the review appears under **`/reviews`** or the booking detail surface the app uses. |
| **Expected result** | Window start returns **200** with **`created`** true/false handled gracefully; create returns **200** and persisted review is visible in the customer UI. |
| **Mocked vs real** | **Real:** booking, media session, consent record, review window, and review create through APIs + DB. **Mock:** reminder/notification side jobs (e.g. **`scheduleReviewReminder`**) if they enqueue external work; optional **admin audit** if it calls external sinks. **Do not mock** consent decision or core review CRUD for this smoke—those are the trust path under test. |

---

## Cross-cutting notes (all scenarios)

- **Auth:** One stable customer login path (fixture user or OTP stub—document when implementing).
- **Data:** Prefer idempotent seeds (known `serviceId` / `vendorId`) so selectors stay stable.
- **CI:** Run this suite on a **labeled** job (nightly or pre-release), not on every PR, unless runtime is proven short.
- **Failure signals:** Network 4xx/5xx, console errors, and broken navigation between the listed routes should fail the smoke.

---

## Out of scope (for this minimal plan)

- Vendor and admin surfaces, full calendar math, media upload pipelines, and exhaustive validation matrices (covered by **`*.integration.test.ts`** and future broader E2E).
