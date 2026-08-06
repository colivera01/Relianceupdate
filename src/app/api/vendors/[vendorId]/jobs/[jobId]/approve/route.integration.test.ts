import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  privateProofAccessGrantFindFirst: vi.fn(),
  approvePrivateServiceVideoPackage: vi.fn(),
  sendVideoReadyNotification: vi.fn(),
  ensureRetentionSchedulesForBooking: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: hoisted.bookingFindFirst },
    privateProofAccessGrant: { findFirst: hoisted.privateProofAccessGrantFindFirst },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(async () => ({
    vendorId: "v1",
    userId: "manager-1",
    membershipId: "manager-membership-1",
  })),
}));

vi.mock("@/lib/service-video-evidence", () => ({
  approvePrivateServiceVideoPackage: hoisted.approvePrivateServiceVideoPackage,
}));

vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: hoisted.sendVideoReadyNotification,
}));

vi.mock("@/lib/media-lifecycle", () => ({
  ensureRetentionSchedulesForBooking: hoisted.ensureRetentionSchedulesForBooking,
}));

vi.mock("@/lib/lifecycle-audit", () => ({ recordLifecycleAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/trust-score-outcome-foundation", () => ({
  TRUST_OUTCOME_TYPES: { WORKFLOW_COMPLETED: "workflow_completed", LATE_COMPLETION: "late_completion" },
  tryRecordFinalizedOperationalOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/trust-score-calculator", () => ({ tryRecalculateVendorTrustScore: vi.fn(async () => undefined) }));

function request(vendorId = "v1", jobId = "job1") {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/approve`, { method: "POST" }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

function booking(status: string) {
  const now = new Date("2026-08-05T12:00:00.000Z");
  return {
    id: "job1",
    userId: "customer-1",
    status,
    title: "Outlet Installation",
    clientName: "Beta Customer",
    customerMetadata: JSON.stringify({ client_email: "customer@example.test" }),
    scheduledFor: now,
    date: now,
    updatedAt: now,
    user: { name: "Beta Customer", email: "customer@example.test", phone: null },
    service: { name: "Outlet Installation" },
    vendor: { name: "Electro LLC", businessName: "Electro LLC" },
  };
}

describe("vendor job Private Service Video approval", () => {
  beforeEach(() => {
    hoisted.bookingFindFirst.mockReset();
    hoisted.privateProofAccessGrantFindFirst.mockReset();
    hoisted.approvePrivateServiceVideoPackage.mockReset();
    hoisted.sendVideoReadyNotification.mockReset();
    hoisted.ensureRetentionSchedulesForBooking.mockReset();
    hoisted.sendVideoReadyNotification.mockResolvedValue({ ok: true, channels: [{ channel: "email", success: true }] });
    hoisted.ensureRetentionSchedulesForBooking.mockResolvedValue([]);
  });

  it("blocks jobs that are not awaiting manager review", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("CONFIRMED"));
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "INVALID_APPROVAL_STATUS" });
  });

  it("fails closed when the complete evidence chain cannot be verified", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("AWAITING_REVIEW"));
    hoisted.approvePrivateServiceVideoPackage.mockRejectedValue(new Error("SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE"));
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PRIVATE_PROOF_EVIDENCE_CHAIN_INCOMPLETE" });
    expect(hoisted.sendVideoReadyNotification).not.toHaveBeenCalled();
  });

  it("treats a completed work record with an active grant as already approved", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("COMPLETED"));
    hoisted.privateProofAccessGrantFindFirst.mockResolvedValue({ id: "grant-1" });
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, alreadyApproved: true });
    expect(hoisted.approvePrivateServiceVideoPackage).not.toHaveBeenCalled();
    expect(hoisted.ensureRetentionSchedulesForBooking).toHaveBeenCalledWith("job1");
  });

  it("atomically approves customer-only Private proof and sends the customer notice", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("AWAITING_REVIEW"));
    hoisted.approvePrivateServiceVideoPackage.mockResolvedValue({
      package: { id: "package-1", version: 1, packageHash: "package-hash" },
      grant: { id: "grant-1" },
      booking: { id: "job1", status: "COMPLETED", date: new Date(), updatedAt: new Date() },
    });
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      privateProof: {
        packageId: "package-1",
        packageVersion: 1,
        accessGrantId: "grant-1",
        audience: "CUSTOMER_ONLY",
      },
      job: { status: "COMPLETED" },
    });
    expect(hoisted.approvePrivateServiceVideoPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job1",
        vendorId: "v1",
        customerUserId: "customer-1",
        managerUserId: "manager-1",
        managerMembershipId: "manager-membership-1",
        completedAt: expect.any(Date),
        customerMetadata: expect.stringContaining("COMPLETED"),
      }),
    );
    expect(hoisted.ensureRetentionSchedulesForBooking).toHaveBeenCalledWith("job1");
    expect(hoisted.sendVideoReadyNotification).toHaveBeenCalledOnce();
  });
});
