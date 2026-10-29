export const SERVICE_REQUEST_STATES = [
  "REQUESTED",
  "VENDOR_ACCEPTED",
  "COUNTEROFFERED",
  "SCHEDULED",
  "VENDOR_DECLINED",
  "CUSTOMER_DECLINED",
  "CANCELED",
] as const;

export type ServiceRequestState = (typeof SERVICE_REQUEST_STATES)[number];

export type ServiceRequestHistoryEntry = {
  state: ServiceRequestState;
  at: string;
  actor_user_id: string | null;
  actor_membership_id: string | null;
  reason: string | null;
  scheduled_for: string | null;
};

export type ServiceRequestLifecycle = {
  version: 1;
  state: ServiceRequestState;
  schedule_mode: "CUSTOMER_REQUESTED" | "VENDOR_TO_PROPOSE";
  requested_at: string;
  requested_scheduled_for: string | null;
  responded_at: string | null;
  responded_by_user_id: string | null;
  responded_by_membership_id: string | null;
  response_reason: string | null;
  proposed_scheduled_for: string | null;
  counteroffer_generation: number;
  customer_responded_at: string | null;
  customer_response_reason: string | null;
  history: ServiceRequestHistoryEntry[];
};

export function parseServiceRequestMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function isoOrNull(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stateOrRequested(value: unknown): ServiceRequestState {
  const normalized = String(value || "").trim().toUpperCase();
  return (SERVICE_REQUEST_STATES as readonly string[]).includes(normalized)
    ? (normalized as ServiceRequestState)
    : "REQUESTED";
}

export function readServiceRequestLifecycle(
  metadataValue: unknown,
  fallback: { requestedAt: Date | string; scheduledFor?: Date | string | null },
): ServiceRequestLifecycle {
  const metadata = parseServiceRequestMetadata(metadataValue);
  const stored = metadata.service_request;
  const row = stored && typeof stored === "object" && !Array.isArray(stored)
    ? stored as Record<string, unknown>
    : {};
  // Historical callers and incomplete legacy fixtures can lack a creation
  // timestamp. Keep lifecycle reads total instead of throwing; the epoch value
  // is an explicit unknown/legacy sentinel, never a current request time.
  const requestedAt = isoOrNull(row.requested_at) || isoOrNull(fallback.requestedAt) || new Date(0).toISOString();
  const requestedSchedule = isoOrNull(row.requested_scheduled_for) || isoOrNull(fallback.scheduledFor);
  const history = Array.isArray(row.history)
    ? row.history.flatMap((entry): ServiceRequestHistoryEntry[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const candidate = entry as Record<string, unknown>;
        const at = isoOrNull(candidate.at);
        if (!at) return [];
        return [{
          state: stateOrRequested(candidate.state),
          at,
          actor_user_id: String(candidate.actor_user_id || "").trim() || null,
          actor_membership_id: String(candidate.actor_membership_id || "").trim() || null,
          reason: String(candidate.reason || "").trim() || null,
          scheduled_for: isoOrNull(candidate.scheduled_for),
        }];
      })
    : [];
  return {
    version: 1,
    state: stateOrRequested(row.state),
    schedule_mode: String(row.schedule_mode || "").toUpperCase() === "VENDOR_TO_PROPOSE"
      ? "VENDOR_TO_PROPOSE"
      : requestedSchedule
        ? "CUSTOMER_REQUESTED"
        : "VENDOR_TO_PROPOSE",
    requested_at: requestedAt,
    requested_scheduled_for: requestedSchedule,
    responded_at: isoOrNull(row.responded_at),
    responded_by_user_id: String(row.responded_by_user_id || "").trim() || null,
    responded_by_membership_id: String(row.responded_by_membership_id || "").trim() || null,
    response_reason: String(row.response_reason || "").trim() || null,
    proposed_scheduled_for: isoOrNull(row.proposed_scheduled_for),
    counteroffer_generation: Math.max(0, Number(row.counteroffer_generation || 0) || 0),
    customer_responded_at: isoOrNull(row.customer_responded_at),
    customer_response_reason: String(row.customer_response_reason || "").trim() || null,
    history,
  };
}

export function initializeServiceRequestMetadata(input: {
  metadataValue: unknown;
  requestedAt: Date | string;
  scheduledFor?: Date | string | null;
  actorUserId: string;
  scheduleMode?: "CUSTOMER_REQUESTED" | "VENDOR_TO_PROPOSE";
}) {
  const metadata = parseServiceRequestMetadata(input.metadataValue);
  const requestedAt = new Date(input.requestedAt).toISOString();
  const scheduledFor = isoOrNull(input.scheduledFor);
  const lifecycle: ServiceRequestLifecycle = {
    version: 1,
    state: "REQUESTED",
    schedule_mode: input.scheduleMode || (scheduledFor ? "CUSTOMER_REQUESTED" : "VENDOR_TO_PROPOSE"),
    requested_at: requestedAt,
    requested_scheduled_for: scheduledFor,
    responded_at: null,
    responded_by_user_id: null,
    responded_by_membership_id: null,
    response_reason: null,
    proposed_scheduled_for: null,
    counteroffer_generation: 0,
    customer_responded_at: null,
    customer_response_reason: null,
    history: [{
      state: "REQUESTED",
      at: requestedAt,
      actor_user_id: input.actorUserId,
      actor_membership_id: null,
      reason: null,
      scheduled_for: scheduledFor,
    }],
  };
  metadata.service_request = lifecycle;
  return { metadata, lifecycle };
}

export function transitionServiceRequestMetadata(input: {
  metadataValue: unknown;
  fallback: { requestedAt: Date | string; scheduledFor?: Date | string | null };
  state: ServiceRequestState;
  at?: Date | string;
  actorUserId: string;
  actorMembershipId?: string | null;
  reason?: string | null;
  scheduledFor?: Date | string | null;
  proposedScheduledFor?: Date | string | null;
  customerResponse?: boolean;
}) {
  const metadata = parseServiceRequestMetadata(input.metadataValue);
  const current = readServiceRequestLifecycle(metadata, input.fallback);
  const at = new Date(input.at || new Date()).toISOString();
  const scheduledFor = isoOrNull(input.scheduledFor);
  const proposedScheduledFor = isoOrNull(input.proposedScheduledFor);
  const reason = String(input.reason || "").trim() || null;
  const lifecycle: ServiceRequestLifecycle = {
    ...current,
    state: input.state,
    ...(input.customerResponse
      ? {
          customer_responded_at: at,
          customer_response_reason: reason,
        }
      : {
          responded_at: at,
          responded_by_user_id: input.actorUserId,
          responded_by_membership_id: input.actorMembershipId || null,
          response_reason: reason,
        }),
    ...(input.state === "COUNTEROFFERED"
      ? {
          proposed_scheduled_for: proposedScheduledFor,
          counteroffer_generation: current.counteroffer_generation + 1,
          customer_responded_at: null,
          customer_response_reason: null,
        }
      : {}),
    history: [
      ...current.history,
      {
        state: input.state,
        at,
        actor_user_id: input.actorUserId,
        actor_membership_id: input.actorMembershipId || null,
        reason,
        scheduled_for: scheduledFor || proposedScheduledFor || current.requested_scheduled_for,
      },
    ].slice(-50),
  };
  metadata.service_request = lifecycle;
  return { metadata, lifecycle };
}

export function serializeServiceRequestMetadata(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata);
}
