# Media Execution Flow Audit (2026-04-27)

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

## Remaining Gaps
- Vendor media management page route target (`/vendor/media`) is missing, despite dashboard and profile linking to it.
- Jobs UI remains very large and partly legacy, making media-path regressions likely.
- Stage-complete and complete endpoints overlap responsibilities; workflow contract can still drift.
- Some compliance/consent orchestration is embedded in large UI logic rather than isolated workflow modules.
- No dedicated end-to-end pipeline test covering full chain: employee upload -> manager approve -> admin moderate -> customer proof -> review attribution.

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
