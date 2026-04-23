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

type ResolveVendorAccessOptions = {
  preferredVendorId?: string | null;
};

const MEMBERSHIP_VENDOR_SELECT = {
  id: true,
  businessName: true,
  name: true,
} as const;

function toVendorAccessContext(
  userId: string,
  membership: any | null | undefined,
  fallbackState: VendorAccessState
): VendorAccessContext {
  if (!membership) {
    return {
      state: fallbackState,
      userId,
      vendorId: null,
      membershipId: null,
      membershipStatus: null,
      role: null,
      businessName: null,
    };
  }

  return {
    state: String(membership.status || "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "PENDING",
    userId,
    vendorId: membership.vendorId ? String(membership.vendorId) : null,
    membershipId: membership.id ? String(membership.id) : null,
    membershipStatus: membership.status ? String(membership.status) : null,
    role: membership.role ? String(membership.role) : null,
    businessName: membership.vendor?.businessName || membership.vendor?.name || null,
  };
}

export function isVendorContextDbTimeoutError(error: unknown): boolean {
  const message = String((error as any)?.message || "").toLowerCase();
  const name = String((error as any)?.name || "").toLowerCase();
  return (
    name.includes("prisma") &&
    (message.includes("connection pool") ||
      message.includes("timed out fetching a new connection") ||
      message.includes("can't reach database server") ||
      message.includes("econnrefused") ||
      message.includes("etimedout"))
  );
}

export async function resolveVendorAccessForUser(
  userId: string,
  options?: ResolveVendorAccessOptions
): Promise<VendorAccessContext> {
  const preferredVendorId = options?.preferredVendorId?.trim();

  const fetchMembership = (vendorId?: string | null) =>
    (prisma as any).vendorMembership.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "PENDING"] },
        ...(vendorId ? { vendorId: String(vendorId) } : {}),
      },
      select: {
        id: true,
        vendorId: true,
        status: true,
        role: true,
        requestedAt: true,
        approvedAt: true,
        vendor: {
          select: MEMBERSHIP_VENDOR_SELECT,
        },
      },
      // Prioritize ACTIVE over PENDING, then most recent approval/request.
      orderBy: [{ status: "asc" }, { approvedAt: "desc" }, { requestedAt: "desc" }],
    });

  let membership = await fetchMembership(preferredVendorId || null);
  // Stale JWT/cookie `vendorId` pointing at a vendor the user does not belong to
  // would otherwise yield NO_ACTIVE_VENDOR_MEMBERSHIP despite a valid membership elsewhere.
  if (!membership && preferredVendorId) {
    membership = await fetchMembership(null);
  }

  if (!membership) return toVendorAccessContext(userId, null, "NONE");

  const status = String(membership.status || "").toUpperCase();
  if (status === "ACTIVE") return toVendorAccessContext(userId, membership, "ACTIVE");
  if (status === "PENDING") return toVendorAccessContext(userId, membership, "PENDING");
  return toVendorAccessContext(userId, null, "NONE");
}

export async function resolveVendorAccessFromRequest(request: Request): Promise<VendorAccessContext | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  return resolveVendorAccessForUser(userId);
}
