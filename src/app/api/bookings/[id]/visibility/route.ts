import { NextResponse } from "next/server";

import { ensureUserAccountCanAct } from "@/lib/account-status";
import {
  authorizationErrorResponse,
  AuthorizationError,
  requireRequestActor,
} from "@/lib/request-actor";
import {
  decidePackageVisibility,
  loadPackageVisibilityView,
} from "@/lib/service-video-publication";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ id: string }> };

async function authorize(request: Request, bookingId: string) {
  const actor = await requireRequestActor(request);
  await ensureUserAccountCanAct(actor.userId);
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, vendorId: true },
  });
  if (!booking) throw new AuthorizationError("FORBIDDEN", "Work record not found.", 403);
  const customer = booking.userId === actor.userId;
  const manager = actor.vendorMemberships.some(
    (membership) => membership.vendorId === booking.vendorId && membership.role === "MANAGER",
  );
  const admin = actor.platformRoles.includes("ADMIN");
  if (!customer && !manager && !admin) {
    throw new AuthorizationError("FORBIDDEN", "You do not have access to this visibility record.", 403);
  }
  return { actor, booking, customer, manager, admin };
}

function failure(error: unknown) {
  return authorizationErrorResponse(error) || NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Package visibility request failed",
    },
    { status: 422 },
  );
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await authorize(request, id);
    const visibility = await loadPackageVisibilityView({ bookingId: id });
    return NextResponse.json({
      success: true,
      role: access.customer ? "CUSTOMER" : access.manager ? "VENDOR_MANAGER" : "ADMIN",
      canDecide: access.customer && visibility?.auditPassed === true,
      visibility,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await authorize(request, id);
    if (!access.customer) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "Only the customer may decide whether the complete approved Service Video enters Public review.",
        403,
      );
    }
    const body = await request.json().catch(() => ({}));
    const result = await decidePackageVisibility({
      bookingId: id,
      customerUserId: access.actor.userId,
      decision: String(body?.decision || "").trim().toUpperCase() as "KEEP_PRIVATE" | "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
      audioConfirmation: body?.audioConfirmation === true,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
