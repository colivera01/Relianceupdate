import { NextResponse } from "next/server";

import { resolveEmployeeDecisionActor } from "@/lib/employee-decision-entry";
import {
  assertEmployeeDecisionDisplayContext,
  EMPLOYEE_DECISION_COOKIE,
  EMPLOYEE_DECISION_PURPOSES,
  employeeDecisionCookieOptions,
  loadEmployeeDecisionContext,
  readEmployeeDecisionCookie,
  requestIpAddress,
} from "@/lib/employee-decision-verification";
import { decideEmployeeRecordingParticipation } from "@/lib/employee-recording-participation";
import { getEmployeeDecisionErrorResponse } from "@/lib/employee-runtime-errors";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { dispatchEmployeeParticipationDeclinedNotification } from "@/lib/notifications/send-employee-participation-declined";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";
import { resolveCurrentV2RecordingAuthorization } from "@/lib/recording/recording-authorization-v2";
import { employeeV2NextState } from "@/lib/recording/employee-v2-service-order";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, routeContext: Context) {
  let rejectedAuditContext: {
    bookingId: string;
    vendorId: string;
    membershipId: string;
    userId: string;
  } | null = null;
  try {
    const { jobId } = await routeContext.params;
    const body = await request.json().catch(() => ({}));
    const actor = await resolveEmployeeDecisionActor({
      request,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      requestedMembershipId: body?.membershipId,
      requestedBookingId: jobId,
    });
    const decisionContext = await loadEmployeeDecisionContext({
      db: prisma as any,
      purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
      userId: actor.userId,
      membershipId: actor.membershipId,
      bookingId: jobId,
    });
    rejectedAuditContext = {
      bookingId: jobId,
      vendorId: actor.vendorId,
      membershipId: actor.membershipId,
      userId: actor.userId,
    };
    assertEmployeeDecisionDisplayContext({
      context: decisionContext,
      entryMethod: actor.entryMethod,
      displayedContextHash: body?.contextHash,
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
      expectedContextHash: body?.contextHash,
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
    let v2Authorization = null;
    if (
      decisionContext.assessmentContractVersion ===
      RECORDING_ASSESSMENT_V2_CONTRACT_VERSION
    ) {
      const authorization = await resolveCurrentV2RecordingAuthorization({
        db: prisma as any,
        bookingId: jobId,
        vendorId: actor.vendorId,
        membershipId: actor.membershipId,
        stage: "INTRO",
        surface: "employee_jobs",
      });
      const ownStatus = result.decision.decision === "ALLOW" ? "ALLOWED" : "DECLINED";
      const otherRequiredEmployeesPending = authorization.employees.requiredMembershipIds.filter(
        (membershipId) =>
          membershipId !== actor.membershipId &&
          !authorization.runtimeGate.employeeParticipation?.evidence.some(
            (item) => item.membershipId === membershipId,
          ),
      ).length;
      v2Authorization = {
        authorized: authorization.authorized,
        nextState: employeeV2NextState({
          blockCode: authorization.runtimeGate.blockCode,
          employeeStatus: ownStatus,
          otherRequiredEmployeesPending,
        }),
      };
      if (!result.idempotent) {
        try {
          await recordLifecycleAudit({
            actionType:
              result.decision.decision === "ALLOW"
                ? "employee_v2_recording_participation_allowed"
                : "employee_v2_recording_participation_declined",
            entityType: "booking",
            entityId: jobId,
            actorUserId: actor.userId,
            newValue: {
              decisionId: result.decision.id,
              decision: result.decision.decision,
              assessmentId: decisionContext.assessmentId,
              assessmentGeneration: decisionContext.assessmentGeneration,
              assignmentGeneration: decisionContext.assignmentGeneration,
            },
            metadata: {
              vendorId: actor.vendorId,
              membershipId: actor.membershipId,
            },
          });
        } catch (auditError) {
          console.error("[employee/recording-participation] audit failed", {
            code: auditError instanceof Error ? auditError.message : "AUDIT_FAILED",
          });
        }
      }
    }
    const response = NextResponse.json({
      success: true,
      ...result,
      vendorNotification,
      v2Authorization,
    });
    response.cookies.set(EMPLOYEE_DECISION_COOKIE, "", {
      ...employeeDecisionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const rejectionCode =
      error instanceof Error
        ? error.message
        : "EMPLOYEE_RECORDING_PARTICIPATION_FAILED";
    console.error("[employee/recording-participation] rejected", {
      code: rejectionCode,
    });
    if (
      rejectedAuditContext &&
      (rejectionCode.includes("STALE") ||
        rejectionCode === "EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED")
    ) {
      try {
        await recordLifecycleAudit({
          actionType: "employee_v2_recording_participation_rejected",
          entityType: "booking",
          entityId: rejectedAuditContext.bookingId,
          actorUserId: rejectedAuditContext.userId,
          newValue: { outcome: "REJECTED", code: rejectionCode },
          metadata: {
            vendorId: rejectedAuditContext.vendorId,
            membershipId: rejectedAuditContext.membershipId,
          },
        });
      } catch (auditError) {
        console.error("[employee/recording-participation] rejection audit failed", {
          code: auditError instanceof Error ? auditError.message : "AUDIT_FAILED",
        });
      }
    }
    const failure = getEmployeeDecisionErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
