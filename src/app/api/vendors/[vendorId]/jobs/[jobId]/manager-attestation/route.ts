import { NextResponse } from "next/server";

import {
  betaRoleAssentApiPresentation,
  getManagerWorkRecordAttestationStatus,
  loadManagerWorkRecordAttestationContext,
  recordManagerWorkRecordAttestation,
} from "@/lib/legal/role-assent-service";
import { requireVendorManager } from "@/lib/membership-auth";
import { authorizationErrorResponse } from "@/lib/request-actor";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ vendorId: string; jobId: string }> };

function failure(error: unknown) {
  const auth = authorizationErrorResponse(error);
  if (auth) return auth;
  const code = error instanceof Error ? error.message : "MANAGER_WORK_RECORD_ATTESTATION_FAILED";
  const status = code.includes("STALE") ? 409 : code.includes("NOT_FOUND") ? 404 : 400;
  return NextResponse.json(
    {
      success: false,
      code,
      error:
        code.includes("STALE")
          ? "The Work Record context changed. Reload and review the current assignment and recording scope."
          : "The Work Record attestation could not be completed.",
    },
    { status },
  );
}

export async function GET(request: Request, routeContext: Context) {
  try {
    const { vendorId, jobId } = await routeContext.params;
    const manager = await requireVendorManager(request, vendorId);
    const context = await loadManagerWorkRecordAttestationContext({
      db: prisma as any,
      userId: manager.userId,
      vendorId,
      membershipId: manager.membershipId,
      bookingId: jobId,
    });
    const status = await getManagerWorkRecordAttestationStatus({ db: prisma as any, context });
    return NextResponse.json({
      success: true,
      status,
      contextHash: context.contextHash,
      context: context.context,
      contentSetHash: betaRoleAssentApiPresentation("VENDOR").contentSetHash,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, routeContext: Context) {
  try {
    const { vendorId, jobId } = await routeContext.params;
    const manager = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const result = await recordManagerWorkRecordAttestation({
      db: prisma as any,
      userId: manager.userId,
      vendorId,
      membershipId: manager.membershipId,
      bookingId: jobId,
      displayedContextHash: String(body?.contextHash || "").trim(),
      displayedContentSetHash: String(body?.contentSetHash || "").trim(),
      authorityConfirmed: body?.authorityConfirmed === true,
      requestId: String(body?.requestId || "").trim() || undefined,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
