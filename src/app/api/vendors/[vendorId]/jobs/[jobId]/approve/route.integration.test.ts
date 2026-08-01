import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const txBookingUpdate = vi.fn();
  const txMediaAssetUpdateMany = vi.fn();
  const transaction = vi.fn(async (cb: any) =>
    cb({
      booking: { update: txBookingUpdate },
      mediaAsset: { updateMany: txMediaAssetUpdateMany },
    })
  );

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
    },
    mediaSession: {
      findMany: mediaSessionFindMany,
    },
    $transaction: transaction,
  };

  return {
    prisma,
    bookingFindFirst,
    mediaSessionFindMany,
    txBookingUpdate,
    txMediaAssetUpdateMany,
    transaction,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: vi.fn(),
}));

function postReq(vendorId: string, jobId: string) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/approve`, {
      method: "POST",
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

async function toJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("vendor job approve integration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({} as any);
    hoisted.bookingFindFirst.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.txBookingUpdate.mockReset();
    hoisted.txMediaAssetUpdateMany.mockReset();
    hoisted.transaction.mockClear();
  });

  it("returns 403 when manager auth is forbidden", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden"));
    const { req, ctx } = postReq("v1", "job1");
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(403);
  });

  it("returns 409 when job is not awaiting review", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "CONFIRMED",
      customerMetadata: "{}",
    });
    const { req, ctx } = postReq("v1", "job1");
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("INVALID_APPROVAL_STATUS");
  });

  it("returns 409 when required stages are missing", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "AWAITING_REVIEW",
      customerMetadata: "{}",
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        mediaAssets: [{ id: "a1", moderationStatus: "pending_review", createdAt: new Date() }],
      },
    ]);
    const { req, ctx } = postReq("v1", "job1");
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE");
  });

  it("treats a repeated approval after the first request committed as success", async () => {
    const completedAt = new Date("2026-08-01T12:00:00.000Z");
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "COMPLETED",
      customerMetadata: "{}",
      date: completedAt,
      updatedAt: completedAt,
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        mediaAssets: [{ id: "a1", moderationStatus: "pending_review", createdAt: completedAt }],
      },
      {
        id: "s2",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "IN_PROGRESS",
        mediaAssets: [{ id: "a2", moderationStatus: "pending_review", createdAt: completedAt }],
      },
      {
        id: "s3",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "COMPLETED",
        mediaAssets: [{ id: "a3", moderationStatus: "pending_review", createdAt: completedAt }],
      },
    ]);

    const { req, ctx } = postReq("v1", "job1");
    const res = await POST(req, ctx as any);
    const body = await toJson(res);

    expect(res.status).toBe(200);
    expect(body.alreadyApproved).toBe(true);
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.txBookingUpdate).not.toHaveBeenCalled();
    expect(hoisted.txMediaAssetUpdateMany).not.toHaveBeenCalled();
  });

  it("completes job and re-queues package moderation", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      status: "AWAITING_REVIEW",
      customerMetadata: "{}",
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        mediaAssets: [{ id: "a1", moderationStatus: "approved", createdAt: new Date() }],
      },
      {
        id: "s2",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "IN_PROGRESS",
        mediaAssets: [{ id: "a2", moderationStatus: "approved", createdAt: new Date() }],
      },
      {
        id: "s3",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "COMPLETED",
        mediaAssets: [{ id: "a3", moderationStatus: "approved", createdAt: new Date() }],
      },
    ]);
    hoisted.txBookingUpdate.mockResolvedValue({
      id: "job1",
      status: "COMPLETED",
      date: new Date(),
      updatedAt: new Date(),
    });
    hoisted.txMediaAssetUpdateMany.mockResolvedValue({ count: 3 });

    const { req, ctx } = postReq("v1", "job1");
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(200);
    expect(hoisted.txBookingUpdate).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: {
        status: "COMPLETED",
        date: expect.any(Date),
        customerMetadata: expect.any(String),
      },
      select: { id: true, status: true, date: true, updatedAt: true },
    });
    expect(hoisted.txMediaAssetUpdateMany).toHaveBeenCalledWith({
      where: {
        mediaSessionId: { in: ["s1", "s2", "s3"] },
        deletedAt: null,
      },
      data: {
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        moderationReason: null,
        moderatedAt: null,
        moderatedByUserId: null,
      },
    });
  });
});
