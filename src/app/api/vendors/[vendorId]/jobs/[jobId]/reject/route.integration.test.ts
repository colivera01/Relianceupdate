import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingUpdate = vi.fn();
  const vendorMembershipFindMany = vi.fn();
  const sendJobRejectionNotification = vi.fn();
  const requestServiceVideoCorrection = vi.fn();

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
    },
    vendorMembership: {
      findMany: vendorMembershipFindMany,
    },
  };

  return {
    prisma,
    bookingFindFirst,
    bookingUpdate,
    vendorMembershipFindMany,
    sendJobRejectionNotification,
    requestServiceVideoCorrection,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
}));

vi.mock("@/lib/notifications/send-job-rejection", () => ({
  sendJobRejectionNotification: hoisted.sendJobRejectionNotification,
}));

vi.mock("@/lib/service-video-evidence", () => ({
  REQUIRED_SERVICE_VIDEO_STAGES: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  requestServiceVideoCorrection: hoisted.requestServiceVideoCorrection,
}));

function postReq(vendorId: string, jobId: string, body?: Record<string, unknown>) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/reject`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

async function toJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("vendor job reject integration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({
      vendorId: "v1",
      userId: "manager-1",
      membershipId: "m1",
    } as any);
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.sendJobRejectionNotification.mockReset();
    hoisted.requestServiceVideoCorrection.mockReset();
    hoisted.requestServiceVideoCorrection.mockResolvedValue({ package: { id: "package-1" }, decision: { id: "decision-1" } });
    hoisted.vendorMembershipFindMany.mockResolvedValue([]);
    hoisted.sendJobRejectionNotification.mockResolvedValue({
      anySuccess: true,
      phoneNumberUsed: "+14075550123",
      channels: [{ channel: "sms", attempted: true, success: true }],
    });
  });

  it("returns 403 when manager auth is forbidden", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden"));
    const { req, ctx } = postReq("v1", "job1", { rejectionReason: "Fix stage video quality." });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(403);
  });

  it("returns 400 when rejectionReason is missing", async () => {
    const { req, ctx } = postReq("v1", "job1", {});
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
    const json = await toJson(res);
    expect(json.code).toBe("REJECTION_REASON_REQUIRED");
  });

  it("returns 409 when job is not awaiting review", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "CONFIRMED",
    });
    const { req, ctx } = postReq("v1", "job1", { rejectionReason: "Fix stage sequencing." });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(409);
    const json = await toJson(res);
    expect(json.code).toBe("INVALID_REJECTION_STATUS");
  });

  it("records a correction request with explicit rejected state", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "AWAITING_REVIEW",
      title: "Breaker Replacement",
      customerMetadata: null,
      service: { name: "Breaker Replacement" },
      vendor: { businessName: "Electro LLC", name: "Electro LLC" },
    });
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job1",
      status: "IN_PROGRESS",
    });
    const { req, ctx } = postReq("v1", "job1", { rejectionReason: "Missing clear completed walkthrough." });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: {
        status: "REJECTED",
        customerMetadata: expect.any(String),
        rejectionReason: "Missing clear completed walkthrough.",
        rejectedAt: expect.any(Date),
        rejectedBy: "manager-1",
      },
    });
    const json = await toJson(res);
    expect(json.code).toBe("SERVICE_VIDEO_CORRECTION_REQUESTED");
    expect(json.success).toBe(true);
  });

  it("notifies assigned employees with a correction link when rejected", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "AWAITING_REVIEW",
      title: "Breaker Replacement",
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["member-1"],
        vendor_job_assigned_employees: ["Tech One"],
      }),
      service: { name: "Breaker Replacement" },
      vendor: { businessName: "Electro LLC", name: "Electro LLC" },
    });
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job1",
      status: "IN_PROGRESS",
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: {
          name: "Tech One",
          email: "tech@example.com",
          phone: "4075550123",
        },
      },
    ]);

    const { req, ctx } = postReq("v1", "job1", { rejectionReason: "Final result needs a clear wide shot." });
    const res = await POST(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(hoisted.vendorMembershipFindMany).toHaveBeenCalledWith({
      where: {
        vendorId: "v1",
        id: { in: ["member-1"] },
        status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    expect(hoisted.sendJobRejectionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job1",
        actorUserId: "manager-1",
        employeeName: "Tech One",
        employeeEmail: "tech@example.com",
        employeePhone: "4075550123",
        vendorName: "Electro LLC",
        jobTitle: "Breaker Replacement",
        rejectionReason: "Final result needs a clear wide shot. Stages: INTRO, IN_PROGRESS, COMPLETED.",
      })
    );
    expect(hoisted.sendJobRejectionNotification.mock.calls[0][0].employeeJobLink).toContain(
      "/employee/jobs?jobId=job1&ct="
    );
    expect((json.details as any).notifications.sentCount).toBe(1);
  });
});
