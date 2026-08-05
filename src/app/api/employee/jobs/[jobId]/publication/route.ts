import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { ensureUserAccountCanAct } from "@/lib/account-status";
import { decidePublicationAsParticipant, loadPublicationView } from "@/lib/service-video-publication";

type Context = { params: Promise<{ jobId: string }> };

async function actor(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) throw new Error("Unauthorized");
  await ensureUserAccountCanAct(userId);
  return userId;
}

function response(error: unknown) {
  const message = error instanceof Error ? error.message : "Publication request failed";
  return NextResponse.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : message.includes("FORBIDDEN") ? 403 : 422 });
}

export async function GET(request: Request, context: Context) {
  try {
    const userId = await actor(request);
    const { jobId } = await context.params;
    const publication = await loadPublicationView({ bookingId: jobId });
    if (!publication) return NextResponse.json({ success: true, publication: null });
    const membershipIds = await (await import("@/server/db")).prisma.vendorMembership.findMany({
      where: { userId, vendorId: publication.proposal.vendorId, status: "ACTIVE", role: "EMPLOYEE" },
      select: { id: true },
    });
    const evidence = await (await import("@/server/db")).prisma.serviceVideoStageEvidence.findMany({
      where: { id: { in: publication.stages.map((row: any) => row.stageEvidenceId) }, employeeMembershipId: { in: membershipIds.map((row) => row.id) } },
      select: { id: true },
    });
    if (!evidence.length) throw new Error("PUBLICATION_PARTICIPANT_FORBIDDEN");
    return NextResponse.json({ success: true, publication });
  } catch (error) {
    return response(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await actor(request);
    const { jobId } = await context.params;
    const publication = await loadPublicationView({ bookingId: jobId });
    if (!publication?.proposal?.id) throw new Error("PUBLICATION_PROPOSAL_NOT_FOUND");
    const body = await request.json().catch(() => ({}));
    const result = await decidePublicationAsParticipant({
      proposalId: publication.proposal.id,
      actorUserId: userId,
      decisions: Array.isArray(body?.decisions) ? body.decisions : [],
      verificationMethod: "SIGNED_IN_EMPLOYEE_SESSION",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return response(error);
  }
}
