import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { accountStatusErrorBody, AccountStatusError, isVendorAccountRestricted } from "@/lib/account-status";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * PATCH /api/admin/vendors/[vendorId]/publish
 * Admin-only vendor public listing toggle.
 */
export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { vendorId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const isPubliclyListed = Boolean(body?.isPubliclyListed);

    const existing = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, isPubliclyListed: true, publiclyListedAt: true, accountStatus: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vendor not found", message: "Vendor not found" },
        { status: 404 }
      );
    }
    if (isPubliclyListed && isVendorAccountRestricted((existing as any).accountStatus)) {
      const statusError = new AccountStatusError("vendor", (existing as any).accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    if (existing.isPubliclyListed === isPubliclyListed) {
      return NextResponse.json({
        success: true,
        message: isPubliclyListed
          ? "Vendor is already publicly listed"
          : "Vendor is already not publicly listed",
        vendor: existing,
      });
    }

    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        isPubliclyListed,
        publiclyListedAt:
          isPubliclyListed && !existing.publiclyListedAt ? new Date() : existing.publiclyListedAt,
      },
      select: {
        id: true,
        isPubliclyListed: true,
        publiclyListedAt: true,
      },
    });

    await createAdminAuditLog({
      actionType: isPubliclyListed ? "VENDOR_LISTED_PUBLICLY" : "VENDOR_UNLISTED",
      entityType: "vendor",
      entityId: vendorId,
      actorUserId: userId,
      previousValue: {
        isPubliclyListed: existing.isPubliclyListed,
        publiclyListedAt: existing.publiclyListedAt?.toISOString() || null,
      },
      newValue: {
        isPubliclyListed: updated.isPubliclyListed,
        publiclyListedAt: updated.publiclyListedAt?.toISOString() || null,
      },
      metadata: {
        source: "PATCH /api/admin/vendors/[vendorId]/publish",
      },
    });

    return NextResponse.json({
      success: true,
      message: isPubliclyListed
        ? "Vendor is now publicly listed"
        : "Vendor has been removed from public marketplace",
      vendor: updated,
    });
  } catch (error: any) {
    console.error("[admin/vendors/:vendorId/publish] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update vendor publish state", message: "Failed to update vendor publish state" },
      { status: 500 }
    );
  }
}
