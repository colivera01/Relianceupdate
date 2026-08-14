import { NextResponse } from "next/server";
import { requireVendorManager } from "@/lib/membership-auth";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ vendorId: string; jobId: string }> };

/** Read-only manager evidence view. No mutation method is intentionally exported. */
export async function GET(request: Request, context: Context) {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorManager(request, vendorId);
    const record = await prisma.consentRecord.findFirst({
      where: { bookingId: jobId, vendorId, isCurrent: true },
      orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        lifecycleStatus: true,
        verifiedDecision: true,
        generation: true,
        recipientName: true,
        recipientEmailMasked: true,
        recipientPhoneMasked: true,
        audioEnabled: true,
        scopeJson: true,
        scopeHash: true,
        requestedAt: true,
        acceptedAt: true,
        declinedAt: true,
        decisionEvidence: {
          select: {
            id: true,
            decision: true,
            claimedRole: true,
            authorityScope: true,
            verificationMethod: true,
            requestHash: true,
            scopeHash: true,
            contentHash: true,
            contentVersion: true,
            decidedAt: true,
          },
        },
        booking: { select: { id: true, title: true, service: { select: { name: true } } } },
      },
    });
    if (!record) {
      return NextResponse.json({ success: false, error: "Recording permission evidence was not found." }, { status: 404 });
    }
    let scope: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(String(record.scopeJson || "{}"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) scope = parsed;
    } catch {
      scope = {};
    }
    return NextResponse.json({
      success: true,
      readOnly: true,
      permission: {
        id: record.id,
        lifecycleStatus: record.lifecycleStatus,
        verifiedDecision: record.verifiedDecision,
        generation: record.generation,
        recipient: {
          name: record.recipientName,
          email: record.recipientEmailMasked,
          phone: record.recipientPhoneMasked,
        },
        audioEnabled: record.audioEnabled,
        scope,
        scopeHash: record.scopeHash,
        requestedAt: record.requestedAt,
        acceptedAt: record.acceptedAt,
        declinedAt: record.declinedAt,
        decisionEvidence: record.decisionEvidence,
        booking: record.booking,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load recording permission evidence.";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
