import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from "@/lib/account-status";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const requestedUserId = String(searchParams.get("userId") || "").trim();
    const userId = authUserId;
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureUserAccountCanAct(userId);

    const { id } = await params;
    const rawId = String(id || "").trim();
    const entityType = String(searchParams.get("type") || "service").trim().toLowerCase();
    if (!rawId) {
      return NextResponse.json({ error: "Favorite id is required" }, { status: 400 });
    }

    if (entityType === "vendor") {
      const favorite = await (prisma as any).vendorFavorite.findFirst({
        where: { userId, OR: [{ id: rawId }, { vendorId: rawId }] },
        select: { id: true, vendorId: true },
      });
      if (!favorite) return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
      await (prisma as any).vendorFavorite.delete({ where: { id: favorite.id } });
      return NextResponse.json({
        success: true,
        removed: { entityType: "vendor", favoriteId: favorite.id, vendorId: favorite.vendorId },
        message: "Saved Vendor removed",
      });
    }
    if (entityType !== "service") {
      return NextResponse.json({ error: "Unsupported favorite type" }, { status: 422 });
    }

    const favorite = await prisma.favorite.findFirst({
      where: {
        userId,
        OR: [{ id: rawId }, { serviceId: rawId }],
      },
      select: {
        id: true,
        serviceId: true,
      },
    });

    if (!favorite) {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }

    await prisma.favorite.delete({
      where: { id: favorite.id },
    });

    return NextResponse.json({
      success: true,
      removed: {
        entityType: "service",
        favoriteId: favorite.id,
        serviceId: favorite.serviceId,
      },
      message: "Favorite removed",
    });
  } catch (error: any) {
    console.error("[users/favorites/:id] DELETE error:", error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to remove favorite", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
