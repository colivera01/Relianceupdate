import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  exceptionFindFirst: vi.fn(),
  exceptionCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: db.bookingFindFirst },
    recordingLocationException: {
      findFirst: db.exceptionFindFirst,
      create: db.exceptionCreate,
    },
  },
}));
vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(async () => ({ userId: "manager-1", membershipId: "manager-membership-1" })),
}));
vi.mock("@/lib/lifecycle-audit", () => ({ recordLifecycleAudit: vi.fn(async () => undefined) }));

describe("vendor manager location exception request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.bookingFindFirst.mockResolvedValue({
      id: "job-1",
      recordingScopeAssessments: [{ id: "assessment-1" }],
    });
    db.exceptionFindFirst.mockResolvedValue(null);
    db.exceptionCreate.mockResolvedValue({
      id: "exception-1",
      status: "PENDING",
      reason: "Indoor GPS cannot verify this service address.",
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });
  });

  it("requires a useful explanation", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/request", {
        method: "POST",
        body: JSON.stringify({ reason: "GPS issue" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );
    expect(response.status).toBe(400);
    expect(db.exceptionCreate).not.toHaveBeenCalled();
  });

  it("creates a pending request that the manager cannot self-approve", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/request", {
        method: "POST",
        body: JSON.stringify({ reason: "Indoor GPS cannot verify this service address." }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(json.exception.status).toBe("PENDING");
    expect(db.exceptionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestedByUserId: "manager-1",
        status: "PENDING",
      }),
    }));
  });
});
