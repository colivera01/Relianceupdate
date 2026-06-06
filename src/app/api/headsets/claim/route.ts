// src/app/api/headsets/claim/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/membership-auth";

/**
 * POST /api/headsets/claim
 * Employee claims a headset via BLE (must be ACTIVE employee)
 * Auto-assigns headset to the requesting employee's membership
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      phoneDeviceUid,
      headsetUid,
      firmwareVersion,
    } = body;

    // Validate request body
    if (!phoneDeviceUid || !headsetUid) {
      return NextResponse.json(
        { error: "Phone device UID and headset UID required" },
        { status: 422 }
      );
    }

    // Get current user ID (from auth)
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1) Get ACTIVE membership for the user
    const membership = await (prisma as any).vendorMembership.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: { requestedAt: "desc" },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No active membership found" },
        { status: 403 }
      );
    }

    // 2) Verify phone device belongs to same vendor and is active
    const phoneDevice = await (prisma as any).device.findUnique({
      where: { deviceUid: phoneDeviceUid },
    });

    if (!phoneDevice) {
      return NextResponse.json(
        { error: "Phone device not found" },
        { status: 403 }
      );
    }

    if (
      phoneDevice.vendorId !== membership.vendorId ||
      phoneDevice.deviceType !== "PHONE" ||
      !phoneDevice.isActive
    ) {
      return NextResponse.json(
        { error: "Phone device not registered or inactive" },
        { status: 403 }
      );
    }

    // Check if headset already exists (before transaction for response message)
    const existingHeadsetCheck = await (prisma as any).device.findUnique({
      where: { deviceUid: headsetUid },
    });

    // 3-5) Atomic transaction: upsert headset + reassign
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Check if headset already exists
      const existingHeadset = await tx.device.findUnique({
        where: { deviceUid: headsetUid },
      });

      // If headset exists with different vendor, conflict
      if (existingHeadset && existingHeadset.vendorId !== membership.vendorId) {
        throw new Error("HEADSET_OWNED_BY_OTHER_VENDOR");
      }

      // Upsert headset device
      const headset = await tx.device.upsert({
        where: { deviceUid: headsetUid },
        create: {
          vendorId: membership.vendorId,
          deviceUid: headsetUid,
          deviceName: "Reliance Headset",
          deviceType: "HEADSET",
          firmwareVersion: firmwareVersion ?? null,
          pairedAt: new Date(),
          lastSeenAt: new Date(),
          isActive: true,
        },
        update: {
          deviceName: "Reliance Headset",
          firmwareVersion: firmwareVersion ?? undefined,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });

      // Check if already assigned to this employee
      const existingAssignment = await tx.deviceAssignment.findFirst({
        where: {
          deviceId: headset.id,
          membershipId: membership.id,
          unassignedAt: null,
        },
      });

      if (existingAssignment) {
        // Already assigned to this employee - return without creating new assignment
        return {
          headset,
          assignment: existingAssignment,
          alreadyAssigned: true,
        };
      }

      // Close any existing active assignment for this headset (reassign with history)
      await tx.deviceAssignment.updateMany({
        where: {
          deviceId: headset.id,
          unassignedAt: null,
        },
        data: {
          unassignedAt: new Date(),
        },
      });

      // Create new assignment (auto-assign to employee)
      const assignment = await tx.deviceAssignment.create({
        data: {
          vendorId: membership.vendorId,
          deviceId: headset.id,
          membershipId: membership.id,
          assignedByUserId: userId,
          assignedAt: new Date(),
        },
      });

      return {
        headset,
        assignment,
        alreadyAssigned: false,
      };
    });

    // Return success response
    if (result.alreadyAssigned) {
      return NextResponse.json({
        success: true,
        alreadyAssigned: true,
        device: {
          id: result.headset.id,
          deviceUid: result.headset.deviceUid,
          deviceType: result.headset.deviceType,
          firmwareVersion: result.headset.firmwareVersion,
        },
        assignment: {
          id: result.assignment.id,
          membershipId: result.assignment.membershipId,
          assignedAt: result.assignment.assignedAt,
        },
        message: "Headset already assigned to you",
      });
    }

    return NextResponse.json({
      success: true,
      alreadyAssigned: false,
      device: {
        id: result.headset.id,
        deviceUid: result.headset.deviceUid,
        deviceType: result.headset.deviceType,
        firmwareVersion: result.headset.firmwareVersion,
      },
      assignment: {
        id: result.assignment.id,
        membershipId: result.assignment.membershipId,
        assignedAt: result.assignment.assignedAt,
      },
      message: existingHeadsetCheck && existingHeadsetCheck.vendorId === membership.vendorId
        ? "Headset reassigned to you"
        : "Headset claimed and assigned successfully",
    });
  } catch (error: any) {
    console.error("[headsets/claim] POST error:", error);
    
    // Handle specific error cases
    if (error.message === "HEADSET_OWNED_BY_OTHER_VENDOR") {
      return NextResponse.json(
        { error: "Headset is already owned by another vendor" },
        { status: 409 }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Device UID already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to claim headset", details: error.message },
      { status: 500 }
    );
  }
}

