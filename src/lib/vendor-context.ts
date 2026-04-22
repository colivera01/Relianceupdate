import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";

export type VendorAccessState = "ACTIVE" | "PENDING" | "NONE";

export type VendorAccessContext = {
  state: VendorAccessState;
  userId: string;
  vendorId: string | null;
  membershipId: string | null;
  membershipStatus: string | null;
  role: string | null;
  businessName: string | null;
};

export async function resolveVendorAccessForUser(userId: string): Promise<VendorAccessContext> {
  const activeMembership = await (prisma as any).vendorMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          name: true,
        },
      },
    },
    orderBy: [{ approvedAt: "desc" }, { requestedAt: "desc" }],
  });

  if (activeMembership) {
    return {
      state: "ACTIVE",
      userId,
      vendorId: String(activeMembership.vendorId),
      membershipId: String(activeMembership.id),
      membershipStatus: String(activeMembership.status),
      role: String(activeMembership.role),
      businessName: activeMembership.vendor?.businessName || activeMembership.vendor?.name || null,
    };
  }

  const pendingMembership = await (prisma as any).vendorMembership.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          name: true,
        },
      },
    },
    orderBy: [{ requestedAt: "desc" }],
  });

  if (pendingMembership) {
    return {
      state: "PENDING",
      userId,
      vendorId: String(pendingMembership.vendorId),
      membershipId: String(pendingMembership.id),
      membershipStatus: String(pendingMembership.status),
      role: String(pendingMembership.role),
      businessName: pendingMembership.vendor?.businessName || pendingMembership.vendor?.name || null,
    };
  }

  return {
    state: "NONE",
    userId,
    vendorId: null,
    membershipId: null,
    membershipStatus: null,
    role: null,
    businessName: null,
  };
}

export async function resolveVendorAccessFromRequest(request: Request): Promise<VendorAccessContext | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  return resolveVendorAccessForUser(userId);
}
