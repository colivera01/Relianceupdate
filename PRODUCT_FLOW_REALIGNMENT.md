# Product flow realignment: vendor-initiated service records vs booking-first

This document is an **audit and planning pass** only. It describes how the app is structured today, where it over-indexes on **customer booking first**, and how to evolve toward the **actual business model** (vendor starts the job → consent → media → moderation → customer transparency and review) without forcing a big-bang refactor.

---

## 1. Booking-first assumptions (where the code assumes “customer booked first”)

### 1.1 Customer hub and navigation

| Area | What assumes booking-first |
|------|----------------------------|
| **Primary customer nav** | `src/components/UserSidebar.tsx` exposes **“My Bookings”** as a top-level destination (`/my-bookings`). That frames the customer’s home journey around **bookings**, not **service records / jobs they’re attached to**. |
| **My Bookings page** | `src/app/(user)/my-bookings/page.tsx` loads **`GET /api/bookings`** and composes media, consent, and review UX from **booking rows** (see `src/lib/my-bookings.ts`). The customer’s “source of truth” for ongoing work is implicitly **a booking list**. |

**Implication:** Even if vendors initiate work in the real world, the **customer-facing product story** is “you have bookings”; anything else is secondary.

### 1.2 Customer media visibility (authorization and URLs)

| Area | What assumes booking-first |
|------|----------------------------|
| **Service-scoped media (customer audience)** | `src/app/api/services/[id]/media/route.ts` — for `audience=customer`, access is gated by **`prisma.booking.findFirst`** on `{ userId, serviceId }` (and optional `bookingId`). The file comment states booking-based auth. A customer without a **Booking** row for that service cannot see customer-facing media via this path, even if a vendor has a **MediaSession** for them. |
| **Booking-scoped media** | `src/app/api/bookings/[id]/media/route.ts` — listing is filtered by **`mediaSession.bookingId`**; the user must own the booking. Media is **namespaced under booking**, not under a neutral “service record” or “job” the customer understands. |

**Implication:** **Booking is the entitlement primitive** for customer media in the current API design.

### 1.3 Consent

| Area | What assumes booking-first |
|------|----------------------------|
| **Consent request API** | `src/app/api/consent/request/route.ts` **requires `bookingId`** (with `vendorId`, `mediaSessionId`). It loads **`Booking`** to resolve customer contact and ties **`ConsentRecord`** to that booking (see `prisma/schema.prisma` — `ConsentRecord.bookingId` is required). |

**Implication:** Consent cannot be requested in the product **without an existing booking**, even though in the business model consent often precedes or sits beside “scheduling” and is really about **this job / this media session with this customer**.

### 1.4 Review flow

| Area | What assumes booking-first |
|------|----------------------------|
| **Review window start** | `src/app/api/reviews/window/start/route.ts` requires **`bookingId`, `vendorId`, `mediaSessionId`** and validates that **`MediaSession.bookingId`** matches the supplied booking. |
| **Review create** | `src/app/api/reviews/create/route.ts` requires **`reviewWindowId`, `bookingId`, `vendorId`** and validates **`booking.userId`** and vendor relationship. |
| **Review window helper** | `src/lib/review-capture.ts` — `getOrCreateActiveReviewWindow` keys windows by **`bookingId` + `vendorId` + `mediaSessionId`**. |
| **Data model** | `ReviewWindow` in `prisma/schema.prisma` has **required `bookingId`** and relations to `Booking`. |

**Implication:** The entire **review capture lifecycle** is anchored on **Booking**, not on a vendor job or service record that could exist before any calendar concept.

### 1.5 Data model (structural coupling)

| Model | Booking coupling |
|-------|------------------|
| **`Booking`** | Central entity linking `userId`, `serviceId`, `vendorId` — appropriate as a **link table**, but today it is overloaded as **the** customer–work anchor. |
| **`MediaSession`** | Has **optional** `bookingId` and `serviceId` — the schema *allows* vendor-led sessions without a booking, but many flows **still require** booking for consent, review, and customer media. |
| **`ConsentRecord`** | **Required `bookingId`**. |
| **`ReviewWindow`** | **Required `bookingId`**. |

**Implication:** The **canonical business object** you want (vendor-initiated job / service record) is **not** first-class; **Booking** is, even when the real-world event is “vendor started a job and invited the customer.”

### 1.6 Vendor side (partial alignment)

Vendor workflows under **`src/app/vendor/jobs`** and vendor media APIs under **`/api/vendors/[vendorId]/...`** align better with “vendor initiates.” The gap is **customer-side** naming, navigation, and APIs that still **project everything through Booking**.

---

## 2. Primary product model (how to describe the system today vs how it should be framed)

### 2.1 Actual business model (target framing)

**Primary flow:**

1. **Vendor creates a job / service record** (work in progress for a specific customer context).
2. **Customer is attached** to that record (identity, contact, relationship to vendor/service).
3. **Consent is requested** for capturing/sharing media for that job.
4. **Media is uploaded** (sessions, assets) and passes **moderation**.
5. **Customer receives access** for transparency and **review** (ratings/feedback windows).

**Booking / calendar** is a **secondary** concern: scheduling a time slot may attach to the same job or create a related appointment, but it must not be the **only** way to create customer entitlement to media and reviews.

### 2.2 What the implementation actually enforces today

Today, steps 3–5 are largely implemented as:

- **Consent** → must have **`bookingId`**.
- **Review** → must have **`bookingId`** and consistent **`MediaSession.bookingId`**.
- **Customer media (service path)** → needs a **Booking** linking user + service.

So the **implemented** primary key for “customer is part of this work” is often **Booking**, not a neutral **service record id** or **customer job id**.

**Reconciliation for planning:** Reframe **Booking** in docs and UX as a **“customer–vendor work link”** or **“service engagement”** until a dedicated model exists — or introduce **`ServiceRecord` / `CustomerJob`** and gradually migrate. The important product point is: **the vendor initiates the record; the customer did not have to “book” first in the user’s mental model.**

---

## 3. Future booking / calendar model (secondary layer)

Treat **booking** as **scheduling and availability**, not as the root of consent, media, or reviews.

### 3.1 Responsibilities of the future booking layer

- **Calendar / availability** for the vendor.
- **Optional scheduled appointment** attached to an existing **service record** or **media session** (e.g. “site visit at 2pm”).
- **Reminders** and **ICS / notifications** where product needs them.
- **No hard dependency**: consent, upload, moderation, and customer gallery access should work for **walk-in / same-day / vendor-created** jobs **without** a scheduled slot.

### 3.2 Relationship to today’s `Booking` table

**Options (for later implementation, not decided here):**

- **Evolve `Booking`** into **“Engagement” / “ServiceRecord”** (rename + relax semantics): optional `scheduledStart` / `scheduledEnd`; booking-specific fields become nullable.
- **Add `ScheduledBooking`** (or `Appointment`) that **references** `serviceRecordId` / `mediaSessionId` instead of the reverse.
- **Make `bookingId` optional** on `ConsentRecord` and `ReviewWindow`, replacing required booking with **`customerUserId` + `vendorId` + `mediaSessionId`** (or **`serviceRecordId`**) plus integrity constraints.

The planning goal: **APIs and UI copy should not say “you must book” to unlock media or reviews.**

---

## 4. Deliverable sections

### 4.1 What is too booking-centric today

| Category | Issue |
|----------|--------|
| **Navigation & copy** | “My Bookings” as the main customer hub. |
| **Customer APIs** | Service customer media gated on **existence of Booking**; booking media route is **booking-id** in the path. |
| **Consent** | **Cannot** request consent without **`bookingId`**. |
| **Reviews** | Window + create + DB model all **require `bookingId`**. |
| **Mental model** | Customer sees **appointments/reservations**; vendor sees **jobs** — asymmetry that hides the real primary flow. |

### 4.2 Rename / reframe (current product, low-risk to high-impact)

| Current | Suggested reframe (UX / docs first) | Notes |
|---------|-------------------------------------|--------|
| “My Bookings” | **“My jobs”**, **“Service records”**, or **“Work with [vendors]”** | Pick one term and use consistently in nav, empty states, emails. |
| “Booking” (customer-facing) | **“Service”**, **“Job”**, **“Visit”**, or **“Engagement”** | Avoid implying the customer initiated scheduling unless they did. |
| Booking detail rows | Surface **vendor**, **service**, **status**, **media**, **consent**, **review** as the **job timeline** | Same data; different story. |
| Internal `bookingId` | Keep in code short-term; document as **“customer work link id”** in API specs | Reduces confusion for future contributors. |

### 4.3 Recommended canonical flow (what the product should communicate)

**Vendor-initiated (primary):**

1. Vendor creates/opens a **job / service record** for a customer (existing customer or invite).
2. Vendor requests **consent** for media tied to that job.
3. After acceptance, vendor **uploads**; system **moderates**.
4. Customer opens **their record** (not “booking list” as the only metaphor) to **view media** and complete **review** when the window opens.

**Customer-initiated scheduling (secondary, future or optional):**

5. Customer may **schedule** a time **on** an existing engagement or as a **new request** that creates an engagement — without being the prerequisite for steps 2–4.

### 4.4 Recommended future booking / calendar flow

- Vendor maintains **availability**.
- Customer (or vendor on behalf of customer) **books a slot**; the slot **links to** a **service record** (or creates one with `source=scheduled`).
- Notifications and calendar exports reference **appointment time**, not **media entitlement**.
- **Cancellation/reschedule** affects calendar state, not necessarily **consent** or **published media** (business rules TBD).

### 4.5 Priority order (adjust product without breaking what works)

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P0** | **Inventory & terminology** — align internal docs, support scripts, and UX copy with “vendor-initiated job / service record.” | Zero schema change; sets alignment for all future work. |
| **P1** | **Customer hub reframe** — rename “My Bookings” and page framing; keep **`/api/bookings`** and routes working. | Users see the right story; same backend. |
| **P2** | **Define a single customer-facing “record” concept** — even if backed by `Booking` + `MediaSession`, present one **timeline** per vendor/service. | Reduces booking-first mental load without new tables. |
| **P3** | **Introduce entitlement primitive** — e.g. `serviceRecordId` or rules: “customer may view media if `ConsentRecord.accepted` + `mediaSession` belongs to record + user is linked.” | Unblocks vendor-led jobs **without** forcing a booking row for every scenario (implementation can start with optional `bookingId`). |
| **P4** | **Migrate consent APIs** — allow consent anchor: **`(vendorId, mediaSessionId, customerUserId)`** or **`serviceRecordId`** with `bookingId` optional/legacy. | Removes artificial “create fake booking” pressure. |
| **P5** | **Migrate review APIs / `ReviewWindow`** — same as consent: anchor on **service record + media session**, booking optional. | Aligns review with real workflow. |
| **P6** | **Customer media routes** — add **service-record-scoped** or **session-scoped** customer endpoints; deprecate booking-only gating where redundant. | Cleaner URLs and auth for “my job’s media.” |
| **P7** | **Calendar / scheduling product** — ship as **add-on** once P3–P6 exist; avoid coupling moderation or review to slot state. | Prevents re-introducing booking as the root entity. |

**Guardrail:** For each step, keep **backward compatibility** for rows that already have `bookingId` populated; treat booking as **one valid linkage path**, not the only path.

---

## 5. Summary

- The codebase **centers customer entitlement and downstream flows on `Booking`**: nav (“My Bookings”), **customer media** auth, **consent**, and **reviews** all **require or assume** a booking.
- The **vendor job / media session** side is closer to the real primary flow, but **customer-facing** surfaces still read as **booking-first**.
- **Calendar booking** should become a **secondary layer** that attaches to a **service record**, not the prerequisite for consent, media, or reviews.
- **Recommended sequence:** copy and hub reframe first, then a shared **entitlement primitive**, then API/schema relaxation (`bookingId` optional), then a dedicated scheduling feature.

---

*Generated as a planning artifact for Reliance product–engineering alignment; implementation TBD per prioritized backlog.*
