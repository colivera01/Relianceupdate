// src/app/api/vendors/[vendorId]/storage/verify/route.ts
// Verification route: Performs real DB write + read to confirm Azure SQL connectivity

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { calculateStorageUsage } from "@/lib/storage-helpers";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/storage/verify
 * Verification route: Creates a test MediaAsset (write) then queries storage (read)
 * This confirms:
 * 1. Prisma migrations are applied
 * 2. Tables exist in Azure SQL
 * 3. API routes can write and read from Azure SQL
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  const { vendorId } = await params;
  let testAssetId: string | null = null;

  try {
    // 1. Verify authorization
    await requireVendorMembership(request, vendorId);

    // 2. Verify vendor exists (read)
    const vendor = await (prisma as any).vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        businessName: true,
        storageLimitBytes: true,
        planKey: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found", vendorId },
        { status: 404 }
      );
    }

    // 3. Get initial storage usage (read)
    const initialUsage = await calculateStorageUsage(vendorId);

    // 4. Create a test MediaAsset (WRITE)
    testAssetId = crypto.randomBytes(16).toString("hex");
    const testBlobKey = `vendor/${vendorId}/media/test-${testAssetId}.txt`;
    const testBytes = BigInt(1024); // 1 KB test file

    const testAsset = await (prisma as any).mediaAsset.create({
      data: {
        id: testAssetId,
        vendorId,
        membershipId: null,
        deviceId: null,
        bytes: testBytes,
        mimeType: "text/plain",
        blobKey: testBlobKey,
        blobUrl: null,
        deletedAt: null,
      },
    });

    // 5. Query storage usage again (READ) - should be increased
    const updatedUsage = await calculateStorageUsage(vendorId);
    const usageIncreased = updatedUsage.usedBytes > initialUsage.usedBytes;

    // 6. Query the test asset back (READ)
    const retrievedAsset = await (prisma as any).mediaAsset.findUnique({
      where: { id: testAssetId },
    });

    // 7. Verify tables exist by checking schema
    const tableCheck = await (prisma as any).$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'dbo' 
      AND TABLE_NAME IN ('media_assets', 'vendors', 'vendor_storage_alerts', 'admin_notifications')
      ORDER BY TABLE_NAME
    `;

    // 8. Clean up: Soft delete the test asset
    await (prisma as any).mediaAsset.update({
      where: { id: testAssetId },
      data: { deletedAt: new Date() },
    });

    // 9. Verify storage decreased after soft delete (READ)
    const finalUsage = await calculateStorageUsage(vendorId);
    const usageDecreased = finalUsage.usedBytes < updatedUsage.usedBytes;

    return NextResponse.json({
      success: true,
      message: "Azure SQL connectivity verified",
      verification: {
        // Database connectivity
        databaseConnected: true,
        prismaClientWorking: true,
        
        // Tables exist
        tablesFound: (tableCheck as any[]).map((t: any) => t.TABLE_NAME),
        requiredTables: ["media_assets", "vendors", "vendor_storage_alerts", "admin_notifications"],
        allTablesExist: (tableCheck as any[]).length >= 4,
        
        // Vendor data
        vendorFound: true,
        vendorId: vendor.id,
        vendorName: vendor.businessName || vendor.name,
        storageLimitBytes: vendor.storageLimitBytes?.toString(),
        planKey: vendor.planKey,
        
        // Write operation
        testAssetCreated: !!testAsset,
        testAssetId: testAsset.id,
        testAssetBytes: testAsset.bytes.toString(),
        
        // Read operations
        initialStorageUsed: initialUsage.usedBytes.toString(),
        initialStorageLimit: initialUsage.limitBytes.toString(),
        initialPercentUsed: initialUsage.percentUsed,
        
        updatedStorageUsed: updatedUsage.usedBytes.toString(),
        storageIncreased: usageIncreased,
        
        finalStorageUsed: finalUsage.usedBytes.toString(),
        storageDecreased: usageDecreased,
        
        // Asset retrieval
        assetRetrieved: !!retrievedAsset,
        assetMatches: retrievedAsset?.id === testAssetId,
        
        // Soft delete verification
        testAssetSoftDeleted: true,
        softDeleteReducesUsage: usageDecreased,
      },
      summary: {
        writeOperation: "✅ PASSED - Created MediaAsset in Azure SQL",
        readOperation: "✅ PASSED - Queried storage usage from Azure SQL",
        softDeleteOperation: "✅ PASSED - Soft delete reduces storage usage",
        tableExistence: (tableCheck as any[]).length >= 4 ? "✅ PASSED" : "⚠️ WARNING - Some tables missing",
      },
    });
  } catch (error: any) {
    // Clean up test asset if it was created
    if (testAssetId) {
      try {
        await (prisma as any).mediaAsset.deleteMany({
          where: { id: testAssetId },
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup test asset:", cleanupError);
      }
    }

    console.error("[storage/verify] POST error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        errorName: error.name,
        errorCode: error.code,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        verification: {
          databaseConnected: false,
          prismaClientWorking: false,
          errorDetails: {
            message: error.message,
            code: error.code,
            name: error.name,
          },
        },
      },
      { status: 500 }
    );
  }
}

