import crypto from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import { rotateVerifiedPermissionLink } from "@/lib/consent/request-service";

function secretMatches(supplied: string, expected: string): boolean {
  const left = crypto.createHash("sha256").update(supplied).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const configuredSecret = String(process.env.INTERNAL_NOTIFICATION_WORKER_SECRET || "").trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { success: false, error: "Notification worker is not configured" },
      { status: 503 }
    );
  }
  const suppliedSecret = String(request.headers.get("x-internal-notification-secret") || "").trim();
  if (!suppliedSecret || !secretMatches(suppliedSecret, configuredSecret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const candidates = await (prisma as any).bookingNotification.findMany({
    where: {
      kind: { startsWith: "CUSTOMER_PERMISSION_REQUEST" },
      status: "FAILED",
      deadLetteredAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      consentRecordId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, consentRecordId: true, attemptCount: true, maxAttempts: true },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const consentRecordId = String(candidate.consentRecordId || "").trim();
    if (!consentRecordId) continue;
    const consentRecord = await (prisma as any).consentRecord.findFirst({
      where: {
        id: consentRecordId,
        decisionEvidence: { is: null },
        lifecycleStatus: "DELIVERY_FAILED",
      },
      select: { id: true, generation: true },
    });
    if (!consentRecord) continue;

    const maxAttempts = Math.max(1, Number(candidate.maxAttempts || 4));
    if (Number(candidate.attemptCount || 0) >= maxAttempts) {
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: { deadLetteredAt: now, lastError: "permission_delivery_retry_limit_reached" },
      });
      results.push({ notificationId: candidate.id, status: "dead_lettered" });
      continue;
    }

    const leased = await (prisma as any).bookingNotification.updateMany({
      where: { id: candidate.id, status: "FAILED", deadLetteredAt: null },
      data: { leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000) },
    });
    if (Number(leased.count || 0) !== 1) continue;

    try {
      const rotated = await rotateVerifiedPermissionLink({
        consentRecordId: consentRecord.id,
        actorUserId: "permission-notification-worker",
      });
      const delivery = await deliverVerifiedPermissionRequest({
        request,
        notificationId: rotated.notificationId,
        consentRecordId: rotated.consentRecordId,
        actorUserId: "permission-notification-worker",
        actionPath: rotated.actionPath,
        recipient: rotated.recipient,
        booking: rotated.booking,
      });
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: {
          deadLetteredAt: new Date(),
          leaseExpiresAt: null,
          lastError: "superseded_by_secure_retry",
        },
      });
      results.push({ notificationId: candidate.id, status: delivery?.status || "FAILED" });
    } catch (error) {
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: {
          leaseExpiresAt: null,
          nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "permission_retry_failed",
        },
      });
      results.push({ notificationId: candidate.id, status: "retry_failed" });
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results });
}
