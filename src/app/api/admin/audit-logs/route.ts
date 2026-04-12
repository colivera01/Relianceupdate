import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/audit-logs
 * Admin-only read route for persisted admin audit logs.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const actionType = String(searchParams.get("actionType") || "").trim();
    const entityType = String(searchParams.get("entityType") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      ...(actionType ? { actionType } : {}),
      ...(entityType ? { entityType } : {}),
      ...(q
        ? {
            OR: [
              { entityId: { contains: q } },
              { actorUserId: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      (prisma as any).adminAuditLog.count({ where }),
      (prisma as any).adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          actionType: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          previousValue: true,
          newValue: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Audit logs fetched successfully",
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      appliedFilters: {
        actionType: actionType || null,
        entityType: entityType || null,
        q: q || null,
      },
    });
  } catch (error: any) {
    console.error("[admin/audit-logs] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs", message: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
