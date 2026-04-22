import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  MODERATION_APPROVED,
  MODERATION_FLAGGED,
  MODERATION_REJECTED,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_PRIVATE,
  VISIBILITY_PUBLIC,
  VISIBILITY_VENDOR_ARCHIVE_ONLY,
} from "@/lib/media-visibility";

interface RouteParams {
  params: Promise<{ assetId: string }>;
}

type ModerationAction =
  | "approve_public"
  | "approve_customer_only"
  | "approve_vendor_archive_only"
  | "approve_private"
  | "set_visibility_public"
  | "set_visibility_customer_only"
  | "set_visibility_vendor_archive_only"
  | "set_visibility_private"
  | "reject"
  | "flag";

const ACTIONS = new Set<ModerationAction>([
  "approve_public",
  "approve_customer_only",
  "approve_vendor_archive_only",
  "approve_private",
  "set_visibility_public",
  "set_visibility_customer_only",
  "set_visibility_vendor_archive_only",
  "set_visibility_private",
  "reject",
  "flag",
]);

/**
 * PATCH /api/admin/media/[assetId]/moderate
 * Admin-only moderation action endpoint.
 */
export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { assetId } = await context.params;

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "") as ModerationAction;
    const moderationReason = typeof body?.moderationReason === "string" ? body.moderationReason.trim() : "";

    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: "Unsupported moderation action", message: "Unsupported moderation action" },
        { status: 422 }
      );
    }

    if (action === "reject" && !moderationReason) {
      return NextResponse.json(
        { success: false, error: "moderationReason is required for reject", message: "moderationReason is required for reject" },
        { status: 422 }
      );
    }

    const existing = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Media asset not found", message: "Media asset not found" },
        { status: 404 }
      );
    }

    const data: any = {
      moderatedAt: new Date(),
      moderatedByUserId: userId,
    };

    if (action === "approve_public") {
      data.moderationStatus = MODERATION_APPROVED;
      data.visibilityStatus = VISIBILITY_PUBLIC;
      data.moderationReason = moderationReason || null;
    } else if (action === "approve_customer_only") {
      data.moderationStatus = MODERATION_APPROVED;
      data.visibilityStatus = VISIBILITY_CUSTOMER_ONLY;
      data.moderationReason = moderationReason || null;
    } else if (action === "approve_vendor_archive_only") {
      data.moderationStatus = MODERATION_APPROVED;
      data.visibilityStatus = VISIBILITY_VENDOR_ARCHIVE_ONLY;
      data.moderationReason = moderationReason || null;
    } else if (action === "approve_private") {
      data.moderationStatus = MODERATION_APPROVED;
      data.visibilityStatus = VISIBILITY_PRIVATE;
      data.moderationReason = moderationReason || null;
    } else if (action === "set_visibility_public") {
      data.visibilityStatus = VISIBILITY_PUBLIC;
      data.moderationReason = moderationReason || null;
    } else if (action === "set_visibility_customer_only") {
      data.visibilityStatus = VISIBILITY_CUSTOMER_ONLY;
      data.moderationReason = moderationReason || null;
    } else if (action === "set_visibility_vendor_archive_only") {
      data.visibilityStatus = VISIBILITY_VENDOR_ARCHIVE_ONLY;
      data.moderationReason = moderationReason || null;
    } else if (action === "set_visibility_private") {
      data.visibilityStatus = VISIBILITY_PRIVATE;
      data.moderationReason = moderationReason || null;
    } else if (action === "reject") {
      data.moderationStatus = MODERATION_REJECTED;
      data.visibilityStatus = VISIBILITY_PRIVATE;
      data.moderationReason = moderationReason;
    } else if (action === "flag") {
      data.moderationStatus = MODERATION_FLAGGED;
      data.visibilityStatus = VISIBILITY_PRIVATE;
      data.moderationReason = moderationReason || null;
    }

    const updated = await (prisma as any).mediaAsset.update({
      where: { id: assetId },
      data,
      select: {
        id: true,
        vendorId: true,
        mediaSessionId: true,
        uploadedByMembershipId: true,
        moderationStatus: true,
        visibilityStatus: true,
        archiveStatus: true,
        moderationReason: true,
        moderatedAt: true,
        moderatedByUserId: true,
        createdAt: true,
        mimeType: true,
        bytes: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Moderation action '${action}' applied successfully`,
      asset: {
        ...updated,
        bytes: typeof updated.bytes === "bigint" ? updated.bytes.toString() : String(updated.bytes || "0"),
      },
    });
  } catch (error: any) {
    console.error("[admin/media/:assetId/moderate] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to moderate media asset", message: "Failed to moderate media asset" },
      { status: 500 }
    );
  }
}
