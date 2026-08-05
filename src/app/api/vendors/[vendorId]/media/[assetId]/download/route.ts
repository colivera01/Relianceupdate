// src/app/api/vendors/[vendorId]/media/[assetId]/download/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { generateDownloadUrl } from "@/lib/azure-blob-storage";

interface RouteParams {
  params: Promise<{ vendorId: string; assetId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/media/[assetId]/download
 * Generate secure download URL (SAS) for a media asset (vendor-scoped)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, assetId } = await params;
    const membership = await requireVendorMembership(request, vendorId);

    // Find asset and verify it belongs to this vendor
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      include: { mediaSession: { select: { sessionType: true } } },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Media asset not found" },
        { status: 404 }
      );
    }

    if (asset.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden: Asset does not belong to this vendor" },
        { status: 403 }
      );
    }

    if (asset.deletedAt) {
      return NextResponse.json(
        { error: "Asset has been deleted" },
        { status: 410 }
      );
    }

    if (
      String(asset.mediaSession?.sessionType || "").trim().toUpperCase() === "JOB_SERVICE_VIDEO" &&
      String((membership as any).role || "").trim().toUpperCase() !== "MANAGER"
    ) {
      return NextResponse.json(
        { error: "Only a vendor manager may open a submitted Private Service Video." },
        { status: 403 }
      );
    }

    // Generate SAS URL for Azure Blob Storage (60 minute expiration)
    let downloadUrl: string;
    try {
      downloadUrl = await generateDownloadUrl(asset.blobKey, 60);
    } catch (error: any) {
      console.error("[media/download] Storage unavailable", {
        vendorId,
        assetId,
        blobKey: asset.blobKey,
        message: error?.message || String(error),
      });
      return NextResponse.json(
        {
          code: "MEDIA_STORAGE_UNAVAILABLE",
          error:
            "Media download is temporarily unavailable because secure storage is not configured or not reachable.",
          details: error?.message || String(error),
        },
        { status: 503 }
      );
    }

    const responseBody = {
      assetId: asset.id,
      blobKey: asset.blobKey,
      downloadUrl,
      url: downloadUrl,
      mimeType: asset.mimeType,
      bytes: asset.bytes.toString(),
      expiresIn: 3600, // 60 minutes in seconds
    };
    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error("[media/download] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate download URL", details: error.message },
      { status: 500 }
    );
  }
}
