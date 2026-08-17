import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  actionLinkAvailability,
  findPermissionByActionSecret,
} from "@/lib/consent/lookup";
import { sendPermissionWrongRecipientNotification } from "@/lib/notifications/send-permission-wrong-recipient";

type Context = { params: Promise<{ token: string }> };

export async function POST(_request: Request, context: Context) {
  const { token } = await context.params;
  const link = await findPermissionByActionSecret(String(token || ""));
  if (!actionLinkAvailability(link).active) {
    return NextResponse.json({ success: true, state: "not_available" });
  }
  const now = new Date();
  await prisma.$transaction([
    (prisma as any).consentRequestLink.updateMany({
      where: { consentRecordId: link.consentRecordId, revokedAt: null },
      data: { revokedAt: now, revocationReason: "wrong_recipient" },
    }),
    (prisma as any).consentRecord.update({
      where: { id: link.consentRecordId },
      data: {
        lifecycleStatus: "WRONG_RECIPIENT",
        status: "wrong_recipient",
        wrongRecipientAt: now,
      },
    }),
    (prisma as any).consentEvent.create({
      data: {
        consentRecordId: link.consentRecordId,
        eventType: "wrong_recipient",
        metadata: JSON.stringify({ generation: link.generation }),
      },
    }),
  ]);
  const record = link.consentRecord;
  let notificationResults: Array<{ channel: "email" | "sms"; success: boolean }> = [];
  try {
    notificationResults = await sendPermissionWrongRecipientNotification({
      bookingId: record.bookingId,
      consentRecordId: record.id,
      vendorId: record.vendorId,
      vendorName: String(record.vendor?.businessName || record.vendor?.name || "Reliance provider"),
      serviceOrderTitle: String(record.booking?.title || record.booking?.service?.name || "Service Order"),
    });
  } catch (error) {
    console.error("[permission/wrong-recipient] manager notification failed", error);
  }
  return NextResponse.json({
    success: true,
    state: "wrong_recipient",
    providerNotificationAttempted: notificationResults.length > 0,
  });
}
