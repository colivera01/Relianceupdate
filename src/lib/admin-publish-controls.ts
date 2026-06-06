import { prisma } from "@/server/db";
import { internalVendorNotClauses } from "@/lib/internal-identities";

export type AdminPublishVendor = {
  id: string;
  name: string | null;
  businessName: string | null;
  category: string | null;
  businessType: string | null;
  isPubliclyListed: boolean;
  publiclyListedAt: Date | null;
  createdAt: Date;
};

export type AdminPublishService = {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
};

export async function getAdminPublishOverview(query: string) {
  const q = String(query || "").trim();

  const vendorWhere = {
    demo: false,
    NOT: internalVendorNotClauses(),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { businessName: { contains: q } },
            { category: { contains: q } },
            { businessType: { contains: q } },
          ],
        }
      : {}),
  };

  const serviceWhere = {
    vendor: {
      demo: false,
      NOT: internalVendorNotClauses(),
    },
    ...(q
      ? {
          OR: [{ name: { contains: q } }, { description: { contains: q } }],
        }
      : {}),
  };

  const [vendors, services] = await Promise.all([
    prisma.vendor.findMany({
      where: vendorWhere,
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
      take: 120,
    }),
    prisma.service.findMany({
      where: serviceWhere,
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
      take: 240,
    }),
  ]);

  return {
    vendors,
    services,
  };
}
