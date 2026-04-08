// src/app/api/vendors/[vendorId]/memberships/[membershipId]/approve/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: { vendorId: string; membershipId: string };
}

/**
 * POST /api/vendors/[vendorId]/memberships/[membershipId]/approve
 * Approve a pending membership and register phone device (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, membershipId } = params;
    const { userId } = await requireVendorManager(request, vendorId);

    // Get membership
    const membership = await (prisma as any).vendorMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    if (membership.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (membership.status !== "PENDING") {
      return NextResponse.json(
        { error: "Membership is not pending" },
        { status: 422 }
      );
    }

    if (!membership.pendingPhoneDeviceUid) {
      return NextResponse.json(
        { error: "No phone device UID found" },
        { status: 422 }
      );
    }

    // Check if device UID already exists under a different vendor
    const existingDevice = await (prisma as any).device.findUnique({
      where: { deviceUid: membership.pendingPhoneDeviceUid },
    });

    if (existingDevice && existingDevice.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Device is already registered to another vendor" },
        { status: 409 }
      );
    }

    // Update membership to ACTIVE (using transaction to ensure atomicity)
    const updatedMembership = await (prisma as any).$transaction(async (tx: any) => {
      // Update membership
      const membership = await tx.vendorMembership.update({
        where: { id: membershipId },
        data: {
          status: "ACTIVE",
          approvedAt: new Date(),
          approvedByUserId: userId,
        },
      });

      // Upsert phone device
      if (existingDevice) {
        await tx.device.update({
          where: { id: existingDevice.id },
          data: {
            vendorId,
            isActive: true,
            lastSeenAt: new Date(),
            model: membership.pendingDeviceModel,
            os: membership.pendingDeviceOs,
            appVersion: membership.pendingAppVersion,
          },
        });
      } else {
        await tx.device.create({
          data: {
            vendorId,
            deviceUid: membership.pendingPhoneDeviceUid,
            deviceType: "PHONE",
            isActive: true,
            lastSeenAt: new Date(),
            model: membership.pendingDeviceModel,
            os: membership.pendingDeviceOs,
            appVersion: membership.pendingAppVersion,
          },
        });
      }

      return membership;
    });


    return NextResponse.json({
      success: true,
      membership: {
        id: updatedMembership.id,
        status: updatedMembership.status,
        approvedAt: updatedMembership.approvedAt,
      },
    });
  } catch (error: any) {
    console.error("[memberships/approve] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to approve membership", details: error.message },
      { status: 500 }
    );
  }
}

