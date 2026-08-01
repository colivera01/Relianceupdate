import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { actionLinkAvailability, findPermissionByActionSecret } from "@/lib/consent/lookup";
import { buildIdentitySafePermissionSummary } from "@/lib/consent/public-summary";

type Context = { params: Promise<{ token: string }> };

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const link = await findPermissionByActionSecret(String(token || ""));
  if (!link) {
    return NextResponse.json({ success: false, code: "PERMISSION_NOT_AVAILABLE", error: "This recording request is not available." }, { status: 404 });
  }
  const availability = actionLinkAvailability(link);
  const record = link.consentRecord;
  if (!availability.active && availability.reason === "expired" && record.lifecycleStatus !== "EXPIRED") {
    await (prisma as any).consentRecord.update({
      where: { id: record.id },
      data: { lifecycleStatus: "EXPIRED", status: "expired" },
    });
    await (prisma as any).consentEvent.create({
      data: { consentRecordId: record.id, eventType: "action_link_expired", metadata: JSON.stringify({ generation: link.generation }) },
    });
  }
  await (prisma as any).consentRequestLink.update({ where: { id: link.id }, data: { lastViewedAt: new Date() } });
  const metadata = parseMetadata(record.booking.customerMetadata);
  const summary = buildIdentitySafePermissionSummary({
    id: record.id,
    status: availability.active ? record.status : availability.reason || record.status,
    expiresAt: link.expiresAt,
    verifiedDecision: record.verifiedDecision,
    vendorName: record.vendor.businessName || record.vendor.name || "Service provider",
    serviceName: record.booking.service?.name || record.booking.title || "Service",
    scheduledFor: record.booking.scheduledFor || record.booking.date,
    recordingLocation: String(metadata.vendor_job_recording_location || "") || null,
    audioEnabled: false,
    recipientEmailMasked: record.recipientEmailMasked,
    recipientPhoneMasked: record.recipientPhoneMasked,
  });
  return NextResponse.json({
    success: true,
    permission: {
      ...summary,
      state: availability.active ? summary.state : availability.reason,
      actionExpiresAt: link.expiresAt,
      customerName: record.recipientName || null,
      verificationOptions: {
        account: true,
        email: Boolean(record.recipientEmailHash),
        sms: Boolean(record.recipientPhoneHash),
      },
      contentVersion: record.contentVersion?.version || null,
      content: record.contentVersion ? JSON.parse(record.contentVersion.contentJson) : null,
      canDecide: availability.active,
    },
  });
}
