import { NextResponse } from "next/server";

import { resolveEmployeeDecisionActor } from "@/lib/employee-decision-entry";
import {
  assertEmployeeDecisionDisplayContext,
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
  requestIpHash,
  startEmployeeDecisionVerification,
  type EmployeeDecisionPurpose,
} from "@/lib/employee-decision-verification";
import { getEmployeeDecisionErrorResponse } from "@/lib/employee-runtime-errors";
import { sendEmployeeDecisionOtp } from "@/lib/notifications/send-employee-decision-otp";
import { prisma } from "@/server/db";

const PURPOSES = new Set(Object.values(EMPLOYEE_DECISION_PURPOSES));

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const purpose = String(body?.purpose || "").trim() as EmployeeDecisionPurpose;
    if (!PURPOSES.has(purpose)) throw new Error("EMPLOYEE_DECISION_PURPOSE_INVALID");
    const actor = await resolveEmployeeDecisionActor({
      request,
      purpose,
      requestedMembershipId: body?.membershipId,
      requestedBookingId: body?.bookingId,
    });
    const context = await loadEmployeeDecisionContext({
      db: prisma as any,
      purpose,
      userId: actor.userId,
      membershipId: actor.membershipId,
      bookingId: actor.bookingId,
    });
    assertEmployeeDecisionDisplayContext({
      context,
      entryMethod: actor.entryMethod,
      displayedContextHash: body?.contextHash,
    });
    const channel = String(body?.channel || "").trim().toLowerCase();
    if (!channel) {
      return NextResponse.json({
        success: true,
        identity: {
          employeeName: context.employeeName,
          vendorName: context.vendorName,
          serviceName: context.serviceName,
          membershipId: context.membershipId,
          bookingId: context.bookingId,
        },
        channels: {
          email: context.recipient.emailMasked,
          sms: context.recipient.phoneMasked,
        },
      });
    }
    if (channel !== "email" && channel !== "sms") {
      throw new Error("EMPLOYEE_DECISION_CHANNEL_INVALID");
    }
    const result = await startEmployeeDecisionVerification({
      db: prisma as any,
      context,
      channel,
      requestIpHash: requestIpHash(request),
      deliver: sendEmployeeDecisionOtp,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[employee/decision-verification/start] rejected", {
      code: error instanceof Error ? error.message : "EMPLOYEE_DECISION_VERIFICATION_FAILED",
    });
    const failure = getEmployeeDecisionErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
