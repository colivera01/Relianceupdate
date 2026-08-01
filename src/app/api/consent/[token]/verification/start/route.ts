import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import {
  PERMISSION_DECISION_SESSION_TTL_MINUTES,
  PERMISSION_DECISION_COOKIE,
  createPermissionDecisionSessionSecret,
  permissionDecisionCookieOptions,
} from "@/lib/consent/decision-session";
import {
  actionLinkAvailability,
  findPermissionByActionSecret,
} from "@/lib/consent/lookup";
import {
  createOtp,
  hashOtp,
  PERMISSION_OTP_MAX_ATTEMPTS,
  PERMISSION_OTP_TTL_MINUTES,
} from "@/lib/consent/otp";
import {
  buildPermissionRecipient,
  hashPermissionContact,
} from "@/lib/consent/recipient";
import { hashOpaqueSecret } from "@/lib/consent/token";
import { sendPermissionOtp } from "@/lib/notifications/send-permission-otp";

type Context = { params: Promise<{ token: string }> };

const GENERIC_RESPONSE = {
  success: true,
  message: "If that verification option is available, a code has been sent.",
};

function requestIpHash(request: Request) {
  const ip = String(
    request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
  )
    .split(",")[0]
    .trim();
  return hashOpaqueSecret(`permission-ip:${ip}`);
}

async function issueDecisionSession(input: {
  recordId: string;
  verificationMethod: string;
  contactHash: string | null;
  userId: string | null;
}) {
  const session = createPermissionDecisionSessionSecret();
  const expiresAt = new Date(
    Date.now() + PERMISSION_DECISION_SESSION_TTL_MINUTES * 60 * 1000,
  );
  await (prisma as any).consentDecisionSession.create({
    data: {
      consentRecordId: input.recordId,
      secretHash: session.secretHash,
      verificationMethod: input.verificationMethod,
      verifiedContactHash: input.contactHash,
      verifiedUserId: input.userId,
      expiresAt,
    },
  });
  return { ...session, expiresAt };
}

export async function POST(request: NextRequest, context: Context) {
  const { token } = await context.params;
  const link = await findPermissionByActionSecret(String(token || ""));
  const availability = actionLinkAvailability(link);
  if (!availability.active) return NextResponse.json(GENERIC_RESPONSE);

  const body = await request.json().catch(() => ({}));
  const channel = String(body?.channel || "")
    .trim()
    .toLowerCase();
  const record = link.consentRecord;
  const userId = await getUserIdFromRequest(request);

  if (channel === "account") {
    if (!userId) return NextResponse.json(GENERIC_RESPONSE);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    const account = buildPermissionRecipient(user || {});
    const emailMatch = Boolean(
      account.emailHash && account.emailHash === record.recipientEmailHash,
    );
    const phoneMatch = Boolean(
      account.phoneHash && account.phoneHash === record.recipientPhoneHash,
    );
    if (!emailMatch && !phoneMatch) return NextResponse.json(GENERIC_RESPONSE);
    const session = await issueDecisionSession({
      recordId: record.id,
      verificationMethod: "logged_in_account",
      contactHash: emailMatch ? account.emailHash : account.phoneHash,
      userId,
    });
    await (prisma as any).consentEvent.create({
      data: {
        consentRecordId: record.id,
        eventType: "identity_verified",
        metadata: JSON.stringify({ method: "logged_in_account" }),
      },
    });
    const response = NextResponse.json({
      success: true,
      verified: true,
      expiresAt: session.expiresAt,
    });
    response.cookies.set(
      PERMISSION_DECISION_COOKIE,
      session.secret,
      permissionDecisionCookieOptions(),
    );
    return response;
  }

  if (channel !== "email" && channel !== "sms")
    return NextResponse.json(GENERIC_RESPONSE);
  const ipHash = requestIpHash(request);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await (prisma as any).consentVerificationChallenge.count({
    where: {
      createdAt: { gte: since },
      OR: [{ consentRecordId: record.id, channel }, { requestIpHash: ipHash }],
    },
  });
  if (recent >= 5) return NextResponse.json(GENERIC_RESPONSE);

  const customer = resolveBookingCustomer(record.booking);
  const recipient = buildPermissionRecipient(customer);
  const destination = channel === "email" ? recipient.email : recipient.phone;
  const expectedHash =
    channel === "email" ? record.recipientEmailHash : record.recipientPhoneHash;
  if (!destination || hashPermissionContact(destination) !== expectedHash)
    return NextResponse.json(GENERIC_RESPONSE);

  const challengeId = crypto.randomUUID();
  const code = createOtp();
  const expiresAt = new Date(
    Date.now() + PERMISSION_OTP_TTL_MINUTES * 60 * 1000,
  );
  const notification = await (prisma as any).bookingNotification.create({
    data: {
      bookingId: record.bookingId,
      consentRecordId: record.id,
      kind: `CUSTOMER_PERMISSION_OTP:${challengeId}`,
      status: "SENDING",
      attemptCount: 1,
      lastAttemptAt: new Date(),
      idempotencyKey: `permission-otp:${challengeId}`,
    },
  });
  await (prisma as any).consentVerificationChallenge.create({
    data: {
      id: challengeId,
      consentRecordId: record.id,
      requestLinkId: link.id,
      channel,
      destinationHash: expectedHash,
      codeHash: hashOtp(code, challengeId),
      expiresAt,
      maxAttempts: PERMISSION_OTP_MAX_ATTEMPTS,
      requestIpHash: ipHash,
    },
  });
  const vendorName =
    record.vendor.businessName || record.vendor.name || "Your provider";
  const serviceName =
    record.booking.service?.name || record.booking.title || "your service";
  const sent = await sendPermissionOtp({
    channel,
    destination,
    code,
    vendorName,
    serviceName,
  });
  await (prisma as any).bookingNotificationAttempt.create({
    data: {
      notificationId: notification.id,
      consentRecordId: record.id,
      channel,
      destinationMasked:
        channel === "email" ? recipient.emailMasked : recipient.phoneMasked,
      status: sent.ok ? "SENT" : "FAILED",
      attemptNumber: 1,
      providerMessageId: sent.providerMessageId || null,
      errorCode: sent.errorCode || null,
      errorMessage: sent.errorMessage || null,
    },
  });
  await (prisma as any).bookingNotification.update({
    where: { id: notification.id },
    data: {
      status: sent.ok ? "SENT" : "FAILED",
      sentAt: sent.ok ? new Date() : null,
      lastError: sent.errorMessage || null,
    },
  });
  await (prisma as any).consentEvent.create({
    data: {
      consentRecordId: record.id,
      eventType: sent.ok
        ? "verification_code_sent"
        : "verification_code_delivery_failed",
      metadata: JSON.stringify({
        channel,
        destinationMasked:
          channel === "email" ? recipient.emailMasked : recipient.phoneMasked,
      }),
    },
  });
  return NextResponse.json(GENERIC_RESPONSE);
}
