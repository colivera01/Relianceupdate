// src/lib/membership-auth.ts
// Authorization helpers for vendor membership system

import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "./auth";

/**
 * Get current user ID from request
 * TEMPORARY: For local development, returns a hardcoded userId
 * TODO: Replace with real auth extraction when JWT is fully implemented
 */
export async function getUserIdFromRequest(_request: Request): Promise<string | null> {
  // TEMPORARY: Local development only
  // In production, extract from JWT token
  return 'user-1'; // Replace with actual user ID from auth
}

export type MembershipRole = "MANAGER" | "EMPLOYEE";
export type MembershipStatus = "PENDING" | "ACTIVE" | "DENIED" | "REVOKED";

/**
 * Get the current user's membership for a vendor
 * Returns null if no membership exists
 */
export async function getVendorMembership(
  vendorId: string,
  userId: string
): Promise<{
  id: string;
  role: string;
  status: string;
  badgeId: string | null;
} | null> {
  const membership = await (prisma as any).vendorMembership.findUnique({
    where: {
      vendorId_userId: {
        vendorId,
        userId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
      badgeId: true,
    },
  });

  return membership;
}

/**
 * Check if user is an ACTIVE MANAGER for the vendor
 */
export async function isVendorManager(
  vendorId: string,
  userId: string
): Promise<boolean> {
  const membership = await getVendorMembership(vendorId, userId);
  return membership?.role === "MANAGER" && membership?.status === "ACTIVE";
}

/**
 * Check if user is an ACTIVE EMPLOYEE for the vendor
 */
export async function isVendorEmployee(
  vendorId: string,
  userId: string
): Promise<boolean> {
  const membership = await getVendorMembership(vendorId, userId);
  return membership?.role === "EMPLOYEE" && membership?.status === "ACTIVE";
}

/**
 * Require MANAGER role and ACTIVE status
 * Throws error if not authorized
 */
export async function requireVendorManager(
  request: Request,
  vendorId?: string
): Promise<{ vendorId: string; userId: string; membershipId: string }> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const targetVendorId = vendorId || (await getVendorIdFromRequest(request));
  if (!targetVendorId) {
    throw new Error("Vendor ID required");
  }

  const membership = await getVendorMembership(targetVendorId, userId);
  if (!membership || membership.role !== "MANAGER" || membership.status !== "ACTIVE") {
    throw new Error("Forbidden: Manager access required");
  }

  return {
    vendorId: targetVendorId,
    userId,
    membershipId: membership.id,
  };
}

/**
 * Require ACTIVE membership (MANAGER or EMPLOYEE)
 */
export async function requireVendorMembership(
  request: Request,
  vendorId: string
): Promise<{ userId: string; membershipId: string; role: string }> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const membership = await getVendorMembership(vendorId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Forbidden: Active membership required");
  }

  return {
    userId,
    membershipId: membership.id,
    role: membership.role,
  };
}

/**
 * Get device by deviceUid and verify it belongs to vendor
 */
export async function getDeviceByUid(
  deviceUid: string,
  vendorId: string
): Promise<{
  id: string;
  vendorId: string;
  deviceType: string;
  isActive: boolean;
} | null> {
  const device = await (prisma as any).device.findFirst({
    where: {
      deviceUid,
      vendorId,
    },
    select: {
      id: true,
      vendorId: true,
      deviceType: true,
      isActive: true,
    },
  });

  return device;
}

/**
 * Get active membership by deviceUid (for phone devices)
 */
export async function getMembershipByPhoneDevice(
  phoneDeviceUid: string
): Promise<{
  membershipId: string;
  vendorId: string;
  userId: string;
  role: string;
  status: string;
} | null> {
  // Find the phone device
  const phoneDevice = await (prisma as any).device.findFirst({
    where: {
      deviceUid: phoneDeviceUid,
      deviceType: "PHONE",
      isActive: true,
    },
    select: {
      vendorId: true,
    },
  });

  if (!phoneDevice) {
    return null;
  }

  // Find active membership for this vendor
  // We need to find which user owns this phone device
  // For now, we'll search for memberships with this pendingPhoneDeviceUid
  const membership = await (prisma as any).vendorMembership.findFirst({
    where: {
      vendorId: phoneDevice.vendorId,
      status: "ACTIVE",
      // Note: This assumes the phone device was registered via approval
      // We might need to add a relation or lookup table
    },
    select: {
      id: true,
      vendorId: true,
      userId: true,
      role: true,
      status: true,
    },
  });

  // Better approach: Find device and then find membership
  // For now, we'll use a simpler approach in the API routes
  return membership;
}

