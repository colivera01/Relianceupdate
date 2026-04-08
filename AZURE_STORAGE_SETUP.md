# Azure Blob Storage Setup Guide

## Overview

The storage system uses Azure Blob Storage with SAS (Shared Access Signature) tokens for secure uploads and downloads. All media files are stored with vendor-scoped paths: `vendor/{vendorId}/media/{assetId}.{ext}`

## Prerequisites

1. Azure Storage Account
2. Storage container (default: "media")
3. Storage account name and access key

## Environment Variables

Add these to your `.env` file:

```env
# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount
AZURE_STORAGE_ACCOUNT_KEY=yourstorageaccountkey
AZURE_STORAGE_CONTAINER_NAME=media
```

## Installation

Install the Azure Storage Blob SDK:

```bash
npm install @azure/storage-blob
```

## Container Setup

1. Create a storage container in Azure Portal (or via Azure CLI):
   ```bash
   az storage container create \
     --name media \
     --account-name yourstorageaccount \
     --account-key yourstorageaccountkey
   ```

2. Set container access level (recommended: Private):
   - Private: Only accessible via SAS tokens
   - Blob: Public read access for blobs
   - Container: Public read access for container and blobs

## How It Works

### Upload Flow

1. **Client requests upload init:**
   - `POST /api/vendors/[vendorId]/media/upload/init`
   - Server checks storage limit
   - Server generates `blobKey`: `vendor/{vendorId}/media/{assetId}.{ext}`
   - Server generates SAS token (write permission, 60 min expiry)
   - Returns: `{ assetId, blobKey, sasUrl, uploadUrl }`

2. **Client uploads directly to Azure:**
   - Uses `sasUrl` to upload file directly to Azure Blob Storage
   - No file passes through your server

3. **Client notifies completion:**
   - `POST /api/vendors/[vendorId]/media/upload/complete`
   - Server verifies blob exists and gets actual size
   - Server re-checks storage limit
   - Server creates `MediaAsset` record in database

### Download Flow

1. **Client requests download:**
   - `GET /api/vendors/[vendorId]/media/[assetId]/download`
   - Server verifies vendor ownership
   - Server generates SAS token (read permission, 60 min expiry)
   - Returns: `{ downloadUrl, expiresIn }`

2. **Client downloads directly from Azure:**
   - Uses `downloadUrl` to download file directly from Azure Blob Storage

## Security

- **SAS Tokens**: Time-limited (60 minutes), permission-scoped (read/write)
- **Vendor Scoping**: All blob keys include vendorId prefix
- **Authorization**: All API routes verify vendor membership before generating SAS
- **Blob Verification**: Upload complete verifies blob exists before creating record

## Blob Naming Convention

```
vendor/{vendorId}/media/{assetId}.{ext}
```

Example:
```
vendor/cmipm4d6v0000sosgqvb8tp63/media/a1b2c3d4e5f6g7h8.jpg
```

This ensures:
- Vendor isolation (can't access other vendor's blobs)
- Easy cleanup (delete all blobs for a vendor)
- Audit trail (blob path shows ownership)

## Helper Functions

Located in `src/lib/azure-blob-storage.ts`:

- `generateUploadUrl(blobKey, expiresInMinutes)` - Generate upload SAS URL
- `generateDownloadUrl(blobKey, expiresInMinutes)` - Generate download SAS URL
- `getBlobProperties(blobKey)` - Verify blob exists and get size
- `deleteBlob(blobKey)` - Delete blob (for cleanup jobs)

## Fallback Behavior

If Azure Storage is not configured:
- Routes will log warnings
- Will return placeholder URLs
- System continues to work (for development/testing)

## Production Checklist

- [ ] Azure Storage Account created
- [ ] Container "media" created (or custom name)
- [ ] Environment variables set
- [ ] Container access level set to Private
- [ ] Storage account key secured (use Key Vault in production)
- [ ] CORS configured if needed for direct browser uploads
- [ ] Monitoring/alerts set up for storage usage

## Cost Optimization

- Use lifecycle management policies to move old blobs to cheaper tiers
- Set up soft delete retention for accidental deletions
- Monitor storage usage per vendor for billing

## Cleanup Job (Future)

Create a background job to physically delete blobs for soft-deleted assets:

```typescript
// Example cleanup job
const deletedAssets = await prisma.mediaAsset.findMany({
  where: {
    deletedAt: { not: null },
    deletedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
  },
});

for (const asset of deletedAssets) {
  await deleteBlob(asset.blobKey);
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
}
```

