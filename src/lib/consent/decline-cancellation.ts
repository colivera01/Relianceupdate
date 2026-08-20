export const RECORDING_DECLINE_CANCELLATION_REASON =
  "Customer declined Reliance recording permission";

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizedStatus(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export async function cancelSimplifiedV1WorkRecordAfterDecline(input: {
  tx: any;
  bookingId: string;
  vendorId: string;
  consentRecordId: string;
  actorUserId: string | null;
  evidenceId: string;
  decidedAt: Date;
  permissionMetadata: Record<string, unknown>;
}) {
  const current = await input.tx.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, vendorId: true, status: true, customerMetadata: true },
  });
  if (!current || String(current.vendorId) !== input.vendorId) {
    throw new Error("DECLINE_CANCELLATION_WORK_RECORD_NOT_FOUND");
  }
  const previousStatus = normalizedStatus(current.status);
  if (!["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(previousStatus)) {
    throw new Error("DECLINE_CANCELLATION_STATE_CHANGED");
  }

  const sessions = await input.tx.mediaSession.findMany({
    where: { bookingId: input.bookingId, vendorId: input.vendorId },
    select: { id: true, _count: { select: { mediaAssets: true } } },
  });
  const unusedSessionIds = sessions
    .filter((session: any) => Number(session?._count?.mediaAssets || 0) === 0)
    .map((session: any) => String(session.id));

  const metadata = {
    ...parseMetadata(current.customerMetadata),
    ...input.permissionMetadata,
  };
  delete metadata.vendor_job_consent_token;
  delete metadata.vendor_job_service_order_released_membership_ids;
  delete metadata.vendor_job_service_order_released_at;
  metadata.vendor_job_cancellation = {
    status: "CANCELED",
    canceled_at: input.decidedAt.toISOString(),
    canceled_by_user_id: input.actorUserId || "verified-permission-recipient",
    canceled_by_membership_id: null,
    reason: RECORDING_DECLINE_CANCELLATION_REASON,
    source: "CUSTOMER_RECORDING_PERMISSION_DECLINE",
    underlying_service_canceled: false,
  };
  metadata.vendor_job_employee_access_revoked_at = input.decidedAt.toISOString();
  metadata.vendor_job_employee_access_revocation_reason =
    "CUSTOMER_RECORDING_PERMISSION_DECLINED";

  await input.tx.employeeRecordingCertification.updateMany({
    where: {
      bookingId: input.bookingId,
      status: "ACTIVE",
      invalidatedAt: null,
    },
    data: {
      status: "INVALIDATED",
      invalidatedAt: input.decidedAt,
      invalidationReason: "CUSTOMER_RECORDING_PERMISSION_DECLINED",
    },
  });
  if (unusedSessionIds.length) {
    await input.tx.mediaSession.updateMany({
      where: { id: { in: unusedSessionIds }, bookingId: input.bookingId },
      data: { status: "ARCHIVED", endedAt: input.decidedAt },
    });
  }
  await input.tx.consentRequestLink.updateMany({
    where: {
      consentRecord: { bookingId: input.bookingId },
      revokedAt: null,
    },
    data: {
      revokedAt: input.decidedAt,
      revocationReason: "CUSTOMER_RECORDING_PERMISSION_DECLINED",
    },
  });
  await input.tx.bookingNotification.updateMany({
    where: {
      bookingId: input.bookingId,
      status: { in: ["QUEUED", "SENDING"] },
    },
    data: {
      status: "CANCELED",
      nextAttemptAt: null,
      leaseExpiresAt: null,
      lastError: "Reliance work record canceled after recording permission was declined",
    },
  });
  const booking = await input.tx.booking.update({
    where: { id: input.bookingId },
    data: {
      status: "CANCELED",
      customerMetadata: JSON.stringify(metadata),
    },
    select: { id: true, status: true, customerMetadata: true },
  });
  await input.tx.consentEvent.create({
    data: {
      consentRecordId: input.consentRecordId,
      eventType: "work_record_canceled_after_decline",
      metadata: JSON.stringify({
        evidenceId: input.evidenceId,
        bookingId: input.bookingId,
        previousStatus,
        resultingStatus: "CANCELED",
        reason: RECORDING_DECLINE_CANCELLATION_REASON,
        underlyingServiceCanceled: false,
        employeeAccessRevoked: true,
        unusedSessionIdsArchived: unusedSessionIds,
      }),
    },
  });

  return { booking, previousStatus, archivedUnusedSessionCount: unusedSessionIds.length };
}
