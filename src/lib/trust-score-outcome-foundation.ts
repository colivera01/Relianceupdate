type OperationalOutcomeStatus = "FINALIZED";
type ServiceIssueStatus = "PENDING" | "VALIDATED" | "REJECTED" | "REFUND_APPROVED";

type PrismaLike = {
  vendorOperationalOutcome?: {
    findFirst?: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  bookingServiceIssue?: {
    findFirst?: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  review?: unknown;
};

export const TRUST_OUTCOME_TYPES = {
  WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED",
  BOOKING_CANCELED: "BOOKING_CANCELED",
  VIDEO_PACKAGE_APPROVED: "VIDEO_PACKAGE_APPROVED",
  VIDEO_PACKAGE_REJECTED: "VIDEO_PACKAGE_REJECTED",
  // Phase 1C: emitted when a job is approved/completed AFTER its scheduled date.
  // This is a genuinely finalized signal (completion time vs. scheduledFor).
  LATE_COMPLETION: "LATE_COMPLETION",
} as const;

export const BOOKING_SERVICE_ISSUE_TYPES = {
  REFUND_REQUEST: "REFUND_REQUEST",
  VALIDATED_DISPUTE: "VALIDATED_DISPUTE",
  SERVICE_FAILURE: "SERVICE_FAILURE",
} as const;

export interface OperationalOutcomeInput {
  vendorId: string;
  bookingId?: string | null;
  outcomeType: string;
  status?: OperationalOutcomeStatus | string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  finalizedAt: Date;
  finalizedByUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BookingServiceIssueInput {
  bookingId: string;
  vendorId: string;
  issueType: string;
  status: ServiceIssueStatus | string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  reportedByUserId?: string | null;
  validatedAt?: Date | null;
  rejectedAt?: Date | null;
  refundApprovedAt?: Date | null;
  finalizedAt?: Date | null;
  finalizedByUserId?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, unknown> | null;
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || "").trim().toUpperCase();
}

function metadataToString(metadata: Record<string, unknown> | null | undefined) {
  return metadata ? JSON.stringify(metadata) : null;
}

function sourceWhere(input: {
  vendorId?: string;
  bookingId?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  outcomeType?: string;
  issueType?: string;
}) {
  return {
    vendorId: input.vendorId,
    bookingId: input.bookingId || undefined,
    outcomeType: input.outcomeType,
    issueType: input.issueType,
    sourceEntityType: input.sourceEntityType || undefined,
    sourceEntityId: input.sourceEntityId || undefined,
  };
}

export function isServiceIssueScoreAffecting(input: Pick<BookingServiceIssueInput, "status">) {
  const status = normalizeStatus(input.status);
  return status === "VALIDATED" || status === "REFUND_APPROVED";
}

export function isServiceIssuePending(input: Pick<BookingServiceIssueInput, "status">) {
  return normalizeStatus(input.status) === "PENDING";
}

export async function recordFinalizedOperationalOutcome(db: PrismaLike, input: OperationalOutcomeInput) {
  const status = normalizeStatus(input.status || "FINALIZED");
  if (status !== "FINALIZED") {
    throw new Error("Operational outcomes must be finalized before they are persisted for Trust Score inputs.");
  }
  if (!(input.finalizedAt instanceof Date)) {
    throw new Error("finalizedAt is required for operational outcomes.");
  }

  const delegate = db.vendorOperationalOutcome;
  if (!delegate) {
    return { skipped: true, reason: "vendorOperationalOutcome delegate unavailable" };
  }

  const data = {
    vendorId: input.vendorId,
    bookingId: input.bookingId || null,
    outcomeType: input.outcomeType,
    status,
    sourceEntityType: input.sourceEntityType || null,
    sourceEntityId: input.sourceEntityId || null,
    finalizedAt: input.finalizedAt,
    finalizedByUserId: input.finalizedByUserId || null,
    metadata: metadataToString(input.metadata),
  };

  const existing =
    delegate.findFirst && input.sourceEntityType && input.sourceEntityId
      ? await delegate.findFirst({
          where: sourceWhere({
            vendorId: input.vendorId,
            bookingId: input.bookingId,
            outcomeType: input.outcomeType,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
          }),
        })
      : null;

  if (existing?.id && delegate.update) {
    return delegate.update({ where: { id: existing.id }, data });
  }

  return delegate.create({ data });
}

export async function recordBookingServiceIssue(db: PrismaLike, input: BookingServiceIssueInput) {
  const status = normalizeStatus(input.status);
  if (!status) {
    throw new Error("status is required for booking service issues.");
  }

  const delegate = db.bookingServiceIssue;
  if (!delegate) {
    return { skipped: true, reason: "bookingServiceIssue delegate unavailable" };
  }

  const data = {
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    issueType: input.issueType,
    status,
    sourceEntityType: input.sourceEntityType || null,
    sourceEntityId: input.sourceEntityId || null,
    reportedByUserId: input.reportedByUserId || null,
    validatedAt: input.validatedAt || null,
    rejectedAt: input.rejectedAt || null,
    refundApprovedAt: input.refundApprovedAt || null,
    finalizedAt: input.finalizedAt || input.validatedAt || input.rejectedAt || input.refundApprovedAt || null,
    finalizedByUserId: input.finalizedByUserId || null,
    resolutionNotes: input.resolutionNotes || null,
    metadata: metadataToString(input.metadata),
  };

  const existing =
    delegate.findFirst && input.sourceEntityType && input.sourceEntityId
      ? await delegate.findFirst({
          where: sourceWhere({
            vendorId: input.vendorId,
            bookingId: input.bookingId,
            issueType: input.issueType,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
          }),
        })
      : null;

  if (existing?.id && delegate.update) {
    return delegate.update({ where: { id: existing.id }, data });
  }

  return delegate.create({ data });
}

export async function tryRecordFinalizedOperationalOutcome(db: PrismaLike, input: OperationalOutcomeInput) {
  try {
    return await recordFinalizedOperationalOutcome(db, input);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[trust-score-outcome-foundation] operational outcome write skipped", {
        outcomeType: input.outcomeType,
        bookingId: input.bookingId,
        error: (error as Error)?.message || String(error),
      });
    }
    return { skipped: true, reason: (error as Error)?.message || String(error) };
  }
}

export async function tryRecordBookingServiceIssue(db: PrismaLike, input: BookingServiceIssueInput) {
  try {
    return await recordBookingServiceIssue(db, input);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[trust-score-outcome-foundation] service issue write skipped", {
        issueType: input.issueType,
        bookingId: input.bookingId,
        error: (error as Error)?.message || String(error),
      });
    }
    return { skipped: true, reason: (error as Error)?.message || String(error) };
  }
}
