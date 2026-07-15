/**
 * Lightweight operational lifecycle for vendor "jobs" (bookings).
 * Stored under customerMetadata.reliance_ops.operational_phase (JSON string on Booking).
 * Booking.status remains the source of truth for customer/booking flows; this phase * refines vendor workflow (see VENDOR_JOB_LIFECYCLE_DESIGN.md).
 */

export const OPERATIONAL_PHASE_VALUES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_VENDOR_REVIEW",
  "AWAITING_ADMIN_REVIEW",
  "REJECTED",
  "COMPLETED",
] as const;

export type OperationalPhase = (typeof OPERATIONAL_PHASE_VALUES)[number];

export function isOperationalPhase(value: string | null | undefined): value is OperationalPhase {
  return OPERATIONAL_PHASE_VALUES.includes(value as OperationalPhase);
}

export function parseCustomerMetadataRecord(value: string | null | undefined): Record<string, unknown> {
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

export type RelianceOps = {
  operational_phase?: string;
};

export function getRelianceOps(metadata: Record<string, unknown>): RelianceOps {
  const raw = metadata.reliance_ops;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as RelianceOps;
  }
  return {};
}

export function setOperationalPhaseOnMetadataJson(
  customerMetadata: string | null | undefined,
  phase: OperationalPhase
): string {
  const meta = parseCustomerMetadataRecord(customerMetadata);
  const prev = getRelianceOps(meta);
  const next: Record<string, unknown> = {
    ...meta,
    reliance_ops: {
      ...prev,
      operational_phase: phase,
    },
  };
  return JSON.stringify(next);
}

/**
 * Resolve the effective operational phase for UI and guards.
 * Prefers stored reliance_ops when booking status is compatible; otherwise infers from status + media + assignees.
 */
export function resolveOperationalPhase(params: {
  bookingStatus: string | null | undefined;
  customerMetadata: string | null | undefined;
  linkedMediaCount: number;
  assignedEmployees: string[];
  hasCompleteStagedPackage?: boolean;
  hasAdminApprovedStagedPackage?: boolean;
}): OperationalPhase {
  const bookingUpper = String(params.bookingStatus || "")
    .trim()
    .toUpperCase();
  const assignees = params.assignedEmployees;
  const meta = parseCustomerMetadataRecord(params.customerMetadata);
  const storedRaw = getRelianceOps(meta).operational_phase;

  if (bookingUpper === "COMPLETED") {
    if (params.hasCompleteStagedPackage && !params.hasAdminApprovedStagedPackage) {
      return "AWAITING_ADMIN_REVIEW";
    }
    return "COMPLETED";
  }

  if (bookingUpper === "ARCHIVED") {
    return "COMPLETED";
  }

  if (bookingUpper === "PENDING") {
    return assignees.length > 0 ? "ASSIGNED" : "PENDING";
  }

  if (bookingUpper === "CONFIRMED") {
    if (storedRaw && isOperationalPhase(storedRaw)) {
      if (storedRaw === "COMPLETED") {
        /* stale vs booking */
      } else {
        return storedRaw;
      }
    }
    if (params.hasAdminApprovedStagedPackage) {
      return "COMPLETED";
    }
    if (params.hasCompleteStagedPackage) {
      return "AWAITING_VENDOR_REVIEW";
    }
    return "IN_PROGRESS";
  }

  if (bookingUpper === "AWAITING_REVIEW") {
    return "AWAITING_VENDOR_REVIEW";
  }

  if (bookingUpper === "REJECTED") {
    return "REJECTED";
  }

  return assignees.length > 0 ? "ASSIGNED" : "PENDING";
}

/** Maps PATCH body booking status to operational phase persisted in metadata (null = leave metadata ops unchanged). */
export function operationalPhaseForBookingStatusUpdate(
  requestedBookingUpper: string,
  assignedEmployees: string[]
): OperationalPhase | null {
  if (requestedBookingUpper === "COMPLETED") return "COMPLETED";
  if (requestedBookingUpper === "CANCELED" || requestedBookingUpper === "ARCHIVED") return null;
  if (requestedBookingUpper === "PENDING") {
    return assignedEmployees.length > 0 ? "ASSIGNED" : "PENDING";
  }
  if (requestedBookingUpper === "CONFIRMED") {
    return "IN_PROGRESS";
  }
  return null;
}
