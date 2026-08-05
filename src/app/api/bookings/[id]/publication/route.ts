import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { ensureUserAccountCanAct } from "@/lib/account-status";
import { decidePublicationAsCustomer, loadPublicationView } from "@/lib/service-video-publication";

type Context = { params: Promise<{ id: string }> };

async function requireCustomer(request: Request, bookingId: string) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) throw new Error("Unauthorized");
  await ensureUserAccountCanAct(userId);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { userId: true } });
  if (!booking) throw new Error("PUBLICATION_BOOKING_NOT_FOUND");
  if (booking.userId !== userId) throw new Error("Forbidden: publication belongs to another customer");
  return userId;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Publication request failed";
  const status = message === "Unauthorized" ? 401 : message.includes("Forbidden") ? 403 : message.includes("NOT_FOUND") ? 404 : 422;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await requireCustomer(request, id);
    const publication = await loadPublicationView({ bookingId: id });
    return NextResponse.json({ success: true, publication });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const userId = await requireCustomer(request, id);
    const body = await request.json().catch(() => ({}));
    const publication = await loadPublicationView({ bookingId: id });
    if (!publication?.proposal?.id) throw new Error("PUBLICATION_PROPOSAL_NOT_FOUND");
    const result = await decidePublicationAsCustomer({
      proposalId: publication.proposal.id,
      customerUserId: userId,
      stageDecisions: body?.stageDecisions || {},
      requestCorrection: body?.requestCorrection === true,
      reason: typeof body?.reason === "string" ? body.reason : null,
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
