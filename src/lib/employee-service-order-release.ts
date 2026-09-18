import { prisma } from "@/server/db";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import {
  isServiceOrderReleasedForCurrentContext,
  parseAssignmentMetadata,
  parseRecordingComplianceMetadata,
} from "@/lib/job-assignment";
import { loadRecordingPermissionGate } from "@/lib/consent/recording-gate";
import { sendJobAssignmentNotification } from "@/lib/notifications/send-job-assignment";

type ReleaseInput = {
  bookingId: string;
  vendorId: string;
  actorUserId: string;
  baseUrl: string;
  forceResend?: boolean;
};

type ReleaseResult = {
  ready: boolean;
  alreadyReleased: boolean;
  deliveryInProgress?: boolean;
  sentCount: number;
  releasedMembershipIds: string[];
  results: Array<Record<string, unknown>>;
  blocked?: { code: string; why: string; resolution: string } | null;
};

function parseMetadata(value: string | null | undefined): Record<string, any> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type CurrentReleaseContext = {
  assignmentGeneration: number;
  assessmentId: string | null;
  assessmentGeneration: number | null;
  scopeHash: string | null;
};

function initialDeliveryKind(context: CurrentReleaseContext, membershipId: string) {
  return [
    "EMPLOYEE_SERVICE_ORDER_INITIAL_V2",
    context.assignmentGeneration,
    context.assessmentGeneration ?? 0,
    context.assessmentId || "legacy",
    context.scopeHash || "legacy",
    membershipId,
  ].join(":");
}

/**
 * Converges assignment-first and permission-first workflows on one idempotent
 * initial Service Order delivery. BookingNotification's unique booking/kind
 * key is the server-side delivery claim; UI state is never the authority.
 */
export async function releaseEmployeeServiceOrderWhenReady(
  input: ReleaseInput,
): Promise<ReleaseResult> {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, vendorId: input.vendorId },
    select: {
      id: true,
      status: true,
      customerMetadata: true,
      title: true,
      clientName: true,
      scheduledFor: true,
      date: true,
      service: { select: { name: true } },
      vendor: { select: { name: true, businessName: true } },
    },
  });
  if (!booking) {
    return { ready: false, alreadyReleased: false, deliveryInProgress: false, sentCount: 0, releasedMembershipIds: [], results: [] };
  }

  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const compliance = parseRecordingComplianceMetadata(booking.customerMetadata);
  if (!assignment.assignedMembershipIds.length) {
    return { ready: false, alreadyReleased: false, deliveryInProgress: false, sentCount: 0, releasedMembershipIds: [], results: [] };
  }

  const gate = await loadRecordingPermissionGate({
    bookingId: booking.id,
    vendorId: input.vendorId,
    customerMetadata: booking.customerMetadata,
    surface: "vendor_release",
    capability: "release",
    actorKind: "VENDOR_MANAGER",
  });
  if (gate.block) {
    return {
      ready: false,
      alreadyReleased: false,
      deliveryInProgress: false,
      sentCount: 0,
      releasedMembershipIds: compliance.releasedMembershipIds,
      results: [],
      blocked: { code: gate.block.code, why: gate.block.why, resolution: gate.block.resolution },
    };
  }

  const members = await prisma.vendorMembership.findMany({
    where: {
      id: { in: assignment.assignedMembershipIds },
      vendorId: input.vendorId,
      status: "ACTIVE",
    },
    select: { id: true, user: { select: { name: true, email: true, phone: true } } },
  });
  const metadata = parseMetadata(booking.customerMetadata);
  const generation = Math.max(1, Number(metadata.vendor_job_assignment_generation || 1));
  const releaseContext: CurrentReleaseContext = {
    assignmentGeneration: generation,
    assessmentId: gate.assessmentId,
    assessmentGeneration: gate.assessmentGeneration,
    scopeHash: gate.scopeHash,
  };
  const released = new Set<string>(
    compliance.releasedMembershipIds.filter((membershipId) =>
      assignment.assignedMembershipIds.includes(membershipId),
    ),
  );
  const releasesToPersist = new Map<string, string | null>();
  const results: Array<Record<string, unknown>> = [];
  const vendorName = String(booking.vendor.businessName || booking.vendor.name || "Reliance Vendor");
  const jobTitle = String(booking.title || booking.service?.name || "Assigned service");

  for (const member of members) {
    if (
      !input.forceResend &&
      isServiceOrderReleasedForCurrentContext(booking.customerMetadata, {
        membershipId: member.id,
        ...releaseContext,
      })
    ) {
      results.push({ membershipId: member.id, alreadyReleased: true });
      continue;
    }

    let claimId: string | null = null;
    let notificationKind: string | null = null;
    if (!input.forceResend) {
      notificationKind = initialDeliveryKind(releaseContext, member.id);
      try {
        const claim = await prisma.bookingNotification.create({
          data: {
            bookingId: booking.id,
            kind: notificationKind,
            status: "SENDING",
            attemptCount: 1,
            lastAttemptAt: new Date(),
            idempotencyKey: `${booking.id}:${notificationKind}`,
          },
          select: { id: true },
        });
        claimId = claim.id;
      } catch (error: any) {
        if (String(error?.code || "").toUpperCase() === "P2002") {
          const existing = await prisma.bookingNotification.findUnique({
            where: { bookingId_kind: { bookingId: booking.id, kind: notificationKind } },
            select: { id: true, status: true, lastAttemptAt: true },
          });
          const status = String(existing?.status || "").trim().toUpperCase();
          if (status === "SENT") {
            releasesToPersist.set(member.id, notificationKind);
            results.push({
              membershipId: member.id,
              notificationId: existing?.id || null,
              currentReleaseRestored: true,
            });
            continue;
          }
          const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000);
          const retryable = existing
            ? await prisma.bookingNotification.updateMany({
                where: {
                  id: existing.id,
                  OR: [
                    { status: { in: ["FAILED", "QUEUED"] } },
                    { status: "SENDING", lastAttemptAt: { lt: staleSendingBefore } },
                  ],
                },
                data: {
                  status: "SENDING",
                  attemptCount: { increment: 1 },
                  lastAttemptAt: new Date(),
                  lastError: null,
                },
              })
            : null;
          if (Number(retryable?.count || 0) === 1 && existing) {
            claimId = existing.id;
          } else {
            results.push({
              membershipId: member.id,
              notificationId: existing?.id || null,
              duplicateInitialDeliveryPrevented: true,
              deliveryInProgress: true,
            });
            continue;
          }
        } else {
          throw error;
        }
      }
    }

    const employeeJobLink = appendEmployeeCaptureToken(
      `${input.baseUrl.replace(/\/+$/, "")}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
      createEmployeeCaptureToken({
        vendorId: input.vendorId,
        bookingId: booking.id,
        membershipId: member.id,
        context: releaseContext,
      }),
    );
    const delivery = await sendJobAssignmentNotification({
      bookingId: booking.id,
      actorUserId: input.actorUserId,
      employeeName: member.user?.name || null,
      employeeEmail: member.user?.email || null,
      employeePhone: member.user?.phone || null,
      employeeJobLink,
      vendorName,
      jobTitle,
      customerName: booking.clientName,
      scheduledFor: booking.scheduledFor || booking.date,
      serviceTimeZone: typeof metadata.service_time_zone === "string" ? metadata.service_time_zone : null,
    });

    if (claimId) {
      await prisma.bookingNotification.update({
        where: { id: claimId },
        data: delivery.anySuccess
          ? { status: "SENT", sentAt: new Date(), channelsJson: JSON.stringify(delivery.channels), lastError: null }
          : { status: "FAILED", channelsJson: JSON.stringify(delivery.channels), lastError: "No configured delivery channel succeeded" },
      });
    }
    if (delivery.anySuccess) releasesToPersist.set(member.id, notificationKind);
    results.push({ membershipId: member.id, anySuccess: delivery.anySuccess, channels: delivery.channels });
  }

  if (releasesToPersist.size > 0) {
    const persisted = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: booking.id }, select: { customerMetadata: true } });
      const currentMetadata = parseMetadata(current?.customerMetadata);
      const currentAssignment = parseAssignmentMetadata(current?.customerMetadata);
      const currentAssignmentGeneration = Math.max(
        1,
        Number(currentMetadata.vendor_job_assignment_generation || 1),
      );
      const currentAssessment = releaseContext.assessmentId
        ? await tx.recordingScopeAssessment.findFirst({
            where: { bookingId: booking.id, vendorId: input.vendorId, isCurrent: true },
            select: { id: true, generation: true, scopeHash: true },
          })
        : null;
      const contextStillCurrent =
        currentAssignmentGeneration === releaseContext.assignmentGeneration &&
        Array.from(releasesToPersist.keys()).every((membershipId) =>
          currentAssignment.assignedMembershipIds.includes(membershipId),
        ) &&
        (!releaseContext.assessmentId ||
          (currentAssessment?.id === releaseContext.assessmentId &&
            currentAssessment?.generation === releaseContext.assessmentGeneration &&
            currentAssessment?.scopeHash === releaseContext.scopeHash));
      if (!contextStillCurrent) return null;
      const currentReleased = Array.isArray(currentMetadata.vendor_job_service_order_released_membership_ids)
        ? currentMetadata.vendor_job_service_order_released_membership_ids
            .map(String)
            .filter((membershipId: string) =>
              currentAssignment.assignedMembershipIds.includes(membershipId),
            )
        : [];
      const releasedAt = new Date().toISOString();
      const nextReleased = Array.from(
        new Set([...currentReleased, ...Array.from(releasesToPersist.keys())]),
      );
      const existingContexts =
        currentMetadata.vendor_job_service_order_release_contexts &&
        typeof currentMetadata.vendor_job_service_order_release_contexts === "object" &&
        !Array.isArray(currentMetadata.vendor_job_service_order_release_contexts)
          ? { ...currentMetadata.vendor_job_service_order_release_contexts }
          : {};
      for (const membershipId of currentReleased) {
        if (existingContexts[membershipId]) continue;
        existingContexts[membershipId] = {
          version: 2,
          assignmentGeneration: releaseContext.assignmentGeneration,
          assessmentId: releaseContext.assessmentId,
          assessmentGeneration: releaseContext.assessmentGeneration,
          scopeHash: releaseContext.scopeHash,
          notificationKind: null,
          releasedAt:
            String(currentMetadata.vendor_job_service_order_released_at || "").trim() || releasedAt,
        };
      }
      for (const [membershipId, kind] of Array.from(releasesToPersist.entries())) {
        existingContexts[membershipId] = {
          version: 2,
          assignmentGeneration: releaseContext.assignmentGeneration,
          assessmentId: releaseContext.assessmentId,
          assessmentGeneration: releaseContext.assessmentGeneration,
          scopeHash: releaseContext.scopeHash,
          notificationKind: kind,
          releasedAt,
        };
      }
      currentMetadata.vendor_job_service_order_released_membership_ids = nextReleased;
      currentMetadata.vendor_job_service_order_release_contexts = existingContexts;
      currentMetadata.vendor_job_service_order_released_at = releasedAt;
      await tx.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: JSON.stringify(currentMetadata) },
      });
      return nextReleased;
    }, { isolationLevel: "Serializable" });
    if (!persisted) {
      return {
        ready: false,
        alreadyReleased: false,
        deliveryInProgress: false,
        sentCount: 0,
        releasedMembershipIds: compliance.releasedMembershipIds,
        results,
        blocked: {
          code: "SERVICE_ORDER_RELEASE_CONTEXT_CHANGED",
          why: "The Service Order recording context changed while the release was being delivered.",
          resolution: "Review the current scope and send the Service Order again.",
        },
      };
    }
    for (const membershipId of persisted) released.add(membershipId);
  }

  const sentCount = results.filter((result) => result.anySuccess === true).length;
  const deliveryInProgress = results.some((result) => result.deliveryInProgress === true);
  const alreadyReleased =
    !input.forceResend &&
    sentCount === 0 &&
    !deliveryInProgress &&
    results.length > 0 &&
    results.every(
      (result) => result.alreadyReleased === true || result.currentReleaseRestored === true,
    );
  return {
    ready: true,
    alreadyReleased,
    deliveryInProgress,
    sentCount,
    releasedMembershipIds: Array.from(released),
    results,
  };
}
