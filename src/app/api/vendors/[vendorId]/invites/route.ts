// src/app/api/vendors/[vendorId]/invites/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import crypto from "crypto";

interface RouteParams {
  params: { vendorId: string };
}

/**
 * POST /api/vendors/[vendorId]/invites
 * Create a new invite (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = params;
    const { userId } = await requireVendorManager(request, vendorId);

    const body = await request.json();
    const { expiresInHours = 24, maxUses } = body;

    // Generate unique code (6 characters)
    let code: string;
    let isUnique = false;
    while (!isUnique) {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();
      const existing = await (prisma as any).vendorInvite.findUnique({
        where: { code },
      });
      if (!existing) isUnique = true;
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const invite = await (prisma as any).vendorInvite.create({
      data: {
        vendorId,
        code: code!,
        token,
        createdByUserId: userId,
        expiresAt,
        maxUses: maxUses || null,
        usesCount: 0,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      token: invite.token,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?token=${invite.token}&code=${invite.code}`,
    });
  } catch (error: any) {
    console.error("[invites] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create invite", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vendors/[vendorId]/invites
 * List all invites for a vendor (MANAGER only)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = params;
    await requireVendorManager(request, vendorId);

    const invites = await (prisma as any).vendorInvite.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      invites: invites.map((invite: any) => ({
        id: invite.id,
        code: invite.code,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        usesCount: invite.usesCount,
        isActive: invite.isActive,
        createdAt: invite.createdAt,
        createdBy: invite.createdBy,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?token=${invite.token}&code=${invite.code}`,
      })),
    });
  } catch (error: any) {
    console.error("[invites] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch invites", details: error.message },
      { status: 500 }
    );
  }
}

