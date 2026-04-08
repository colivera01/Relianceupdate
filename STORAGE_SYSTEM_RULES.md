# Storage System Rules & Implementation

## Ground Rules

1. **Vendor-scoped media**: All media (videos/photos/files) are strictly scoped to a single vendor profile (`vendorId`)
2. **Soft delete only**: Media supports soft delete only (`deletedAt`), never hard deletes
3. **Storage calculation**: Soft-deleted items (`deletedAt IS NOT NULL`) must not count toward storage usage
4. **Storage limits**: Storage usage limits are enforced per vendor profile
5. **Upload blocking**: When storage is full, block uploads only. Viewing and deleting media must still work
6. **Plans without billing**: No billing yet; vendors are on plans with storage limits (`planKey`, `storageLimitBytes`)
7. **Admin alerts**: Admin must receive alerts when vendors cross 80%, 95%, and 100% storage usage
8. **Backend enforcement**: All backend enforcement must happen in API routes (not only UI)

## Implementation Verification

### ✅ 1. Vendor-Scoped Media

**Database:**
- `MediaAsset.vendorId` (required, foreign key to Vendor)
- All queries filter by `vendorId`

**API Routes:**
- All routes require `vendorId` in path: `/api/vendors/[vendorId]/media/*`
- All routes use `requireVendorMembership(request, vendorId)` for authorization
- All operations verify `asset.vendorId === vendorId` before allowing access

**Files:**
- `src/app/api/vendors/[vendorId]/media/route.ts`
- `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/*/route.ts`

### ✅ 2. Soft Delete Only

**Database:**
- `MediaAsset.deletedAt` (nullable DateTime)
- No hard delete operations in codebase

**API Routes:**
- `DELETE /api/vendors/[vendorId]/media/[assetId]` sets `deletedAt = now()`
- Never calls `prisma.mediaAsset.delete()`

**File:**
- `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts` (line 50-55)

### ✅ 3. Storage Calculation Excludes Soft-Deleted

**Storage Query:**
```typescript
// src/lib/storage-helpers.ts
const storageAggregate = await prisma.mediaAsset.aggregate({
  where: {
    vendorId,
    deletedAt: null,  // ✅ Only counts non-deleted
  },
  _sum: { bytes: true },
});
```

**All Usage Calculations:**
- `calculateStorageUsage()` - filters `deletedAt IS NULL`
- `GET /api/vendors/[vendorId]/storage/usage` - filters `deletedAt IS NULL`
- Upload checks - use `calculateStorageUsage()` which excludes deleted

**File:**
- `src/lib/storage-helpers.ts` (line 30-40)

### ✅ 4. Storage Limits Per Vendor

**Database:**
- `Vendor.storageLimitBytes` (BigInt, default: 1GB)
- `Vendor.planKey` (String, default: "FREE")
- `Vendor.isOverLimit` (Boolean, cached status)

**Enforcement:**
- All storage checks are vendor-scoped
- `calculateStorageUsage(vendorId)` reads vendor's `storageLimitBytes`
- All upload routes check vendor-specific limit

**Files:**
- `prisma/schema.prisma` (Vendor model)
- `src/lib/storage-helpers.ts`

### ✅ 5. Upload Blocking Only (View/Delete Still Work)

**Blocked When Full:**
- ❌ `POST /api/vendors/[vendorId]/media/upload/init` - Returns 403 STORAGE_LIMIT_REACHED
- ❌ `POST /api/vendors/[vendorId]/media/upload/complete` - Returns 403 STORAGE_LIMIT_REACHED

**Always Allowed (Even When Full):**
- ✅ `GET /api/vendors/[vendorId]/media` - List media (filters deletedAt)
- ✅ `GET /api/vendors/[vendorId]/media/[assetId]/download` - Download media
- ✅ `DELETE /api/vendors/[vendorId]/media/[assetId]` - Soft delete (always allowed)
- ✅ `GET /api/vendors/[vendorId]/storage/usage` - View storage stats

**Files:**
- `src/app/api/vendors/[vendorId]/media/upload/init/route.ts` (line 47-61)
- `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` (line 44-61)
- `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts` (line 49-75)

### ✅ 6. Plans Without Billing

**Database:**
- `Vendor.planKey` (String, default: "FREE") - "FREE" | "STARTER" | "PRO"
- `Vendor.storageLimitBytes` (BigInt) - Plan-specific limit
- No billing/subscription tables yet

**Future-Ready:**
- When billing is added, just update `planKey` and `storageLimitBytes`
- No need to rewrite upload logic

**File:**
- `prisma/schema.prisma` (Vendor model, lines 85-88)

### ✅ 7. Admin Alerts at Thresholds

**Database:**
- `VendorStorageAlert` - Tracks alerts per vendor per threshold (80, 95, 100)
- `AdminNotification` - Stores admin alerts with metadata

**Alert Logic:**
- `checkAndCreateStorageAlerts()` checks thresholds: 80%, 95%, 100%
- Creates `VendorStorageAlert` once per threshold (deduplicated)
- Creates `AdminNotification` for each crossed threshold
- Triggered in: upload/init, upload/complete, storage/usage

**Admin Page:**
- `/admin/notifications` - View all alerts
- Filters: All, Unread, Storage Alerts

**Files:**
- `src/lib/storage-helpers.ts` (checkAndCreateStorageAlerts function)
- `src/app/admin/notifications/page.tsx`
- `src/app/api/admin/notifications/route.ts`

### ✅ 8. Backend Enforcement in API Routes

**Primary Gate - Upload Init:**
- `POST /api/vendors/[vendorId]/media/upload/init`
- Requires `expectedBytes` in request body
- Calculates: `usedBytes + expectedBytes`
- Blocks with 403 if exceeds `limitBytes`
- Returns `STORAGE_LIMIT_REACHED` error

**Safety Gate - Upload Complete:**
- `POST /api/vendors/[vendorId]/media/upload/complete`
- Recalculates `usedBytes` before creating MediaAsset
- Blocks if limit would be exceeded
- Prevents "got SAS earlier" bypass

**Storage Usage:**
- `GET /api/vendors/[vendorId]/storage/usage`
- Calculates and returns current usage
- Checks alerts on every call

**All Enforcement:**
- Server-side only (API routes)
- No reliance on client-side checks
- Authorization via `requireVendorMembership()`

**Files:**
- `src/app/api/vendors/[vendorId]/media/upload/init/route.ts`
- `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts`
- `src/app/api/vendors/[vendorId]/storage/usage/route.ts`
- `src/lib/storage-helpers.ts`

## Key Enforcement Points

1. **Storage Calculation**: Always filters `deletedAt IS NULL`
2. **Upload Blocking**: Two gates (init + complete) both check limits
3. **Vendor Scoping**: All operations verify vendorId matches
4. **Soft Delete**: Always allowed, even when over limit
5. **Alert Deduplication**: One alert per vendor per threshold
6. **Backend Only**: All enforcement in API routes, not UI

## Testing Checklist

- [ ] Upload blocked when `usedBytes + expectedBytes > limitBytes`
- [ ] Upload complete blocked if limit exceeded
- [ ] Soft delete always works (even when over limit)
- [ ] Storage usage excludes soft-deleted items
- [ ] View/download works when over limit
- [ ] Alerts created at 80%, 95%, 100%
- [ ] Alerts deduplicated (one per threshold)
- [ ] Admin notifications visible in `/admin/notifications`
- [ ] Vendor scoping enforced (can't access other vendor's media)

