import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingUpdate = vi.fn();

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
    },
  };

  return {
    prisma,
    bookingFindFirst,
    bookingUpdate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
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

  it("returns job to in-progress with rejection fields", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "AWAITING_REVIEW",
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
        status: "IN_PROGRESS",
        rejectionReason: "Missing clear completed walkthrough.",
        rejectedAt: expect.any(Date),
        rejectedBy: "manager-1",
      },
    });
    const json = await toJson(res);
    expect(json.code).toBe("JOB_REJECTED");
    expect(json.success).toBe(true);
  });
});
