import { NextResponse } from "next/server";

import { resolveEmployeeDecisionActor } from "@/lib/employee-decision-entry";
import {
  assertEmployeeDecisionDisplayContext,
  EMPLOYEE_DECISION_COOKIE,
  EMPLOYEE_DECISION_PURPOSES,
  employeeDecisionCookieOptions,
  loadEmployeeDecisionContext,
  verifyEmployeeDecisionOtp,
  type EmployeeDecisionPurpose,
} from "@/lib/employee-decision-verification";
import { getEmployeeDecisionErrorResponse } from "@/lib/employee-runtime-errors";
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
    const result = await verifyEmployeeDecisionOtp({
      db: prisma as any,
      challengeId: String(body?.challengeId || "").trim(),
      code: String(body?.code || "").trim(),
      expectedContext: context,
    });
    const response = NextResponse.json({ success: true, verified: true, expiresAt: result.expiresAt });
    response.cookies.set(
      EMPLOYEE_DECISION_COOKIE,
      result.secret,
      employeeDecisionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("[employee/decision-verification/verify] rejected", {
      code: error instanceof Error ? error.message : "EMPLOYEE_DECISION_VERIFICATION_FAILED",
    });
    const failure = getEmployeeDecisionErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
