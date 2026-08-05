import { NextResponse } from "next/server";
import { requireVendorManager } from "@/lib/membership-auth";
import {
  approveVendorPublicationRepresentation,
  createPublicationProposal,
  loadPublicationView,
} from "@/lib/service-video-publication";

type Context = { params: Promise<{ vendorId: string; jobId: string }> };

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Publication request failed";
  if (message === "Unauthorized") return 401;
  if (message.includes("Forbidden")) return 403;
  if (message.includes("NOT_AVAILABLE") || message.includes("NOT_COMPLETE")) return 409;
  return 422;
}

export async function GET(request: Request, context: Context) {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorManager(request, vendorId);
    return NextResponse.json({ success: true, publication: await loadPublicationView({ bookingId: jobId }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load publication status";
    return NextResponse.json({ success: false, error: message }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { vendorId, jobId } = await context.params;
    const actor = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const proposal = await createPublicationProposal({
      bookingId: jobId,
      vendorId,
      proposedByUserId: actor.userId,
      proposedByMembershipId: actor.membershipId,
      stages: Array.isArray(body?.stages) ? body.stages : undefined,
    });
    return NextResponse.json({ success: true, proposal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create publication proposal";
    return NextResponse.json({ success: false, error: message }, { status: statusFor(error) });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { vendorId, jobId } = await context.params;
    const actor = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const current = await loadPublicationView({ bookingId: jobId });
    if (!current?.proposal?.id) {
      return NextResponse.json({ success: false, error: "PUBLICATION_PROPOSAL_NOT_FOUND" }, { status: 404 });
    }
    const decision = await approveVendorPublicationRepresentation({
      proposalId: current.proposal.id,
      vendorId,
      managerUserId: actor.userId,
      managerMembershipId: actor.membershipId,
    });
    return NextResponse.json({ success: true, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve publication representation";
    return NextResponse.json({ success: false, error: message }, { status: statusFor(error) });
  }
}
