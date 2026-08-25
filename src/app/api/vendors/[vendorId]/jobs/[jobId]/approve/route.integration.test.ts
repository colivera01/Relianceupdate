import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  submitPackageForCoreAdminAudit: vi.fn(),
  sendCoreAdminAuditReadyNotification: vi.fn(),
  ensureRetentionSchedulesForBooking: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: { booking: { findFirst: hoisted.bookingFindFirst } } }));
vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(async () => ({
    vendorId: "v1",
    userId: "manager-1",
    membershipId: "manager-membership-1",
  })),
}));
vi.mock("@/lib/service-video-admin-audit", async () => {
  const actual = await vi.importActual<any>("@/lib/service-video-admin-audit");
  return { ...actual, submitPackageForCoreAdminAudit: hoisted.submitPackageForCoreAdminAudit };
});
vi.mock("@/lib/service-video-admin-audit-notifications", () => ({
  sendCoreAdminAuditReadyNotification: hoisted.sendCoreAdminAuditReadyNotification,
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

function request() {
  return {
    req: new Request("http://localhost/api/vendors/v1/jobs/job1/approve", { method: "POST" }),
    ctx: { params: Promise.resolve({ vendorId: "v1", jobId: "job1" }) },
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
    customerMetadata: "{}",
    scheduledFor: now,
    date: now,
    updatedAt: now,
    user: { name: "Beta Customer", email: "customer@example.test", phone: null },
    service: { name: "Outlet Installation" },
    vendor: { name: "Electro LLC", businessName: "Electro LLC" },
  };
}

describe("vendor manager Service Video audit submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.sendCoreAdminAuditReadyNotification.mockResolvedValue({ status: "SENT" });
    hoisted.ensureRetentionSchedulesForBooking.mockResolvedValue([]);
  });

  it("blocks jobs outside manager review", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("CONFIRMED"));
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "INVALID_APPROVAL_STATUS" });
  });

  it("fails closed when the exact package evidence cannot be attested", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("AWAITING_REVIEW"));
    hoisted.submitPackageForCoreAdminAudit.mockRejectedValue(new Error("ADMIN_AUDIT_PACKAGE_INCOMPLETE"));
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ADMIN_AUDIT_EVIDENCE_CHAIN_INCOMPLETE" });
    expect(hoisted.sendCoreAdminAuditReadyNotification).not.toHaveBeenCalled();
  });

  it("submits for Admin Audit without granting or notifying customer proof", async () => {
    const { POST } = await import("./route");
    hoisted.bookingFindFirst.mockResolvedValue(booking("AWAITING_REVIEW"));
    hoisted.submitPackageForCoreAdminAudit.mockResolvedValue({
      booking: { id: "job1", status: "COMPLETED" },
      package: { id: "package-1", version: 2, packageHash: "package-hash", status: "AWAITING_ADMIN_REVIEW" },
      managerDecision: { id: "manager-decision-1" },
      adminNotificationId: "admin-notification-1",
      adminEmailNotificationId: "booking-notification-1",
      firstTransition: true,
    });
    const { req, ctx } = request();
    const response = await POST(req, ctx as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      message: expect.stringContaining("Customer access remains locked"),
      adminAudit: { packageId: "package-1", packageVersion: 2, status: "AWAITING_ADMIN_REVIEW" },
    });
    expect(hoisted.submitPackageForCoreAdminAudit).toHaveBeenCalledWith({
      bookingId: "job1",
      vendorId: "v1",
      managerUserId: "manager-1",
      managerMembershipId: "manager-membership-1",
    });
    expect(hoisted.sendCoreAdminAuditReadyNotification).toHaveBeenCalledOnce();
  });
});
