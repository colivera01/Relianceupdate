import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { TRUST_OUTCOME_TYPES, tryRecordFinalizedOperationalOutcome } from "@/lib/trust-score-outcome-foundation";
import { tryRecalculateVendorTrustScore } from "@/lib/trust-score-calculator";
import { approvePrivateServiceVideoPackage } from "@/lib/service-video-evidence";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { isUnclaimedBookingUserEmail, issueCustomerBookingClaimToken } from "@/lib/customer-booking-claim";
import { ensureRetentionSchedulesForBooking } from "@/lib/media-lifecycle";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

function parseMetadata(value: string | null | undefined): Record<string, any> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function usableEmail(value: unknown): string {
  const email = String(value || "").trim();
  return email && !email.toLowerCase().endsWith("@reliance.local") ? email : "";
}

function customerVideoUrl(request: Request, bookingId: string, claimToken?: string): string {
  const configured = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  const baseUrl = configured || new URL(request.url).origin;
  const params = new URLSearchParams({ videoReady: "1" });
  if (claimToken) params.set("claimToken", claimToken);
  return `${baseUrl}/my-bookings/${encodeURIComponent(bookingId)}?${params.toString()}`;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: {
        id: true,
        userId: true,
        status: true,
        title: true,
        clientName: true,
        customerMetadata: true,
        scheduledFor: true,
        date: true,
        updatedAt: true,
        user: { select: { name: true, email: true, phone: true } },
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!booking) return NextResponse.json({ error: "Job not found for this vendor." }, { status: 404 });

    const currentStatus = normalizeBookingStatus(booking.status);
    if (currentStatus === "COMPLETED") {
      const existingGrant = await (prisma as any).privateProofAccessGrant.findFirst({
        where: { bookingId: booking.id, status: "ACTIVE", revokedAt: null },
        select: { id: true },
      });
      if (existingGrant) {
        await ensureRetentionSchedulesForBooking(booking.id);
        return NextResponse.json({
          success: true,
          alreadyApproved: true,
          message: "Private Service Video was already approved for the customer.",
          job: { id: booking.id, status: booking.status, date: booking.date, updatedAt: booking.updatedAt },
        });
      }
    }
    if (currentStatus !== "AWAITING_REVIEW") {
      return NextResponse.json(
        {
          error: "Only work records awaiting manager review can be approved.",
          code: "INVALID_APPROVAL_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const completedAt = new Date();
    const metadata = parseMetadata(booking.customerMetadata);
    let claimToken = "";
    let nextMetadata = setOperationalPhaseOnMetadataJson(booking.customerMetadata, "COMPLETED");
    if (isUnclaimedBookingUserEmail(booking.user?.email)) {
      const issuedClaim = issueCustomerBookingClaimToken(parseMetadata(nextMetadata));
      claimToken = issuedClaim.rawToken;
      nextMetadata = JSON.stringify(issuedClaim.metadata);
    }

    let approval;
    try {
      approval = await approvePrivateServiceVideoPackage({
        bookingId: booking.id,
        vendorId,
        customerUserId: booking.userId,
        managerUserId: manager.userId,
        managerMembershipId: manager.membershipId,
        completedAt,
        customerMetadata: nextMetadata,
      });
    } catch (approvalError: any) {
      return NextResponse.json(
        {
          error: "Private proof cannot be approved because its evidence chain is incomplete.",
          code: "PRIVATE_PROOF_EVIDENCE_CHAIN_INCOMPLETE",
          details: approvalError?.message || "Required evidence is missing.",
        },
        { status: 409 }
      );
    }

    await ensureRetentionSchedulesForBooking(booking.id);

    await recordLifecycleAudit({
      actionType: "private_service_video_approved",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: manager.userId,
      previousValue: { status: currentStatus },
      newValue: { status: "COMPLETED", packageId: approval.package.id, grantId: approval.grant.id },
      metadata: { vendorId, audience: "CUSTOMER_ONLY", packageHash: approval.package.packageHash },
    });

    await tryRecordFinalizedOperationalOutcome(prisma as any, {
      vendorId,
      bookingId: booking.id,
      outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
      sourceEntityType: "booking",
      sourceEntityId: booking.id,
      finalizedAt: completedAt,
      finalizedByUserId: manager.userId || null,
      metadata: { previousStatus: currentStatus, privateProofApproved: true },
    });
    const scheduledTime = booking.scheduledFor ? new Date(booking.scheduledFor).getTime() : NaN;
    if (Number.isFinite(scheduledTime) && completedAt.getTime() > scheduledTime) {
      await tryRecordFinalizedOperationalOutcome(prisma as any, {
        vendorId,
        bookingId: booking.id,
        outcomeType: TRUST_OUTCOME_TYPES.LATE_COMPLETION,
        sourceEntityType: "booking",
        sourceEntityId: booking.id,
        finalizedAt: completedAt,
        finalizedByUserId: manager.userId || null,
        metadata: {
          scheduledFor: new Date(scheduledTime).toISOString(),
          completedAt: completedAt.toISOString(),
          lateByMs: completedAt.getTime() - scheduledTime,
        },
      });
    }
    await tryRecalculateVendorTrustScore(prisma as any, vendorId, "job_approved", "job_approve");

    const customerEmail =
      usableEmail(metadata.client_email) ||
      usableEmail(metadata.claim_contact_email) ||
      usableEmail(booking.user?.email);
    const customerPhone = String(
      metadata.client_phone || metadata.claim_contact_phone || booking.user?.phone || ""
    ).trim();
    const notification = await sendVideoReadyNotification({
      actorUserId: manager.userId,
      bookingId: booking.id,
      customerEmail,
      customerPhone,
      customerName: String(booking.clientName || booking.user?.name || "").trim() || null,
      serviceName: booking.service?.name || null,
      bookingTitle: booking.title || null,
      vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
      completedAt,
      serviceTimeZone: typeof metadata.service_time_zone === "string" ? metadata.service_time_zone : null,
      videoUrl: customerVideoUrl(request, booking.id, claimToken),
    });

    return NextResponse.json({
      success: true,
      message: "Private Service Video approved and made available to the customer.",
      job: approval.booking,
      privateProof: {
        packageId: approval.package.id,
        packageVersion: approval.package.version,
        accessGrantId: approval.grant.id,
        audience: "CUSTOMER_ONLY",
      },
      notification: { ok: notification.ok, channels: notification.channels },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to approve Private Service Video", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
