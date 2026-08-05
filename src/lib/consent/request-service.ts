import { prisma } from "@/server/db";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import { createAdminAuditLog } from "@/lib/admin-audit";
import {
  PERMISSION_CONTENT_HASH,
  PERMISSION_CONTENT_JSON,
  PERMISSION_CONTENT_VERSION,
  PERMISSION_SCOPE_SCHEMA_VERSION,
  stableJson,
} from "./content-version";
import { buildPermissionRecipient } from "./recipient";
import { PERMISSION_LINK_TTL_HOURS } from "./state-machine";
import { createOpaqueSecret, hashOpaqueSecret } from "./token";
import { verifiedPermissionRequestsEnabled } from "./lookup";

export const CUSTOMER_PERMISSION_NOTIFICATION_KIND = "CUSTOMER_PERMISSION_REQUEST";

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export type CreatedPermissionRequest = {
  consentRecordId: string;
  requestLinkId: string | null;
  actionSecret: string | null;
  actionPath: string | null;
  notificationId: string | null;
  state: "pending" | "no_digital_channel" | "recipient_mismatch";
  recipient: ReturnType<typeof buildPermissionRecipient>;
  booking: any;
  generation: number;
};

export async function createVerifiedPermissionRequest(input: {
  bookingId: string;
  actorUserId: string;
  mediaSessionId?: string | null;
  reason?: "create" | "resend" | "recipient_correction";
  recipientOverride?: { name?: string | null; email?: string | null; phone?: string | null };
}): Promise<CreatedPermissionRequest> {
  if (!verifiedPermissionRequestsEnabled()) {
    throw new Error("Verified permission requests are temporarily unavailable");
  }
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      vendor: { select: { id: true, name: true, businessName: true } },
      service: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!booking) throw new Error("Permission work record not found");

  const customer = input.recipientOverride || resolveBookingCustomer(booking);
  const recipient = buildPermissionRecipient(customer);
  const metadata = parseMetadata(booking.customerMetadata);
  const assessment = await (prisma as any).recordingScopeAssessment.findFirst({
    where: { bookingId: booking.id, vendorId: booking.vendorId, isCurrent: true },
    orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
  });
  if (!assessment || assessment.status !== "COMPLETE" || !assessment.permissionRequired) {
    throw new Error("This work record does not require a customer permission request");
  }
  const recordingLocation = String(assessment.locationType || "").trim().toLowerCase();

  const recipientLookups = [
    ...(recipient.email ? [{ email: recipient.email }] : []),
    ...(recipient.phone ? [{ phone: recipient.phone }] : []),
  ];
  const linkedUsers = recipientLookups.length
    ? await prisma.user.findMany({
        where: { OR: recipientLookups },
        select: { id: true, email: true, phone: true },
      })
    : [];
  const emailOwner = recipient.email
    ? linkedUsers.find((user) => String(user.email || "").trim().toLowerCase() === recipient.email)?.id
    : null;
  const phoneOwner = recipient.phone
    ? linkedUsers.find((user) => String(user.phone || "").replace(/\D/g, "") === recipient.phone?.replace(/\D/g, ""))?.id
    : null;
  const recipientMismatch = Boolean(emailOwner && phoneOwner && emailOwner !== phoneOwner);
  const hasChannel = Boolean(recipient.email || recipient.phone);
  const scopeJson = stableJson({
    ...JSON.parse(String(assessment.scopeJson || "{}")),
    customerLabel: recipient.name || null,
    recordingAssessmentId: assessment.id,
  });
  const scopeHash = String(assessment.scopeHash);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PERMISSION_LINK_TTL_HOURS * 60 * 60 * 1000);
  const actionSecret = hasChannel && !recipientMismatch ? createOpaqueSecret() : null;
  const [latest, current] = await Promise.all([
    (prisma as any).consentRecord.findFirst({
    where: { bookingId: booking.id },
    orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
    select: { generation: true },
    }),
    (prisma as any).consentRecord.findFirst({
      where: { bookingId: booking.id, isCurrent: true },
      orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
      select: { verifiedDecision: true, decisionEvidence: { select: { id: true } } },
    }),
  ]);
  if (current?.verifiedDecision || current?.decisionEvidence) {
    throw new Error("A final recording permission decision already exists for this work record");
  }
  const generation = Number(latest?.generation || 0) + 1;

  const result = await prisma.$transaction(async (tx) => {
    const contentVersion = await (tx as any).consentContentVersion.upsert({
      where: { version: PERMISSION_CONTENT_VERSION },
      create: {
        version: PERMISSION_CONTENT_VERSION,
        contentJson: PERMISSION_CONTENT_JSON,
        contentHash: PERMISSION_CONTENT_HASH,
        scopeSchemaVersion: PERMISSION_SCOPE_SCHEMA_VERSION,
        effectiveAt: new Date("2026-07-31T00:00:00.000Z"),
      },
      update: {},
    });
    const previous = await (tx as any).consentRecord.findMany({
      where: { bookingId: booking.id, isCurrent: true },
      select: { id: true },
    });
    if (previous.length) {
      await (tx as any).consentRequestLink.updateMany({
        where: { consentRecordId: { in: previous.map((item: any) => item.id) }, revokedAt: null },
        data: { revokedAt: now, revocationReason: "superseded" },
      });
      await (tx as any).consentRecord.updateMany({
        where: { id: { in: previous.map((item: any) => item.id) } },
        data: { status: "superseded", lifecycleStatus: "SUPERSEDED", supersededAt: now, isCurrent: false },
      });
    }

    const lifecycleStatus = recipientMismatch
      ? "RECIPIENT_MISMATCH"
      : hasChannel
        ? "PENDING"
        : "NO_DIGITAL_CHANNEL";
    const record = await (tx as any).consentRecord.create({
      data: {
        token: null,
        bookingId: booking.id,
        vendorId: booking.vendorId,
        mediaSessionId: input.mediaSessionId || null,
        consentType: "video_access",
        status: "requested",
        lifecycleStatus,
        generation,
        isCurrent: true,
        verifiedDecision: false,
        recipientName: recipient.name,
        recipientEmailHash: recipient.emailHash,
        recipientPhoneHash: recipient.phoneHash,
        recipientEmailMasked: recipient.emailMasked,
        recipientPhoneMasked: recipient.phoneMasked,
        recipientMismatch,
        scopeJson,
        scopeHash,
        audioEnabled: false,
        contentVersionId: contentVersion.id,
        requestedAt: now,
        expiresAt,
      },
    });
    const link = actionSecret
      ? await (tx as any).consentRequestLink.create({
          data: {
            consentRecordId: record.id,
            secretHash: hashOpaqueSecret(actionSecret),
            generation,
            expiresAt,
          },
        })
      : null;
    const notification = actionSecret
      ? await (tx as any).bookingNotification.create({
          data: {
            bookingId: booking.id,
            consentRecordId: record.id,
            kind: `${CUSTOMER_PERMISSION_NOTIFICATION_KIND}:${record.id}`,
            status: "QUEUED",
            idempotencyKey: `permission:${record.id}:initial`,
          },
        })
      : null;
    await (tx as any).consentEvent.create({
      data: {
        consentRecordId: record.id,
        eventType: input.reason || "create",
        metadata: JSON.stringify({
          lifecycleStatus,
          generation,
          recipientEmailMasked: recipient.emailMasked,
          recipientPhoneMasked: recipient.phoneMasked,
          scopeHash,
          contentVersion: PERMISSION_CONTENT_VERSION,
        }),
      },
    });
    const nextMetadata = { ...metadata };
    if (input.recipientOverride) {
      nextMetadata.client_name = recipient.name;
      nextMetadata.client_email = recipient.email;
      nextMetadata.client_phone = recipient.phone;
    }
    delete nextMetadata.vendor_job_consent_token;
    nextMetadata.vendor_job_consent_record_id = record.id;
    nextMetadata.vendor_job_consent_accepted = false;
    nextMetadata.vendor_job_consent_status = lifecycleStatus.toLowerCase();
    nextMetadata.vendor_job_consent_notification_status = notification ? "QUEUED" : lifecycleStatus;
    nextMetadata.vendor_job_consent_last_requested_at = now.toISOString();
    await tx.booking.update({ where: { id: booking.id }, data: { customerMetadata: JSON.stringify(nextMetadata) } });
    return { record, link, notification };
  });

  await createAdminAuditLog({
    actionType: "permission_requested",
    entityType: "consent",
    entityId: result.record.id,
    actorUserId: input.actorUserId,
    metadata: {
      bookingId: booking.id,
      vendorId: booking.vendorId,
      generation,
      lifecycleStatus: result.record.lifecycleStatus,
      scopeHash,
    },
  });

  return {
    consentRecordId: result.record.id,
    requestLinkId: result.link?.id || null,
    actionSecret,
    actionPath: actionSecret ? `/consent/${encodeURIComponent(actionSecret)}` : null,
    notificationId: result.notification?.id || null,
    state: recipientMismatch ? "recipient_mismatch" : hasChannel ? "pending" : "no_digital_channel",
    recipient,
    booking,
    generation,
  };
}

export async function rotateVerifiedPermissionLink(input: {
  consentRecordId: string;
  actorUserId: string;
}) {
  const record = await (prisma as any).consentRecord.findUnique({
    where: { id: input.consentRecordId },
    include: {
      booking: {
        include: {
          vendor: { select: { id: true, name: true, businessName: true } },
          service: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      decisionEvidence: true,
    },
  });
  if (!record) throw new Error("Permission request not found");
  if (record.decisionEvidence || ["ACCEPTED", "DECLINED"].includes(String(record.status || "").toUpperCase())) {
    throw new Error("A final permission decision cannot be resent");
  }
  const recipient = buildPermissionRecipient(resolveBookingCustomer(record.booking));
  if (
    recipient.emailHash !== record.recipientEmailHash ||
    recipient.phoneHash !== record.recipientPhoneHash
  ) {
    throw new Error("Recipient details changed; correct the recipient before resending");
  }
  if (!recipient.email && !recipient.phone) throw new Error("No digital delivery channel is available");
  const actionSecret = createOpaqueSecret();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PERMISSION_LINK_TTL_HOURS * 60 * 60 * 1000);
  const generation = Number(record.generation || 1) + 1;
  const result = await prisma.$transaction(async (tx) => {
    await (tx as any).consentRequestLink.updateMany({
      where: { consentRecordId: record.id, revokedAt: null },
      data: { revokedAt: now, revocationReason: "resend_rotated" },
    });
    const updated = await (tx as any).consentRecord.update({
      where: { id: record.id },
      data: { generation, status: "requested", lifecycleStatus: "PENDING", expiresAt },
    });
    const link = await (tx as any).consentRequestLink.create({
      data: { consentRecordId: record.id, secretHash: hashOpaqueSecret(actionSecret), generation, expiresAt },
    });
    const notification = await (tx as any).bookingNotification.create({
      data: {
        bookingId: record.bookingId,
        consentRecordId: record.id,
        kind: `${CUSTOMER_PERMISSION_NOTIFICATION_KIND}:${record.id}:resend:${generation}`,
        status: "QUEUED",
        idempotencyKey: `permission:${record.id}:resend:${generation}`,
      },
    });
    await (tx as any).consentEvent.create({
      data: {
        consentRecordId: record.id,
        eventType: "resent",
        metadata: JSON.stringify({ generation, previousGeneration: record.generation }),
      },
    });
    return { updated, link, notification };
  });
  await createAdminAuditLog({
    actionType: "permission_resent",
    entityType: "consent",
    entityId: record.id,
    actorUserId: input.actorUserId,
    metadata: { bookingId: record.bookingId, generation },
  });
  return {
    consentRecordId: record.id,
    actionSecret,
    actionPath: `/consent/${encodeURIComponent(actionSecret)}`,
    notificationId: result.notification.id,
    recipient,
    booking: record.booking,
    generation,
  };
}
