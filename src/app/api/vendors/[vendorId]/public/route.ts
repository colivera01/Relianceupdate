import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/public
 * Public trust-safe vendor profile payload.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, isPubliclyListed: true },
      select: {
        id: true,
        name: true,
        businessName: true,
        businessType: true,
        category: true,
        bio: true,
        city: true,
        state: true,
        serviceAreas: true,
      },
    });

    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const services = await prisma.service.findMany({
      where: { vendorId: vendor.id, isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        createdAt: true,
      },
    });

    const serviceIds = services.map((service) => service.id);
    const publicAssets = await (prisma as any).mediaAsset.findMany({
      where: {
        vendorId: vendor.id,
        ...getApprovedActiveBaseWhere(),
        visibilityStatus: {
          in: getVisibilityStatusesForAudience("public"),
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mimeType: true,
        blobUrl: true,
        createdAt: true,
        mediaSession: {
          select: {
            serviceId: true,
            title: true,
          },
        },
      },
    });

    const previewByServiceId = new Map<string, string>();
    for (const asset of publicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const url = String(asset?.blobUrl || "").trim();
      if (!serviceId || !url || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, url);
    }

    const publicServices = services.map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        serviceDescription: service.description || "",
        price: Number(service.price),
        previewMediaUrl: previewByServiceId.get(service.id) || null,
      }));

    const publicMedia = publicAssets
      .map((asset: any) => ({
        mediaId: asset.id,
        serviceId: asset?.mediaSession?.serviceId ? String(asset.mediaSession.serviceId) : null,
        title: asset?.mediaSession?.title || "Service Media",
        mimeType: asset.mimeType,
        url: asset.blobUrl,
        createdAt: asset.createdAt,
      }))
      .filter((item: any) => item.url);

    const serviceAreas =
      typeof vendor.serviceAreas === "string"
        ? vendor.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const vendorReviewAgg = (await getVendorReviewAggregatesForPublic([vendor.id])).get(vendor.id);

    return NextResponse.json({
      success: true,
      vendor: {
        vendorId: vendor.id,
        vendorName: vendor.businessName || vendor.name || "Unknown Vendor",
        businessType: vendor.businessType || null,
        category: vendor.category || null,
        bio: vendor.bio || null,
        location: [vendor.city, vendor.state].filter(Boolean).join(", ") || null,
        serviceAreas,
        profilePhoto: null, // Intentionally omitted until profile-photo public visibility governance exists.
        rating: vendorReviewAgg?.rating ?? null,
        reviewCount: vendorReviewAgg?.reviewCount ?? null,
      },
      publicServices,
      publicMedia,
      meta: {
        serviceEligibilityRule:
          "Only vendors with isPubliclyListed=true and services with isPublished=true are returned.",
        reviewEligibilityRule:
          "Public review aggregates use vendor-level DB reviews where moderationStatus=approved and visibilityStatus=public.",
        omittedForSafety: [
          "internal settings",
          "admin/moderation internals",
          "membership/device/internal management data",
          "private/customer_only/vendor_archive_only media",
          "pending/rejected/flagged media",
          "vendor profile photo (until governed as public-safe)",
        ],
        totalServicesForVendor: serviceIds.length,
        totalPublicServicesReturned: publicServices.length,
      },
    });
  } catch (error: any) {
    console.error("[vendors/:vendorId/public] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch public vendor profile", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
