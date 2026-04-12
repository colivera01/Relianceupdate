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
    await requireVendorMembership(request, vendorId);

    // Find asset and verify it belongs to this vendor
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
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

    const runtimeStorageConfig = {
      accountConfigured: Boolean(process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim()),
      keyConfigured: Boolean(process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim()),
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || "media",
    };
    console.info("[media/download] runtime storage config", runtimeStorageConfig);

    // Generate SAS URL for Azure Blob Storage (60 minute expiration)
    let downloadUrl: string;
    try {
      downloadUrl = await generateDownloadUrl(asset.blobKey, 60);
      console.info("[media/download] generateDownloadUrl result", {
        hasUrl: Boolean(downloadUrl),
        isAzureBlobHost: /\.blob\.core\.windows\.net/i.test(downloadUrl || ""),
      });
    } catch (error: any) {
      // Fallback if Azure Storage not configured
      console.warn("Azure Storage not configured, using stored URL or placeholder:", error.message);
      downloadUrl = asset.blobUrl || 
        `${process.env.BLOB_STORAGE_URL || 'https://storage.example.com'}/${asset.blobKey}?sas_token=...`;
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
    console.info("[media/download] response body", responseBody);
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

