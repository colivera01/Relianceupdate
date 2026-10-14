import { NextResponse } from "next/server";

import { resolveEmployeeDecisionActor } from "@/lib/employee-decision-entry";
import {
  EMPLOYEE_DECISION_COOKIE,
  EMPLOYEE_DECISION_PURPOSES,
  employeeDecisionCookieOptions,
  readEmployeeDecisionCookie,
} from "@/lib/employee-decision-verification";
import { getEmployeeDecisionErrorResponse } from "@/lib/employee-runtime-errors";
import {
  betaRoleAssentApiPresentation,
  ensureBetaRoleAssentContent,
  getEmployeeRoleAssentStatus,
  loadEmployeeRoleAssentContext,
  recordEmployeeRoleAssent,
} from "@/lib/legal/role-assent-service";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { prisma } from "@/server/db";

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "EMPLOYEE_ROLE_ASSENT_FAILED";
  if (
    code.startsWith("EMPLOYEE_") ||
    code === "Unauthorized" ||
    code === "ROLE_ASSENT_CONTENT_STALE"
  ) {
    if (code === "EMPLOYEE_ROLE_ASSENT_ACKNOWLEDGEMENTS_REQUIRED") {
      return NextResponse.json(
        { success: false, code, error: "Complete every required acknowledgment before continuing." },
        { status: 400 },
      );
    }
    if (code === "ROLE_ASSENT_CONTENT_STALE") {
      return NextResponse.json(
        { success: false, code, error: "The legal content changed. Reload and review the current versions.", staleContext: true },
        { status: 409 },
      );
    }
    const mapped = getEmployeeDecisionErrorResponse(error, "verification");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const status = code === "ROLE_ASSENT_NOT_ENABLED" ? 404 : code.includes("STALE") ? 409 : 400;
  return NextResponse.json(
    { success: false, code, error: "Employee Service Order assent could not be completed." },
    { status },
  );
}

async function employeeContext(request: Request, body: any) {
  const actor = await resolveEmployeeDecisionActor({
    request,
    purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT,
    requestedMembershipId: body?.membershipId,
    requestedBookingId: body?.bookingId,
  });
  if (actor.entryMethod !== "SERVICE_ORDER_ENTRY") {
    throw new Error("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
  }
  if (!actor.bookingId) throw new Error("EMPLOYEE_RECORDING_CONTEXT_REQUIRED");
  const context = await loadEmployeeRoleAssentContext({
    db: prisma as any,
    userId: actor.userId,
    membershipId: actor.membershipId,
    bookingId: actor.bookingId,
  });
  const expected = String(body?.contextHash || "").trim();
  if (expected && expected !== context.decisionContext.contextHash) {
    throw new Error("EMPLOYEE_RECORDING_PARTICIPATION_CONTEXT_STALE");
  }
  return { actor, context };
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const body = {
      membershipId: query.get("membershipId"),
      bookingId: query.get("bookingId"),
      contextHash: query.get("contextHash"),
    };
    const { context } = await employeeContext(request, body);
    await ensureBetaRoleAssentContent(prisma as any);
    const status = await getEmployeeRoleAssentStatus({ db: prisma as any, context });
    return NextResponse.json({
      success: true,
      enabled: true,
      identity: {
        employeeName: context.decisionContext.employeeName,
        vendorName: context.decisionContext.vendorName,
        serviceName: context.decisionContext.serviceName,
        membershipId: context.membershipId,
        bookingId: context.bookingId,
      },
      serviceOrderContextHash: context.decisionContext.contextHash,
      status,
      presentation: betaRoleAssentApiPresentation("EMPLOYEE"),
    });
  } catch (error) {
    console.error("[employee/legal-assent] read rejected", {
      code: error instanceof Error ? error.message : "EMPLOYEE_ROLE_ASSENT_FAILED",
    });
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { actor, context } = await employeeContext(request, body);
    const decision = String(body?.decision || "").trim().toUpperCase();
    if (decision === "WRONG_RECIPIENT") {
      await recordLifecycleAudit({
        actionType: "employee_service_order_wrong_recipient_reported",
        entityType: "booking",
        entityId: context.bookingId,
        actorUserId: actor.userId,
        newValue: { outcome: "IDENTITY_CORRECTION_REQUESTED" },
        metadata: {
          vendorId: context.vendorId,
          membershipId: context.membershipId,
          verifiedEmployeeAssent: false,
          serviceOrderContextHash: context.decisionContext.contextHash,
        },
      });
      return NextResponse.json({
        success: true,
        correctionRequested: true,
        message: "This was recorded as an identity correction, not assent or a recording decision.",
      });
    }
    if (decision !== "ASSENT" && decision !== "DECLINE") {
      throw new Error("ROLE_ASSENT_DECISION_INVALID");
    }
    const sessionSecret = readEmployeeDecisionCookie(request);
    if (!sessionSecret) throw new Error("EMPLOYEE_DECISION_SESSION_REQUIRED");
    const result = await recordEmployeeRoleAssent({
      db: prisma as any,
      userId: actor.userId,
      membershipId: context.membershipId,
      bookingId: context.bookingId,
      decision,
      sessionSecret,
      expectedServiceOrderContextHash: String(body?.contextHash || "").trim(),
      acknowledgements: {
        identity: body?.acknowledgements?.identity === true,
        terms: body?.acknowledgements?.terms === true,
        privacy: body?.acknowledgements?.privacy === true,
        electronicRecords: body?.acknowledgements?.electronicRecords === true,
      },
      displayedContentSetHash: String(body?.contentSetHash || "").trim(),
      requestId: String(body?.requestId || "").trim() || undefined,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json({ success: true, ...result });
    response.cookies.set(EMPLOYEE_DECISION_COOKIE, "", {
      ...employeeDecisionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[employee/legal-assent] write rejected", {
      code: error instanceof Error ? error.message : "EMPLOYEE_ROLE_ASSENT_FAILED",
    });
    return failure(error);
  }
}
