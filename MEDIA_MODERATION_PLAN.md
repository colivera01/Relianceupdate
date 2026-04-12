# Media Moderation and Visibility Plan

## Objective
Build a safe, explicit moderation workflow where vendor-uploaded media is private by default, admin is final authority for publication scope, and future AI moderation can assist without replacing human review.

## Current State (Audit)

### Models
- `MediaAsset` currently stores storage/linkage data (`vendorId`, `mediaSessionId`, `bytes`, `mimeType`, `blobKey`, `blobUrl`, `deletedAt`), but no explicit moderation/visibility fields.
- `MediaSession` currently stores workflow status in `status` and job linkage (`bookingId`, `serviceId`, etc.).
- `deletedAt` on `MediaAsset` is already used as soft-archive/delete marker.

### Routes
- Vendor media list route: `GET /api/vendors/[vendorId]/media` supports `includeDeleted=true`.
- Media session routes:
  - `GET/POST /api/vendors/[vendorId]/media/sessions`
  - `GET/PATCH /api/vendors/[vendorId]/media/sessions/[sessionId]`
  - Session status currently mixes upload lifecycle and review concepts.
- Asset route:
  - `DELETE /api/vendors/[vendorId]/media/[assetId]` soft-deletes via `deletedAt`.
  - `PATCH /api/vendors/[vendorId]/media/[assetId]` restore action exists.

### Gap
- No first-class separation of:
  - moderation decision
  - visibility decision
  - archive state
- No admin moderation queue route/UI currently tied to explicit moderation fields.

## Proposed State Model

Use explicit fields on `MediaAsset` for governance, keep `MediaSession.status` for capture/upload technical lifecycle.

### A) moderationStatus
- `pending_review`
- `approved`
- `rejected`
- `flagged`

### B) visibilityStatus
- `private`
- `customer_only`
- `public`
- `vendor_archive_only`

### C) archiveStatus
- `active`
- `archived`

## Minimal Schema Additions (Low-Risk)

### `MediaAsset` (recommended)
- `moderationStatus String @default("pending_review")`
- `visibilityStatus String @default("private")`
- `archiveStatus String @default("active")`
- `moderationReason String?` (admin rejection/review note)
- `moderatedAt DateTime?`
- `moderatedByUserId String?` (nullable until admin-user model relationship is finalized)
- `uploadedByMembershipId String?` (optional convenience for moderation queue display)

### AI-ready optional fields (advisory only)
- `aiModerationStatus String?` (`pending`, `clean`, `flagged`, `error`)
- `aiModerationScore Float?`
- `aiModerationLabels String?` (JSON string for now)
- `reviewRequired Boolean @default(true)`
- `aiModeratedAt DateTime?`

Notes:
- Keep existing `deletedAt` for backward compatibility.
- `archiveStatus` and `deletedAt` can coexist short-term; long-term, move UI logic to `archiveStatus` while preserving `deletedAt` for storage cleanup semantics.

## Route Changes Needed

### 1) Vendor-facing routes (read-only moderation visibility)
- Extend `GET /api/vendors/[vendorId]/media` response with:
  - `moderationStatus`
  - `visibilityStatus`
  - `archiveStatus`
  - `moderationReason`
  - `moderatedAt`
- Restrict vendor mutation routes so vendor cannot set public/customer visibility directly.

### 2) Admin moderation routes (new)
- `GET /api/admin/media/moderation-queue`
  - filters: status/date/vendor/employee/job/serviceType/search
  - returns queue rows with preview metadata
- `PATCH /api/admin/media/[assetId]/moderate`
  - actions:
    - approve_public
    - approve_customer_only
    - approve_vendor_archive_only
    - reject
    - flag
  - writes moderation + visibility fields

### 3) Public/customer visibility-aware read routes
- Public feeds/profile endpoints must only return media where:
  - `moderationStatus = approved`
  - `visibilityStatus = public`
  - `archiveStatus = active`
- Customer-specific views should allow:
  - `moderationStatus = approved`
  - `visibilityStatus in ("customer_only","public")`
  - plus ownership/authorization checks

### 4) Asset lifecycle routes
- Keep `DELETE` as soft/archive-safe behavior.
- Keep restore route.
- Add explicit archive/unarchive action route later to reduce ambiguity between delete/archive semantics.

## Admin Moderation Queue Workflow

Queue row should show:
- thumbnail/preview
- media title
- vendor name
- uploader/employee
- linked job
- client
- upload date
- moderation status
- current visibility status

Admin actions:
- Approve Public
- Approve Customer Only
- Approve Vendor Archive Only
- Reject (with reason)
- Flag (optional high-risk hold)
- Request resubmission (phase 2; can be represented by `rejected + reason` for now)

Decision outcomes:
- Approved + visibility set -> visible in corresponding channel(s)
- Rejected -> hidden from customer/public, visible to vendor with reason
- Flagged -> hidden pending further admin action

## Vendor Workflow

Vendor sees all own uploads with:
- moderation status
- visibility status
- archive state
- rejection reason (if rejected)

Vendor can:
- upload
- view own media
- archive/restore own media (policy permitting)

Vendor cannot:
- directly publish to public/customer channels when admin review is required.

## Customer/Public Visibility Rules

### Public
- Only `approved + public + active`.

### Customer
- Only `approved + (customer_only or public) + active`.
- plus customer/vendor/job authorization policy.

### Vendor profile archive area
- `approved + vendor_archive_only` (and optionally approved public/customer media if desired by product policy).

## Content Archive Reframe (Media Only)

The Content Archive should be strictly media-focused and not mixed with Job Archive:
- list media assets
- show moderation status, visibility status, archive state
- filters:
  - status
  - date
  - employee
  - job
  - service type
- search:
  - title
  - job
  - client

Per-item actions by role:
- Vendor: view, archive/restore, (delete if allowed), see moderation outcomes
- Admin: moderation decisions + visibility assignment

## AI Moderation Readiness (Advisory-First)

### Phase approach
1. Upload completes -> queue AI scan asynchronously.
2. Store AI outputs on `MediaAsset` (score/labels/status/reviewRequired).
3. Admin queue highlights flagged items first.
4. Admin final decision always overrides AI.

### Guardrails
- AI never auto-publishes.
- AI rejection is advisory; admin confirms final reject/approve.
- Keep full audit trail of AI result + admin decision.

## Recommended Implementation Order

1. **Schema migration (minimal fields on `MediaAsset`)**
2. **Extend vendor media list response with moderation/visibility/archive fields**
3. **Create admin moderation queue and moderation action route**
4. **Apply visibility filtering in public/customer read routes**
5. **Wire vendor Content Archive UI to new fields (status chips + filters)**
6. **Add AI advisory fields + async screening pipeline hooks**
7. **Add audit log trail for moderation decisions**

## Safe Targeted Steps (Immediate)

1. Add `moderationStatus`, `visibilityStatus`, `archiveStatus` defaults in schema.
2. Update upload-complete flow to initialize:
   - `moderationStatus = pending_review`
   - `visibilityStatus = private`
   - `archiveStatus = active`
3. Add admin moderation PATCH route and enforce role checks.
4. Update vendor archive UI to read these fields and disable any vendor-publication controls.

## Admin-Only Follow-up

- Completed governance policy for disputed/appealed rejections.
- Admin bulk actions and SLA rules for pending queue.
- Audit/reporting endpoints for moderation metrics and legal compliance.
