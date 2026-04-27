// src/app/api/vendors/[vendorId]/memberships/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

function statusFilter(status: string) {
  const s = String(status || "").trim();
  const upper = s.toUpperCase();
  if (!upper) return undefined;
  return { in: [upper, s.toLowerCase(), s] };
}

/**
 * GET /api/vendors/[vendorId]/memberships?status=PENDING
 * List memberships for a vendor (MANAGER only)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await params;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusUpper = String(status || "").trim().toUpperCase();
    // Active roster reads are safe for any active member and unblock employee pages.
    if (statusUpper === "ACTIVE") {
      await requireVendorMembership(request, vendorId);
    } else {
      await requireVendorManager(request, vendorId);
    }

    const where: any = { vendorId };
    if (status) {
      where.status = statusFilter(status);
    }

    const memberships = await (prisma as any).vendorMembership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({
      memberships: memberships.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        badgeId: m.badgeId,
        requestedAt: m.requestedAt,
        approvedAt: m.approvedAt,
        deniedAt: m.deniedAt,
        revokedAt: m.revokedAt,
        pendingPhoneDeviceUid: m.pendingPhoneDeviceUid,
        pendingDeviceModel: m.pendingDeviceModel,
        pendingDeviceOs: m.pendingDeviceOs,
        pendingAppVersion: m.pendingAppVersion,
        user: m.user,
      })),
    });
  } catch (error: any) {
    console.error("[memberships] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch memberships", details: error.message },
      { status: 500 }
    );
  }
}

