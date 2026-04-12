import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/publish
 * Admin-only publish control overview for vendors and services.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();

    const vendors = await prisma.vendor.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { businessName: { contains: q } },
              { category: { contains: q } },
              { businessType: { contains: q } },
            ],
          }
        : undefined,
      orderBy: [{ isPubliclyListed: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        businessName: true,
        category: true,
        businessType: true,
        isPubliclyListed: true,
        publiclyListedAt: true,
        createdAt: true,
      },
      take: 150,
    });

    const vendorIds = vendors.map((v) => v.id);
    const services = vendorIds.length
      ? await prisma.service.findMany({
          where: {
            vendorId: { in: vendorIds },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: [{ isPublished: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            vendorId: true,
            name: true,
            price: true,
            isPublished: true,
            publishedAt: true,
            createdAt: true,
          },
          take: 500,
        })
      : [];

    return NextResponse.json({
      success: true,
      message: "Publish control overview fetched successfully",
      vendors,
      services,
    });
  } catch (error: any) {
    console.error("[admin/publish] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch publish controls", message: "Failed to fetch publish controls" },
      { status: 500 }
    );
  }
}
