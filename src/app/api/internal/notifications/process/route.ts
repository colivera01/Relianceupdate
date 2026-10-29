import crypto from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import { rotateVerifiedPermissionLink } from "@/lib/consent/request-service";
import {
  CUSTOMER_RECORDING_NOTICE_KIND,
  isCustomerRecordingNoticeKind,
  retryRecordingNotice,
} from "@/lib/recording/recording-notice";
import {
  EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND,
  dispatchEmployeeParticipationDeclinedNotification,
  isEmployeeParticipationDeclinedNotificationKind,
} from "@/lib/notifications/send-employee-participation-declined";
import {
  SERVICE_REQUEST_NOTIFICATION_PREFIX,
  dispatchServiceRequestNotification,
  enqueueServiceRequestAppointmentReminders,
} from "@/lib/notifications/service-request";

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
  let reminderQueued = 0;
  let reminderError: string | null = null;
  try {
    const reminders = await enqueueServiceRequestAppointmentReminders({
      db: prisma as any,
      now,
      baseUrl: new URL(request.url).origin,
    });
    reminderQueued = reminders.length;
  } catch (error) {
    reminderError = error instanceof Error ? error.message.slice(0, 500) : "service_request_reminder_enqueue_failed";
    console.error("[notifications/process] appointment reminder enqueue failed:", error);
  }
  const candidates = await (prisma as any).bookingNotification.findMany({
    where: {
      OR: [
        { kind: { startsWith: "CUSTOMER_PERMISSION_REQUEST" } },
        { kind: { startsWith: CUSTOMER_RECORDING_NOTICE_KIND } },
        { kind: { startsWith: EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND } },
      ],
      status: "FAILED",
      deadLetteredAt: null,
      AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }],
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, kind: true, consentRecordId: true, attemptCount: true, maxAttempts: true },
  });

  const serviceRequestCandidates = await (prisma as any).bookingNotification.findMany({
    where: {
      kind: { startsWith: SERVICE_REQUEST_NOTIFICATION_PREFIX },
      deadLetteredAt: null,
      OR: [
        { status: "QUEUED" },
        {
          status: "FAILED",
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        { status: "SENDING", leaseExpiresAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, kind: true, attemptCount: true, maxAttempts: true },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of serviceRequestCandidates) {
    const maxAttempts = Math.max(1, Number(candidate.maxAttempts || 4));
    if (Number(candidate.attemptCount || 0) >= maxAttempts) {
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: {
          deadLetteredAt: now,
          leaseExpiresAt: null,
          lastError: "service_request_delivery_retry_limit_reached",
        },
      });
      results.push({ notificationId: candidate.id, kind: candidate.kind, status: "dead_lettered" });
      continue;
    }
    try {
      const delivered = await dispatchServiceRequestNotification({
        notificationId: candidate.id,
        actorUserId: "service-request-notification-worker",
        db: prisma as any,
      });
      results.push({ notificationId: candidate.id, kind: candidate.kind, status: delivered?.status || "FAILED" });
    } catch (error) {
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: {
          status: "FAILED",
          leaseExpiresAt: null,
          nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "service_request_retry_failed",
        },
      });
      results.push({ notificationId: candidate.id, kind: candidate.kind, status: "retry_failed" });
    }
  }
  for (const candidate of candidates) {
    const maxAttempts = Math.max(1, Number(candidate.maxAttempts || 4));
    if (Number(candidate.attemptCount || 0) >= maxAttempts) {
      const recordingNotice = isCustomerRecordingNoticeKind(candidate.kind);
      const employeeDecline = isEmployeeParticipationDeclinedNotificationKind(candidate.kind);
      await (prisma as any).bookingNotification.update({
        where: { id: candidate.id },
        data: {
          deadLetteredAt: now,
          lastError: recordingNotice
            ? "recording_notice_retry_limit_reached"
            : employeeDecline
              ? "employee_participation_decline_delivery_retry_limit_reached"
            : "permission_delivery_retry_limit_reached",
        },
      });
      results.push({ notificationId: candidate.id, status: "dead_lettered" });
      continue;
    }

    if (isCustomerRecordingNoticeKind(candidate.kind)) {
      try {
        const retried = await retryRecordingNotice(candidate.id, "recording-notice-worker");
        results.push({
          notificationId: candidate.id,
          status: retried.delivery?.status || "FAILED",
        });
      } catch (error) {
        await (prisma as any).bookingNotification.update({
          where: { id: candidate.id },
          data: {
            nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
            lastError: error instanceof Error ? error.message.slice(0, 500) : "recording_notice_retry_failed",
          },
        });
        results.push({ notificationId: candidate.id, status: "retry_failed" });
      }
      continue;
    }

    if (isEmployeeParticipationDeclinedNotificationKind(candidate.kind)) {
      const retried = await dispatchEmployeeParticipationDeclinedNotification({
        notificationId: candidate.id,
        actorUserId: "employee-participation-notification-worker",
      });
      results.push({ notificationId: candidate.id, status: retried.status });
      continue;
    }

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

  return NextResponse.json({
    success: true,
    processed: results.length,
    reminders: { queued: reminderQueued, error: reminderError },
    results,
  });
}
