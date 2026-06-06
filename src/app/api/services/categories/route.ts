import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

const FALLBACK_CATEGORY_LABEL = "Other Services";

/**
 * GET /api/services/categories
 * Public-safe category aggregation for browse.
 *
 * Counts only services that are currently eligible for public discovery:
 * - vendor is publicly listed
 * - service is explicitly published
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = await prisma.service.findMany({
      where: {
        isPublished: true,
        vendor: {
          isPubliclyListed: true,
          accountStatus: "active",
        },
      },
      select: {
        id: true,
        name: true,
        vendorId: true,
        vendor: {
          select: {
            category: true,
            businessType: true,
          },
        },
      },
    });

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
        meta: {
          countedServices: 0,
          note: "No public-eligible service inventory currently available.",
        },
      });
    }

    const categoryMap = new Map<
      string,
      {
        key: string;
        label: string;
        serviceIds: Set<string>;
        vendorIds: Set<string>;
        sampleServiceNames: string[];
      }
    >();

    for (const service of services) {
      const rawCategory = String(service.vendor.category || service.vendor.businessType || "").trim();
      const categoryLabel = rawCategory || FALLBACK_CATEGORY_LABEL;
      const categoryKey = categoryLabel.toLowerCase().replace(/\s+/g, "-");

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          key: categoryKey,
          label: categoryLabel,
          serviceIds: new Set(),
          vendorIds: new Set(),
          sampleServiceNames: [],
        });
      }

      const entry = categoryMap.get(categoryKey)!;
      entry.serviceIds.add(service.id);
      entry.vendorIds.add(service.vendorId);
      if (entry.sampleServiceNames.length < 3) {
        entry.sampleServiceNames.push(service.name);
      }
    }

    const categories = Array.from(categoryMap.values())
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        serviceCount: entry.serviceIds.size,
        vendorCount: entry.vendorIds.size,
        sampleServices: entry.sampleServiceNames,
      }))
      .sort((a, b) => b.serviceCount - a.serviceCount || a.label.localeCompare(b.label));

    return NextResponse.json({
      success: true,
      categories,
      meta: {
        countedServices: services.length,
        eligibilityRule:
          "Only services where vendor.accountStatus=active, vendor.isPubliclyListed=true, and service.isPublished=true are counted.",
      },
    });
  } catch (error: any) {
    console.error("[services/categories] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch category aggregation", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
