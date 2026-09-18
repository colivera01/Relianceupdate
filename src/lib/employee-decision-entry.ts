import { ensureUserAccountCanAct } from "@/lib/account-status";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  readEmployeeCaptureToken,
  resolveEmployeeCaptureAccess,
} from "@/lib/employee-capture-token";
import {
  resolveEmployeePublicMediaConsentAccess,
} from "@/lib/employee-public-media-consent-token";
import {
  EMPLOYEE_DECISION_PURPOSES,
  type EmployeeDecisionPurpose,
} from "@/lib/employee-decision-verification";
import { prisma } from "@/server/db";

export type EmployeeDecisionActor = {
  userId: string;
  vendorId: string;
  membershipId: string;
  bookingId: string | null;
  entryMethod:
    | "SERVICE_ORDER_ENTRY"
    | "PUBLIC_PARTICIPATION_ENTRY"
    | "SIGNED_IN_ACCOUNT";
};

export async function resolveEmployeeDecisionActor(input: {
  request: Request;
  purpose: EmployeeDecisionPurpose;
  requestedMembershipId?: string | null;
  requestedBookingId?: string | null;
}): Promise<EmployeeDecisionActor> {
  const capture = await resolveEmployeeCaptureAccess(input.request, {
    bookingId:
      input.purpose === EMPLOYEE_DECISION_PURPOSES.RECORDING
        ? input.requestedBookingId
        : null,
  });
  if (
    input.purpose === EMPLOYEE_DECISION_PURPOSES.RECORDING &&
    readEmployeeCaptureToken(input.request) &&
    !capture
  ) {
    throw new Error("EMPLOYEE_SERVICE_ORDER_LINK_INVALID");
  }
  if (capture) {
    if (
      input.requestedMembershipId &&
      input.requestedMembershipId !== capture.membershipId
    ) {
      throw new Error("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN");
    }
    return {
      userId: capture.userId,
      vendorId: capture.vendorId,
      membershipId: capture.membershipId,
      bookingId:
        input.purpose === EMPLOYEE_DECISION_PURPOSES.RECORDING
          ? capture.bookingId
          : null,
      entryMethod: "SERVICE_ORDER_ENTRY",
    };
  }
  if (input.purpose === EMPLOYEE_DECISION_PURPOSES.STANDING_PUBLIC) {
    const participation = await resolveEmployeePublicMediaConsentAccess(input.request);
    if (participation) {
      if (
        input.requestedMembershipId &&
        input.requestedMembershipId !== participation.membershipId
      ) {
        throw new Error("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN");
      }
      return {
        userId: participation.userId,
        vendorId: participation.vendorId,
        membershipId: participation.membershipId,
        bookingId: null,
        entryMethod: "PUBLIC_PARTICIPATION_ENTRY",
      };
    }
  }
  const userId = await getUserIdFromRequest(input.request);
  if (!userId) throw new Error("Unauthorized");
  await ensureUserAccountCanAct(userId);
  const membershipId = String(input.requestedMembershipId || "").trim();
  if (!membershipId) throw new Error("EMPLOYEE_DECISION_MEMBERSHIP_REQUIRED");
  const membership = await (prisma as any).vendorMembership.findFirst({
    where: {
      id: membershipId,
      userId,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    select: { vendorId: true },
  });
  if (!membership) throw new Error("EMPLOYEE_DECISION_CONTEXT_FORBIDDEN");
  return {
    userId,
    vendorId: membership.vendorId,
    membershipId,
    bookingId:
      input.purpose === EMPLOYEE_DECISION_PURPOSES.RECORDING
        ? String(input.requestedBookingId || "").trim() || null
        : null,
    entryMethod: "SIGNED_IN_ACCOUNT",
  };
}
