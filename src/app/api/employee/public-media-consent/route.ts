import { NextResponse } from "next/server";

import { ensureUserAccountCanAct } from "@/lib/account-status";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  readEmployeeCaptureToken,
  resolveEmployeeCaptureAccess,
} from "@/lib/employee-capture-token";
import {
  readEmployeePublicMediaConsentToken,
  resolveEmployeePublicMediaConsentAccess,
} from "@/lib/employee-public-media-consent-token";
import {
  decideEmployeePublicMediaConsent,
  loadEmployeePublicMediaConsentView,
} from "@/lib/service-video-publication";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Public Media Consent request failed";
  const status = message === "Unauthorized"
    ? 401
    : message.includes("FORBIDDEN")
      ? 403
      : 422;
  return NextResponse.json({ success: false, error: message }, { status });
}

type ConsentActor = {
  userId: string;
  membershipId: string | null;
  verificationMethod: string;
};

async function actor(request: Request): Promise<ConsentActor> {
  if (readEmployeePublicMediaConsentToken(request)) {
    const access = await resolveEmployeePublicMediaConsentAccess(request);
    if (!access) throw new Error("Unauthorized");
    return {
      userId: access.userId,
      membershipId: access.membershipId,
      verificationMethod: "SIGNED_EMPLOYEE_PARTICIPATION_LINK",
    };
  }
  if (readEmployeeCaptureToken(request)) {
    const access = await resolveEmployeeCaptureAccess(request);
    if (!access) throw new Error("Unauthorized");
    return {
      userId: access.userId,
      membershipId: access.membershipId,
      verificationMethod: "SIGNED_EMPLOYEE_SERVICE_ORDER_LINK",
    };
  }
  const userId = await getUserIdFromRequest(request);
  if (!userId) throw new Error("Unauthorized");
  await ensureUserAccountCanAct(userId);
  return { userId, membershipId: null, verificationMethod: "SIGNED_IN_EMPLOYEE_SESSION" };
}

export async function GET(request: Request) {
  try {
    const access = await actor(request);
    return NextResponse.json({
      success: true,
      consent: await loadEmployeePublicMediaConsentView({
        userId: access.userId,
        membershipId: access.membershipId,
      }),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await actor(request);
    const body = await request.json().catch(() => ({}));
    const requestedMembershipId = String(body?.membershipId || "").trim();
    if (access.membershipId && requestedMembershipId !== access.membershipId) {
      throw new Error("EMPLOYEE_PUBLIC_MEDIA_CONSENT_FORBIDDEN");
    }
    const result = await decideEmployeePublicMediaConsent({
      userId: access.userId,
      membershipId: access.membershipId || requestedMembershipId,
      decision: String(body?.decision || "").trim().toUpperCase() as "ALLOW" | "DENY",
      verificationMethod: access.verificationMethod,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
