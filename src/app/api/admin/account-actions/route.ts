import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";

const ACCOUNT_TYPES = new Set(["user", "vendor"]);
const ACCOUNT_STATUSES = new Set([
  "active",
  "suspended",
  "banned",
  "deactivated",
  "archived_inactive",
  "pending_approval",
]);
const ACCOUNT_ACTION_TO_STATUS: Record<string, string> = {
  suspend: "suspended",
  ban: "banned",
  deactivate: "deactivated",
  reactivate: "active",
};
const REASONS = new Set([
  "harassment",
  "fraud",
  "unsafe_conduct",
  "repeated_inappropriate_content",
  "spam",
  "impersonation",
  "policy_violation",
  "inactivity_cleanup",
  "requested_closure",
  "duplicate_account",
  "other",
]);
const VENDOR_RESTRICTED_STATUSES = new Set(["suspended", "banned", "deactivated", "archived_inactive"]);

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function accountSelect() {
  return {
    id: true,
    accountStatus: true,
    accountStatusUpdatedAt: true,
    accountStatusReason: true,
    accountStatusAdminNotes: true,
  };
}

function serializeAccountState(account: any) {
  return {
    accountStatus: String(account?.accountStatus || "active"),
    accountStatusUpdatedAt: account?.accountStatusUpdatedAt?.toISOString?.() || null,
    accountStatusReason: account?.accountStatusReason || null,
    accountStatusAdminNotes: account?.accountStatusAdminNotes || null,
  };
}

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const targetType = normalizeString(url.searchParams.get("targetType")).toLowerCase();
    const targetId = normalizeString(url.searchParams.get("targetId"));

    if (!ACCOUNT_TYPES.has(targetType) || !targetId) {
      return NextResponse.json(
        { success: false, error: "targetType must be user or vendor and targetId is required" },
        { status: 400 }
      );
    }

    const delegate = targetType === "vendor" ? (prisma as any).vendor : (prisma as any).user;
    const account = await delegate.findUnique({
      where: { id: targetId },
      select: accountSelect(),
    });

    if (!account) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        targetType,
        ...serializeAccountState(account),
      },
    });
  } catch (error: any) {
    console.error("[admin/account-actions] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json({ success: false, error: "Failed to fetch account status" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId: actorUserId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const targetType = normalizeString(body?.targetType).toLowerCase();
    const targetId = normalizeString(body?.targetId);
    const action = normalizeString(body?.action).toLowerCase();
    const requestedStatus = normalizeString(body?.accountStatus).toLowerCase();
    const reasonCategory = normalizeString(body?.reasonCategory).toLowerCase();
    const adminNotes = normalizeString(body?.adminNotes);

    if (!ACCOUNT_TYPES.has(targetType) || !targetId) {
      return NextResponse.json(
        { success: false, error: "targetType must be user or vendor and targetId is required" },
        { status: 400 }
      );
    }

    const nextStatus = ACCOUNT_ACTION_TO_STATUS[action] || requestedStatus;
    if (!nextStatus || !ACCOUNT_STATUSES.has(nextStatus)) {
      return NextResponse.json(
        { success: false, error: "Unsupported account action or accountStatus" },
        { status: 422 }
      );
    }
    if (targetType === "user" && nextStatus === "pending_approval") {
      return NextResponse.json(
        { success: false, error: "pending_approval is vendor-only" },
        { status: 422 }
      );
    }
    if (!reasonCategory || !REASONS.has(reasonCategory)) {
      return NextResponse.json(
        { success: false, error: "A supported reasonCategory is required" },
        { status: 422 }
      );
    }
    if (!adminNotes) {
      return NextResponse.json(
        { success: false, error: "adminNotes is required" },
        { status: 422 }
      );
    }

    const delegate = targetType === "vendor" ? (prisma as any).vendor : (prisma as any).user;
    const existing = await delegate.findUnique({
      where: { id: targetId },
      select: {
        ...accountSelect(),
        ...(targetType === "vendor" ? { isPubliclyListed: true, publiclyListedAt: true } : {}),
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    const previousState = serializeAccountState(existing);
    const updateData: Record<string, unknown> = {
      accountStatus: nextStatus,
      accountStatusUpdatedAt: new Date(),
      accountStatusReason: reasonCategory,
      accountStatusAdminNotes: adminNotes,
    };

    if (targetType === "vendor" && VENDOR_RESTRICTED_STATUSES.has(nextStatus)) {
      updateData.isPubliclyListed = false;
    }

    const updated = await delegate.update({
      where: { id: targetId },
      data: updateData,
      select: {
        ...accountSelect(),
        ...(targetType === "vendor" ? { isPubliclyListed: true, publiclyListedAt: true } : {}),
      },
    });

    if (targetType === "vendor" && VENDOR_RESTRICTED_STATUSES.has(nextStatus)) {
      await (prisma as any).service.updateMany({
        where: { vendorId: targetId, isPublished: true },
        data: { isPublished: false, publishedAt: null },
      });
    }

    await createAdminAuditLog({
      actionType: `ACCOUNT_${nextStatus.toUpperCase()}`,
      entityType: targetType === "vendor" ? "vendor" : "user",
      entityId: targetId,
      actorUserId,
      previousValue: {
        ...previousState,
        ...(targetType === "vendor" ? { isPubliclyListed: Boolean(existing.isPubliclyListed) } : {}),
      },
      newValue: {
        ...serializeAccountState(updated),
        ...(targetType === "vendor" ? { isPubliclyListed: Boolean(updated.isPubliclyListed) } : {}),
      },
      metadata: {
        source: "POST /api/admin/account-actions",
        action: action || "set_status",
        reasonCategory,
      },
    });

    if (nextStatus === "suspended" || nextStatus === "banned" || nextStatus === "deactivated") {
      await (prisma as any).adminNotification.create({
        data: {
          vendorId: targetType === "vendor" ? targetId : null,
          type: "ACCOUNT_ACTION",
          title: `${targetType === "vendor" ? "Vendor" : "User"} account ${nextStatus}`,
          message: `Admin changed ${targetType} ${targetId} to ${nextStatus}. Reason: ${reasonCategory}.`,
          metadata: JSON.stringify({
            targetType,
            targetId,
            status: nextStatus,
            action: action || "set_status",
            reasonCategory,
            actorUserId,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `${targetType} account status updated to ${nextStatus}`,
      account: {
        id: updated.id,
        targetType,
        ...serializeAccountState(updated),
        ...(targetType === "vendor" ? { isPubliclyListed: Boolean(updated.isPubliclyListed) } : {}),
      },
    });
  } catch (error: any) {
    console.error("[admin/account-actions] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json({ success: false, error: "Failed to update account status" }, { status: 500 });
  }
}
