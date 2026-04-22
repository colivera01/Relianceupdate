import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./[jobId]/actions/route";
import { requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingUpdate = vi.fn();
  const bookingDelete = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const mediaSessionUpdateMany = vi.fn();
  const mediaAssetCount = vi.fn();
  const mediaAssetUpdateMany = vi.fn();
  const txMediaSessionUpdateMany = vi.fn();
  const txMediaAssetUpdateMany = vi.fn();
  const txBookingDelete = vi.fn();
  const transaction = vi.fn(async (cb: any) =>
    cb({
      mediaSession: { updateMany: txMediaSessionUpdateMany },
      mediaAsset: { updateMany: txMediaAssetUpdateMany },
      booking: { delete: txBookingDelete },
    })
  );

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
      update: bookingUpdate,
      delete: bookingDelete,
    },
    mediaSession: {
      findMany: mediaSessionFindMany,
      updateMany: mediaSessionUpdateMany,
    },
    mediaAsset: {
      count: mediaAssetCount,
      updateMany: mediaAssetUpdateMany,
    },
    $transaction: transaction,
  };

  return {
    prisma,
    bookingFindFirst,
    bookingUpdate,
    mediaSessionFindMany,
    mediaSessionUpdateMany,
    mediaAssetCount,
    mediaAssetUpdateMany,
    txMediaSessionUpdateMany,
    txMediaAssetUpdateMany,
    txBookingDelete,
    transaction,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

function patchReq(vendorId: string, jobId: string, action: string) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

function patchReqBody(vendorId: string, jobId: string, body: Record<string, unknown>) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

function deleteReq(vendorId: string, jobId: string) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/actions`, {
      method: "DELETE",
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

function getReq(vendorId: string, jobId: string) {
  return {
    req: new Request(`http://localhost/api/vendors/${vendorId}/jobs/${jobId}/actions`, {
      method: "GET",
    }),
    ctx: { params: Promise.resolve({ vendorId, jobId }) },
  };
}

async function toJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("vendor job actions integration", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({} as any);
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.mediaSessionUpdateMany.mockReset();
    hoisted.mediaAssetCount.mockReset();
    hoisted.mediaAssetUpdateMany.mockReset();
    hoisted.txMediaSessionUpdateMany.mockReset();
    hoisted.txMediaAssetUpdateMany.mockReset();
    hoisted.txBookingDelete.mockReset();
    hoisted.transaction.mockClear();
  });

  it("PATCH returns 403 when vendor auth is forbidden", async () => {
    vi.mocked(requireVendorMembership).mockRejectedValue(new Error("Forbidden"));
    const { req, ctx } = patchReq("v1", "job1", "ARCHIVE_JOB");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(403);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 when job is missing", async () => {
    hoisted.bookingFindFirst.mockResolvedValue(null);
    const { req, ctx } = patchReq("v1", "missing", "ARCHIVE_JOB");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(404);
    const j = await toJson(res);
    expect(j.code).toBe("JOB_NOT_FOUND");
  });

  it("PATCH ARCHIVE_JOB transitions booking status", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "PENDING" });
    hoisted.bookingUpdate.mockResolvedValue({ id: "job1", status: "ARCHIVED" });
    const { req, ctx } = patchReq("v1", "job1", "ARCHIVE_JOB");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: { status: "ARCHIVED" },
      select: { id: true, status: true },
    });
  });

  it("PATCH MOVE_CONTENT_TO_ARCHIVE returns empty-state when no linked sessions", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    const { req, ctx } = patchReq("v1", "job1", "MOVE_CONTENT_TO_ARCHIVE");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.sessionCount).toBe(0);
    expect(j.archivedAssetCount).toBe(0);
    expect(hoisted.mediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetUpdateMany).not.toHaveBeenCalled();
  });

  it("PATCH MOVE_CONTENT_TO_ARCHIVE archives linked sessions and assets", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    hoisted.mediaSessionUpdateMany.mockResolvedValue({ count: 2 });
    hoisted.mediaAssetUpdateMany.mockResolvedValue({ count: 4 });
    const { req, ctx } = patchReq("v1", "job1", "MOVE_CONTENT_TO_ARCHIVE");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.sessionCount).toBe(2);
    expect(j.archivedAssetCount).toBe(4);
    expect(hoisted.mediaSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
      data: { status: "ARCHIVED" },
    });
    expect(hoisted.mediaAssetUpdateMany).toHaveBeenCalledWith({
      where: { mediaSessionId: { in: ["s1", "s2"] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("GET returns delete preview and linked-content summary", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(3);
    const { req, ctx } = getReq("v1", "job1");
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.canVendorDelete).toBe(true);
    expect(j.linkedSessionCount).toBe(1);
    expect(j.linkedAssetCount).toBe(3);
  });

  it("DELETE blocks completed jobs for vendors", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "COMPLETED" });
    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(403);
    const j = await toJson(res);
    expect(j.code).toBe("JOB_DELETE_BLOCKED_COMPLETED");
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS blocks COMPLETED when no linked media", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({
        reliance_ops: { operational_phase: "AWAITING_VENDOR_REVIEW" },
      }),
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "completed",
    });
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("COMPLETION_REQUIRES_MEDIA");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS blocks COMPLETED when not awaiting vendor review", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({
        reliance_ops: { operational_phase: "IN_PROGRESS" },
      }),
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(2);
    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "completed",
    });
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("COMPLETION_REQUIRES_VENDOR_REVIEW_PHASE");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS allows COMPLETED when awaiting review and media exists", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({
        reliance_ops: { operational_phase: "AWAITING_VENDOR_REVIEW" },
      }),
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(1);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job1",
      status: "COMPLETED",
      customerMetadata: expect.any(String),
      updatedAt: new Date(),
    });
    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "completed",
    });
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalled();
  });

  it("DELETE archives linked content and hard-deletes pending job", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    hoisted.mediaAssetCount.mockResolvedValue(2);

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.code).toBe("JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED");
    expect(j.hardDeleted).toBe(true);
    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.txMediaSessionUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["s1", "s2"] } },
      data: { status: "ARCHIVED", endedAt: expect.any(Date) },
    });
    expect(hoisted.txMediaAssetUpdateMany).toHaveBeenCalledWith({
      where: { mediaSessionId: { in: ["s1", "s2"] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(hoisted.txMediaSessionUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["s1", "s2"] } },
      data: { bookingId: null },
    });
    expect(hoisted.txBookingDelete).toHaveBeenCalledWith({ where: { id: "job1" } });
  });
});
