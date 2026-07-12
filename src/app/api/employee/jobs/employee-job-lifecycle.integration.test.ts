import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const resolveEmployeeCaptureAccess = vi.fn();
  const sendJobCorrectionReadyNotification = vi.fn();
  return {
    vendorMembershipFindMany,
    bookingFindMany,
    bookingFindUnique,
    bookingUpdate,
    mediaSessionFindFirst,
    mediaSessionFindMany,
    resolveEmployeeCaptureAccess,
    sendJobCorrectionReadyNotification,
  };
});

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: {
      findMany: hoisted.vendorMembershipFindMany,
    },
    booking: {
      findMany: hoisted.bookingFindMany,
      findUnique: hoisted.bookingFindUnique,
      update: hoisted.bookingUpdate,
    },
    mediaSession: {
      findFirst: hoisted.mediaSessionFindFirst,
      findMany: hoisted.mediaSessionFindMany,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(async () => "employee-1"),
}));

vi.mock("@/lib/job-assignment", () => ({
  parseAssignmentMetadata: vi.fn(() => ({
    assignedMembershipIds: ["membership-1"],
  })),
  parseRecordingComplianceMetadata: vi.fn(() => ({
    location: "business",
    consentAccepted: false,
    consentToken: "",
    locationVerified: true,
    locationVerifiedAt: "2026-07-12T00:00:00.000Z",
    serviceOrderReleasedAt: "2026-07-12T00:00:00.000Z",
    releasedMembershipIds: ["membership-1"],
  })),
  setStageProgressMetadata: vi.fn(() => "{}"),
}));

vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: hoisted.resolveEmployeeCaptureAccess,
}));

vi.mock("@/lib/notifications/send-job-correction-ready", () => ({
  sendJobCorrectionReadyNotification: hoisted.sendJobCorrectionReadyNotification,
}));

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/account-status", () => ({
  ensureUserAccountCanAct: vi.fn(async () => undefined),
  ensureVendorAccountCanOperate: vi.fn(async () => undefined),
  isVendorAccountRestricted: vi.fn(() => false),
  accountStatusErrorBody: vi.fn(() => ({ error: "account blocked" })),
  AccountStatusError: class AccountStatusError extends Error {
    statusCode = 403;
  },
}));

vi.mock("@/lib/employee-runtime-errors", () => ({
  getEmployeeRuntimeErrorResponse: vi.fn((_scope: string, error: unknown) => ({
    status: 500,
    body: { error: error instanceof Error ? error.message : "Unknown error" },
  })),
}));

describe("employee job lifecycle routes", () => {
  beforeEach(() => {
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.bookingFindMany.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.mediaSessionFindFirst.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.resolveEmployeeCaptureAccess.mockReset();
    hoisted.sendJobCorrectionReadyNotification.mockReset();
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue(null);
    hoisted.sendJobCorrectionReadyNotification.mockResolvedValue({
      anySuccess: true,
      phoneNumberUsed: "+14075550199",
      channels: [{ channel: "sms", attempted: true, success: true }],
    });

    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    ]);
  });

  it("uses the capture token assignment even when the browser has another signed-in user", async () => {
    const { GET } = await import("./route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        vendor: { name: "Electro LLC", businessName: "Electro LLC", accountStatus: "ACTIVE" },
      },
    ]);
    hoisted.bookingFindMany.mockResolvedValue([
      {
        id: "job-1",
        vendorId: "vendor-1",
        title: "Breaker Replacement",
        status: "IN_PROGRESS",
        customerMetadata: "{}",
        scheduledFor: null,
        date: null,
        service: { id: "svc-1", name: "Breaker Replacement" },
        user: { id: "customer-1", name: "Bradley Coopers", email: null, phone: "4079148888" },
        vendor: { id: "vendor-1", name: "Electro LLC", businessName: "Electro LLC" },
      },
    ]);
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        bookingId: "job-1",
        vendorJobVideoStage: "INTRO",
        mediaAssets: [{ id: "asset-1" }],
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/employee/jobs?ct=signed-token", { method: "GET" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.vendorMembershipFindMany).toHaveBeenCalledWith({
      where: { id: "membership-1" },
      select: { id: true, vendorId: true, vendor: { select: { name: true, businessName: true, accountStatus: true } } },
    });
    expect(hoisted.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-1",
          vendorId: { in: ["vendor-1"] },
        }),
      })
    );
    expect(json.jobs).toHaveLength(1);
    expect(json.jobs[0]).toMatchObject({
      id: "job-1",
      title: "Breaker Replacement",
      stageProgress: { INTRO: true, IN_PROGRESS: false, COMPLETED: false },
      canMarkComplete: false,
    });
  });

  it("enables manual manager submission for in-progress jobs with all three videos", async () => {
    const { GET } = await import("./route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        vendor: { name: "Electro LLC", businessName: "Electro LLC", accountStatus: "ACTIVE" },
      },
    ]);
    hoisted.bookingFindMany.mockResolvedValue([
      {
        id: "job-1",
        vendorId: "vendor-1",
        title: "Outlet Installation",
        status: "IN_PROGRESS",
        customerMetadata: "{}",
        scheduledFor: null,
        date: null,
        service: { id: "svc-1", name: "Outlet Installation" },
        user: { id: "customer-1", name: "Brandon Sims", email: null, phone: "4074861397" },
        vendor: { id: "vendor-1", name: "Electro LLC", businessName: "Electro LLC" },
      },
    ]);
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { bookingId: "job-1", vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { bookingId: "job-1", vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
      { bookingId: "job-1", vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "asset-3" }] },
    ]);

    const response = await GET(
      new Request("http://localhost/api/employee/jobs?ct=signed-token", { method: "GET" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.jobs[0]).toMatchObject({
      id: "job-1",
      status: "IN_PROGRESS",
      stageProgress: { INTRO: true, IN_PROGRESS: true, COMPLETED: true },
      canMarkComplete: true,
    });
  });

  it("keeps rejected correction links submittable even when status is still awaiting review", async () => {
    const { GET } = await import("./route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        vendor: { name: "Electro LLC", businessName: "Electro LLC", accountStatus: "ACTIVE" },
      },
    ]);
    hoisted.bookingFindMany.mockResolvedValue([
      {
        id: "job-1",
        vendorId: "vendor-1",
        title: "Outlet Installation",
        status: "AWAITING_REVIEW",
        rejectionReason: "Redo stage 3",
        rejectedAt: new Date("2026-07-12T13:00:00.000Z"),
        customerMetadata: "{}",
        scheduledFor: null,
        date: null,
        service: { id: "svc-1", name: "Outlet Installation" },
        user: { id: "customer-1", name: "Brandon Sims", email: null, phone: "4074861397" },
        vendor: { id: "vendor-1", name: "Electro LLC", businessName: "Electro LLC" },
      },
    ]);
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { bookingId: "job-1", vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { bookingId: "job-1", vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
      { bookingId: "job-1", vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "asset-3" }] },
    ]);

    const response = await GET(
      new Request("http://localhost/api/employee/jobs?ct=signed-token", { method: "GET" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.jobs[0]).toMatchObject({
      id: "job-1",
      status: "AWAITING_REVIEW",
      rejectionReason: "Redo stage 3",
      stageProgress: { INTRO: true, IN_PROGRESS: true, COMPLETED: true },
      canMarkComplete: true,
    });
  });

  it("uses the capture token assignment when saving a replacement stage", async () => {
    const { POST } = await import("./[jobId]/stage/route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "IN_PROGRESS",
      customerMetadata: "{}",
    });
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      mediaAssets: [{ id: "asset-1" }],
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job-1",
      status: "IN_PROGRESS",
      customerMetadata: "{}",
      updatedAt: new Date("2026-07-12T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/stage?ct=signed-token", {
        method: "POST",
        body: JSON.stringify({ stage: "INTRO" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );

    expect(response.status).toBe(200);
    expect(hoisted.vendorMembershipFindMany).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).toHaveBeenCalled();
  });

  it("does not auto-submit to manager review when the final stage is saved", async () => {
    const { POST } = await import("./[jobId]/stage/route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "IN_PROGRESS",
      customerMetadata: "{}",
    });
    hoisted.mediaSessionFindFirst.mockResolvedValue({
      id: "session-3",
      mediaAssets: [{ id: "asset-3" }],
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
      { vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "asset-3" }] },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job-1",
      status: "IN_PROGRESS",
      customerMetadata: "{}",
      updatedAt: new Date("2026-07-12T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/stage?ct=signed-token", {
        method: "POST",
        body: JSON.stringify({ stage: "COMPLETED" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { customerMetadata: "{}" },
      select: { id: true, status: true, customerMetadata: true, updatedAt: true },
    });
    expect(json.readyForManagerReview).toBe(true);
    expect(json.awaitingReview).toBe(false);
  });

  it("blocks start when the job is no longer pending", async () => {
    const { POST } = await import("./[jobId]/start/route");

    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "COMPLETED",
      customerMetadata: "{}",
    });

    const response = await POST(new Request("http://localhost/api/employee/jobs/job-1/start", { method: "POST" }), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("INVALID_START_STATUS");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("blocks complete when the job is already awaiting review", async () => {
    const { POST } = await import("./[jobId]/complete/route");

    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "AWAITING_REVIEW",
      customerMetadata: "{}",
    });

    const response = await POST(new Request("http://localhost/api/employee/jobs/job-1/complete", { method: "POST" }), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("INVALID_COMPLETE_STATUS");
    expect(hoisted.mediaSessionFindMany).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("allows corrected rejected jobs to be resent from a stale awaiting-review state", async () => {
    const { POST } = await import("./[jobId]/complete/route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.vendorMembershipFindMany.mockResolvedValueOnce([
      {
        id: "manager-1",
        vendorId: "vendor-1",
        role: "MANAGER",
        user: {
          name: "Manager One",
          email: "manager@example.com",
          phone: "4075550199",
        },
      },
    ]);
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "AWAITING_REVIEW",
      title: "Outlet Installation",
      customerMetadata: "{}",
      rejectionReason: "Redo stage 3",
      service: { name: "Outlet Installation" },
      vendor: { name: "Electro LLC", businessName: "Electro LLC" },
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
      { vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "asset-3" }] },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job-1",
      status: "AWAITING_REVIEW",
      date: null,
    });

    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/complete?ct=signed-token", { method: "POST" }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "AWAITING_REVIEW",
          customerMetadata: expect.any(String),
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
        }),
        select: { id: true, status: true, date: true },
      })
    );
    expect(JSON.parse(hoisted.bookingUpdate.mock.calls[0][0].data.customerMetadata)).toMatchObject({
      reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" },
    });
    expect(json.notifications).toMatchObject({
      correctionReady: true,
      sentCount: 1,
    });
  });

  it("notifies managers when a rejected job is fixed and resubmitted", async () => {
    const { POST } = await import("./[jobId]/complete/route");
    hoisted.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-from-token",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeName: "Tech One",
      token: {},
    });
    hoisted.vendorMembershipFindMany
      .mockResolvedValueOnce([
        {
          id: "manager-1",
          vendorId: "vendor-1",
          role: "MANAGER",
          user: {
            name: "Manager One",
            email: "manager@example.com",
            phone: "4075550199",
          },
        },
      ]);
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "IN_PROGRESS",
      title: "Outlet Installation",
      customerMetadata: "{}",
      rejectionReason: "Redo final result video.",
      service: { name: "Outlet Installation" },
      vendor: { name: "Electro LLC", businessName: "Electro LLC" },
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "asset-1" }] },
      { vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "asset-2" }] },
      { vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "asset-3" }] },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job-1",
      status: "AWAITING_REVIEW",
      date: null,
    });

    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/complete?ct=signed-token", { method: "POST" }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.vendorMembershipFindMany).toHaveBeenCalledWith({
      where: {
        vendorId: "vendor-1",
        role: "MANAGER",
        status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    expect(hoisted.sendJobCorrectionReadyNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job-1",
        actorUserId: "employee-from-token",
        managerName: "Manager One",
        managerEmail: "manager@example.com",
        managerPhone: "4075550199",
        vendorName: "Electro LLC",
        jobTitle: "Outlet Installation",
        employeeName: "Tech One",
      })
    );
    expect(hoisted.sendJobCorrectionReadyNotification.mock.calls[0][0].managerReviewLink).toContain(
      "/vendor/jobs/job-1"
    );
    expect(json.notifications).toMatchObject({
      correctionReady: true,
      sentCount: 1,
    });
  });
});
