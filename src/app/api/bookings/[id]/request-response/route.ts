import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/auth";
import {
  AccountStatusError,
  accountStatusErrorBody,
  ensureUserAccountCanAct,
} from "@/lib/account-status";
import { bookingIntervalsOverlap, resolveServiceDurationMinutes } from "@/lib/availability-slots";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import {
  dispatchServiceRequestNotifications,
  enqueueServiceRequestVendorEvent,
} from "@/lib/notifications/service-request";
import {
  parseServiceRequestMetadata,
  readServiceRequestLifecycle,
  serializeServiceRequestMetadata,
  transitionServiceRequestMetadata,
} from "@/lib/service-request-lifecycle";
import { prisma } from "@/server/db";

type CustomerAction = "ACCEPT_COUNTEROFFER" | "DECLINE_COUNTEROFFER";

function response(success: boolean, code: string, message: string, details?: Record<string, unknown>) {
  return { success, code, message, ...(details ? { details } : {}) };
}

function requestBaseUrl(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.APP_BASE_URL || "https://beta.relianceonline.org";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(response(false, "UNAUTHORIZED", "Sign in as the customer who made this request."), { status: 401 });
    }
    await ensureUserAccountCanAct(userId);

    const { id: bookingId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toUpperCase() as CustomerAction;
    const reason = String(body?.reason || "").trim();
    const requestId = String(body?.requestId || "").trim();
    if (!(["ACCEPT_COUNTEROFFER", "DECLINE_COUNTEROFFER"] as string[]).includes(action)) {
      return NextResponse.json(
        response(false, "COUNTEROFFER_ACTION_INVALID", "Choose whether to accept or decline the proposed appointment time."),
        { status: 422 },
      );
    }
    if (!requestId) {
      return NextResponse.json(
        response(false, "IDEMPOTENCY_KEY_REQUIRED", "Refresh this Service Record and try your response again."),
        { status: 400 },
      );
    }
    if (action === "DECLINE_COUNTEROFFER" && reason && reason.length < 3) {
      return NextResponse.json(
        response(false, "COUNTEROFFER_REASON_INVALID", "Enter a brief reason or leave the reason blank."),
        { status: 422 },
      );
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          userId: true,
          vendorId: true,
          status: true,
          scheduledFor: true,
          createdAt: true,
          customerMetadata: true,
          service: { select: { description: true } },
        },
      });
      if (!current) throw new Error("SERVICE_REQUEST_NOT_FOUND");
      if (current.userId !== userId) throw new Error("SERVICE_REQUEST_FORBIDDEN");

      const lifecycle = readServiceRequestLifecycle(current.customerMetadata, {
        requestedAt: current.createdAt,
        scheduledFor: current.scheduledFor,
      });
      const metadata = parseServiceRequestMetadata(current.customerMetadata);
      const processedIds = Array.isArray(metadata.service_request_customer_request_ids)
        ? metadata.service_request_customer_request_ids.map((value) => String(value))
        : [];
      const requestToken = requestId ? `${action}:${requestId}` : "";
      if (requestToken && processedIds.includes(requestToken)) {
        return { booking: current, lifecycle, previousStatus: current.status, idempotent: true, queued: [] as any[] };
      }
      if (String(current.status || "").toUpperCase() !== "PENDING" || lifecycle.state !== "COUNTEROFFERED") {
        throw new Error("COUNTEROFFER_STATE_CHANGED");
      }
      const proposedAt = lifecycle.proposed_scheduled_for ? new Date(lifecycle.proposed_scheduled_for) : null;
      if (!proposedAt || Number.isNaN(proposedAt.getTime())) throw new Error("COUNTEROFFER_SCHEDULE_MISSING");
      if (proposedAt.getTime() <= now.getTime()) throw new Error("COUNTEROFFER_SCHEDULE_EXPIRED");

      if (action === "ACCEPT_COUNTEROFFER") {
        const possibleConflicts = await tx.booking.findMany({
          where: {
            id: { not: current.id },
            vendorId: current.vendorId,
            status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] as any },
            scheduledFor: {
              gt: new Date(proposedAt.getTime() - 8 * 60 * 60 * 1000),
              lt: new Date(proposedAt.getTime() + 8 * 60 * 60 * 1000),
            },
          },
          select: { scheduledFor: true, service: { select: { description: true } } },
        });
        const duration = resolveServiceDurationMinutes(current.service?.description);
        if (possibleConflicts.some((candidate) => candidate.scheduledFor && bookingIntervalsOverlap(
          proposedAt,
          duration,
          candidate.scheduledFor,
          resolveServiceDurationMinutes(candidate.service?.description),
        ))) {
          throw new Error("COUNTEROFFER_SCHEDULE_UNAVAILABLE");
        }

        const transitioned = transitionServiceRequestMetadata({
          metadataValue: metadata,
          fallback: { requestedAt: current.createdAt, scheduledFor: current.scheduledFor },
          state: "SCHEDULED",
          at: now,
          actorUserId: userId,
          customerResponse: true,
          scheduledFor: proposedAt,
        });
        if (requestToken) {
          transitioned.metadata.service_request_customer_request_ids = [...processedIds, requestToken].slice(-25);
        }
        const booking = await tx.booking.update({
          where: { id: current.id },
          data: {
            status: "CONFIRMED",
            scheduledFor: proposedAt,
            date: proposedAt,
            customerMetadata: serializeServiceRequestMetadata(transitioned.metadata),
          },
          select: { id: true, status: true, scheduledFor: true, customerMetadata: true },
        });
        const queued = await enqueueServiceRequestVendorEvent({
          db: tx as any,
          bookingId: booking.id,
          event: "COUNTER_ACCEPTED_VENDOR",
          actorUserId: userId,
          baseUrl: requestBaseUrl(request),
          scheduledFor: proposedAt,
          dedupeKey: `counter-${lifecycle.counteroffer_generation}-accepted`,
        });
        return { booking, lifecycle: transitioned.lifecycle, previousStatus: current.status, idempotent: false, queued };
      }

      const transitioned = transitionServiceRequestMetadata({
        metadataValue: metadata,
        fallback: { requestedAt: current.createdAt, scheduledFor: current.scheduledFor },
        state: "CUSTOMER_DECLINED",
        at: now,
        actorUserId: userId,
        customerResponse: true,
        reason,
        scheduledFor: proposedAt,
      });
      if (requestToken) {
        transitioned.metadata.service_request_customer_request_ids = [...processedIds, requestToken].slice(-25);
      }
      const booking = await tx.booking.update({
        where: { id: current.id },
        data: {
          status: "CANCELED",
          rejectionReason: reason || "Customer declined the proposed appointment time.",
          rejectedAt: now,
          rejectedBy: userId,
          customerMetadata: serializeServiceRequestMetadata(transitioned.metadata),
        },
        select: { id: true, status: true, scheduledFor: true, customerMetadata: true },
      });
      const queued = await enqueueServiceRequestVendorEvent({
        db: tx as any,
        bookingId: booking.id,
        event: "COUNTER_DECLINED_VENDOR",
        actorUserId: userId,
        baseUrl: requestBaseUrl(request),
        reason: reason || null,
        scheduledFor: proposedAt,
        dedupeKey: `counter-${lifecycle.counteroffer_generation}-declined`,
      });
      return { booking, lifecycle: transitioned.lifecycle, previousStatus: current.status, idempotent: false, queued };
    }, { isolationLevel: "Serializable" });

    let notifications = result.queued.map((row: any) => ({ id: row.id, status: row.status || "QUEUED" }));
    if (!result.idempotent) {
      try {
        notifications = await dispatchServiceRequestNotifications(result.queued, userId, prisma as any);
      } catch (notificationError) {
        console.error("[bookings/request-response] notification dispatch deferred:", notificationError);
      }
      await recordLifecycleAudit({
        actionType: action === "ACCEPT_COUNTEROFFER" ? "customer_counteroffer_accepted" : "customer_counteroffer_declined",
        entityType: "booking",
        entityId: bookingId,
        actorUserId: userId,
        previousValue: { status: result.previousStatus },
        newValue: { status: result.booking.status, serviceRequest: result.lifecycle },
        metadata: { requestId: requestId || null },
      });
    }

    return NextResponse.json(response(
      true,
      action === "ACCEPT_COUNTEROFFER" ? "COUNTEROFFER_ACCEPTED" : "COUNTEROFFER_DECLINED",
      action === "ACCEPT_COUNTEROFFER"
        ? "The proposed time is confirmed. The business has been notified."
        : "The proposed time was declined. The business has been notified.",
      {
        booking: {
          id: result.booking.id,
          status: result.booking.status,
          scheduledFor: result.booking.scheduledFor?.toISOString?.() || result.booking.scheduledFor || null,
        },
        requestLifecycle: result.lifecycle,
        notifications,
        idempotent: result.idempotent,
      },
    ));
  } catch (error) {
    console.error("[bookings/request-response] error:", error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, { status: number; message: string }> = {
      SERVICE_REQUEST_NOT_FOUND: { status: 404, message: "Service request not found." },
      SERVICE_REQUEST_FORBIDDEN: { status: 403, message: "This service request does not belong to your account." },
      COUNTEROFFER_STATE_CHANGED: { status: 409, message: "This proposed time was already answered or changed. Refresh to see its current status." },
      COUNTEROFFER_SCHEDULE_MISSING: { status: 409, message: "This proposal does not contain a valid appointment time." },
      COUNTEROFFER_SCHEDULE_EXPIRED: { status: 409, message: "This proposed appointment time has passed. Ask the business to propose another time." },
      COUNTEROFFER_SCHEDULE_UNAVAILABLE: { status: 409, message: "That appointment time is no longer available. Ask the business to propose another time." },
    };
    if (errors[code]) {
      return NextResponse.json(response(false, code, errors[code].message), { status: errors[code].status });
    }
    return NextResponse.json(response(false, "COUNTEROFFER_RESPONSE_FAILED", "Unable to respond to this proposed time."), { status: 500 });
  }
}
