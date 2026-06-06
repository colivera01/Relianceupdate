import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { accountStatusErrorBody, AccountStatusError, isVendorAccountRestricted } from "@/lib/account-status";

interface RouteParams {
  params: Promise<{ serviceId: string }>;
}

/**
 * PATCH /api/admin/services/[serviceId]/publish
 * Admin-only service publish toggle.
 */
export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { serviceId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const rawIsPublished = body?.isPublished;

    console.log("[admin/services/:serviceId/publish] Incoming request", {
      serviceId,
      actorUserId: userId,
      rawIsPublished,
    });

    if (typeof rawIsPublished !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload: isPublished must be a boolean",
          details: `Received type: ${typeof rawIsPublished}`,
        },
        { status: 422 }
      );
    }
    const isPublished = rawIsPublished;

    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        isPublished: true,
        publishedAt: true,
        vendor: { select: { accountStatus: true } },
      },
    });
    if (!existing) {
      console.warn("[admin/services/:serviceId/publish] Service not found", { serviceId });
      return NextResponse.json(
        { success: false, error: "Service not found", message: "Service not found" },
        { status: 404 }
      );
    }
    if (isPublished && isVendorAccountRestricted((existing as any).vendor?.accountStatus)) {
      const statusError = new AccountStatusError("vendor", (existing as any).vendor?.accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    if (existing.isPublished === isPublished) {
      return NextResponse.json({
        success: true,
        message: isPublished ? "Service is already published" : "Service is already unpublished",
        service: existing,
      });
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        isPublished,
        publishedAt:
          isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
      select: {
        id: true,
        vendorId: true,
        isPublished: true,
        publishedAt: true,
      },
    });

    console.log("[admin/services/:serviceId/publish] Update result", {
      serviceId: updated.id,
      vendorId: updated.vendorId,
      isPublished: updated.isPublished,
      publishedAt: updated.publishedAt,
    });

    try {
      await createAdminAuditLog({
        actionType: isPublished ? "SERVICE_PUBLISHED" : "SERVICE_UNPUBLISHED",
        entityType: "service",
        entityId: serviceId,
        actorUserId: userId,
        previousValue: {
          isPublished: existing.isPublished,
          publishedAt: existing.publishedAt?.toISOString() || null,
        },
        newValue: {
          isPublished: updated.isPublished,
          publishedAt: updated.publishedAt?.toISOString() || null,
        },
        metadata: {
          source: "PATCH /api/admin/services/[serviceId]/publish",
          vendorId: updated.vendorId,
        },
      });
    } catch (auditError: any) {
      // Publish state change must not fail because of audit storage readiness.
      console.warn("[admin/services/:serviceId/publish] Audit log write failed", {
        serviceId,
        reason: auditError?.message || "Unknown audit error",
      });
    }

    return NextResponse.json({
      success: true,
      message: isPublished
        ? "Service is now published"
        : "Service has been unpublished",
      service: updated,
    });
  } catch (error: any) {
    console.error("[admin/services/:serviceId/publish] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message, details: error?.message || "Forbidden" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update service publish state",
        message: "Failed to update service publish state",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
