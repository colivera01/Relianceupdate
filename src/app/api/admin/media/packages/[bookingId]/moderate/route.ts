import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import {
  isUnclaimedBookingUserEmail,
  issueCustomerBookingClaimToken,
} from "@/lib/customer-booking-claim";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { ensureRetentionSchedulesForBooking } from "@/lib/media-lifecycle";
import {
  sendCoreAdminAuditVendorResultNotification,
  sendCorePrivateProofReadyNotification,
  sendCorePrivateProofRejectedNotification,
} from "@/lib/service-video-admin-audit-notifications";
import { isCoreAdminAuditRejectionCategory } from "@/lib/core-admin-audit-categories";
import {
  CoreAdminAuditError,
  decideCoreServiceVideoAdminAudit,
} from "@/lib/service-video-admin-audit";
import { prisma } from "@/server/db";

interface RouteParams {
  params: Promise<{ bookingId: string }>;
}

function parseMetadata(value: string | null | undefined): Record<string, any> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function customerVideoUrl(bookingId: string, claimToken?: string): string {
  const base = String(readNotificationEnv().appBaseUrl || "").trim().replace(/\/+$/, "");
  const params = new URLSearchParams({ videoReady: "1" });
  if (claimToken) params.set("claimToken", claimToken);
  return `${base}/my-bookings/${encodeURIComponent(bookingId)}?${params.toString()}`;
}

/** Applies the terminal core Admin PASS/REJECT decision to one exact submitted package. */
export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const admin = await requireAdmin(request);
    const { bookingId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const rawAction = String(body?.action || "").trim().toUpperCase();
    const decision = rawAction === "APPROVE" ? "PASS" : rawAction;
    const rejectionCategory = String(body?.rejectionCategory || "").trim();
    const reason = String(body?.reason || body?.moderationReason || "").trim();
    if (decision !== "PASS" && decision !== "REJECT") {
      return NextResponse.json(
        { success: false, error: "Admin audit requires PASS or REJECT." },
        { status: 422 },
      );
    }
    if (decision === "REJECT" && !isCoreAdminAuditRejectionCategory(rejectionCategory)) {
      return NextResponse.json(
        { success: false, error: "Select a supported Reliance Audit rejection category." },
        { status: 422 },
      );
    }
    if (decision === "REJECT" && !reason) {
      return NextResponse.json(
        { success: false, error: "A clear rejection reason is required." },
        { status: 422 },
      );
    }

    const result = await decideCoreServiceVideoAdminAudit({
      bookingId,
      adminUserId: admin.userId,
      adminRole: "ADMIN",
      decision,
      rejectionCategory,
      reason,
    });

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        vendorId: true,
        userId: true,
        title: true,
        clientName: true,
        customerMetadata: true,
        date: true,
        user: { select: { name: true, email: true, phone: true } },
        vendor: { select: { name: true, businessName: true } },
        service: { select: { name: true } },
      },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    const metadata = parseMetadata(booking.customerMetadata);
    const customer = resolveBookingCustomer(booking);
    let claimToken = "";
    if (decision === "PASS" && isUnclaimedBookingUserEmail(booking.user?.email)) {
      const issued = issueCustomerBookingClaimToken(metadata);
      claimToken = issued.rawToken;
      await (prisma as any).booking.update({
        where: { id: bookingId },
        data: { customerMetadata: JSON.stringify(issued.metadata) },
      });
    }

    let notification: any = null;
    if (result.customerNotificationId) {
      notification = decision === "PASS"
        ? await sendCorePrivateProofReadyNotification({
            notificationId: result.customerNotificationId,
            actorUserId: admin.userId,
            bookingId,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            customerName: customer.name,
            serviceName: booking.service?.name,
            bookingTitle: booking.title,
            vendorName: booking.vendor?.businessName || booking.vendor?.name,
            completedAt: booking.date,
            serviceTimeZone: metadata.service_time_zone,
            videoUrl: customerVideoUrl(bookingId, claimToken),
          })
        : await sendCorePrivateProofRejectedNotification({
            notificationId: result.customerNotificationId,
            actorUserId: admin.userId,
            bookingId,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            customerName: customer.name,
            serviceName: booking.service?.name,
            vendorName: booking.vendor?.businessName || booking.vendor?.name,
          });
    }
    if (decision === "PASS") await ensureRetentionSchedulesForBooking(bookingId);
    const vendorNotification = result.vendorNotificationId
      ? await sendCoreAdminAuditVendorResultNotification({
          notificationId: result.vendorNotificationId,
          actorUserId: admin.userId,
          bookingId,
          vendorId: booking.vendorId,
          decision,
          serviceName: booking.service?.name || booking.title,
          rejectionCategory,
          reason,
          decidedAt: result.decision.decidedAt,
        })
      : null;

    return NextResponse.json({
      success: true,
      alreadyDecided: result.alreadyDecided,
      decision,
      packageId: result.package.id,
      packageVersion: result.package.version,
      customerProofReleased: decision === "PASS",
      notification,
      vendorNotification,
      message: decision === "PASS"
        ? "Admin PASS recorded. The Private Service Video was released to the customer."
        : "Admin REJECT recorded. The Service Video package is terminal and was not released.",
    });
  } catch (error: any) {
    if (error instanceof CoreAdminAuditError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 409 },
      );
    }
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[core-admin-service-video-audit] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record the Admin audit decision." },
      { status: 500 },
    );
  }
}
