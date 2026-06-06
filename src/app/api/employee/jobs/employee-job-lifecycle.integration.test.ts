import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const vendorMembershipFindMany = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const mediaSessionFindMany = vi.fn();
  return {
    vendorMembershipFindMany,
    bookingFindUnique,
    bookingUpdate,
    mediaSessionFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: {
      findMany: hoisted.vendorMembershipFindMany,
    },
    booking: {
      findUnique: hoisted.bookingFindUnique,
      update: hoisted.bookingUpdate,
    },
    mediaSession: {
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
}));

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/account-status", () => ({
  ensureUserAccountCanAct: vi.fn(async () => undefined),
  ensureVendorAccountCanOperate: vi.fn(async () => undefined),
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
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.mediaSessionFindMany.mockReset();

    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        vendorId: "vendor-1",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    ]);
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
});
