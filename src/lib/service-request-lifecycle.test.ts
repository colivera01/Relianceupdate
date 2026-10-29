import { describe, expect, it } from "vitest";
import {
  initializeServiceRequestMetadata,
  readServiceRequestLifecycle,
  transitionServiceRequestMetadata,
} from "./service-request-lifecycle";

describe("service request lifecycle metadata", () => {
  it("records a customer-selected appointment request with actor evidence", () => {
    const requestedAt = new Date("2026-11-01T13:00:00.000Z");
    const scheduledFor = new Date("2026-11-05T15:00:00.000Z");
    const initialized = initializeServiceRequestMetadata({
      metadataValue: { custom_fields: { note: "Use side entrance" } },
      requestedAt,
      scheduledFor,
      actorUserId: "customer-1",
    });
    expect(initialized.lifecycle).toMatchObject({
      state: "REQUESTED",
      schedule_mode: "CUSTOMER_REQUESTED",
      requested_at: requestedAt.toISOString(),
      requested_scheduled_for: scheduledFor.toISOString(),
    });
    expect(initialized.lifecycle.history).toEqual([expect.objectContaining({
      actor_user_id: "customer-1",
      scheduled_for: scheduledFor.toISOString(),
    })]);
    expect(initialized.metadata.custom_fields).toEqual({ note: "Use side entrance" });
  });

  it("uses VENDOR_TO_PROPOSE when no published appointment can be selected", () => {
    const initialized = initializeServiceRequestMetadata({
      metadataValue: {},
      requestedAt: "2026-11-01T13:00:00.000Z",
      actorUserId: "customer-1",
    });
    expect(initialized.lifecycle.schedule_mode).toBe("VENDOR_TO_PROPOSE");
    expect(initialized.lifecycle.requested_scheduled_for).toBeNull();
  });

  it("captures counteroffer and customer acceptance as history", () => {
    const initialized = initializeServiceRequestMetadata({
      metadataValue: {},
      requestedAt: "2026-11-01T13:00:00.000Z",
      actorUserId: "customer-1",
      scheduleMode: "VENDOR_TO_PROPOSE",
    });
    const proposed = "2026-11-06T16:30:00.000Z";
    const countered = transitionServiceRequestMetadata({
      metadataValue: initialized.metadata,
      fallback: { requestedAt: initialized.lifecycle.requested_at },
      state: "COUNTEROFFERED",
      at: "2026-11-01T14:00:00.000Z",
      actorUserId: "manager-user-1",
      actorMembershipId: "membership-1",
      reason: "The afternoon is available.",
      proposedScheduledFor: proposed,
    });
    const accepted = transitionServiceRequestMetadata({
      metadataValue: countered.metadata,
      fallback: { requestedAt: initialized.lifecycle.requested_at },
      state: "SCHEDULED",
      at: "2026-11-01T14:10:00.000Z",
      actorUserId: "customer-1",
      customerResponse: true,
      scheduledFor: proposed,
    });
    expect(countered.lifecycle).toMatchObject({
      state: "COUNTEROFFERED",
      proposed_scheduled_for: proposed,
      counteroffer_generation: 1,
      responded_by_membership_id: "membership-1",
    });
    expect(accepted.lifecycle.history.map((entry) => entry.state)).toEqual([
      "REQUESTED",
      "COUNTEROFFERED",
      "SCHEDULED",
    ]);
  });

  it("reads legacy metadata as a request without inventing history", () => {
    const lifecycle = readServiceRequestLifecycle(
      JSON.stringify({ legacy_field: true }),
      { requestedAt: "2026-11-01T13:00:00.000Z", scheduledFor: null },
    );
    expect(lifecycle.state).toBe("REQUESTED");
    expect(lifecycle.schedule_mode).toBe("VENDOR_TO_PROPOSE");
    expect(lifecycle.history).toEqual([]);
  });
});
