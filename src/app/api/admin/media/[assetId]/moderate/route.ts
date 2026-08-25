import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import {
  MODERATION_APPROVED,
  MODERATION_FLAGGED,
  MODERATION_PENDING_REVIEW,
  MODERATION_REJECTED,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_PRIVATE,
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

const VISIBILITY_ONLY_ACTIONS = new Set<ModerationAction>([
  "set_visibility_public",
  "set_visibility_customer_only",
  "set_visibility_vendor_archive_only",
  "set_visibility_private",
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

    if (action === "approve_public" || action === "set_visibility_public") {
      return NextResponse.json(
        {
          success: false,
          error: "EXACT_MEDIA_PUBLICATION_REQUIRED",
          message: "Public visibility cannot be granted from a stage shortcut. Use the exact-media publication review.",
        },
        { status: 409 }
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
      select: {
        id: true,
        moderationStatus: true,
        mediaSession: { select: { bookingId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Media asset not found", message: "Media asset not found" },
        { status: 404 }
      );
    }
    const coreAuditPackage = existing.mediaSession?.bookingId
      ? await (prisma as any).serviceVideoPackageEvidence.findFirst({
          where: {
            bookingId: existing.mediaSession.bookingId,
            isCurrent: true,
            auditEvidenceVersion: { not: null },
            status: { in: ["AWAITING_ADMIN_REVIEW", "PRIVATE_APPROVED", "ADMIN_REJECTED"] },
          },
          select: { id: true, status: true },
        })
      : null;
    if (coreAuditPackage) {
      return NextResponse.json(
        {
          success: false,
          error: "CORE_ADMIN_AUDIT_PACKAGE_DECISION_REQUIRED",
          message: "Core-audited Service Video stages are immutable. Use the exact package audit or the separate publication workflow.",
        },
        { status: 409 },
      );
    }

    const existingModerationStatus = String(existing.moderationStatus || MODERATION_PENDING_REVIEW).trim().toLowerCase();
    if (VISIBILITY_ONLY_ACTIONS.has(action) && existingModerationStatus !== MODERATION_APPROVED) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot change visibility for unapproved media",
          message: "Visibility can only be changed when moderationStatus is 'approved'",
        },
        { status: 422 }
      );
    }

    const data: any = {
      moderatedAt: new Date(),
      moderatedByUserId: userId,
    };

    if (action === "approve_customer_only") {
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

    // Keep booking lifecycle aligned with staged-package moderation state.
    try {
      if (updated.mediaSessionId) {
        const session = await (prisma as any).mediaSession.findFirst({
          where: { id: updated.mediaSessionId },
          select: { bookingId: true, vendorId: true },
        });
        const bookingId = session?.bookingId ? String(session.bookingId) : "";
        const vendorId = session?.vendorId ? String(session.vendorId) : "";
        if (bookingId && vendorId) {
          const [booking, sessions] = await Promise.all([
            prisma.booking.findUnique({
              where: { id: bookingId },
              select: { id: true, status: true, customerMetadata: true },
            }),
            (prisma as any).mediaSession.findMany({
              where: { bookingId, vendorId },
              select: {
                id: true,
                sessionType: true,
                vendorJobVideoStage: true,
                mediaAssets: {
                  where: { deletedAt: null },
                  select: { id: true, moderationStatus: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            }),
          ]);
          if (booking) {
            const packageState = evaluateVendorJobPackageState(sessions);
            const bookingStatus = String(booking.status || "").trim().toUpperCase();
            if (packageState.hasAllRequiredStagesApproved && bookingStatus !== "COMPLETED" && bookingStatus !== "ARCHIVED") {
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  status: "COMPLETED",
                  customerMetadata: setOperationalPhaseOnMetadataJson(booking.customerMetadata, "COMPLETED"),
                },
              });
            } else if (
              bookingStatus === "CONFIRMED" &&
              packageState.hasAllRequiredStages &&
              !packageState.hasAllRequiredStagesApproved
            ) {
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  customerMetadata: setOperationalPhaseOnMetadataJson(
                    booking.customerMetadata,
                    "AWAITING_ADMIN_REVIEW"
                  ),
                },
              });
            }
          }
        }
      }
    } catch (lifecycleSyncError: any) {
      console.warn(
        "[admin/media/:assetId/moderate] booking lifecycle sync skipped:",
        lifecycleSyncError?.message || lifecycleSyncError
      );
    }

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
