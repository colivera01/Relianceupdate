import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import {
  applyMediaWithdrawal,
  createLifecycleAppeal,
  ensureRetentionSchedulesForBooking,
  openMediaLifecycleCase,
  requestMediaDeletion,
  resolveCanonicalMediaLifecycle,
} from "@/lib/media-lifecycle";
import {
  authorizationErrorResponse,
  AuthorizationError,
  requireRequestActor,
} from "@/lib/request-actor";

type Context = { params: Promise<{ id: string }> };

async function loadAuthorizedBooking(request: Request, bookingId: string) {
  const actor = await requireRequestActor(request);
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      customerMetadata: true,
      status: true,
      date: true,
      updatedAt: true,
      mediaSessions: {
        select: {
          mediaAssets: {
            select: { id: true, contentHash: true, deletedAt: true },
          },
        },
      },
    },
  });
  if (!booking)
    throw new AuthorizationError("FORBIDDEN", "Work record not found.", 403);
  const manager = actor.vendorMemberships.find(
    (item) => item.vendorId === booking.vendorId && item.role === "MANAGER",
  );
  const employeeMemberships = new Set(
    actor.vendorMemberships
      .filter((item) => item.vendorId === booking.vendorId)
      .map((item) => item.id),
  );
  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const employee = assignment.assignedMembershipIds.some((id) =>
    employeeMemberships.has(id),
  );
  const customer = booking.userId === actor.userId;
  const admin = actor.platformRoles.includes("ADMIN");
  if (!customer && !manager && !employee && !admin) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have access to this work record.",
      403,
    );
  }
  const role = admin
    ? "ADMIN"
    : manager
      ? "VENDOR_MANAGER"
      : employee
        ? "EMPLOYEE"
        : "CUSTOMER";
  return {
    actor,
    booking,
    role,
    customer,
    manager: Boolean(manager),
    employee,
    admin,
  };
}

function assetsFromBooking(booking: any): string[] {
  return (booking.mediaSessions || []).flatMap((session: any) =>
    (session.mediaAssets || []).map((asset: any) => String(asset.id)),
  );
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await loadAuthorizedBooking(request, id);
    await ensureRetentionSchedulesForBooking(id);
    const [cases, withdrawals, deletions, holds, appeals, auditEvents] =
      await Promise.all([
        (prisma as any).mediaLifecycleCase.findMany({
          where: { bookingId: id },
          orderBy: { createdAt: "desc" },
        }),
        (prisma as any).mediaWithdrawalEvidence.findMany({
          where: { bookingId: id },
          orderBy: { appliedAt: "desc" },
        }),
        (prisma as any).mediaDeletionRequest.findMany({
          where: { bookingId: id },
          orderBy: { requestedAt: "desc" },
        }),
        (prisma as any).mediaEvidenceHold.findMany({
          where: { bookingId: id },
          orderBy: { startedAt: "desc" },
        }),
        (prisma as any).mediaLifecycleAppeal.findMany({
          where: { bookingId: id },
          orderBy: { submittedAt: "desc" },
        }),
        (prisma as any).mediaLifecycleAuditEvent.findMany({
          where: { bookingId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
    const assetIds = assetsFromBooking(access.booking);
    const lifecycle = await Promise.all(
      assetIds.map(async (mediaAssetId) => ({
        mediaAssetId,
        ...(await resolveCanonicalMediaLifecycle({
          bookingId: id,
          mediaAssetId,
          intendedAudience: "PRIVATE",
        })),
      })),
    );
    return NextResponse.json({
      success: true,
      role: access.role,
      lifecycle,
      cases,
      withdrawals,
      deletions,
      holds,
      appeals,
      auditEvents,
      allowedActions: {
        withdrawRecording: access.customer || access.manager,
        withdrawPublication:
          access.customer || access.manager || access.employee,
        openDispute: true,
        requestDeletion: access.customer || access.manager,
        appeal: access.customer || access.manager || access.employee,
      },
    });
  } catch (error) {
    return (
      authorizationErrorResponse(error) ||
      NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Lifecycle status unavailable",
        },
        { status: 500 },
      )
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await loadAuthorizedBooking(request, id);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "")
      .trim()
      .toUpperCase();
    const mediaAssetId = String(body.mediaAssetId || "").trim() || null;
    if (
      mediaAssetId &&
      !assetsFromBooking(access.booking).includes(mediaAssetId)
    ) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "Media does not belong to this work record.",
        403,
      );
    }

    if (action === "WITHDRAW_RECORDING") {
      if (!access.customer && !access.manager)
        throw new AuthorizationError(
          "FORBIDDEN",
          "Only the customer or vendor manager may stop future recording for this work record.",
          403,
        );
      const withdrawal = await applyMediaWithdrawal({
        bookingId: id,
        vendorId: access.booking.vendorId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        authorityType: access.customer ? "CUSTOMER" : "VENDOR_REPRESENTATION",
        scope: "RECORDING",
        reason: String(body.reason || "").trim() || null,
        request,
      });
      return NextResponse.json({
        success: true,
        message:
          "Future recording is stopped. The service may continue without recording when the approved scope allows it.",
        withdrawal,
      });
    }

    if (action === "WITHDRAW_PUBLICATION" || action === "WITHDRAW_LIKENESS") {
      const employeeLikeness = action === "WITHDRAW_LIKENESS";
      if (employeeLikeness && !access.employee)
        throw new AuthorizationError(
          "FORBIDDEN",
          "Only the affected employee may withdraw their likeness permission.",
          403,
        );
      if (!employeeLikeness && !access.customer && !access.manager) {
        throw new AuthorizationError(
          "FORBIDDEN",
          "Only the customer or vendor manager may withdraw Public publication approval.",
          403,
        );
      }
      const withdrawal = await applyMediaWithdrawal({
        bookingId: id,
        vendorId: access.booking.vendorId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        authorityType: employeeLikeness
          ? "EMPLOYEE_LIKENESS"
          : access.customer
            ? "CUSTOMER"
            : "VENDOR_REPRESENTATION",
        scope: employeeLikeness ? "LIKENESS" : "PUBLICATION",
        reason: String(body.reason || "").trim() || null,
        packageId: String(body.packageId || "").trim() || null,
        proposalId: String(body.proposalId || "").trim() || null,
        stageId: String(body.stageId || "").trim() || null,
        mediaAssetId,
        request,
      });
      return NextResponse.json({
        success: true,
        message:
          "This version is no longer available publicly on Reliance. Existing outside copies cannot be recalled by Reliance.",
        withdrawal,
      });
    }

    if (action === "OPEN_DISPUTE") {
      const category = String(body.category || "")
        .trim()
        .toUpperCase();
      if (!category)
        return NextResponse.json(
          { success: false, error: "Choose a concern category." },
          { status: 422 },
        );
      const lifecycleCase = await openMediaLifecycleCase({
        bookingId: id,
        vendorId: access.booking.vendorId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        category,
        reasonDetail: String(body.reasonDetail || "").trim() || null,
        packageId: String(body.packageId || "").trim() || null,
        proposalId: String(body.proposalId || "").trim() || null,
        mediaAssetId,
        request,
      });
      return NextResponse.json(
        {
          success: true,
          message:
            lifecycleCase.status === "RESTRICTED"
              ? "Your concern was received. Public access to the affected proof is restricted while Reliance reviews it."
              : "Your concern was received and is under review.",
          case: lifecycleCase,
        },
        { status: 201 },
      );
    }

    if (action === "REQUEST_DELETION") {
      if (!access.customer && !access.manager)
        throw new AuthorizationError(
          "FORBIDDEN",
          "Only the customer or vendor manager may request deletion for this work record.",
          403,
        );
      if (!mediaAssetId)
        return NextResponse.json(
          {
            success: false,
            error: "Choose the media to request for deletion.",
          },
          { status: 422 },
        );
      const deletion = await requestMediaDeletion({
        bookingId: id,
        vendorId: access.booking.vendorId,
        mediaAssetId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        reason: String(body.reason || "").trim() || null,
        request,
      });
      return NextResponse.json(
        {
          success: true,
          message:
            "Deletion was requested and access is restricted. This is not yet deleted; Reliance must review retention or hold requirements and verify storage removal.",
          deletion,
        },
        { status: 201 },
      );
    }

    if (action === "APPEAL") {
      const caseId = String(body.caseId || "").trim();
      const lifecycleCase = await (prisma as any).mediaLifecycleCase.findFirst({
        where: { id: caseId, bookingId: id },
      });
      if (!lifecycleCase)
        return NextResponse.json(
          { success: false, error: "Lifecycle case not found." },
          { status: 404 },
        );
      const appeal = await createLifecycleAppeal({
        caseId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        reason: String(body.reason || "").trim(),
        request,
      });
      return NextResponse.json(
        {
          success: true,
          message: "Your appeal was submitted for a separate review.",
          appeal,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unsupported lifecycle action." },
      { status: 422 },
    );
  } catch (error) {
    return (
      authorizationErrorResponse(error) ||
      NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Lifecycle action failed",
        },
        { status: 500 },
      )
    );
  }
}
