import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  requirePermissionManagerForBooking,
  permissionAuthorizationStatus,
} from "@/lib/consent/authorization";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import { rotateVerifiedPermissionLink } from "@/lib/consent/request-service";

type Context = { params: Promise<{ requestId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { requestId } = await context.params;
    const record = await (prisma as any).consentRecord.findUnique({
      where: { id: requestId },
      select: { bookingId: true },
    });
    if (!record)
      return NextResponse.json(
        { success: false, error: "Permission request not found" },
        { status: 404 },
      );
    const { manager } = await requirePermissionManagerForBooking(
      request,
      record.bookingId,
    );
    const rotated = await rotateVerifiedPermissionLink({
      consentRecordId: requestId,
      actorUserId: manager.userId,
    });
    const delivery = await deliverVerifiedPermissionRequest({
      request,
      notificationId: rotated.notificationId,
      consentRecordId: rotated.consentRecordId,
      actorUserId: manager.userId,
      actionPath: rotated.actionPath,
      recipient: rotated.recipient,
      booking: rotated.booking,
    });
    return NextResponse.json({
      success: true,
      permission: {
        id: rotated.consentRecordId,
        generation: rotated.generation,
        state:
          delivery?.status === "SENT" || delivery?.status === "PARTIAL"
            ? "delivered"
            : "delivery_failed",
        recipient: {
          email: rotated.recipient.emailMasked,
          phone: rotated.recipient.phoneMasked,
        },
      },
      delivery: delivery
        ? {
            status: delivery.status,
            attemptCount: delivery.attemptCount,
            channels: delivery.channels,
            lastError: delivery.lastError,
          }
        : null,
    });
  } catch (error) {
    const status = permissionAuthorizationStatus(error);
    if (status !== 500)
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status },
      );
    const message =
      error instanceof Error
        ? error.message
        : "Unable to resend permission request";
    const safeStatus =
      message.includes("cannot") ||
      message.includes("changed") ||
      message.includes("channel")
        ? 409
        : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status: safeStatus },
    );
  }
}
