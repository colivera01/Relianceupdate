// src/app/api/vendors/[vendorId]/invites/[inviteId]/route.ts
// Deactivate an invite

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; inviteId: string }>;
}

/**
 * PATCH /api/vendors/[vendorId]/invites/[inviteId]
 * Deactivate an invite (MANAGER only)
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, inviteId } = await params;
    await requireVendorManager(request, vendorId);

    const body = await request.json();
    const { isActive } = body;

    const invite = await (prisma as any).vendorInvite.update({
      where: { id: inviteId },
      data: { isActive },
    });

    return NextResponse.json({
      id: invite.id,
      isActive: invite.isActive,
    });
  } catch (error: any) {
    console.error("[invites] PATCH error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update invite", details: error.message },
      { status: 500 }
    );
  }
}

