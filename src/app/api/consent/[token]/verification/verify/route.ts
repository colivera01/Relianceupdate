import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  PERMISSION_DECISION_COOKIE,
  PERMISSION_DECISION_SESSION_TTL_MINUTES,
  createPermissionDecisionSessionSecret,
  permissionDecisionCookieOptions,
} from "@/lib/consent/decision-session";
import { actionLinkAvailability, findPermissionByActionSecret } from "@/lib/consent/lookup";
import { evaluateOtpAttempt } from "@/lib/consent/otp";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { token } = await context.params;
  const link = await findPermissionByActionSecret(String(token || ""));
  if (!actionLinkAvailability(link).active) {
    return NextResponse.json({ success: false, error: "Verification was not completed" }, { status: 422 });
  }
  const body = await request.json().catch(() => ({}));
  const channel = String(body?.channel || "").trim().toLowerCase();
  const code = String(body?.code || "").trim();
  if (!code || (channel !== "email" && channel !== "sms")) {
    return NextResponse.json({ success: false, error: "Verification was not completed" }, { status: 422 });
  }
  const challenge = await (prisma as any).consentVerificationChallenge.findFirst({
    where: { consentRecordId: link.consentRecordId, requestLinkId: link.id, channel },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    return NextResponse.json({ success: false, error: "Verification was not completed" }, { status: 422 });
  }
  const result = evaluateOtpAttempt({
    expectedHash: challenge.codeHash,
    suppliedCode: code,
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    failedAttempts: challenge.failedAttempts,
    maxAttempts: challenge.maxAttempts,
    consumedAt: challenge.consumedAt,
  });
  if (!result.ok) {
    if (result.reason === "incorrect") {
      await (prisma as any).consentVerificationChallenge.update({
        where: { id: challenge.id },
        data: { failedAttempts: { increment: 1 } },
      });
    }
    return NextResponse.json({ success: false, error: "Verification was not completed" }, { status: 422 });
  }

  const decision = createPermissionDecisionSessionSecret();
  const expiresAt = new Date(Date.now() + PERMISSION_DECISION_SESSION_TTL_MINUTES * 60 * 1000);
  const consumedAt = new Date();
  const consumed = await prisma.$transaction(async (tx) => {
    const result = await (tx as any).consentVerificationChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: consumedAt } },
      data: { consumedAt },
    });
    if (Number(result.count || 0) !== 1) return false;
    await (tx as any).consentDecisionSession.create({
      data: {
        consentRecordId: link.consentRecordId,
        secretHash: decision.secretHash,
        verificationMethod: `${channel}_otp`,
        verifiedContactHash: challenge.destinationHash,
        expiresAt,
      },
    });
    await (tx as any).consentEvent.create({
      data: {
        consentRecordId: link.consentRecordId,
        eventType: "identity_verified",
        metadata: JSON.stringify({ method: `${channel}_otp` }),
      },
    });
    return true;
  });
  if (!consumed) {
    return NextResponse.json({ success: false, error: "Verification was not completed" }, { status: 422 });
  }
  const response = NextResponse.json({ success: true, verified: true, expiresAt });
  response.cookies.set(PERMISSION_DECISION_COOKIE, decision.secret, permissionDecisionCookieOptions());
  return response;
}
