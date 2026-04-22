# Vendor → employee → review → admin lifecycle (design pass)

Design-only document: proposes a structured operational lifecycle without requiring implementation in this step. Findings below reflect the current system: **vendor “jobs” are primarily `Booking` rows** surfaced via `GET /api/vendors/[vendorId]/dashboard`, with statuses normalized in UI; **admin moderation** applies to **`MediaAsset`** (e.g. `pending_review`, `approved`), not to a first-class “job lifecycle” field.

---

## 1. Proposed job status flow (canonical)

Use **UPPER_SNAKE_CASE** as the canonical stored form (aligned with existing `Booking.status` style: `PENDING`, `CONFIRMED`, etc.). UI labels can stay human-readable.

| Canonical status | Meaning (operational) |
|------------------|------------------------|
| **PENDING** | Job/service record exists; not yet committed to an assignee or start time (optional: customer booking pending). |
| **ASSIGNED** | Vendor has assigned one or more employees; work not started (or not acknowledged by assignee). |
| **IN_PROGRESS** | Employee has started work (on-site / active). |
| **AWAITING_VENDOR_REVIEW** | Employee marked work + media “ready for vendor review” (internal QA before customer-facing release). *(Alias for product copy: **AWAITING_REVIEW** when you mean vendor QA—not admin moderation.)* |
| **UNDER_ADMIN_REVIEW** | *(Optional at job level)* At least one asset is submitted for admin moderation; use **only** if you want a **job-level aggregate** flag. Today, **truth lives on `MediaAsset.moderationStatus`**—prefer keeping admin state there and deriving badges. |
| **COMPLETED** | Vendor accepted outcome; job closed from an operations perspective (may still have historical media). |
| **CANCELED** | Terminal: stopped. |
| **ARCHIVED** | Terminal: hidden from active lists; already used in codebase. |

### Lifecycle diagram (text)

```text
  [ CANCELED ]  (terminal; can be reached from multiple states — rules TBD)

  PENDING
     | assign employee(s)
     v
  ASSIGNED
     | employee accepts / starts work
     v
  IN_PROGRESS
     | upload media; mark ready for vendor review
     v
  AWAITING_VENDOR_REVIEW
     | vendor accepts outcome -> COMPLETED
     | (optional) media passes through admin moderation on MediaAsset
     v
  COMPLETED

  ARCHIVED  (terminal housekeeping; can be applied from several states)

  Note: Admin moderation remains primarily on MediaAsset (pending_review -> approved, etc.).
  A job-level UNDER_ADMIN_REVIEW flag, if used, should be a derived aggregate, not the source of truth.
```

**Relationship to admin moderation:** In the current product, **admin moderates assets**, not bookings. A practical rule is:

- **Do not duplicate** full moderation state on the booking unless you need a coarse “this job has blocking moderation” flag for vendor dashboards.
- **Derive** “has pending admin review” from linked sessions/assets (`pending_review`, etc.).

If you add **UNDER_ADMIN_REVIEW** at job level, define it strictly as a **cache/aggregate** updated when assets transition, with **`MediaAsset` remaining source of truth**.

---

## 2. Role responsibilities

### Employee (field / assignee)

| Action | Proposed trigger | Notes vs today |
|--------|------------------|----------------|
| Accept assignment | Transition **ASSIGNED → IN_PROGRESS** (or **ASSIGNED → ASSIGNED** + `acceptedAt` if you want a sub-state) | **Gap:** no employee-scoped job UI or membership-gated “accept” API surfaced as first-class. |
| Start job | Same as accept, or explicit “start” timestamp | Today **CONFIRMED** maps to “in progress” in the dashboard without employee granularity. |
| Upload media | Allowed in **IN_PROGRESS** (and possibly **AWAITING_VENDOR_REVIEW** if rework) | Exists via vendor media upload flows; **not clearly gated** by employee vs vendor. |
| Mark ready for vendor review | **IN_PROGRESS → AWAITING_VENDOR_REVIEW** | **Gap:** no dedicated status; vendor may mark complete or upload without this step. |

### Vendor (business owner / dispatcher)

| Action | Proposed trigger | Notes vs today |
|--------|------------------|----------------|
| Assign employee | **PENDING → ASSIGNED** (or **ASSIGNED** update) | **Partial:** `ASSIGN_JOB` persists assignees (e.g. in metadata); not a distinct lifecycle status. |
| Review submitted media | In **AWAITING_VENDOR_REVIEW**, approve or request changes | **Gap:** review is implicit; media moderation is admin-centric in data model. |
| Mark job complete | **AWAITING_VENDOR_REVIEW → COMPLETED** (or skip intermediate if policy allows) | Maps to existing **COMPLETED** booking status after mapping work. |

### Admin

| Action | System locus | Notes vs today |
|--------|--------------|----------------|
| Moderate media (approve / reject / flag / visibility) | **`MediaAsset`** (+ visibility) | Implemented; admin UI and APIs exist. |
| Optional: block customer release | Enforce “customer-visible only when `moderationStatus = approved`” | Already consistent with customer media routes that filter approved + visibility. |

---

## 3. Current gaps (grounded in codebase behavior)

1. **Job = booking mapping is coarse**  
   Dashboard maps `Booking.status`: `PENDING` → “scheduled”, `CONFIRMED` → “in progress”, `COMPLETED` → “completed”, etc. There is **no** `ASSIGNED`, **no** `AWAITING_VENDOR_REVIEW`, and **no** employee-driven transition.

2. **Employee interaction is largely missing**  
   Assignees appear as strings from **`customerMetadata`** (`extractAssignedEmployeesFromMetadata`); there is no standard **employee portal** flow for accept / start / submit-for-review tied to auth.

3. **Vendor “complete” vs media pipeline**  
   `deriveMediaPurposeFromJobStatus` only splits **completion** vs **progress** from job status. Vendors can drive uploads and status updates **without** a formal employee “ready for review” step—so **vendor actions can occur “early”** relative to the ideal field-then-review sequence.

4. **Admin review is asset-level, not job-level**  
   Vendor jobs UI shows **Media: Pending Review** from **video/asset** moderation (`getJobMediaModerationSummary`). That is correct technically but **confusing operationally** if users expect a single “job status” for “with admin.”

5. **Status transition rules are implicit**  
   `PATCH .../jobs/[jobId]/actions` maps UI statuses back to `Booking.status` (`normalizeUiStatusToBookingStatus`). New lifecycle states require **explicit mapping**, validation, and migration of existing rows.

---

## 4. Proposed minimal changes (compatibility-preserving)

### Principles

- Keep **`Booking` (job id)** and **existing media sessions/assets** stable.
- Introduce lifecycle as **either** (a) extended `Booking.status` enum **or** (b) a **parallel field** (e.g. `operationalStatus` / JSON metadata) with a **legacy mapping** from current `PENDING | CONFIRMED | COMPLETED | CANCELED | ARCHIVED`.

### Recommended: parallel operational field (lowest blast radius)

- Add something like **`booking.operationalStatus`** (or structured JSON in `customerMetadata` under a reserved key `relianceOps: { phase, ... }`) with the new enum.
- Continue populating **legacy `Booking.status`** for customer/booking flows until those are refactored.
- Dashboard mapping reads **operational** first, falls back to legacy.

### Alternative: extend `Booking.status`

- Add Prisma enum values **only** with a migration and a **single mapping table** (old → new) for backfill:
  - `PENDING` → `PENDING` or split into `PENDING` vs `ASSIGNED` using assignee presence.
  - `CONFIRMED` → `IN_PROGRESS` or `ASSIGNED` based on rules (e.g. if `assignedEmployees` empty → `IN_PROGRESS` vendor-led).

This is **higher risk** for anything that assumes only five booking statuses.

### Admin / media

- **No change required** to moderation semantics for minimal rollout; optionally add **job-level derived flags** in API responses (`hasPendingAdminMedia`, `hasRejectedMedia`) for UI clarity.

---

## 5. Required status additions (summary)

| New / clarified canonical | Purpose |
|---------------------------|---------|
| **ASSIGNED** | Vendor assigned employee(s); work not started. |
| **IN_PROGRESS** | Work started (employee or vendor-led—policy defines who can set). |
| **AWAITING_VENDOR_REVIEW** | Employee submitted media / marked ready; vendor must review before treating as done. |
| **UNDER_ADMIN_REVIEW** | *(Optional job-level aggregate)* “Some linked asset is in admin queue.” Prefer derivation from `MediaAsset` unless reporting needs a persisted flag. |

Existing **PENDING**, **COMPLETED**, **CANCELED**, **ARCHIVED** stay; **CONFIRMED** today should be **split conceptually** into **ASSIGNED** vs **IN_PROGRESS** over time.

---

## 6. Minimal implementation plan

### P0 — Documentation + API contract (no breaking changes)

- Publish the canonical lifecycle and **legacy mapping** from current dashboard statuses.
- Extend dashboard DTO with **optional** fields: `operationalStatus`, `hasPendingAdminMedia`, `awaitingVendorReview` (all derivable initially from rules + asset queries).

### P1 — Persist minimal operational state

- Add **`operationalStatus`** (or metadata) + timestamps: `assignedAt`, `startedAt`, `submittedForVendorReviewAt`, `vendorReviewedAt`, `completedAt`.
- Wire **vendor** actions: assign → `ASSIGNED`; vendor “mark complete” only from **AWAITING_VENDOR_REVIEW** or policy-approved shortcuts.
- Gate **employee** actions behind membership role APIs (even if UI is vendor-only at first: “on behalf of employee”).

### P2 — Employee surface + strict transitions

- Employee portal (or mobile): accept, start, upload, **submit for review**.
- Server-side **state machine** validation (reject illegal transitions).
- Optional: job-level **UNDER_ADMIN_REVIEW** aggregate maintained by triggers or application hooks on asset moderation changes.

---

## 7. Deliverable checklist

| Item | Location |
|------|----------|
| Lifecycle diagram | §1 (above) |
| Required status additions | §5 |
| Minimal implementation plan | §6 (P0 / P1 / P2) |
| Role responsibilities | §2 |
| Current gaps | §3 |
| Compatibility strategy | §4 |

---

*This document is the single design artifact for the workflow; implementation tickets should reference §6 priorities.*
