import { NextResponse } from "next/server";

import { ensureVendorAccountCanOperate } from "@/lib/account-status";
import {
  betaRoleAssentApiPresentation,
  ensureBetaRoleAssentContent,
  getVendorRoleAssentStatus,
  loadVendorRoleAssentContext,
  recordVendorRoleAssent,
} from "@/lib/legal/role-assent-service";
import {
  authorizationErrorResponse,
  requireActorVendorManager,
  requireRequestActor,
} from "@/lib/request-actor";
import { prisma } from "@/server/db";

function failure(error: unknown) {
  const auth = authorizationErrorResponse(error);
  if (auth) return auth;
  const code = error instanceof Error ? error.message : "VENDOR_ROLE_ASSENT_FAILED";
  const status = code === "ROLE_ASSENT_NOT_ENABLED" ? 404 : code.includes("STALE") ? 409 : 400;
  const messages: Record<string, string> = {
    ROLE_ASSENT_NOT_ENABLED: "This beta assent surface is not enabled.",
    ROLE_ASSENT_CONTENT_STALE: "The legal content changed. Reload and review the current versions.",
    VENDOR_ROLE_ASSENT_AUTHORITY_STALE: "Your Vendor authority changed. Sign in again with a current Manager account.",
    VENDOR_ROLE_ASSENT_ACKNOWLEDGEMENTS_REQUIRED: "Complete every required acknowledgment before agreeing for the Vendor.",
  };
  return NextResponse.json(
    { success: false, code, error: messages[code] || "Vendor assent could not be completed." },
    { status },
  );
}

async function actorContext(request: Request) {
  const actor = await requireRequestActor(request);
  const vendorId = String(new URL(request.url).searchParams.get("vendorId") || "").trim();
  if (!vendorId) throw new Error("VENDOR_ID_REQUIRED");
  await ensureVendorAccountCanOperate(vendorId);
  const membership = requireActorVendorManager(actor, vendorId);
  const context = await loadVendorRoleAssentContext({
    db: prisma as any,
    userId: actor.userId,
    vendorId,
    membershipId: membership.id,
  });
  return { actor, membership, context };
}

export async function GET(request: Request) {
  try {
    const { context } = await actorContext(request);
    await ensureBetaRoleAssentContent(prisma as any);
    const status = await getVendorRoleAssentStatus({ db: prisma as any, context });
    return NextResponse.json({
      success: true,
      enabled: true,
      identity: {
        vendorId: context.vendorId,
        vendorName: context.vendorName,
        actorRole: context.actorRole,
        membershipId: context.membershipId,
      },
      status,
      presentation: betaRoleAssentApiPresentation("VENDOR"),
    });
  } catch (error) {
    console.error("[vendor/legal-assent] read rejected", {
      code: error instanceof Error ? error.message : "VENDOR_ROLE_ASSENT_FAILED",
    });
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, membership, context } = await actorContext(request);
    const body = await request.json().catch(() => ({}));
    const decision = String(body?.decision || "").trim().toUpperCase();
    if (decision !== "ASSENT" && decision !== "DECLINE") {
      throw new Error("ROLE_ASSENT_DECISION_INVALID");
    }
    const result = await recordVendorRoleAssent({
      db: prisma as any,
      userId: actor.userId,
      vendorId: context.vendorId,
      membershipId: membership.id,
      decision,
      acknowledgements: {
        authority: body?.acknowledgements?.authority === true,
        terms: body?.acknowledgements?.terms === true,
        privacy: body?.acknowledgements?.privacy === true,
        electronicRecords: body?.acknowledgements?.electronicRecords === true,
      },
      displayedContentSetHash: String(body?.contentSetHash || "").trim(),
      requestId: String(body?.requestId || "").trim() || undefined,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[vendor/legal-assent] write rejected", {
      code: error instanceof Error ? error.message : "VENDOR_ROLE_ASSENT_FAILED",
    });
    return failure(error);
  }
}
