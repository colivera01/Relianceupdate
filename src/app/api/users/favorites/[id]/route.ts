import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from "@/lib/account-status";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const headerUserId = String(request.headers.get("x-user-id") || "").trim();
    const requestedUserId = String(searchParams.get("userId") || "").trim();
    const userId = authUserId || headerUserId || requestedUserId || null;
    if (!userId) {
      return NextResponse.json(
        {
          error: "Authentication required",
          ...(process.env.NODE_ENV === "development"
            ? {
                details:
                  "No user identity found from auth token/cookies, x-user-id header, or userId fallback",
              }
            : {}),
        },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(userId);

    const { id } = await params;
    const rawId = String(id || "").trim();
    if (!rawId) {
      return NextResponse.json({ error: "Favorite id is required" }, { status: 400 });
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
