# RELIANCE PRODUCT ALIGNMENT (Current Codebase)

**Last refreshed:** 2026-04-12.

This document reflects the current implementation in this repository only (frontend `src/app`, Next API routes in `src/app/api`, Prisma models in `prisma/schema.prisma`, and legacy Express backend in `backend/src`).

## 1. EXISTING MODELS

### Primary data model (active app path: Prisma + Next API)
Defined in `prisma/schema.prisma`:

- `Vendor`
- `Employee`
- `Service`
- `User`
- `Booking`
- `Review`
- `Device`
- `DevicePairingCode`
- `VendorMembership`
- `VendorInvite`
- `DeviceAssignment`
- `MediaAsset`
- `VendorStorageAlert`
- `AdminNotification`
- `AdminAuditLog`
- `Favorite`
- `ReviewWindow`, `ReviewPromptEvent`, `ReviewSentiment`
- `ConsentRecord`, `ConsentEvent`

Enums in use:
- `MembershipRole` (`MANAGER`, `EMPLOYEE`)
- `MembershipStatus` (`PENDING`, `ACTIVE`, `DENIED`, `REVOKED`)
- `DeviceType` (`PHONE`, `HEADSET`)

### Legacy backend models (separate stack)
The `backend` folder contains a separate Express + SQL model layer with:
- `UserModel` in `backend/src/models/User.ts`
- `ServiceModel` in `backend/src/models/Service.ts`

These do not match the Prisma model shapes one-to-one and appear to represent an older/parallel backend path.

## 2. API ROUTES

### Next.js API routes (active in app)
There are **102** route handlers under `src/app/api/**/route.ts` (see `ROUTE_MAP.md`), including:

- **Auth/Profile**
  - `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/reset-password/validate`
  - `/api/customer/profile`, `/api/vendor/profile`, `/api/profile/toggle`, `/api/profile/check-vendor-eligibility`
  - `/api/passkey/register-options`, `/api/passkey/register`
- **Services/Search/Reviews/Bookings**
  - `/api/services`, `/api/services/[id]`, `/api/services/[id]/media`, `/api/services/discover`, `/api/services/categories`
  - `/api/search`
  - `/api/reviews`, `/api/reviews/create`, `/api/reviews/prompt-event`, `/api/reviews/sentiment`, `/api/reviews/window/start`, `/api/reviews/window/expire`
  - `/api/bookings`, `/api/bookings/[id]`, `/api/bookings/[id]/cancel`, `/api/bookings/[id]/media`
  - `/api/availability/vendor/[vendorId]`, `/api/availability/check`
- **Consent**
  - `/api/consent/request`, `/api/consent/[token]`, `/api/consent/accept`, `/api/consent/decline`
- **Favorites**
  - `/api/users/favorites`, `/api/users/favorites/[id]`
- **Notifications (dev / server)**
  - `/api/dev/notifications-test` (non-production, secret-guarded)
- **Vendor org/workforce**
  - `/api/vendors/[vendorId]/dashboard`
  - `/api/vendors/[vendorId]/memberships` and approve/deny/revoke actions
  - `/api/vendors/[vendorId]/invites` and invite patch route
  - `/api/vendors/[vendorId]/devices`
  - `/api/vendors/[vendorId]/headsets/[deviceId]/assign|unassign`
- **Device lifecycle**
  - `/api/device/pairing/request`, `/api/device/pairing/confirm`
  - `/api/pairing/request`, `/api/pairing/confirm` (duplicate pattern)
  - `/api/device/heartbeat`
  - `/api/devices`, `/api/vendor/devices`, `/api/vendor/devices/[id]`, `/api/headsets/claim`
- **Media/storage**
  - `/api/vendors/[vendorId]/media`
  - `/api/vendors/[vendorId]/media/upload/init`
  - `/api/vendors/[vendorId]/media/upload/complete`
  - `/api/vendors/[vendorId]/media/[assetId]`
  - `/api/vendors/[vendorId]/media/[assetId]/download`
  - `/api/vendors/[vendorId]/media/storage`
  - `/api/vendors/[vendorId]/storage/usage`
  - `/api/vendors/[vendorId]/storage/verify`
- **Admin/system**
  - `/api/admin/vendors/*`, `/api/admin/notifications/*`, `/api/admin/seed`, `/api/admin/reset`, `/api/admin/db-status`
  - `/api/admin/audit-logs`, `/api/admin/publish`, `/api/admin/media/*`, `/api/admin/reviews/*`, `/api/admin/review-audit`, `/api/admin/services/[serviceId]/publish`
  - `/api/health`, `/api/test`, `/api/test-db`

### Legacy Express backend routes (parallel)
In `backend/src/app.ts`:
- Mounted: `/api/auth`, `/api/services`
- Placeholder handlers: `/api/users`, `/api/vendors`, `/api/bookings`
- Health: `/health`

## 3. MEDIA FLOW

Current implemented flow (vendor-scoped media management):

1. **Init upload**: `POST /api/vendors/[vendorId]/media/upload/init`
   - Validates membership
   - Validates requested file metadata
   - Checks projected storage usage before upload
   - Generates blob key and Azure SAS upload URL (with fallback placeholder URL)

2. **Client uploads directly to blob storage** using returned SAS URL

3. **Complete upload**: `POST /api/vendors/[vendorId]/media/upload/complete`
   - Revalidates membership
   - Optionally verifies blob properties from Azure
   - Rechecks storage safety gate
   - Persists `MediaAsset`
   - Recomputes storage and raises threshold alerts/notifications

4. **List media**: `GET /api/vendors/[vendorId]/media`
   - Returns vendor assets (excluding soft-deleted by default)
   - Returns aggregate storage totals

5. **Download URL**: `GET /api/vendors/[vendorId]/media/[assetId]/download`
   - Generates secure SAS read URL (fallback to stored/placeholder URL)

6. **Delete media**: `DELETE /api/vendors/[vendorId]/media/[assetId]`
   - Soft-deletes asset (`deletedAt`)
   - Returns updated storage usage immediately

## 4. FRONTEND CONNECTIONS

### How frontend calls backend
- Centralized client in `src/lib/api.ts` (`typedFetch`, cookie credentials included).
- SDK wrappers in `src/sdk/*` and hooks in `src/hooks/*`.
- Direct `fetch()` usage also exists in many hooks/pages.

### Connected areas (implemented and wired)
- Auth/profile switching (`src/sdk/auth.ts`, profile routes)
- Bookings/services/reviews/search basic fetch paths
- Vendor dashboard + devices + media hooks:
  - `useVendorDashboard`
  - `useVendorDevices`
  - `useVendorMedia`
- Device pair UI in `src/app/device/pair/page.tsx` uses `/api/device/pairing/confirm`.

### Mode switching
- `src/components/ClientProviders.tsx` enables MSW mock worker when `NEXT_PUBLIC_API_MODE=mock`.
- `src/lib/api.ts` uses `NEXT_PUBLIC_API_MODE` and `NEXT_PUBLIC_API_BASE_URL` for mock/external base URL selection.

## 5. DEVICE READINESS

What is currently in place:
- Pairing code generation and confirmation endpoints exist.
- Device registry model supports UID, type, activity, firmware/model/OS/app version, last-seen.
- Heartbeat endpoint exists for phone liveness updates.
- Headset claim/assignment workflow exists with transaction-based reassignment logic.
- Manager device view endpoint includes assignment/user context.
- Device management UI exists (`/dashboard/devices`, `/device/pair`).

Readiness level: **partially ready** (core structures are present, but key auth/data consistency issues remain; see gaps).

## 6. GAPS

### Auth and authorization gaps
- `getUserIdFromRequest` / `getVendorIdFromRequest` in `src/lib/auth.ts` still support **header/cookie fallbacks** (`x-user-id`, `x-vendor-id`) used by internal UIs — treat as **non-production-grade** until real JWT/session enforcement is unified.
- Re-audit `src/lib/membership-auth.ts` + vendor routes whenever auth hardening lands.

### API contract mismatches
- Several SDK endpoints have no matching route files, e.g.:
  - `/api/reviews/stats`
  - `/api/users/preferences`
  - `/api/users/upload-photo`
  - `/api/search/services`, `/api/search/vendors`, `/api/search/suggestions`, etc.
- Device route response shape mismatch:
  - `src/app/api/vendor/devices/route.ts` returns raw array
  - hooks expect `{ devices: [...] }`

### Schema vs route implementation mismatches
- Device creation in pairing confirm uses fields not present in Prisma `Device` schema (`deviceName`, `userAgent`).
- Some queries/orderings reference fields inconsistent with schema expectations (`createdAt` in device listing routes while Prisma `Device` uses `pairedAt`).
- Duplicate pairing route families (`/api/pairing/*` and `/api/device/pairing/*`) increase ambiguity.

### Product/feature completeness gaps
- Employee mobile flow (`src/app/employee/mobile/page.tsx`) is mostly mock/UI-driven with backend notes, not real integrated endpoints.
- Media upload init expects `expectedBytes`, while some frontend hook calls use `fileSize` naming.
- Mixed backend architecture (Next API + legacy Express backend) without a clearly enforced single source of truth.

## 7. NEXT STEPS

1. **Unify auth extraction**
   - Replace hardcoded user/vendor ID stubs with real JWT/session parsing in `src/lib/auth.ts` and `src/lib/membership-auth.ts`.

2. **Normalize device API contracts**
   - Standardize response shapes (`{ devices }`), align field usage to Prisma schema (`pairedAt` vs `createdAt`), and remove non-schema fields or extend schema intentionally.

3. **Resolve endpoint drift**
   - Either implement missing SDK-targeted routes or update SDKs to only call existing routes.
   - Remove/redirect duplicate pairing route families.

4. **Stabilize media contract**
   - Align request payload naming (`expectedBytes` vs `fileSize`) and document required fields for upload init/complete.

5. **Decide backend source of truth**
   - Choose either Next API + Prisma or the legacy Express backend as the primary platform path, then deprecate or isolate the other to reduce confusion and defects.

6. **Raise delivery confidence**
   - Add integration tests around pairing, heartbeat, headset claim/assign, and media upload lifecycle.
   - Add contract tests between SDK methods and route availability.

