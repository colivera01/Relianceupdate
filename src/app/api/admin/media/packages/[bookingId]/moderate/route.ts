import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { TRUST_OUTCOME_TYPES, tryRecordFinalizedOperationalOutcome } from "@/lib/trust-score-outcome-foundation";
import { tryRecalculateVendorTrustScore } from "@/lib/trust-score-calculator";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { sendVideoPackageApprovedNotification } from "@/lib/notifications/send-video-package-approved";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import {
  MODERATION_APPROVED,
  MODERATION_FLAGGED,
  MODERATION_PENDING_REVIEW,
  MODERATION_REJECTED,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_PRIVATE,
  VISIBILITY_PUBLIC,
  VISIBILITY_VENDOR_ARCHIVE_ONLY,
} from "@/lib/media-visibility";
import { normalizeVendorJobVideoStage, type VendorJobVideoStage } from "@/lib/vendor-job-video-stages";

interface RouteParams {
  params: Promise<{ bookingId: string }>;
}

type PackageModerationAction = "approve" | "reject" | "flag";
type VisibilityLevel = "public" | "customer_only" | "vendor_archive_only" | "private";

const REQUIRED_STAGES: VendorJobVideoStage[] = ["INTRO", "IN_PROGRESS", "COMPLETED"];
const ACTIONS = new Set<PackageModerationAction>(["approve", "reject", "flag"]);
const VISIBILITIES = new Set<VisibilityLevel>(["public", "customer_only", "vendor_archive_only", "private"]);

function visibilityToDbValue(level: VisibilityLevel) {
  if (level === "public") return VISIBILITY_PUBLIC;
  if (level === "customer_only") return VISIBILITY_CUSTOMER_ONLY;
  if (level === "vendor_archive_only") return VISIBILITY_VENDOR_ARCHIVE_ONLY;
  return VISIBILITY_PRIVATE;
}

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function usableCustomerEmail(value: unknown): string {
  const email = String(value || "").trim();
  return email.toLowerCase().endsWith("@reliance.local") ? "" : email;
}

function toAbsoluteVideoUrl(bookingId: string): string {
  const env = readNotificationEnv();
  const base = String(env.appBaseUrl || "").trim();
  const path = `/my-bookings/${bookingId}?videoReady=1`;
  return base ? `${base}${path}` : path;
}

function toAbsoluteVendorJobUrl(bookingId: string): string {
  const env = readNotificationEnv();
  const base = String(env.appBaseUrl || "").trim();
  const path = `/vendor/jobs/${bookingId}`;
  return base ? `${base}${path}` : path;
}

function visibilityLabel(level: VisibilityLevel): string {
  if (level === "public") return "Public";
  if (level === "customer_only") return "Customer only";
  if (level === "vendor_archive_only") return "Vendor archive only";
  return "Private / internal";
}

/**
 * PATCH /api/admin/media/packages/[bookingId]/moderate
 * Applies moderation to the latest Intro/In Progress/Completed stage assets as a single package operation.
 */
export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { bookingId } = await context.params;

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase() as PackageModerationAction;
    const visibility = String(body?.visibility || "").trim().toLowerCase() as VisibilityLevel;
    const moderationReason = typeof body?.moderationReason === "string" ? body.moderationReason.trim() : "";

    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: "Unsupported package moderation action", message: "Unsupported package moderation action" },
        { status: 422 }
      );
    }

    if (action === "approve" && !VISIBILITIES.has(visibility)) {
      return NextResponse.json(
        { success: false, error: "visibility is required for approve", message: "visibility is required for approve" },
        { status: 422 }
      );
    }

    if (action === "reject" && !moderationReason) {
      return NextResponse.json(
        { success: false, error: "moderationReason is required for reject", message: "moderationReason is required for reject" },
        { status: 422 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        vendorId: true,
        title: true,
        clientName: true,
        userId: true,
        customerMetadata: true,
        vendor: {
          select: {
            businessName: true,
            name: true,
            email: true,
            phone: true,
            memberships: {
              where: {
                status: "ACTIVE",
                role: "MANAGER",
              },
              select: {
                id: true,
                user: { select: { name: true, email: true, phone: true } },
              },
            },
          },
        },
        user: { select: { email: true, name: true, phone: true } },
        service: { select: { name: true } },
      },
    });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", message: "Booking not found" },
        { status: 404 }
      );
    }
    const bookingMetadata = parseMetadata(booking.customerMetadata);
    const customerVisibilityChoice = String(
      bookingMetadata.vendor_job_customer_visibility_choice || ""
    ).trim().toLowerCase();
    const effectiveVisibility: VisibilityLevel =
      action === "approve" && customerVisibilityChoice === "public"
        ? "public"
        : action === "approve" && customerVisibilityChoice === "private"
        ? "private"
        : visibility;

    const packageAssets = await (prisma as any).mediaAsset.findMany({
      where: {
        deletedAt: null,
        mediaSession: {
          bookingId,
          sessionType: "JOB_SERVICE_VIDEO",
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        moderationStatus: true,
        mediaSession: {
          select: {
            vendorJobVideoStage: true,
          },
        },
      },
    });

    const latestByStage = new Map<VendorJobVideoStage, { id: string; moderationStatus: string | null }>();
    for (const asset of packageAssets) {
      const stage = normalizeVendorJobVideoStage(asset.mediaSession?.vendorJobVideoStage);
      if (!stage || !REQUIRED_STAGES.includes(stage)) continue;
      if (!latestByStage.has(stage)) {
        latestByStage.set(stage, {
          id: String(asset.id),
          moderationStatus: asset.moderationStatus ? String(asset.moderationStatus) : null,
        });
      }
    }

    if (!REQUIRED_STAGES.every((stage) => latestByStage.has(stage))) {
      return NextResponse.json(
        { success: false, error: "Incomplete package", message: "Package must have Starting Condition, Work in Progress, and Final Result stages" },
        { status: 422 }
      );
    }

    const targetAssets = REQUIRED_STAGES.map((stage) => latestByStage.get(stage)!);
    const now = new Date();

    const updates = targetAssets.map((asset) => {
      const existingModerationStatus = String(asset.moderationStatus || MODERATION_PENDING_REVIEW).trim().toLowerCase();
      const data: Record<string, unknown> = {
        moderatedAt: now,
        moderatedByUserId: userId,
      };

      if (action === "approve") {
        data.moderationStatus = MODERATION_APPROVED;
        data.visibilityStatus = visibilityToDbValue(effectiveVisibility);
        data.moderationReason = null;
      } else if (action === "reject") {
        data.moderationStatus = MODERATION_REJECTED;
        data.visibilityStatus = VISIBILITY_PRIVATE;
        data.moderationReason = moderationReason;
      } else if (action === "flag") {
        data.moderationStatus = MODERATION_FLAGGED;
        data.visibilityStatus = VISIBILITY_PRIVATE;
        data.moderationReason = null;
      } else if (existingModerationStatus === MODERATION_APPROVED) {
        data.visibilityStatus = VISIBILITY_PRIVATE;
      }

      return (prisma as any).mediaAsset.update({
        where: { id: asset.id },
        data,
        select: {
          id: true,
          moderationStatus: true,
          visibilityStatus: true,
          moderationReason: true,
          moderatedAt: true,
          moderatedByUserId: true,
        },
      });
    });

    const results = await Promise.all(updates);
    if (action === "approve" || action === "reject") {
      await tryRecordFinalizedOperationalOutcome(prisma as any, {
        vendorId: booking.vendorId,
        bookingId,
        outcomeType:
          action === "approve"
            ? TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED
            : TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED,
        sourceEntityType: "media_package",
        sourceEntityId: bookingId,
        finalizedAt: now,
        finalizedByUserId: userId,
        metadata: {
          action,
          visibility: action === "approve" ? effectiveVisibility : null,
          moderationReason: action === "reject" ? moderationReason : null,
          assetIds: targetAssets.map((asset) => asset.id),
        },
      });

      // Internal-only, non-blocking Trust Score recalculation.
      await tryRecalculateVendorTrustScore(
        prisma as any,
        booking.vendorId,
        `media_package_${action}`,
        "package_moderate"
      );
    }
    if (action === "approve") {
      const metadata = parseMetadata(booking.customerMetadata);
      const nextMetadata: Record<string, unknown> = { ...metadata };
      let metadataChanged = false;

      if (effectiveVisibility === "customer_only" || effectiveVisibility === "public") {
        const alreadyNotified = Boolean(metadata.proof_ready_notification_sent_at);
      if (!alreadyNotified) {
        const videoUrl = toAbsoluteVideoUrl(bookingId);
        const customer = resolveBookingCustomer(booking);
        const customerEmail = customer.email || "";
        const customerPhone = customer.phone || "";
        const customerName = customer.name || "";
        let notified = false;
        const sendResult = await sendVideoReadyNotification({
          actorUserId: userId,
          bookingId,
          customerEmail,
          customerPhone,
          customerName,
          serviceName: booking.service?.name,
          bookingTitle: booking.title,
          vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
          videoUrl,
        });
        notified = Boolean(sendResult.ok);
        // Best-effort anti-spam gate: mark attempted once so re-approve does not spam.
        nextMetadata.proof_ready_notification_sent_at = new Date().toISOString();
        nextMetadata.proof_ready_notification_sent_success = notified;
        nextMetadata.proof_ready_notification_visibility = effectiveVisibility;
        nextMetadata.proof_ready_notification_url = videoUrl;
        metadataChanged = true;
        }
      }

      const alreadyManagerNotified = Boolean(metadata.admin_package_approved_notification_sent_at);
      if (!alreadyManagerNotified) {
        const vendorName = booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor";
        const jobTitle = booking.title || booking.service?.name || "Service order";
        const managerReviewLink = toAbsoluteVendorJobUrl(bookingId);
        const activeManagers = Array.isArray((booking.vendor as any)?.memberships)
          ? ((booking.vendor as any).memberships as any[])
          : [];
        const recipients = activeManagers.length
          ? activeManagers.map((manager) => ({
              name: manager?.user?.name || vendorName,
              email: manager?.user?.email || "",
              phone: manager?.user?.phone || "",
            }))
          : [
              {
                name: vendorName,
                email: booking.vendor?.email || "",
                phone: booking.vendor?.phone || "",
              },
            ];
        const managerResults = [];
        for (const recipient of recipients) {
          const result = await sendVideoPackageApprovedNotification({
            actorUserId: userId,
            bookingId,
            managerName: recipient.name,
            managerEmail: recipient.email,
            managerPhone: recipient.phone,
            managerReviewLink,
            vendorName,
            jobTitle,
            customerName: booking.clientName,
            visibilityLabel: visibilityLabel(effectiveVisibility),
          });
          managerResults.push({
            email: Boolean(recipient.email),
            phone: Boolean(recipient.phone),
            anySuccess: result.anySuccess,
          });
        }
        nextMetadata.admin_package_approved_notification_sent_at = new Date().toISOString();
        nextMetadata.admin_package_approved_notification_visibility = effectiveVisibility;
        nextMetadata.admin_package_approved_notification_success = managerResults.some((result) => result.anySuccess);
        metadataChanged = true;
      }

      if (metadataChanged) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { customerMetadata: JSON.stringify(nextMetadata) },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Package action '${action}' applied to ${results.length} stages`,
      bookingId,
      updatedAssets: results,
    });
  } catch (error: any) {
    console.error("[admin/media/packages/:bookingId/moderate] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to moderate package", message: "Failed to moderate package" },
      { status: 500 }
    );
  }
}
