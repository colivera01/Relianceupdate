// src/app/api/vendors/[vendorId]/media/upload/init/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { calculateStorageUsage, checkAndCreateStorageAlerts } from "@/lib/storage-helpers";
import { generateUploadUrl } from "@/lib/azure-blob-storage";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/media/upload/init
 * Initialize media upload - returns SAS URL and blobKey
 * PRIMARY GATE: Blocks upload if storage limit would be exceeded
 */
export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const { userId, membershipId, role } = await requireVendorMembership(request, vendorId);

    const body = await request.json();
    const { fileName, expectedBytes, mimeType, deviceId } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: "fileName and mimeType are required" },
        { status: 422 }
      );
    }

    if (!expectedBytes || expectedBytes <= 0) {
      return NextResponse.json(
        { error: "expectedBytes is required and must be greater than 0" },
        { status: 422 }
      );
    }

    // Calculate current storage usage
    const usage = await calculateStorageUsage(vendorId);

    // Check if adding expectedBytes would exceed limit
    const projectedUsed = usage.usedBytes + BigInt(expectedBytes);
    if (projectedUsed > usage.limitBytes) {
      // Check and create alerts (may have just crossed threshold)
      await checkAndCreateStorageAlerts(vendorId, usage);

      return NextResponse.json(
        {
          error: "STORAGE_LIMIT_REACHED",
          usedBytes: usage.usedBytes.toString(),
          limitBytes: usage.limitBytes.toString(),
          percentUsed: usage.percentUsed,
          message: "Storage limit reached. Delete existing media or upgrade your plan.",
        },
        { status: 403 }
      );
    }

    // Check and create alerts if thresholds crossed
    await checkAndCreateStorageAlerts(vendorId, usage);

    // Generate unique asset ID
    const assetId = crypto.randomBytes(16).toString("hex");
    
    // Extract file extension
    const ext = fileName.split(".").pop() || "";
    
    // Generate blob key with vendor prefix
    const blobKey = `vendor/${vendorId}/media/${assetId}.${ext}`;

    // Generate SAS URL for Azure Blob Storage (60 minute expiration)
    let sasUrl: string;
    try {
      sasUrl = await generateUploadUrl(blobKey, 60);
    } catch (error: any) {
      // Fallback if Azure Storage not configured
      console.warn("Azure Storage not configured, using placeholder URL:", error.message);
      sasUrl = `${process.env.BLOB_STORAGE_URL || 'https://storage.example.com'}/${blobKey}?sas_token=...`;
    }

    return NextResponse.json({
      assetId,
      blobKey,
      sasUrl,
      uploadUrl: sasUrl, // Alias for compatibility
      storage: {
        usedBytes: usage.usedBytes.toString(),
        limitBytes: usage.limitBytes.toString(),
        percentUsed: usage.percentUsed,
      },
    });
  } catch (error: any) {
    console.error("[media/upload/init] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to initialize upload", details: error.message },
      { status: 500 }
    );
  }
}

