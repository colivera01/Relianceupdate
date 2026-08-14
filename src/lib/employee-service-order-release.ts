import { prisma } from "@/server/db";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata, parseRecordingComplianceMetadata } from "@/lib/job-assignment";
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

function initialDeliveryKind(generation: number, membershipId: string) {
  return `EMPLOYEE_SERVICE_ORDER_INITIAL:${generation}:${membershipId}`;
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
    return { ready: false, alreadyReleased: false, sentCount: 0, releasedMembershipIds: [], results: [] };
  }

  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const compliance = parseRecordingComplianceMetadata(booking.customerMetadata);
  if (!assignment.assignedMembershipIds.length) {
    return { ready: false, alreadyReleased: false, sentCount: 0, releasedMembershipIds: [], results: [] };
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
  const released = new Set<string>(compliance.releasedMembershipIds);
  const results: Array<Record<string, unknown>> = [];
  const vendorName = String(booking.vendor.businessName || booking.vendor.name || "Reliance Vendor");
  const jobTitle = String(booking.title || booking.service?.name || "Assigned service");

  for (const member of members) {
    if (!input.forceResend && released.has(member.id)) {
      results.push({ membershipId: member.id, alreadyReleased: true });
      continue;
    }

    let claimId: string | null = null;
    if (!input.forceResend) {
      try {
        const claim = await prisma.bookingNotification.create({
          data: {
            bookingId: booking.id,
            kind: initialDeliveryKind(generation, member.id),
            status: "SENDING",
            attemptCount: 1,
            lastAttemptAt: new Date(),
            idempotencyKey: `${booking.id}:${generation}:${member.id}:initial-service-order`,
          },
          select: { id: true },
        });
        claimId = claim.id;
      } catch (error: any) {
        if (String(error?.code || "").toUpperCase() === "P2002") {
          results.push({ membershipId: member.id, duplicateInitialDeliveryPrevented: true });
          continue;
        }
        throw error;
      }
    }

    const employeeJobLink = appendEmployeeCaptureToken(
      `${input.baseUrl.replace(/\/+$/, "")}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
      createEmployeeCaptureToken({ vendorId: input.vendorId, bookingId: booking.id, membershipId: member.id }),
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
    if (delivery.anySuccess) released.add(member.id);
    results.push({ membershipId: member.id, anySuccess: delivery.anySuccess, channels: delivery.channels });
  }

  if (released.size > compliance.releasedMembershipIds.length) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: booking.id }, select: { customerMetadata: true } });
      const currentMetadata = parseMetadata(current?.customerMetadata);
      const currentReleased = Array.isArray(currentMetadata.vendor_job_service_order_released_membership_ids)
        ? currentMetadata.vendor_job_service_order_released_membership_ids.map(String)
        : [];
      currentMetadata.vendor_job_service_order_released_membership_ids = Array.from(
        new Set([...currentReleased, ...Array.from(released)]),
      );
      currentMetadata.vendor_job_service_order_released_at = new Date().toISOString();
      await tx.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: JSON.stringify(currentMetadata) },
      });
    });
  }

  const sentCount = results.filter((result) => result.anySuccess === true).length;
  const alreadyReleased =
    !input.forceResend &&
    sentCount === 0 &&
    results.length > 0 &&
    results.every(
      (result) => result.alreadyReleased === true || result.duplicateInitialDeliveryPrevented === true,
    );
  return {
    ready: true,
    alreadyReleased,
    sentCount,
    releasedMembershipIds: Array.from(released),
    results,
  };
}
