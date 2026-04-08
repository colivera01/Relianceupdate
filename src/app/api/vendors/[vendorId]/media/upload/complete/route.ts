// src/app/api/vendors/[vendorId]/media/upload/complete/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";
import { getBlobProperties } from "@/lib/azure-blob-storage";

interface RouteParams {
  params: { vendorId: string };
}

/**
 * POST /api/vendors/[vendorId]/media/upload/complete
 * Create MediaAsset record after blob upload is complete
 * SAFETY GATE: Re-checks limit before creating record
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = params;
    const { userId, membershipId, role } = await requireVendorMembership(request, vendorId);

    const body = await request.json();
    const {
      assetId,
      blobKey,
      blobUrl,
      bytes,
      mimeType,
      deviceId,
    } = body;

    if (!assetId || !blobKey || !bytes || !mimeType) {
      return NextResponse.json(
        { error: "assetId, blobKey, bytes, and mimeType are required" },
        { status: 422 }
      );
    }

    // Verify blob exists and get actual size (safety check)
    let actualBytes = BigInt(bytes);
    try {
      const blobProps = await getBlobProperties(blobKey);
      if (blobProps && blobProps.exists && blobProps.contentLength) {
        // Use actual blob size if available (more accurate)
        actualBytes = BigInt(blobProps.contentLength);
      }
    } catch (error: any) {
      console.warn("Could not verify blob properties, using provided bytes:", error.message);
      // Continue with provided bytes if blob verification fails
    }

    // SAFETY GATE: Recalculate storage and check limit
    const usage = await calculateStorageUsage(vendorId);
    const projectedUsed = usage.usedBytes + actualBytes;
    
    if (projectedUsed > usage.limitBytes) {
      // Check and create alerts
      await checkAndCreateStorageAlerts(vendorId, usage);

      return NextResponse.json(
        {
          error: "STORAGE_LIMIT_REACHED",
          usedBytes: usage.usedBytes.toString(),
          limitBytes: usage.limitBytes.toString(),
          percentUsed: usage.percentUsed,
          message: "Storage limit would be exceeded. Upload blocked.",
        },
        { status: 403 }
      );
    }

    // Create MediaAsset record
    const asset = await (prisma as any).mediaAsset.create({
      data: {
        id: assetId,
        vendorId,
        membershipId: membershipId || null,
        deviceId: deviceId || null,
        bytes: actualBytes,
        mimeType,
        blobKey,
        blobUrl: blobUrl || null,
        deletedAt: null,
      },
    });

    // Recalculate storage after creation
    const updatedUsage = await calculateStorageUsage(vendorId);
    
    // Check and create alerts (may have crossed threshold after upload)
    await checkAndCreateStorageAlerts(vendorId, updatedUsage);

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        vendorId: asset.vendorId,
        blobKey: asset.blobKey,
        blobUrl: asset.blobUrl,
        bytes: asset.bytes.toString(),
        mimeType: asset.mimeType,
        createdAt: asset.createdAt,
      },
      storage: {
        usedBytes: updatedUsage.usedBytes.toString(),
        limitBytes: updatedUsage.limitBytes.toString(),
        percentUsed: updatedUsage.percentUsed,
        totalMB: (Number(updatedUsage.usedBytes) / (1024 * 1024)).toFixed(2),
        totalGB: (Number(updatedUsage.usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("[media/upload/complete] POST error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Asset ID already exists" },
        { status: 409 }
      );
    }
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to complete upload", details: error.message },
      { status: 500 }
    );
  }
}

