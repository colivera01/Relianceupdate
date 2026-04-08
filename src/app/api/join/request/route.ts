// src/app/api/join/request/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import crypto from "crypto";

/**
 * POST /api/join/request
 * Employee requests to join a vendor using invite code/token
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      token,
      code,
      badgeId,
      phoneDeviceUid,
      deviceMeta = {},
    } = body;

    if (!token && !code) {
      return NextResponse.json(
        { error: "Token or code required" },
        { status: 422 }
      );
    }

    if (!badgeId) {
      return NextResponse.json(
        { error: "Badge ID required" },
        { status: 422 }
      );
    }

    if (!phoneDeviceUid) {
      return NextResponse.json(
        { error: "Phone device UID required" },
        { status: 422 }
      );
    }

    // Find invite by token or code
    const invite = await (prisma as any).vendorInvite.findFirst({
      where: {
        OR: [
          token ? { token } : {},
          code ? { code } : {},
        ],
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invite code or token" },
        { status: 409 }
      );
    }

    if (!invite.isActive) {
      return NextResponse.json(
        { error: "Invite is no longer active" },
        { status: 409 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 409 }
      );
    }

    if (invite.maxUses && invite.usesCount >= invite.maxUses) {
      return NextResponse.json(
        { error: "Invite has reached maximum uses" },
        { status: 409 }
      );
    }

    // Check if user already exists or create new user
    // For now, we'll create a user with phone as identifier
    let user = await (prisma as any).user.findFirst({
      where: {
        OR: [
          { phone: deviceMeta.phone },
          // Could also check by device UID if we store it
        ],
      },
    });

    if (!user) {
      // Create new user
      user = await (prisma as any).user.create({
        data: {
          name: deviceMeta.name || `Employee ${badgeId}`,
          phone: deviceMeta.phone || phoneDeviceUid,
          email: deviceMeta.email,
        },
      });
    }

    // Check if membership already exists
    const existingMembership = await (prisma as any).vendorMembership.findUnique({
      where: {
        vendorId_userId: {
          vendorId: invite.vendorId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      // Update invite uses count
      await (prisma as any).vendorInvite.update({
        where: { id: invite.id },
        data: { usesCount: invite.usesCount + 1 },
      });

      return NextResponse.json({
        status: existingMembership.status,
        membershipId: existingMembership.id,
      });
    }

    // Create new membership with PENDING status
    const membership = await (prisma as any).vendorMembership.create({
      data: {
        vendorId: invite.vendorId,
        userId: user.id,
        role: "EMPLOYEE",
        status: "PENDING",
        badgeId,
        pendingPhoneDeviceUid: phoneDeviceUid,
        pendingDeviceModel: deviceMeta.model,
        pendingDeviceOs: deviceMeta.os,
        pendingAppVersion: deviceMeta.appVersion,
      },
    });

    // Update invite uses count
    await (prisma as any).vendorInvite.update({
      where: { id: invite.id },
      data: { usesCount: invite.usesCount + 1 },
    });

    return NextResponse.json({
      status: "PENDING",
      membershipId: membership.id,
    });
  } catch (error: any) {
    console.error("[join/request] POST error:", error);
    if (error.code === "P2002") {
      // Unique constraint violation
      return NextResponse.json(
        { error: "Membership already exists for this user" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process join request", details: error.message },
      { status: 500 }
    );
  }
}

