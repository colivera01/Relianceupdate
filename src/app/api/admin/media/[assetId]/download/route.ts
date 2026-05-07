import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { generateDownloadUrl } from "@/lib/azure-blob-storage";

interface RouteParams {
  params: Promise<{ assetId: string }>;
}

/**
 * GET /api/admin/media/[assetId]/download
 * Generate admin-scoped secure download URL for a media asset.
 */
export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { assetId } = await context.params;

    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        vendorId: true,
        blobKey: true,
        blobUrl: true,
        mimeType: true,
        bytes: true,
        deletedAt: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Media asset not found", message: "Media asset not found" }, { status: 404 });
    }

    if (asset.deletedAt) {
      return NextResponse.json({ error: "Asset has been deleted", message: "Asset has been deleted" }, { status: 410 });
    }

    let downloadUrl = "";
    try {
      downloadUrl = await generateDownloadUrl(String(asset.blobKey || ""), 60);
    } catch (error: any) {
      if (asset.blobUrl) {
        downloadUrl = String(asset.blobUrl);
      } else {
        throw new Error(error?.message || "Failed to generate secure media URL");
      }
    }

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      vendorId: asset.vendorId,
      blobKey: asset.blobKey,
      downloadUrl,
      url: downloadUrl,
      mimeType: asset.mimeType,
      bytes: typeof asset.bytes === "bigint" ? asset.bytes.toString() : String(asset.bytes || "0"),
      expiresIn: 3600,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate admin media URL", message: "Failed to generate admin media URL" },
      { status: 500 }
    );
  }
}

