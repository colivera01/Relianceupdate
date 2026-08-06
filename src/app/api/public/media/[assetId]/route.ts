import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { generateDownloadUrl } from "@/lib/azure-blob-storage";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";

type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, context: Context) {
  const { assetId } = await context.params;
  const eligible = await resolveCanonicalPublicAssetIds();
  if (!eligible.includes(assetId)) {
    return NextResponse.json({ success: false, error: "Public Service Video is not available" }, { status: 404 });
  }
  const asset = await (prisma as any).mediaAsset.findFirst({
    where: { id: assetId, deletedAt: null, uploadState: "SAVED", moderationStatus: "approved", visibilityStatus: "public" },
    select: { blobKey: true },
  });
  if (!asset?.blobKey) {
    return NextResponse.json({ success: false, error: "Public Service Video is not available" }, { status: 404 });
  }
  const secureUrl = await generateDownloadUrl(String(asset.blobKey), 2);
  return NextResponse.redirect(secureUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
