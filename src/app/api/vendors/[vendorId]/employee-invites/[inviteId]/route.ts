import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; inviteId: string }>;
}

export async function DELETE(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, inviteId } = await context.params;
    await requireVendorManager(request, vendorId);

    const invite = await (prisma as any).vendorInvite.findFirst({
      where: { id: inviteId, vendorId },
      select: { id: true, isActive: true, usesCount: true },
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found for this vendor." }, { status: 404 });
    }

    if (!invite.isActive) {
      return NextResponse.json({
        success: true,
        invite: { id: invite.id, status: "cancelled", isActive: false, usesCount: invite.usesCount },
      });
    }

    const updated = await (prisma as any).vendorInvite.update({
      where: { id: invite.id },
      data: { isActive: false },
      select: { id: true, isActive: true, usesCount: true },
    });

    return NextResponse.json({
      success: true,
      invite: { id: updated.id, status: "cancelled", isActive: updated.isActive, usesCount: updated.usesCount },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to cancel invite", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
