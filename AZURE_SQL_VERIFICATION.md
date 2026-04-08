# Azure SQL Database Verification Guide

## Quick Verification

### Step 1: Run Prisma Migrations

Ensure all migrations are applied to your Azure SQL database:

```bash
# Generate Prisma client (if schema changed)
npx prisma generate

# Push schema to database (applies migrations)
npx prisma db push

# Or use migrations (recommended for production)
npx prisma migrate deploy
```

### Step 2: Verify Database Connection

Check that your `.env` file has the correct `DATABASE_URL`:

```env
DATABASE_URL="sqlserver://USERNAME:PASSWORD@SERVER.database.windows.net:1433;database=DBNAME;encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30;"
```

### Step 3: Test Connectivity with Verification Route

**Use this route to verify end-to-end connectivity:**

```
POST /api/vendors/[vendorId]/storage/verify
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/vendors/cmipm4d6v0000sosgqvb8tp63/storage/verify \
  -H "Content-Type: application/json"
```

**What This Route Does:**
1. ✅ **Reads** vendor data from Azure SQL
2. ✅ **Reads** initial storage usage
3. ✅ **Writes** a test MediaAsset to Azure SQL
4. ✅ **Reads** updated storage usage (verifies write worked)
5. ✅ **Reads** the test asset back (verifies retrieval)
6. ✅ **Soft deletes** the test asset
7. ✅ **Reads** final storage usage (verifies soft delete reduces usage)
8. ✅ **Checks** that required tables exist

**Expected Response:**
```json
{
  "success": true,
  "message": "Azure SQL connectivity verified",
  "verification": {
    "databaseConnected": true,
    "prismaClientWorking": true,
    "tablesFound": ["admin_notifications", "media_assets", "vendor_storage_alerts", "vendors"],
    "allTablesExist": true,
    "vendorFound": true,
    "testAssetCreated": true,
    "storageIncreased": true,
    "storageDecreased": true,
    "softDeleteReducesUsage": true
  },
  "summary": {
    "writeOperation": "✅ PASSED - Created MediaAsset in Azure SQL",
    "readOperation": "✅ PASSED - Queried storage usage from Azure SQL",
    "softDeleteOperation": "✅ PASSED - Soft delete reduces storage usage",
    "tableExistence": "✅ PASSED"
  }
}
```

## Verification Checklist

### ✅ Prisma Configuration
- [ ] `prisma/schema.prisma` has `provider = "sqlserver"`
- [ ] `DATABASE_URL` is set in `.env`
- [ ] `npx prisma generate` completed successfully
- [ ] `npx prisma db push` or `npx prisma migrate deploy` completed successfully

### ✅ Tables Exist
Run the verification route and check `tablesFound` includes:
- [ ] `media_assets` (MediaAsset table)
- [ ] `vendors` (Vendor table)
- [ ] `vendor_storage_alerts` (VendorStorageAlert table)
- [ ] `admin_notifications` (AdminNotification table)

### ✅ API Routes Use Real Prisma
All routes import from `@/server/db`:
- [ ] `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` - Uses `prisma.mediaAsset.create()`
- [ ] `src/app/api/vendors/[vendorId]/storage/usage/route.ts` - Uses `prisma.mediaAsset.aggregate()`
- [ ] `src/app/api/vendors/[vendorId]/media/[assetId]/route.ts` - Uses `prisma.mediaAsset.update()`

### ✅ Write Operations Work
- [ ] Create MediaAsset: `POST /api/vendors/[vendorId]/media/upload/complete`
- [ ] Verification route creates test asset successfully

### ✅ Read Operations Work
- [ ] Query storage usage: `GET /api/vendors/[vendorId]/storage/usage`
- [ ] List media: `GET /api/vendors/[vendorId]/media`
- [ ] Verification route reads storage usage successfully

### ✅ Soft Delete Works
- [ ] Delete media: `DELETE /api/vendors/[vendorId]/media/[assetId]`
- [ ] Storage usage decreases immediately after soft delete
- [ ] Verification route confirms soft delete reduces usage

## Manual Verification Steps

### 1. Check Prisma Client Generation
```bash
npx prisma generate
```
Should output: `✔ Generated Prisma Client`

### 2. Check Database Connection
```bash
npx prisma db push
```
Should output: `✔ Database synchronized`

### 3. Check Tables in Azure Portal
1. Go to Azure Portal → Your SQL Database
2. Query Editor
3. Run: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'`
4. Verify tables exist: `media_assets`, `vendors`, `vendor_storage_alerts`, `admin_notifications`

### 4. Test Write + Read
Use the verification route:
```bash
POST /api/vendors/[vendorId]/storage/verify
```

### 5. Test Real Upload Flow
1. `POST /api/vendors/[vendorId]/media/upload/init` - Should return SAS URL
2. Upload file to Azure Blob Storage using SAS URL
3. `POST /api/vendors/[vendorId]/media/upload/complete` - Should create MediaAsset
4. `GET /api/vendors/[vendorId]/storage/usage` - Should show increased usage

## Troubleshooting

### Error: "Can't reach database server"
- Check `DATABASE_URL` format
- Verify Azure SQL firewall allows your IP
- Check network connectivity

### Error: "Table does not exist"
- Run `npx prisma db push` to apply schema
- Check migration files in `prisma/migrations/`

### Error: "Prisma Client not generated"
- Run `npx prisma generate`
- Restart Next.js dev server

### Error: "Connection timeout"
- Check Azure SQL firewall rules
- Verify connection string format
- Check `loginTimeout` in connection string

## Confirmation

Once the verification route returns `success: true` with all checks passing, you can confirm:

✅ **Prisma migrations were generated and applied**
✅ **Tables exist in Azure SQL database**
✅ **API routes are executing real Prisma queries (not mocks)**
✅ **Write operations work (MediaAsset creation)**
✅ **Read operations work (storage usage queries)**
✅ **Soft delete works (storage usage decreases)**

The system is **fully connected to Azure SQL Database** and ready for production use.

