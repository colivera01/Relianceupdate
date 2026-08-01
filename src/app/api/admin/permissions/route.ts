import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const state = String(searchParams.get("state") || "").trim().toUpperCase();
    const records = await (prisma as any).consentRecord.findMany({
      where: {
        ...(state ? { lifecycleStatus: state } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q } },
                { bookingId: { contains: q } },
                { recipientName: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
      select: {
        id: true,
        bookingId: true,
        lifecycleStatus: true,
        verifiedDecision: true,
        legacyEvidence: true,
        recipientName: true,
        recipientEmailMasked: true,
        recipientPhoneMasked: true,
        recipientMismatch: true,
        audioEnabled: true,
        generation: true,
        requestedAt: true,
        expiresAt: true,
        acceptedAt: true,
        declinedAt: true,
        vendor: { select: { name: true, businessName: true } },
        booking: { select: { title: true, service: { select: { name: true } } } },
        decisionEvidence: { select: { decision: true, verificationMethod: true, decidedAt: true } },
      },
    });
    return NextResponse.json({ success: true, permissions: records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load permission records";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
