# Operational phase — `AWAITING_VENDOR_REVIEW` (implementation summary)

## Files changed

| File | Change |
|------|--------|
| `src/lib/vendor-job-operational-phase.ts` | **New.** Parses/sets `customerMetadata.reliance_ops.operational_phase`, resolves effective phase for UI/guards, maps booking status updates to stored phase. |
| `src/app/api/vendors/[vendorId]/dashboard/route.ts` | Each job DTO includes **`operationalPhase`** (resolved). Archived jobs get the same field. |
| `src/app/api/vendors/[vendorId]/jobs/[jobId]/actions/route.ts` | **`UPDATE_STATUS`**: blocks `COMPLETED` unless `linkedAssetCount >= 1` and resolved phase is **`AWAITING_VENDOR_REVIEW`**; merges operational phase into metadata on status changes. **`ASSIGN_JOB`**: sets phase **`ASSIGNED`** / **`PENDING`** when booking is **`PENDING`**. Booking `findFirst` now selects **`customerMetadata`**. |
| `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` | After a **video** asset is created for a session tied to a **`CONFIRMED`** booking, sets **`reliance_ops.operational_phase`** to **`AWAITING_VENDOR_REVIEW`**. |
| `src/app/vendor/jobs/page.tsx` | Surfaces **`operationalPhase`** in adapted jobs; status label/badge (amber when awaiting review); **`Review & complete`** action; status modal disables **Completed** until rules pass; helper copy. |
| `src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts` | Tests for completion guards and allowed completion. |

## How operational phase is stored

- **Location:** `Booking.customerMetadata` JSON string, key path **`reliance_ops.operational_phase`**.
- **Values used in this pass:** `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `AWAITING_VENDOR_REVIEW`, `COMPLETED` (see `vendor-job-operational-phase.ts`).
- **Booking.status** (`PENDING` \| `CONFIRMED` \| `COMPLETED` \| …) is unchanged as the booking-system source of truth; operational phase **refines** vendor workflow on top of **`CONFIRMED`** (UI “in progress”) especially.

## Status transitions (practical)

1. **PENDING booking** + assignees in metadata → phase **`ASSIGNED`** (via **Assign** action).
2. **Update status → In progress** → booking **`CONFIRMED`**, phase **`IN_PROGRESS`** in metadata.
3. **Service video upload completes** (`mimeType` video*, booking **`CONFIRMED`**) → phase **`AWAITING_VENDOR_REVIEW`** (idempotent overwrite).
4. **Update status → Completed** or **Review & complete** → allowed only if **at least one** linked media asset and resolved phase **`AWAITING_VENDOR_REVIEW`**; then booking **`COMPLETED`** and phase **`COMPLETED`** in metadata.
5. **Legacy / no metadata:** `resolveOperationalPhase` infers **`AWAITING_VENDOR_REVIEW`** for **`CONFIRMED`** bookings with **linked media** so existing jobs are not stuck unable to complete.

Admin moderation remains on **`MediaAsset`** only; job phase does not mirror `pending_review` / `approved`.

## Vendor UI

- Primary badge text uses operational phase when set (e.g. **Job: Awaiting vendor review**).
- Extra outline badge: **Awaiting your review** when phase matches.
- **Actions → Review & complete** runs the same completion update as status **Completed** (disabled until rules pass).
- **Update Job Status** disables the **Completed** option until media + awaiting review, with short helper text.

## Tests

Run: `npx vitest run src/app/api/vendors/[vendorId]/jobs/vendor-job-actions.integration.test.ts`
