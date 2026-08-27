import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  actor: vi.fn(),
  applyMediaWithdrawal: vi.fn(),
  ensureRetentionSchedulesForBooking: vi.fn(),
  resolveCanonicalMediaLifecycle: vi.fn(),
  openMediaLifecycleCase: vi.fn(),
  requestMediaDeletion: vi.fn(),
  createLifecycleAppeal: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findUnique: hoisted.bookingFindUnique },
    mediaLifecycleCase: { findMany: vi.fn(), findFirst: vi.fn() },
    mediaWithdrawalEvidence: { findMany: vi.fn() },
    mediaDeletionRequest: { findMany: vi.fn() },
    mediaEvidenceHold: { findMany: vi.fn() },
    mediaLifecycleAppeal: { findMany: vi.fn() },
    mediaLifecycleAuditEvent: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/request-actor", async () => {
  const actual = await vi.importActual<any>("@/lib/request-actor");
  return { ...actual, requireRequestActor: hoisted.actor };
});
vi.mock("@/lib/media-lifecycle", () => ({
  applyMediaWithdrawal: hoisted.applyMediaWithdrawal,
  createLifecycleAppeal: hoisted.createLifecycleAppeal,
  ensureRetentionSchedulesForBooking:
    hoisted.ensureRetentionSchedulesForBooking,
  openMediaLifecycleCase: hoisted.openMediaLifecycleCase,
  requestMediaDeletion: hoisted.requestMediaDeletion,
  resolveCanonicalMediaLifecycle: hoisted.resolveCanonicalMediaLifecycle,
}));

import { POST } from "./route";

const booking = {
  id: "booking-1",
  userId: "customer-1",
  vendorId: "vendor-1",
  customerMetadata: JSON.stringify({
    vendor_job_assigned_membership_ids: ["membership-employee"],
  }),
  status: "COMPLETED",
  date: new Date(),
  updatedAt: new Date(),
  mediaSessions: [
    {
      mediaAssets: [{ id: "asset-1", contentHash: "hash-1", deletedAt: null }],
    },
  ],
};

function actor(
  userId: string,
  memberships: Array<{ id: string; vendorId: string; role: string }> = [],
) {
  return { userId, vendorMemberships: memberships, platformRoles: [] };
}

describe("work-record media lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.bookingFindUnique.mockResolvedValue(booking);
    hoisted.applyMediaWithdrawal.mockResolvedValue({
      id: "withdrawal-1",
      status: "APPLIED",
    });
    hoisted.requestMediaDeletion.mockResolvedValue({ id: "deletion-1", status: "ACCESS_RESTRICTED" });
  });

  it("blocks an actor who does not own or participate in the work record", async () => {
    hoisted.actor.mockResolvedValue(actor("customer-2"));
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "OPEN_DISPUTE", category: "PRIVACY" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    expect(response.status).toBe(403);
    expect(hoisted.openMediaLifecycleCase).not.toHaveBeenCalled();
  });

  it("allows the owning customer to withdraw Public publication", async () => {
    hoisted.actor.mockResolvedValue(actor("customer-1"));
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WITHDRAW_PUBLICATION",
          mediaAssetId: "asset-1",
        }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    expect(response.status).toBe(200);
    expect(hoisted.applyMediaWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "customer-1",
        scope: "PUBLICATION",
        mediaAssetId: "asset-1",
      }),
    );
  });

  it("limits an employee to their own likeness withdrawal", async () => {
    hoisted.actor.mockResolvedValue(
      actor("employee-1", [
        { id: "membership-employee", vendorId: "vendor-1", role: "EMPLOYEE" },
      ]),
    );
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WITHDRAW_PUBLICATION",
          mediaAssetId: "asset-1",
        }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    expect(response.status).toBe(403);
    expect(hoisted.applyMediaWithdrawal).not.toHaveBeenCalled();
  });

  it("retires Vendor Manager governance authority at the server boundary", async () => {
    hoisted.actor.mockResolvedValue(
      actor("manager-1", [
        { id: "membership-manager", vendorId: "vendor-1", role: "MANAGER" },
      ]),
    );
    const withdrawal = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW_PUBLICATION", mediaAssetId: "asset-1" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const deletion = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_DELETION", mediaAssetId: "asset-1" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(withdrawal.status).toBe(403);
    expect(deletion.status).toBe(403);
    expect(hoisted.applyMediaWithdrawal).not.toHaveBeenCalled();
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
  });

  it("denies employee stored-media deletion even with active assignment membership", async () => {
    hoisted.actor.mockResolvedValue(
      actor("employee-1", [
        { id: "membership-employee", vendorId: "vendor-1", role: "EMPLOYEE" },
      ]),
    );
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_DELETION", mediaAssetId: "asset-1" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(403);
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
  });

  it("rejects a deletion request for media outside the work record", async () => {
    hoisted.actor.mockResolvedValue(actor("customer-1"));
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_DELETION",
          mediaAssetId: "asset-other",
        }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    expect(response.status).toBe(403);
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
  });
});
