import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import {
  applyMediaWithdrawal,
  createLifecycleAppeal,
  ensureRetentionSchedulesForBooking,
  openMediaLifecycleCase,
  resolveCanonicalMediaLifecycle,
} from "@/lib/media-lifecycle";
import {
  authorizationErrorResponse,
  AuthorizationError,
  requireRequestActor,
} from "@/lib/request-actor";
import { resolveServiceVideoPublicState } from "@/lib/service-video-visibility-presentation";

type Context = { params: Promise<{ id: string }> };

async function loadAuthorizedBooking(request: Request, bookingId: string) {
  const actor = await requireRequestActor(request);
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
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
  const employeeMemberships = new Set(
    actor.vendorMemberships
      .filter((item) => item.vendorId === booking.vendorId)
      .map((item) => item.id),
  );
  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const employee = assignment.assignedMembershipIds.some((id) =>
    employeeMemberships.has(id),
  );
  const admin = actor.platformRoles.includes("ADMIN");
  if (!employee && !admin) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have access to this work record.",
      403,
    );
  }
  const role = admin ? "ADMIN" : "EMPLOYEE";
  return {
    actor,
    booking,
    role,
    employee,
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
    const [publicationProposal, activePublicEligibilityCount] = await Promise.all([
      (prisma as any).serviceVideoPublicationProposal.findFirst({
        where: { bookingId: id, isCurrent: true },
        orderBy: { version: "desc" },
        select: { status: true, contractVersion: true, authorizationModel: true },
      }),
      (prisma as any).publicServiceVideoEligibility.count({
        where: { bookingId: id, status: "ACTIVE", audience: "PUBLIC", invalidatedAt: null },
      }),
    ]);
    const publicState = resolveServiceVideoPublicState({
      proposalStatus: publicationProposal?.status,
      proposalContractVersion: publicationProposal?.contractVersion,
      proposalAuthorizationModel: publicationProposal?.authorizationModel,
      activePublicEligibilityCount,
      publicationWithdrawn: withdrawals.some(
        (item: any) => String(item.scope || "").toUpperCase() === "PUBLICATION" && String(item.status || "").toUpperCase() === "APPLIED",
      ),
    });
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
      publicState,
      allowedActions: {
        withdrawRecording: false,
        withdrawPublication: access.employee,
        openDispute: access.employee,
        requestDeletion: false,
        appeal: access.employee,
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
      throw new AuthorizationError(
        "FORBIDDEN",
        "Recording-governance requests must be handled by Reliance Support.",
        403,
      );
    }

    if (action === "WITHDRAW_PUBLICATION" || action === "WITHDRAW_LIKENESS") {
      const employeeLikeness = action === "WITHDRAW_LIKENESS";
      if (employeeLikeness && !access.employee)
        throw new AuthorizationError(
          "FORBIDDEN",
          "Only the affected employee may withdraw their likeness permission.",
          403,
        );
      if (!employeeLikeness) {
        throw new AuthorizationError(
          "FORBIDDEN",
          "Public-governance requests must be handled by Reliance Support.",
          403,
        );
      }
      const withdrawal = await applyMediaWithdrawal({
        bookingId: id,
        vendorId: access.booking.vendorId,
        actorUserId: access.actor.userId,
        actorRole: access.role,
        authorityType: "EMPLOYEE_LIKENESS",
        scope: "LIKENESS",
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
          "The Public-sharing restriction was recorded. Reliance will prevent future Public access and remove current Public access where applicable; existing outside copies cannot be recalled.",
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
      throw new AuthorizationError(
        "FORBIDDEN",
        "Stored-media deletion requests must be handled by Reliance Support.",
        403,
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
