import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { moderatePublicationProposal } from "@/lib/service-video-publication";

type Context = { params: Promise<{ proposalId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(request);
    const { proposalId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const decision = String(body?.decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED", "FLAGGED", "CORRECTION_REQUESTED"].includes(decision)) {
      return NextResponse.json({ success: false, error: "PUBLICATION_ADMIN_DECISION_INVALID" }, { status: 422 });
    }
    const result = await moderatePublicationProposal({
      proposalId,
      adminUserId: admin.userId,
      decision: decision as "APPROVED" | "REJECTED" | "FLAGGED" | "CORRECTION_REQUESTED",
      reason: typeof body?.reason === "string" ? body.reason : null,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to moderate publication proposal";
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 422 });
  }
}
