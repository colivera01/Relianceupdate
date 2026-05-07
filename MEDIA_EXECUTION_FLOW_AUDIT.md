# Media Execution Flow Audit (refreshed 2026-05-06)

> **Status:** Full lifecycle is verified end-to-end against live Azure SQL by `e2e/reliance-trust-loop.spec.ts` ("full proof-to-review trust loop (live routes)"). Last green run: 2026-05-06.

## Canonical lifecycle (one booking, one trust loop)

```
[customer]                [employee]                  [manager]               [admin]                [customer]              [customer]
  Book Service  ─►  Upload INTRO + IN_PROGRESS + COMPLETED  ─►  Approve  ─►  Moderate package (visibility)  ─►  View Proof  ─►  Submit Review
                                                                                                                          │
                                                                                                                          ▼
                                                                                                        [vendor dashboard]
                                                                                                        Attribution + ratingCount
```

| # | Step | Frontend surface | API route | Booking status before | Booking status after |
|---|---|---|---|---|---|
| 1 | Customer creates booking | `/discover` → `/service/[id]` → `/booking/[id]` → `/booking/[id]/confirmation` | `POST /api/bookings` | n/a | `PENDING` |
| 2 | Manager assigns employee | `/vendor/jobs` | `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` (`ASSIGN_JOB`) | `PENDING` | `ASSIGNED` |
| 3 | Employee uploads stages | `/employee/jobs` | `POST /api/employee/jobs/[jobId]/stage` (`INTRO`/`IN_PROGRESS`/`COMPLETED`) | `IN_PROGRESS` | `IN_PROGRESS` until last stage → `AWAITING_REVIEW` |
| 4 | Manager approves completion | `/vendor/jobs` | `POST /api/vendors/[vendorId]/jobs/[jobId]/approve` | `AWAITING_REVIEW` | `COMPLETED` (assets re-queued `pending_review`) |
| 5 | Admin moderates package | `/admin/media-moderation` | `PATCH /api/admin/media/packages/[bookingId]/moderate` (`approve` + `visibility`) | `COMPLETED` | `COMPLETED` (assets `approved` + visibility set) |
| 6 | Customer views proof | `/my-bookings/[bookingId]` (with `?proofReady=1` deep link) | `GET /api/bookings/[id]` + `GET /api/bookings/[id]/media` | `COMPLETED` | unchanged |
| 7 | Customer submits review | In-video overlay or `/reviews` | `POST /api/reviews/window/start` → `POST /api/reviews/create` | `COMPLETED` | unchanged; review row created with attribution |

Manager rejection branch (3a) — `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` requires `rejectionReason`, returns booking to `IN_PROGRESS`, persists `rejectionReason` / `rejectedAt` / `rejectedBy`. Employee then re-uploads, clearing rejection metadata, and the booking re-enters `AWAITING_REVIEW`.

## Employee Upload Stages
- Employee starts assigned job: `POST /api/employee/jobs/[jobId]/start`.
- Employee stage completion endpoint: `POST /api/employee/jobs/[jobId]/stage` with `INTRO`, `IN_PROGRESS`, `COMPLETED`.
- Stage endpoint verifies that stage media exists before allowing progression.
- When all three required stages have uploaded media, booking transitions to `AWAITING_REVIEW`.
- Employee complete endpoint (`POST /api/employee/jobs/[jobId]/complete`) also enforces required stages and sets `AWAITING_REVIEW`.

## Manager Submit / Approve / Reject Loop
- Direct complete-by-status is blocked in vendor actions route (`MANAGER_APPROVAL_REQUIRED`).
- Manager approve endpoint: `POST /api/vendors/[vendorId]/jobs/[jobId]/approve`.
  - Requires `AWAITING_REVIEW`.
  - Requires complete 3-stage package.
  - Sets booking to `COMPLETED`.
  - Re-queues stage assets to `pending_review` for admin moderation.
- Manager reject endpoint: `POST /api/vendors/[vendorId]/jobs/[jobId]/reject`.
  - Requires `rejectionReason`.
  - Requires `AWAITING_REVIEW`.
  - Moves booking back to `IN_PROGRESS` and stamps rejection fields.

## Admin Moderation
- Queue route: `GET /api/admin/media/moderation-queue`.
  - Builds package views from latest `INTRO/IN_PROGRESS/COMPLETED` assets per booking.
- Package moderation route: `PATCH /api/admin/media/packages/[bookingId]/moderate`.
  - Supports `approve`, `reject`, `flag`.
  - Approve requires visibility (`public`, `customer_only`, etc.).
  - Reject requires `moderationReason`.

## Customer Proof View
- Customer media route: `GET /api/bookings/[id]/media`.
  - Enforces booking ownership (`booking.userId` must match requester).
  - Returns approved + active assets with customer-safe visibility only.
  - Applies proof policy to include only customer-appropriate assets/stages.
- Download route used by UI: `/api/bookings/[id]/media/[assetId]/download`.

## Notification Flow
- On package approve with `customer_only` or `public` visibility, moderation route sends proof-ready email (best effort).
- Notification audit logs are written via notification audit utilities.
- Booking metadata stores anti-spam marker (`proof_ready_notification_sent_at`) to avoid duplicate sends on re-approve.

## Review Attribution
- Review creation route (`POST /api/reviews/create`) enforces:
  - active review window
  - booking/vendor/window context match
  - booking ownership by customer
  - unique review-per-booking semantics
- Attribution fields persisted:
  - `assignedMembershipId`
  - `assignedEmployeeName`
  - `assignedUserId`
  - `attributionVersion`
- Vendor dashboard consumes attribution aggregates for employee performance/ranking.

## Remaining Gaps (refreshed 2026-05-06)
- `/vendor/media` and `/vendor/storage` pages now exist (resolved 2026-04-27); card-level metrics on the vendor dashboard still partially pending backend wiring.
- Jobs UI remains large and mixed-responsibility; media-path regression risk persists, but the manager review gate is now hard server-side so client misuse cannot bypass it.
- Stage-complete and complete endpoints still overlap (`POST /api/employee/jobs/[jobId]/stage` with `COMPLETED` stage vs. `POST /api/employee/jobs/[jobId]/complete`); workflow contract is consistent in practice but worth consolidating later.
- Consent orchestration lives in `SmartVideoPlayer` + per-route logic; isolated workflow modules are still desirable but no longer blocking the trust loop.
- **Resolved:** the dedicated end-to-end pipeline test exists and passes (`e2e/reliance-trust-loop.spec.ts`) covering employee upload → manager approve → admin moderate → customer proof → review attribution.

## Live verification (2026-05-06)
- `npx playwright test e2e/reliance-trust-loop.spec.ts` → `1 passed (3.3m)` against Azure SQL (`relianceorgsqlserver.database.windows.net / reliance-db`).
- Booking under test: `cmouv7gmr0001so1gdk3d5is5` (auto-created by the spec).
- Customer-visible approved media count after admin approval: 3 (one per stage), all `visibility=customer_only`.
- Vendor dashboard post-loop: `stats.ratingCount > 0`, `employeePerformance` includes assigned membership, `linkedMediaCount=3` and `linkedSessionCount=3` on the loop's job.

---

## Operational Checklist: Proof-to-Review Trust Loop

### 1) Employee Stage Upload
- **Required status before step:** `PENDING` or `IN_PROGRESS`/`CONFIRMED` (assigned employee context).
- **Action/endpoint:** Employee uploads stage media and marks stage via `POST /api/employee/jobs/[jobId]/stage` (`INTRO` / `IN_PROGRESS` / `COMPLETED`).
- **Expected status after step:** Stays in execution state until all required stages exist; then transitions to `AWAITING_REVIEW`.
- **Who can perform it:** Assigned active employee (or equivalent authorized execution actor).
- **Main failure cases:** `401` unauthorized, `403` not assigned/no membership, `404` job not found, `409 STAGE_VIDEO_REQUIRED`, invalid stage payload.

### 2) Submit for Manager Review
- **Required status before step:** Required stage proofs uploaded (`INTRO`, `IN_PROGRESS`, `COMPLETED`).
- **Action/endpoint:** Finalize execution path to review state via employee flow (`POST /api/employee/jobs/[jobId]/complete`) or stage progression completion.
- **Expected status after step:** `AWAITING_REVIEW`.
- **Who can perform it:** Assigned employee (manager bypass only where explicitly allowed by route rules).
- **Main failure cases:** `409 REQUIRED_STAGES_MISSING`, `403` assignment mismatch, `401` auth failure.

### 3) Manager Approve / Reject
- **Required status before step:** `AWAITING_REVIEW`.
- **Action/endpoint:**  
  - Approve: `POST /api/vendors/[vendorId]/jobs/[jobId]/approve`  
  - Reject: `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` (requires `rejectionReason`)
- **Expected status after step:**  
  - Approve -> `COMPLETED` (+ staged assets reset to moderation queue)  
  - Reject -> `IN_PROGRESS`
- **Who can perform it:** Active vendor manager only.
- **Main failure cases:** `403` non-manager, `409 INVALID_APPROVAL_STATUS` / `INVALID_REJECTION_STATUS`, `400 REJECTION_REASON_REQUIRED`, `409 COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE`.

### 4) Admin Moderation
- **Required status before step:** Complete 3-stage package exists; assets queued `pending_review`.
- **Action/endpoint:**  
  - Queue view: `GET /api/admin/media/moderation-queue`  
  - Package decision: `PATCH /api/admin/media/packages/[bookingId]/moderate` (`approve`/`reject`/`flag`)
- **Expected status after step:** Moderation + visibility set on package assets; rejected/flagged remain restricted.
- **Who can perform it:** Admin only.
- **Main failure cases:** `403` non-admin, `422` invalid action/visibility/reason, `422 Incomplete package`, `404 booking not found`.

### 5) Customer Proof Access
- **Required status before step:** Asset approved and visibility customer-eligible (`customer_only`/`public` path).
- **Action/endpoint:** `GET /api/bookings/[id]/media` (+ download route for asset fetch).
- **Expected status after step:** Customer can list/view allowed proof assets for owned booking.
- **Who can perform it:** Booking owner (authenticated customer).
- **Main failure cases:** `401` unauthenticated, `403` booking ownership mismatch, `404` booking not found, empty asset list when visibility/moderation not satisfied.

### 6) Review Attribution
- **Required status before step:** Valid active review window tied to booking/vendor/media context.
- **Action/endpoint:** `POST /api/reviews/create`.
- **Expected status after step:** Review created with attribution fields (`assignedMembershipId`, `assignedUserId`, `assignedEmployeeName`); window closed/submitted.
- **Who can perform it:** Booking customer only.
- **Main failure cases:** `401` auth required, `403` non-owner submit, `409 REVIEW_ALREADY_EXISTS`, `409 REVIEW_WINDOW_CONTEXT_MISMATCH`, invalid window/media linkage errors.

### 7) Expected Failure Codes / Blockers
- `MANAGER_APPROVAL_REQUIRED` when trying to force completion outside manager gate.
- `COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE` when approval attempted without full stages.
- `STAGE_VIDEO_REQUIRED` / `REQUIRED_STAGES_MISSING` when stage evidence is incomplete.
- `REJECTION_REASON_REQUIRED` when manager reject lacks reason.
- `FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED` / assignment-forbidden errors for role or membership mismatch.
- Moderation validation blockers: invalid action/visibility/reason, incomplete package.
- Customer trust blockers: booking ownership mismatch, not-approved/not-visible proof, review window mismatch/expiry.

### 8) End-to-End Test Checklist
- Employee uploads all 3 stages and confirms transition to `AWAITING_REVIEW`.
- Manager reject path returns job to `IN_PROGRESS` and records rejection reason.
- Employee re-submits corrected package and returns to `AWAITING_REVIEW`.
- Manager approve path sets `COMPLETED` and re-queues package assets for admin moderation.
- Admin approves package with customer-visible setting; verify moderation/visibility persisted.
- Customer can fetch proof via booking media route and access expected stage assets.
- Customer submits review successfully; verify attribution fields persisted and surfaced in vendor performance aggregates.
