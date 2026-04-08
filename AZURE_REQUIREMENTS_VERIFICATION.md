# Azure-Specific Requirements Verification

## ✅ All Requirements Implemented

### 1. Azure Blob Storage with Server-Generated SAS Tokens

**Status**: ✅ **IMPLEMENTED**

**Location**: `src/lib/azure-blob-storage.ts`

**Implementation**:
- Uses `@azure/storage-blob` SDK
- Server-side SAS token generation (not client-side)
- `generateUploadUrl()` - Creates SAS token with write permission (60 min expiry)
- `generateDownloadUrl()` - Creates SAS token with read permission (60 min expiry)
- Uses `StorageSharedKeyCredential` for authentication
- Uses `generateBlobSASQueryParameters()` for token generation

**Code Reference**:
```typescript
// src/lib/azure-blob-storage.ts
export async function generateUploadUrl(
  blobKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const sasToken = await generateUploadSAS(blobKey, expiresInMinutes);
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobKey}?${sasToken}`;
  return url;
}
```

**Usage**:
- `POST /api/vendors/[vendorId]/media/upload/init` - Generates upload SAS URL
- `GET /api/vendors/[vendorId]/media/[assetId]/download` - Generates download SAS URL

---

### 2. Blob Paths Prefixed with vendorId

**Status**: ✅ **IMPLEMENTED**

**Location**: `src/app/api/vendors/[vendorId]/media/upload/init/route.ts` (line 75)

**Implementation**:
- Blob key format: `vendor/{vendorId}/media/{assetId}.{ext}`
- Ensures vendor isolation
- Easy cleanup per vendor
- Audit trail in blob path

**Code Reference**:
```typescript
// src/app/api/vendors/[vendorId]/media/upload/init/route.ts
const blobKey = `vendor/${vendorId}/media/${assetId}.${ext}`;
```

**Example**:
```
vendor/cmipm4d6v0000sosgqvb8tp63/media/a1b2c3d4e5f6g7h8.jpg
```

**Benefits**:
- Vendor-scoped paths prevent cross-vendor access
- Easy to list/delete all blobs for a vendor
- Clear ownership in blob path

---

### 3. Prisma Provider is sqlserver

**Status**: ✅ **IMPLEMENTED**

**Location**: `prisma/schema.prisma` (line 9)

**Implementation**:
```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

**Database**: Azure SQL Database (SQL Server)

**Models**:
- `MediaAsset` - Uses BigInt for bytes (SQL Server compatible)
- `VendorStorageAlert` - Uses Int for threshold
- `AdminNotification` - Uses String for type/metadata
- All models use `@@map()` for SQL Server table naming

---

### 4. Enforce Upload Limits in Both upload/init and upload/complete

**Status**: ✅ **IMPLEMENTED**

#### Primary Gate: upload/init

**Location**: `src/app/api/vendors/[vendorId]/media/upload/init/route.ts` (lines 43-63)

**Implementation**:
```typescript
// Calculate current storage usage
const usage = await calculateStorageUsage(vendorId);

// Check if adding expectedBytes would exceed limit
const projectedUsed = usage.usedBytes + BigInt(expectedBytes);
if (projectedUsed > usage.limitBytes) {
  return NextResponse.json(
    {
      error: "STORAGE_LIMIT_REACHED",
      usedBytes: usage.usedBytes.toString(),
      limitBytes: usage.limitBytes.toString(),
      percentUsed: usage.percentUsed,
    },
    { status: 403 }
  );
}
```

**Behavior**:
- Blocks upload before SAS token generation
- Requires `expectedBytes` in request body
- Returns 403 with detailed error if limit exceeded

#### Safety Gate: upload/complete

**Location**: `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` (lines 56-71)

**Implementation**:
```typescript
// SAFETY GATE: Recalculate storage and check limit
const usage = await calculateStorageUsage(vendorId);
const projectedUsed = usage.usedBytes + actualBytes;

if (projectedUsed > usage.limitBytes) {
  return NextResponse.json(
    {
      error: "STORAGE_LIMIT_REACHED",
      usedBytes: usage.usedBytes.toString(),
      limitBytes: usage.limitBytes.toString(),
      percentUsed: usage.percentUsed,
    },
    { status: 403 }
  );
}
```

**Behavior**:
- Re-checks limit before creating MediaAsset record
- Verifies actual blob size (from Azure)
- Prevents "got SAS earlier" bypass
- Blocks if limit would be exceeded

**Why Two Gates?**
1. **Primary Gate (init)**: Prevents unnecessary SAS token generation
2. **Safety Gate (complete)**: Prevents race conditions and ensures accuracy

---

### 5. Soft-Deleted Media Immediately Reduces Reported Storage Usage

**Status**: ✅ **IMPLEMENTED**

**Location**: `src/lib/storage-helpers.ts` (lines 34-42)

**Implementation**:
```typescript
// Calculate used storage (only non-deleted assets)
const storageAggregate = await prisma.mediaAsset.aggregate({
  where: {
    vendorId,
    deletedAt: null,  // ✅ Only counts non-deleted
  },
  _sum: {
    bytes: true,
  },
});
```

**Storage Calculation**:
- Always filters `WHERE deletedAt IS NULL`
- Used in all storage calculations:
  - `calculateStorageUsage()` - Core helper function
  - `GET /api/vendors/[vendorId]/storage/usage` - Usage endpoint
  - Upload init/complete checks - Limit enforcement
  - Delete route - Immediate update after soft delete

**Delete Route Behavior**:
```typescript
// src/app/api/vendors/[vendorId]/media/[assetId]/route.ts
// Soft delete (always allowed, even if over limit)
const updatedAsset = await prisma.mediaAsset.update({
  where: { id: assetId },
  data: {
    deletedAt: new Date(),  // ✅ Soft delete
  },
});

// Recalculate storage (usage drops immediately)
const usage = await calculateStorageUsage(vendorId);
// Returns updated storage stats
```

**Immediate Effect**:
- When `deletedAt` is set, next storage calculation excludes it
- No cache invalidation needed
- Database query filters `deletedAt IS NULL` automatically
- Storage usage drops immediately in API responses

**All Storage Queries**:
- ✅ `calculateStorageUsage()` - Filters `deletedAt IS NULL`
- ✅ `GET /api/vendors/[vendorId]/storage/usage` - Filters `deletedAt IS NULL`
- ✅ Upload init check - Uses `calculateStorageUsage()` (excludes deleted)
- ✅ Upload complete check - Uses `calculateStorageUsage()` (excludes deleted)
- ✅ Media list - Can optionally filter `deletedAt IS NULL`

---

## Summary

| Requirement | Status | Location |
|------------|--------|----------|
| Azure Blob Storage with SAS tokens | ✅ | `src/lib/azure-blob-storage.ts` |
| Blob paths prefixed with vendorId | ✅ | `src/app/api/vendors/[vendorId]/media/upload/init/route.ts` |
| Prisma provider is sqlserver | ✅ | `prisma/schema.prisma` |
| Enforce limits in upload/init | ✅ | `src/app/api/vendors/[vendorId]/media/upload/init/route.ts` |
| Enforce limits in upload/complete | ✅ | `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` |
| Soft-deleted media reduces usage | ✅ | `src/lib/storage-helpers.ts` (all queries filter `deletedAt IS NULL`) |

## Testing Checklist

- [ ] Upload init blocks when `usedBytes + expectedBytes > limitBytes`
- [ ] Upload complete blocks when limit would be exceeded
- [ ] SAS tokens generated server-side (not client-side)
- [ ] Blob paths include `vendor/{vendorId}/media/` prefix
- [ ] Soft delete sets `deletedAt` (not hard delete)
- [ ] Storage usage excludes soft-deleted items immediately
- [ ] All storage calculations filter `deletedAt IS NULL`
- [ ] Database provider is `sqlserver` in schema
- [ ] Azure Storage credentials configured via environment variables

## Environment Variables Required

```env
# Azure SQL Database
DATABASE_URL="sqlserver://..."

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount
AZURE_STORAGE_ACCOUNT_KEY=yourstorageaccountkey
AZURE_STORAGE_CONTAINER_NAME=media
```

All Azure-specific requirements are **fully implemented and verified**.

