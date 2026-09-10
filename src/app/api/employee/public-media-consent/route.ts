import { NextResponse } from "next/server";

import { ensureUserAccountCanAct } from "@/lib/account-status";
import { getUserIdFromRequest } from "@/lib/auth";
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

async function actor(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) throw new Error("Unauthorized");
  await ensureUserAccountCanAct(userId);
  return userId;
}

export async function GET(request: Request) {
  try {
    const userId = await actor(request);
    return NextResponse.json({
      success: true,
      consent: await loadEmployeePublicMediaConsentView({ userId }),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await actor(request);
    const body = await request.json().catch(() => ({}));
    const result = await decideEmployeePublicMediaConsent({
      userId,
      membershipId: String(body?.membershipId || "").trim(),
      decision: String(body?.decision || "").trim().toUpperCase() as "ALLOW" | "DENY",
      verificationMethod: "SIGNED_IN_EMPLOYEE_SESSION",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
