import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  actor: vi.fn(),
  caseFindMany: vi.fn(),
  caseFindFirst: vi.fn(),
  withdrawalFindMany: vi.fn(),
  deletionFindMany: vi.fn(),
  holdFindMany: vi.fn(),
  appealFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  proposalFindFirst: vi.fn(),
  publicEligibilityCount: vi.fn(),
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
    mediaLifecycleCase: { findMany: hoisted.caseFindMany, findFirst: hoisted.caseFindFirst },
    mediaWithdrawalEvidence: { findMany: hoisted.withdrawalFindMany },
    mediaDeletionRequest: { findMany: hoisted.deletionFindMany },
    mediaEvidenceHold: { findMany: hoisted.holdFindMany },
    mediaLifecycleAppeal: { findMany: hoisted.appealFindMany },
    mediaLifecycleAuditEvent: { findMany: hoisted.auditFindMany },
    serviceVideoPublicationProposal: { findFirst: hoisted.proposalFindFirst },
    publicServiceVideoEligibility: { count: hoisted.publicEligibilityCount },
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

import { GET, POST } from "./route";

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
  platformRoles: string[] = [],
) {
  return { userId, vendorMemberships: memberships, platformRoles };
}

describe("work-record media lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.bookingFindUnique.mockResolvedValue(booking);
    hoisted.caseFindMany.mockResolvedValue([]);
    hoisted.caseFindFirst.mockResolvedValue(null);
    hoisted.withdrawalFindMany.mockResolvedValue([]);
    hoisted.deletionFindMany.mockResolvedValue([]);
    hoisted.holdFindMany.mockResolvedValue([]);
    hoisted.appealFindMany.mockResolvedValue([]);
    hoisted.auditFindMany.mockResolvedValue([]);
    hoisted.proposalFindFirst.mockResolvedValue(null);
    hoisted.publicEligibilityCount.mockResolvedValue(0);
    hoisted.resolveCanonicalMediaLifecycle.mockResolvedValue({ outcome: "AVAILABLE" });
    hoisted.applyMediaWithdrawal.mockResolvedValue({
      id: "withdrawal-1",
      status: "APPLIED",
    });
    hoisted.openMediaLifecycleCase.mockResolvedValue({
      id: "case-1",
      status: "UNDER_REVIEW",
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

  it("denies all retired Customer self-service governance actions", async () => {
    hoisted.actor.mockResolvedValue(actor("customer-1"));
    for (const body of [
      { action: "WITHDRAW_RECORDING" },
      { action: "WITHDRAW_PUBLICATION", mediaAssetId: "asset-1" },
      { action: "OPEN_DISPUTE", category: "PRIVACY" },
      { action: "REQUEST_DELETION", mediaAssetId: "asset-1" },
    ]) {
      const response = await POST(
        new Request("http://localhost/api/bookings/booking-1/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: "booking-1" }) },
      );
      expect(response.status).toBe(403);
    }
    expect(hoisted.applyMediaWithdrawal).not.toHaveBeenCalled();
    expect(hoisted.openMediaLifecycleCase).not.toHaveBeenCalled();
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
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

  it("denies all retired Vendor Manager self-service governance actions", async () => {
    hoisted.actor.mockResolvedValue(
      actor("manager-1", [
        { id: "membership-manager", vendorId: "vendor-1", role: "MANAGER" },
      ]),
    );
    for (const body of [
      { action: "WITHDRAW_RECORDING" },
      { action: "WITHDRAW_PUBLICATION", mediaAssetId: "asset-1" },
      { action: "OPEN_DISPUTE", category: "PRIVACY" },
      { action: "REQUEST_DELETION", mediaAssetId: "asset-1" },
    ]) {
      const response = await POST(
        new Request("http://localhost/api/bookings/booking-1/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: "booking-1" }) },
      );
      expect(response.status).toBe(403);
    }
    expect(hoisted.applyMediaWithdrawal).not.toHaveBeenCalled();
    expect(hoisted.openMediaLifecycleCase).not.toHaveBeenCalled();
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
  });

  it("preserves assigned-employee likeness withdrawal and concern reporting", async () => {
    hoisted.actor.mockResolvedValue(
      actor("employee-1", [
        { id: "membership-employee", vendorId: "vendor-1", role: "EMPLOYEE" },
      ]),
    );
    const likeness = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW_LIKENESS", mediaAssetId: "asset-1" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const concern = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "OPEN_DISPUTE", category: "PRIVACY", reasonDetail: "Unintended capture." }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(likeness.status).toBe(200);
    expect(concern.status).toBe(201);
    expect(hoisted.applyMediaWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ actorRole: "EMPLOYEE", authorityType: "EMPLOYEE_LIKENESS", scope: "LIKENESS" }),
    );
    expect(hoisted.openMediaLifecycleCase).toHaveBeenCalledWith(
      expect.objectContaining({ actorRole: "EMPLOYEE", category: "PRIVACY" }),
    );
  });

  it("keeps historical Customer and Vendor governance evidence readable to Reliance Admin", async () => {
    hoisted.actor.mockResolvedValue(actor("admin-1", [], ["ADMIN"]));
    hoisted.withdrawalFindMany.mockResolvedValue([
      { id: "withdrawal-customer", actorRole: "CUSTOMER", scope: "PUBLICATION", status: "APPLIED" },
      { id: "withdrawal-vendor", actorRole: "VENDOR_MANAGER", scope: "RECORDING", status: "APPLIED" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/bookings/booking-1/lifecycle"),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.withdrawals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "withdrawal-customer", actorRole: "CUSTOMER" }),
      expect.objectContaining({ id: "withdrawal-vendor", actorRole: "VENDOR_MANAGER" }),
    ]));
    expect(body.allowedActions).toEqual({
      withdrawRecording: false,
      withdrawPublication: false,
      openDispute: false,
      requestDeletion: false,
      appeal: false,
    });
  });

  it("does not grant manager authority from a different vendor", async () => {
    hoisted.actor.mockResolvedValue(
      actor("manager-2", [
        { id: "membership-other", vendorId: "vendor-2", role: "MANAGER" },
      ]),
    );
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW_RECORDING" }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(403);
    expect(hoisted.applyMediaWithdrawal).not.toHaveBeenCalled();
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

  it("rejects a participant action for media outside the work record", async () => {
    hoisted.actor.mockResolvedValue(actor("employee-1", [
      { id: "membership-employee", vendorId: "vendor-1", role: "EMPLOYEE" },
    ]));
    const response = await POST(
      new Request("http://localhost/api/bookings/booking-1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WITHDRAW_LIKENESS",
          mediaAssetId: "asset-other",
        }),
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    expect(response.status).toBe(403);
    expect(hoisted.requestMediaDeletion).not.toHaveBeenCalled();
  });
});
