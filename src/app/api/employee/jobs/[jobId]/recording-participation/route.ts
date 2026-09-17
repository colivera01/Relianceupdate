import { NextResponse } from "next/server";

import { resolveEmployeeDecisionActor } from "@/lib/employee-decision-entry";
import {
  EMPLOYEE_DECISION_COOKIE,
  EMPLOYEE_DECISION_PURPOSES,
  employeeDecisionCookieOptions,
  readEmployeeDecisionCookie,
  requestIpAddress,
} from "@/lib/employee-decision-verification";
import { decideEmployeeRecordingParticipation } from "@/lib/employee-recording-participation";
import { dispatchEmployeeParticipationDeclinedNotification } from "@/lib/notifications/send-employee-participation-declined";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, routeContext: Context) {
  try {
    const { jobId } = await routeContext.params;
    const body = await request.json().catch(() => ({}));
    const actor = await resolveEmployeeDecisionActor({
      request,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      requestedMembershipId: body?.membershipId,
      requestedBookingId: jobId,
    });
    const sessionSecret = readEmployeeDecisionCookie(request);
    if (!sessionSecret) throw new Error("EMPLOYEE_DECISION_SESSION_REQUIRED");
    const result = await decideEmployeeRecordingParticipation({
      db: prisma as any,
      userId: actor.userId,
      membershipId: actor.membershipId,
      bookingId: jobId,
      decision: String(body?.decision || "").trim().toUpperCase() as "ALLOW" | "DECLINE",
      sessionSecret,
      ipAddress: requestIpAddress(request),
      userAgent: request.headers.get("user-agent"),
    });
    const vendorNotification = result.vendorNotificationId
      ? await dispatchEmployeeParticipationDeclinedNotification({
          notificationId: result.vendorNotificationId,
          actorUserId: actor.userId,
          baseUrl: request.url,
        })
      : null;
    const response = NextResponse.json({ success: true, ...result, vendorNotification });
    response.cookies.set(EMPLOYEE_DECISION_COOKIE, "", {
      ...employeeDecisionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "EMPLOYEE_RECORDING_PARTICIPATION_FAILED";
    const status = code === "Unauthorized" ? 401 : code.includes("FORBIDDEN") ? 403 : 422;
    return NextResponse.json({ success: false, code, error: code }, { status });
  }
}
