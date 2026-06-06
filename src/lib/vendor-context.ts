import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { isUserAccountRestricted, isVendorAccountRestricted, normalizeAccountStatus } from "@/lib/account-status";

export type VendorAccessState = "ACTIVE" | "PENDING" | "RESTRICTED" | "NONE";

export type VendorAccessContext = {
  state: VendorAccessState;
  userId: string;
  vendorId: string | null;
  membershipId: string | null;
  membershipStatus: string | null;
  accountStatus: string | null;
  restrictedAccountType: "user" | "vendor" | null;
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
  accountStatus: true,
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
      accountStatus: null,
      restrictedAccountType: null,
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
    accountStatus: normalizeAccountStatus(membership.vendor?.accountStatus),
    restrictedAccountType: isVendorAccountRestricted(membership.vendor?.accountStatus) ? "vendor" : null,
    role: membership.role ? String(membership.role) : null,
    businessName: membership.vendor?.businessName || membership.vendor?.name || null,
  };
}

function normalizeMembershipStatus(status: unknown, approvedAt: unknown): "ACTIVE" | "PENDING" | "DENIED" | "REVOKED" | "UNKNOWN" {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "PENDING" || normalized === "DENIED" || normalized === "REVOKED") {
    // Data-drift fallback: approvedAt set but status left as pending.
    if (normalized === "PENDING" && approvedAt) return "ACTIVE";
    return normalized;
  }
  if (approvedAt) return "ACTIVE";
  return "UNKNOWN";
}

function normalizeMembershipRole(role: unknown): "MANAGER" | "EMPLOYEE" | "UNKNOWN" {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "MANAGER" || normalized === "EMPLOYEE") return normalized;
  return "UNKNOWN";
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
  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true },
  });
  if (user && isUserAccountRestricted(user.accountStatus)) {
    return {
      state: "RESTRICTED",
      userId,
      vendorId: null,
      membershipId: null,
      membershipStatus: null,
      accountStatus: normalizeAccountStatus(user.accountStatus),
      restrictedAccountType: "user",
      role: null,
      businessName: null,
    };
  }
  const memberships = await (prisma as any).vendorMembership.findMany({
    where: {
      userId,
      ...(preferredVendorId ? { vendorId: String(preferredVendorId) } : {}),
    },
    select: {
      id: true,
      vendorId: true,
      status: true,
      role: true,
      requestedAt: true,
      approvedAt: true,
      vendor: { select: MEMBERSHIP_VENDOR_SELECT },
    },
  });

  const fallbackMemberships =
    memberships.length === 0 && preferredVendorId
      ? await (prisma as any).vendorMembership.findMany({
          where: { userId },
          select: {
            id: true,
            vendorId: true,
            status: true,
            role: true,
            requestedAt: true,
            approvedAt: true,
            vendor: { select: MEMBERSHIP_VENDOR_SELECT },
          },
        })
      : memberships;

  if (!fallbackMemberships.length) return toVendorAccessContext(userId, null, "NONE");

  const ranked = [...fallbackMemberships].sort((a: any, b: any) => {
    const statusA = normalizeMembershipStatus(a.status, a.approvedAt);
    const statusB = normalizeMembershipStatus(b.status, b.approvedAt);
    const roleA = normalizeMembershipRole(a.role);
    const roleB = normalizeMembershipRole(b.role);
    const statusScore = (status: string) => (status === "ACTIVE" ? 0 : status === "PENDING" ? 1 : 2);
    const roleScore = (role: string) => (role === "MANAGER" ? 0 : role === "EMPLOYEE" ? 1 : 2);
    const statusDelta = statusScore(statusA) - statusScore(statusB);
    if (statusDelta !== 0) return statusDelta;
    const roleDelta = roleScore(roleA) - roleScore(roleB);
    if (roleDelta !== 0) return roleDelta;
    return new Date(b.approvedAt || b.requestedAt || 0).getTime() - new Date(a.approvedAt || a.requestedAt || 0).getTime();
  });

  const membership = ranked[0];
  const status = normalizeMembershipStatus(membership.status, membership.approvedAt);
  const vendorStatus = normalizeAccountStatus(membership.vendor?.accountStatus);
  if (isVendorAccountRestricted(vendorStatus)) {
    const context = toVendorAccessContext(userId, membership, "RESTRICTED");
    return {
      ...context,
      state: "RESTRICTED",
      accountStatus: vendorStatus,
      restrictedAccountType: "vendor",
    };
  }
  if (status === "ACTIVE") return toVendorAccessContext(userId, membership, "ACTIVE");
  if (status === "PENDING") return toVendorAccessContext(userId, membership, "PENDING");
  return toVendorAccessContext(userId, null, "NONE");
}

export async function resolveVendorAccessFromRequest(request: Request): Promise<VendorAccessContext | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  return resolveVendorAccessForUser(userId);
}
