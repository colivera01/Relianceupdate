import { NextRequest, NextResponse } from "next/server";

import { completePermissionDecision, PermissionDecisionError } from "@/lib/consent/decision-service";
import { PERMISSION_DECISION_COOKIE, permissionDecisionCookieOptions } from "@/lib/consent/decision-session";
import { sendConsentDecisionNotifications } from "@/lib/notifications/send-consent-decision";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    if (!token) return NextResponse.json({ success: false, error: "Request is not available" }, { status: 400 });
    const result = await completePermissionDecision({
      request,
      actionSecret: token,
      decision: "decline",
      claimedRole: body?.claimedRole,
      authorityScope: body?.authorityScope,
    });
    await sendConsentDecisionNotifications({
      request,
      bookingId: result.bookingId,
      accepted: false,
      declineCanceled: result.workRecordCanceled,
      actorUserId: result.evidence.actorUserId || "verified-permission-recipient",
    }).catch((error) => console.error("[permission/decline] decision notification failed", error));
    const response = NextResponse.json({
      success: true,
      permission: {
        state: result.workRecordCanceled ? "canceled" : "declined",
        workRecordCanceled: result.workRecordCanceled,
      },
    });
    response.cookies.set(PERMISSION_DECISION_COOKIE, "", { ...permissionDecisionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof PermissionDecisionError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    console.error("[permission/decline] POST failed", error);
    return NextResponse.json({ success: false, error: "Unable to save this recording decision" }, { status: 500 });
  }
}
