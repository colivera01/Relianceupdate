import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import {
  getRelianceOps,
  operationalPhaseForBookingStatusUpdate,
  resolveOperationalPhase,
  setOperationalPhaseOnMetadataJson,
} from "@/lib/vendor-job-operational-phase";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { countableMediaAssetWhere } from "@/lib/metrics-exclusion";
import { sendJobAssignmentNotification } from "@/lib/notifications/send-job-assignment";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

type JobAction =
  | "ARCHIVE_JOB"
  | "MOVE_CONTENT_TO_ARCHIVE"
  | "UNARCHIVE_JOB"
  | "UPDATE_JOB"
  | "ASSIGN_JOB"
  | "UPDATE_STATUS"
  | "APPROVE_JOB_COMPLETION";

type ResolvedAssignmentMember = {
  id: string;
  displayName: string;
  user: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function apiResponse(
  success: boolean,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return { success, code, message, ...(details ? { details } : {}) };
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function displayNameForMembershipUser(
  user: { name: string | null; email: string | null } | null | undefined
) {
  if (!user) return "Team member";
  const name = String(user.name || "").trim();
  const email = String(user.email || "").trim();
  return name || email || "Team member";
}

function resolveJobLinkBaseUrl(request: Request): string {
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (appBaseUrl) return appBaseUrl;
  const origin = String(request.headers.get("origin") || "").trim().replace(/\/+$/, "");
  if (origin) return origin;
  try {
    return new URL(request.url).origin.replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

async function resolveJobAssignmentForVendor(
  vendorId: string,
  assignedMembershipIds: unknown,
  assignedEmployees: unknown
): Promise<
  | { ok: true; membershipIds: string[]; displayNames: string[]; members: ResolvedAssignmentMember[] }
  | { ok: false; response: NextResponse }
> {
  const normalizedIds = Array.isArray(assignedMembershipIds)
    ? Array.from(
        new Set(assignedMembershipIds.map((id) => String(id || "").trim()).filter(Boolean))
      )
    : [];
  const normalizedNames = Array.isArray(assignedEmployees)
    ? assignedEmployees.map((n) => String(n || "").trim()).filter(Boolean)
    : [];

  if (normalizedIds.length > 0) {
    const rows = await prisma.vendorMembership.findMany({
      where: {
        vendorId,
        id: { in: normalizedIds },
        status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    if (rows.length !== normalizedIds.length) {
      return {
        ok: false,
        response: NextResponse.json(
          apiResponse(
            false,
            "INVALID_MEMBERSHIP",
            "One or more selected team members are not eligible for this vendor."
          ),
          { status: 422 }
        ),
      };
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const displayNames = normalizedIds.map((id) => displayNameForMembershipUser(byId.get(id)?.user));
    const members = normalizedIds
      .map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        return {
          id,
          displayName: displayNames[index] || displayNameForMembershipUser(row.user),
          user: row.user || null,
        };
      })
      .filter(Boolean) as ResolvedAssignmentMember[];
    return { ok: true, membershipIds: normalizedIds, displayNames, members };
  }

  if (normalizedNames.length === 0) {
    return { ok: true, membershipIds: [], displayNames: [], members: [] };
  }

  const activeMembers = await prisma.vendorMembership.findMany({
    where: { vendorId, status: { in: ["ACTIVE", "active", "PENDING", "pending"] } },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  const membershipIdsOut: string[] = [];
  const displayNamesOut: string[] = [];
  const membersOut: ResolvedAssignmentMember[] = [];

  for (const requestedName of normalizedNames) {
    const lower = requestedName.toLowerCase();
    const match = activeMembers.find((m) => {
      const n = String(m.user?.name || "").trim().toLowerCase();
      const e = String(m.user?.email || "").trim().toLowerCase();
      return n === lower || e === lower;
    });
    if (!match) {
      return {
        ok: false,
        response: NextResponse.json(
          apiResponse(false, "UNKNOWN_EMPLOYEE", `No active team member matches "${requestedName}".`, {
            requestedName,
          }),
          { status: 422 }
        ),
      };
    }
    if (!membershipIdsOut.includes(match.id)) {
      membershipIdsOut.push(match.id);
      const displayName = displayNameForMembershipUser(match.user);
      displayNamesOut.push(displayName);
      membersOut.push({ id: match.id, displayName, user: match.user || null });
    }
  }

  return { ok: true, membershipIds: membershipIdsOut, displayNames: displayNamesOut, members: membersOut };
}

function normalizeUiStatusToBookingStatus(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "archived") return "ARCHIVED";
  if (normalized === "completed") return "COMPLETED";
  if (normalized === "cancelled" || normalized === "canceled") return "CANCELED";
  if (normalized === "pending" || normalized === "scheduled") return "PENDING";
  if (normalized === "in progress" || normalized === "in-progress" || normalized === "in_progress") return "CONFIRMED";
  if (normalized === "confirmed") return "CONFIRMED";
  return null;
}

async function getLinkedMediaSummary(vendorId: string, bookingId: string) {
  const sessions = await (prisma as any).mediaSession.findMany({
    where: {
      vendorId,
      bookingId,
    },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: any) => s.id);
  const linkedAssetCount = sessionIds.length
    ? await (prisma as any).mediaAsset.count({
        where: countableMediaAssetWhere({
          mediaSessionId: { in: sessionIds },
        }),
      })
    : 0;
  return {
    linkedSessionCount: sessionIds.length,
    linkedAssetCount,
    linkedSessionIds: sessionIds,
  };
}

async function getVendorJobPackageState(vendorId: string, bookingId: string) {
  const sessions = await (prisma as any).mediaSession.findMany({
    where: {
      vendorId,
      bookingId,
    },
    select: {
      id: true,
      sessionType: true,
      vendorJobVideoStage: true,
      mediaAssets: {
        where: { deletedAt: null },
        select: { id: true, moderationStatus: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return evaluateVendorJobPackageState(sessions);
}

export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const member = await requireVendorMembership(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase() as JobAction;

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: {
        id: true,
        vendorId: true,
        status: true,
        customerMetadata: true,
        title: true,
        clientName: true,
        scheduledFor: true,
        date: true,
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    if (action === "ARCHIVE_JOB") {
      if (normalizeBookingStatus(booking.status) === "ARCHIVED") {
        return NextResponse.json({
          success: true,
          action,
          job: { id: booking.id, status: "ARCHIVED" },
          message: "Job is already archived.",
        });
      }
      const statusUpper = normalizeBookingStatus(booking.status);
      if (statusUpper !== "COMPLETED") {
        return NextResponse.json(
          apiResponse(
            false,
            "ARCHIVE_REQUIRES_COMPLETED_JOB",
            "Archive is allowed only for completed jobs with completed admin approval.",
            { status: statusUpper || "UNKNOWN" }
          ),
          { status: 409 }
        );
      }
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      if (packageState.hasStagedPackage && !packageState.hasAllRequiredStagesApproved) {
        return NextResponse.json(
          apiResponse(
            false,
            "ARCHIVE_REQUIRES_ADMIN_APPROVED_PACKAGE",
            "Archive is allowed only after all required staged videos are admin-approved.",
            {
              hasAllRequiredStages: packageState.hasAllRequiredStages,
              hasAllRequiredStagesApproved: packageState.hasAllRequiredStagesApproved,
            }
          ),
          { status: 409 }
        );
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "ARCHIVED" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job archived successfully",
      });
    }

    if (action === "UNARCHIVE_JOB") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "PENDING" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job restored to active jobs",
      });
    }

    if (action === "UPDATE_JOB") {
      const title = body?.title !== undefined ? String(body.title || "").trim() : undefined;
      const clientName =
        body?.clientName !== undefined ? String(body.clientName || "").trim() : undefined;
      const serviceId =
        body?.serviceId !== undefined && body?.serviceId !== null
          ? String(body.serviceId || "").trim()
          : undefined;

      const data: any = {};
      if (title !== undefined) data.title = title || null;
      if (clientName !== undefined) data.clientName = clientName || null;
      if (serviceId !== undefined) {
        if (serviceId) {
          const service = await prisma.service.findFirst({
            where: { id: serviceId, vendorId },
            select: { id: true },
          });
          if (!service) {
            return NextResponse.json(
              apiResponse(false, "SERVICE_NOT_FOUND", "Selected service does not belong to this vendor."),
              { status: 404 }
            );
          }
          data.serviceId = service.id;
        }
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data,
        select: { id: true, status: true, title: true, clientName: true, serviceId: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job details updated successfully",
      });
    }

    if (action === "ASSIGN_JOB") {
      const resolved = await resolveJobAssignmentForVendor(
        vendorId,
        body?.assignedMembershipIds,
        body?.assignedEmployees
      );
      if (!resolved.ok) {
        return resolved.response;
      }
      const { membershipIds, displayNames, members } = resolved;
      const existing = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { customerMetadata: true, status: true },
      });
      const metadata = parseCustomerMetadata(existing?.customerMetadata || null);
      const previouslyAssignedIds = Array.isArray(metadata.vendor_job_assigned_membership_ids)
        ? metadata.vendor_job_assigned_membership_ids
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      metadata.vendor_job_assigned_membership_ids = membershipIds;
      metadata.vendor_job_assigned_employees = displayNames;
      if (membershipIds[0]) {
        metadata.vendor_job_primary_membership_id = membershipIds[0];
        metadata.vendor_job_primary_employee = displayNames[0] || null;
      } else {
        delete metadata.vendor_job_primary_membership_id;
        delete metadata.vendor_job_primary_employee;
      }
      const bookingUpper = normalizeBookingStatus(existing?.status);
      if (bookingUpper === "PENDING" && displayNames.length > 0) {
        const ops = getRelianceOps(metadata);
        metadata.reliance_ops = { ...ops, operational_phase: "ASSIGNED" };
      }
      if (bookingUpper === "PENDING" && displayNames.length === 0) {
        const ops = getRelianceOps(metadata);
        metadata.reliance_ops = { ...ops, operational_phase: "PENDING" };
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: JSON.stringify(metadata) },
        select: { id: true, status: true, customerMetadata: true, updatedAt: true },
      });

      await recordLifecycleAudit({
        actionType: "job_assigned",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: member.userId,
        newValue: {
          assignedMembershipIds: membershipIds,
          assignedEmployees: displayNames,
          primaryMembershipId: membershipIds[0] || null,
          primaryEmployeeName: displayNames[0] || null,
        },
        metadata: { vendorId },
      });

      const newlyAssignedIds = new Set(
        membershipIds.filter((id) => !previouslyAssignedIds.includes(id))
      );
      const notificationResults = [];
      if (newlyAssignedIds.size > 0) {
        const baseUrl = resolveJobLinkBaseUrl(request);
        const vendorName = String(booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor");
        const jobTitle = String(booking.title || booking.service?.name || "Assigned job");
        const customerName = String(booking.clientName || booking.user?.name || "").trim() || null;

        for (const assignmentMember of members) {
          if (!newlyAssignedIds.has(assignmentMember.id)) continue;
          try {
            const employeeJobLink = appendEmployeeCaptureToken(
              `${baseUrl}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
              createEmployeeCaptureToken({
                vendorId,
                bookingId: booking.id,
                membershipId: assignmentMember.id,
              })
            );
            const notification = await sendJobAssignmentNotification({
              bookingId: booking.id,
              actorUserId: member.userId,
              employeeName: assignmentMember.displayName,
              employeeEmail: assignmentMember.user?.email || null,
              employeePhone: assignmentMember.user?.phone || null,
              employeeJobLink,
              vendorName,
              jobTitle,
              customerName,
              scheduledFor: booking.scheduledFor || booking.date || null,
            });
            notificationResults.push({
              membershipId: assignmentMember.id,
              employeeName: assignmentMember.displayName,
              anySuccess: notification.anySuccess,
              phoneNumberUsed: notification.phoneNumberUsed,
              channels: notification.channels,
            });
          } catch (error) {
            notificationResults.push({
              membershipId: assignmentMember.id,
              employeeName: assignmentMember.displayName,
              anySuccess: false,
              errorMessage: error instanceof Error ? error.message : String(error),
              channels: [],
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        action,
        job: {
          id: updated.id,
          status: updated.status,
          assignedMembershipIds: membershipIds,
          assignedEmployees: displayNames,
          primaryMembershipId: membershipIds[0] || null,
          primaryEmployeeName: displayNames[0] || null,
          updatedAt: updated.updatedAt,
        },
        notifications: {
          newlyAssignedCount: newlyAssignedIds.size,
          sentCount: notificationResults.filter((item) => item.anySuccess).length,
          results: notificationResults,
        },
        message: "Job assignment updated successfully",
      });
    }

    if (action === "UPDATE_STATUS") {
      const requestedStatus = normalizeUiStatusToBookingStatus(body?.status);
      if (!requestedStatus) {
        return NextResponse.json(
          apiResponse(false, "INVALID_STATUS", "Unsupported status transition request."),
          { status: 422 }
        );
      }
      const requestedUpper = normalizeBookingStatus(requestedStatus);
      const assignedFromMeta = (() => {
        const m = parseCustomerMetadata(booking.customerMetadata || null);
        const raw = m.vendor_job_assigned_employees;
        if (!Array.isArray(raw)) return [] as string[];
        return raw.map((item) => String(item || "").trim()).filter(Boolean);
      })();

      const { linkedAssetCount } = await getLinkedMediaSummary(vendorId, booking.id);
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      const currentPhase = resolveOperationalPhase({
        bookingStatus: booking.status,
        customerMetadata: booking.customerMetadata,
        linkedMediaCount: linkedAssetCount,
        assignedEmployees: assignedFromMeta,
        hasCompleteStagedPackage: packageState.hasAllRequiredStages,
        hasAdminApprovedStagedPackage: packageState.hasAllRequiredStagesApproved,
      });

      if (requestedUpper === "COMPLETED") {
        return NextResponse.json(
          apiResponse(
            false,
            "MANAGER_APPROVAL_REQUIRED",
            "Direct status update to completed is blocked. Use manager approval for jobs in AWAITING_REVIEW.",
            { operationalPhase: currentPhase, hasAllRequiredStages: packageState.hasAllRequiredStages }
          ),
          { status: 409 }
        );
      }

      const nextOpsPhase = operationalPhaseForBookingStatusUpdate(requestedUpper, assignedFromMeta);
      const metadataUpdate =
        nextOpsPhase != null
          ? setOperationalPhaseOnMetadataJson(booking.customerMetadata, nextOpsPhase)
          : booking.customerMetadata;

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: requestedStatus,
          ...(metadataUpdate !== undefined && metadataUpdate !== booking.customerMetadata
            ? { customerMetadata: metadataUpdate }
            : {}),
        },
        select: { id: true, status: true, customerMetadata: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job status updated successfully",
      });
    }

    if (action === "APPROVE_JOB_COMPLETION") {
      await requireVendorManager(request, vendorId);
      const currentStatus = normalizeBookingStatus(booking.status);
      if (currentStatus !== "AWAITING_REVIEW") {
        return NextResponse.json(
          apiResponse(
            false,
            "INVALID_APPROVAL_STATUS",
            "Only jobs awaiting review can be approved for completion.",
            { status: currentStatus || "UNKNOWN" }
          ),
          { status: 409 }
        );
      }
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      if (!packageState.hasAllRequiredStages) {
        return NextResponse.json(
          apiResponse(
            false,
            "COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE",
            "Approve completion only after Starting Condition, Work in Progress, and Final Result videos are uploaded."
          ),
          { status: 409 }
        );
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED", date: new Date() },
        select: { id: true, status: true, date: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job completion approved.",
      });
    }

    if (action === "MOVE_CONTENT_TO_ARCHIVE") {
      const sessions = await (prisma as any).mediaSession.findMany({
        where: {
          vendorId,
          bookingId: booking.id,
        },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: any) => s.id);

      if (sessionIds.length === 0) {
        return NextResponse.json({
          success: true,
          action,
          message: "No linked content found for this job",
          sessionCount: 0,
          archivedAssetCount: 0,
        });
      }

      await (prisma as any).mediaSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: "ARCHIVED" },
      });

      const archivedAssetsResult = await (prisma as any).mediaAsset.updateMany({
        where: {
          mediaSessionId: { in: sessionIds },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        action,
        message: "Job content moved to archive successfully",
        sessionCount: sessionIds.length,
        archivedAssetCount: archivedAssetsResult?.count || 0,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 422 });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to process job action", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === "COMPLETED") {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_COMPLETED",
          "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed.",
          { status: normalizedStatus }
        ),
        { status: 403 }
      );
    }

    // UI "in progress" maps to Prisma CONFIRMED (legacy check used IN_PROGRESS which never matched).
    const allowedVendorDeleteStatuses = new Set(["PENDING", "CONFIRMED"]);
    if (!allowedVendorDeleteStatuses.has(normalizedStatus)) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
          { status: normalizedStatus || "UNKNOWN" }
        ),
        { status: 409 }
      );
    }

    const { linkedSessionCount, linkedAssetCount, linkedSessionIds } = await getLinkedMediaSummary(
      vendorId,
      booking.id
    );

    try {
      await prisma.$transaction(async (tx) => {
        if (linkedSessionIds.length > 0) {
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: {
              status: "ARCHIVED",
              endedAt: new Date(),
            },
          });

          await (tx as any).mediaAsset.updateMany({
            where: {
              mediaSessionId: { in: linkedSessionIds },
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
            },
          });

          // Detach sessions from booking before deleting booking to avoid FK/NoAction conflicts.
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: { bookingId: null },
          });
        }

        await tx.booking.delete({
          where: { id: booking.id },
        });
      });
    } catch (transactionError: any) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          "Job deletion was blocked because linked dependencies could not be handled safely. No records were deleted.",
          {
            status: normalizedStatus,
            reason: transactionError?.message || "Unknown dependency handling failure",
          }
        ),
        { status: 409 }
      );
    }

    return NextResponse.json({
      ...apiResponse(
        true,
        linkedSessionCount > 0
          ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
          : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT",
        linkedSessionCount > 0
          ? "Job permanently deleted. Linked media sessions and assets were archived safely to prevent orphaned records."
          : "Job permanently deleted. No linked media content was found.",
        {
          linkedSessionCount,
          linkedAssetCount,
          mediaHandled: linkedSessionCount > 0 ? "archived" : "none",
        }
      ),
      hardDeleted: true,
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] DELETE error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        apiResponse(false, "JOB_DELETE_BLOCKED_FORBIDDEN", String(error.message)),
        { status: 403 }
      );
    }
    return NextResponse.json(
      apiResponse(
        false,
        "JOB_DELETE_FAILED_INTERNAL",
        "Failed to permanently delete job.",
        { reason: error.message }
      ),
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    const { linkedSessionCount, linkedAssetCount } = await getLinkedMediaSummary(vendorId, booking.id);

    const canVendorDelete =
      normalizedStatus === "PENDING" || normalizedStatus === "CONFIRMED";

    return NextResponse.json({
      jobId: booking.id,
      status: normalizedStatus,
      canVendorDelete,
      linkedSessionCount,
      linkedAssetCount,
      message:
        normalizedStatus === "COMPLETED"
          ? "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed."
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "This job has linked media. Deleting this job will also archive related media/session records so nothing is orphaned."
            : "This job can be deleted safely. No linked media content found."
          : `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
      code:
        normalizedStatus === "COMPLETED"
          ? "JOB_DELETE_BLOCKED_COMPLETED"
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
            : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT"
          : "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to inspect job delete dependencies", details: error.message },
      { status: 500 }
    );
  }
}
