import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./[jobId]/actions/route";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import { sendJobAssignmentNotification } from "@/lib/notifications/send-job-assignment";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const bookingDelete = vi.fn();
  const vendorMembershipFindMany = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const mediaSessionUpdateMany = vi.fn();
  const mediaAssetCount = vi.fn();
  const mediaAssetUpdateMany = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const txMediaSessionUpdateMany = vi.fn();
  const txMediaAssetUpdateMany = vi.fn();
  const txBookingDelete = vi.fn();
  const transaction = vi.fn(async (cb: any) =>
    cb({
      mediaSession: { updateMany: txMediaSessionUpdateMany },
      mediaAsset: { updateMany: txMediaAssetUpdateMany },
      booking: { delete: txBookingDelete, update: bookingUpdate },
    })
  );

  const prisma = {
    booking: {
      findFirst: bookingFindFirst,
      findUnique: bookingFindUnique,
      update: bookingUpdate,
      delete: bookingDelete,
    },
    vendorMembership: {
      findMany: vendorMembershipFindMany,
    },
    mediaSession: {
      findMany: mediaSessionFindMany,
      updateMany: mediaSessionUpdateMany,
    },
    mediaAsset: {
      count: mediaAssetCount,
      updateMany: mediaAssetUpdateMany,
    },
    consentRecord: {
      findFirst: consentRecordFindFirst,
    },
    $transaction: transaction,
  };

  return {
    prisma,
    bookingFindFirst,
    bookingFindUnique,
    bookingUpdate,
    vendorMembershipFindMany,
    mediaSessionFindMany,
    mediaSessionUpdateMany,
    mediaAssetCount,
    mediaAssetUpdateMany,
    consentRecordFindFirst,
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
  requireVendorManager: vi.fn(),
}));

vi.mock("@/lib/notifications/send-job-assignment", () => ({
  sendJobAssignmentNotification: vi.fn(),
}));

vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: vi.fn(),
}));

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(),
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
    vi.mocked(requireVendorMembership).mockResolvedValue({ userId: "manager-1" } as any);
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({} as any);
    vi.mocked(sendJobAssignmentNotification).mockReset();
    vi.mocked(sendJobAssignmentNotification).mockResolvedValue({
      anySuccess: true,
      smsEnabled: true,
      emailEnabled: true,
      phoneNumberUsed: "+14075550123",
      channels: [
        { channel: "email", attempted: true, success: true, providerMessageId: "email-1" },
        { channel: "sms", attempted: true, success: true, providerMessageId: "sms-1" },
      ],
    });
    vi.mocked(sendVideoReadyNotification).mockReset();
    vi.mocked(sendVideoReadyNotification).mockResolvedValue({
      ok: true,
      channels: [],
      videoUrl: "",
    } as any);
    vi.mocked(recordLifecycleAudit).mockReset();
    vi.mocked(recordLifecycleAudit).mockResolvedValue(undefined);
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.mediaSessionUpdateMany.mockReset();
    hoisted.mediaAssetCount.mockReset();
    hoisted.mediaAssetUpdateMany.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
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

  it("PATCH ARCHIVE_JOB blocks non-completed jobs", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "PENDING" });
    const { req, ctx } = patchReq("v1", "job1", "ARCHIVE_JOB");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("ARCHIVE_REQUIRES_COMPLETED_JOB");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH ARCHIVE_JOB transitions booking status for completed jobs", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "COMPLETED" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
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

  it("GET marks CONFIRMED jobs as vendor-deletable", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "CONFIRMED" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    const { req, ctx } = getReq("v1", "job1");
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.canVendorDelete).toBe(true);
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
        reliance_ops: { operational_phase: "IN_PROGRESS" },
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
    expect(j.code).toBe("MANAGER_APPROVAL_REQUIRED");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS blocks COMPLETED when package is not admin-approved", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({
        reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" },
      }),
    });
    hoisted.mediaSessionFindMany
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }, { id: "s3" }])
      .mockResolvedValueOnce([
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
          mediaAssets: [{ id: "a2", moderationStatus: "pending_review", createdAt: new Date() }],
        },
        {
          id: "s3",
          sessionType: "JOB_SERVICE_VIDEO",
          vendorJobVideoStage: "COMPLETED",
          mediaAssets: [{ id: "a3", moderationStatus: "approved", createdAt: new Date() }],
        },
      ]);
    hoisted.mediaAssetCount.mockResolvedValue(2);
    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "completed",
    });
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("MANAGER_APPROVAL_REQUIRED");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS blocks direct COMPLETED and requires manager approval endpoint", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({
        reliance_ops: { operational_phase: "AWAITING_ADMIN_REVIEW" },
      }),
    });
    hoisted.mediaSessionFindMany
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }, { id: "s3" }])
      .mockResolvedValueOnce([
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
    hoisted.mediaAssetCount.mockResolvedValue(1);
    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "completed",
    });
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("MANAGER_APPROVAL_REQUIRED");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("GET marks awaiting-review jobs as vendor-deletable service orders", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "AWAITING_REVIEW" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(3);
    const { req, ctx } = getReq("v1", "job1");
    const res = await GET(req, ctx as any);
    const j = await toJson(res);

    expect(res.status).toBe(200);
    expect(j.canVendorDelete).toBe(true);
    expect(j.linkedSessionCount).toBe(1);
    expect(j.linkedAssetCount).toBe(3);
  });

  it("DELETE allows awaiting-review service orders and archives linked media before deleting", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "AWAITING_REVIEW" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    hoisted.mediaAssetCount.mockResolvedValue(2);

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    const j = await toJson(res);

    expect(res.status).toBe(200);
    expect(hoisted.txMediaSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
      data: { status: "ARCHIVED", endedAt: expect.any(Date) },
    });
    expect(hoisted.txMediaAssetUpdateMany).toHaveBeenCalledWith({
      where: { mediaSessionId: { in: ["s1", "s2"] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(hoisted.txMediaSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
      data: { bookingId: null },
    });
    expect(hoisted.txBookingDelete).toHaveBeenCalledWith({
      where: { id: "job1" },
    });
    expect(j.hardDeleted).toBe(true);
    expect(j.code).toBe("JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED");
  });

  it("PATCH ASSIGN_JOB saves a customer-location assignment while consent is pending", async () => {
    const customerLocationMetadata = JSON.stringify({
      vendor_job_recording_location: "residence",
      reliance_ops: { operational_phase: "PENDING" },
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: customerLocationMetadata,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: customerLocationMetadata,
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: { name: "Peter Parker", email: "peter@example.com", phone: "4075550123" },
      },
    ]);
    hoisted.bookingUpdate.mockImplementation(async ({ data }: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: data.customerMetadata,
      updatedAt: new Date("2026-07-22T12:00:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "ASSIGN_JOB",
      assignedMembershipIds: ["member-1"],
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.notifications).toMatchObject({ deferred: true, sentCount: 0 });
    const saved = JSON.parse(hoisted.bookingUpdate.mock.calls[0][0].data.customerMetadata);
    expect(saved.vendor_job_assigned_membership_ids).toEqual(["member-1"]);
    expect(saved.vendor_job_service_order_released_at).toBeUndefined();
  });

  it("PATCH ASSIGN_JOB stores primary employee attribution and defers the service order email", async () => {
    const previousMetadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["old-member"],
      vendor_job_assigned_employees: ["Old Employee"],
      reliance_ops: { operational_phase: "PENDING" },
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: previousMetadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: previousMetadata,
    });
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: {
          name: "Peter Parker",
          email: "peter@example.com",
          phone: "4075550123",
        },
      },
    ]);
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: args.data.customerMetadata,
      updatedAt: new Date("2026-06-11T12:00:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "ASSIGN_JOB",
      assignedMembershipIds: ["member-1"],
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({
          customerMetadata: expect.any(String),
        }),
      })
    );
    const updateArg = hoisted.bookingUpdate.mock.calls[0][0];
    const savedMetadata = JSON.parse(updateArg.data.customerMetadata);
    expect(savedMetadata.vendor_job_assigned_membership_ids).toEqual(["member-1"]);
    expect(savedMetadata.vendor_job_assigned_employees).toEqual(["Peter Parker"]);
    expect(savedMetadata.vendor_job_primary_membership_id).toBe("member-1");
    expect(savedMetadata.vendor_job_primary_employee).toBe("Peter Parker");
    expect(savedMetadata.reliance_ops.operational_phase).toBe("ASSIGNED");
    expect(recordLifecycleAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "job_assigned",
        actorUserId: "manager-1",
        newValue: expect.objectContaining({
          primaryMembershipId: "member-1",
          primaryEmployeeName: "Peter Parker",
        }),
      })
    );
    expect(sendJobAssignmentNotification).not.toHaveBeenCalled();
    expect(json.notifications).toMatchObject({
      newlyAssignedCount: 1,
      sentCount: 0,
      deferred: true,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER sends business-address jobs for employee phone location verification", async () => {
    const metadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_assigned_employees: ["Peter Parker"],
      vendor_job_primary_membership_id: "member-1",
      vendor_job_primary_employee: "Peter Parker",
      vendor_job_recording_location: "business",
      vendor_job_location_verified: false,
      reliance_ops: { operational_phase: "ASSIGNED" },
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: metadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: metadata,
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: {
          name: "Peter Parker",
          email: "peter@example.com",
          phone: "4075550123",
        },
      },
    ]);
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: args.data.customerMetadata,
      updatedAt: new Date("2026-06-11T12:10:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "RELEASE_EMPLOYEE_SERVICE_ORDER",
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(sendJobAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job1",
        actorUserId: "manager-1",
        employeeName: "Peter Parker",
        employeeEmail: "peter@example.com",
        employeePhone: "4075550123",
        employeeJobLink: expect.stringMatching(
          /^http:\/\/localhost\/employee\/jobs\?jobId=job1&ct=.+/
        ),
        vendorName: "Electro LLC",
        jobTitle: "Outlet Installation",
        customerName: "Carmen Customer",
      })
    );
    const updateArg = hoisted.bookingUpdate.mock.calls[0][0];
    const savedMetadata = JSON.parse(updateArg.data.customerMetadata);
    expect(savedMetadata.vendor_job_location_verified).toBe(false);
    expect(savedMetadata.vendor_job_service_order_released_membership_ids).toEqual(["member-1"]);
    expect(json.notifications).toMatchObject({
      sentCount: 1,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER blocks a declined residence request despite mutable business metadata", async () => {
    const metadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_assigned_employees: ["Peter Parker"],
      vendor_job_recording_location: "business",
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: metadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: null,
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: metadata,
    });
    hoisted.consentRecordFindFirst.mockResolvedValue({
      id: "permission-1",
      status: "declined",
      lifecycleStatus: "DECLINED",
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: JSON.stringify({ recordingLocation: "residence" }),
      recipientMismatch: false,
      decisionEvidence: { id: "evidence-1" },
    });

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "RELEASE_EMPLOYEE_SERVICE_ORDER",
      recordingCompliance: { location: "business", consentAccepted: true },
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(409);
    expect(json.code).toBe("VERIFIED_PERMISSION_REQUIRED");
    expect((json.details as any).recordingCompliance).toMatchObject({
      location: "residence",
      permissionRequired: true,
      permissionStatus: "declined",
      recordingUnlocked: false,
    });
    expect(sendJobAssignmentNotification).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_RECORDING_COMPLIANCE snapshots the selected business address", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: JSON.stringify({}),
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
      date: null,
      service: { name: "Electrical Service" },
      vendor: {
        businessName: "Electro LLC",
        name: "Electro",
        address: "407 Boxwood Circle",
        city: "Winter Springs",
        state: "FL",
        zipCode: "32708",
        latitude: 28.6984,
        longitude: -81.3081,
        geocodedAt: new Date("2026-06-10T12:00:00.000Z"),
      },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({ customerMetadata: JSON.stringify({}) });
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: args.data.customerMetadata,
      updatedAt: new Date("2026-06-11T12:10:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_RECORDING_COMPLIANCE",
      recordingCompliance: {
        location: "business",
        consentAccepted: false,
        locationVerified: false,
      },
    });
    const response = await PATCH(req, ctx as any);
    const json = await toJson(response);
    const savedMetadata = JSON.parse(hoisted.bookingUpdate.mock.calls[0][0].data.customerMetadata);

    expect(response.status).toBe(200);
    expect(savedMetadata.vendor_job_recording_location_snapshot).toMatchObject({
      type: "business",
      source: "vendor_profile",
      status: "verified_coordinates",
      address: "407 Boxwood Circle",
      city: "Winter Springs",
      state: "FL",
      zip_code: "32708",
      latitude: 28.6984,
      longitude: -81.3081,
    });
    expect((json.job as any).recordingCompliance.addressSnapshot.formattedAddress).toBe(
      "407 Boxwood Circle, Winter Springs, FL, 32708"
    );
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER sends the service order after business location verification", async () => {
    const metadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_assigned_employees: ["Peter Parker"],
      vendor_job_primary_membership_id: "member-1",
      vendor_job_primary_employee: "Peter Parker",
      vendor_job_recording_location: "business",
      vendor_job_location_verified: true,
      vendor_job_location_verified_at: "2026-06-11T12:00:00.000Z",
      reliance_ops: { operational_phase: "ASSIGNED" },
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: metadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: metadata,
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: {
          name: "Peter Parker",
          email: "peter@example.com",
          phone: "4075550123",
        },
      },
    ]);
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: args.data.customerMetadata,
      updatedAt: new Date("2026-06-11T12:10:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "RELEASE_EMPLOYEE_SERVICE_ORDER",
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(sendJobAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job1",
        actorUserId: "manager-1",
        employeeName: "Peter Parker",
        employeeEmail: "peter@example.com",
        employeePhone: "4075550123",
        employeeJobLink: expect.stringMatching(
          /^http:\/\/localhost\/employee\/jobs\?jobId=job1&ct=.+/
        ),
        vendorName: "Electro LLC",
        jobTitle: "Outlet Installation",
        customerName: "Carmen Customer",
      })
    );
    const updateArg = hoisted.bookingUpdate.mock.calls[0][0];
    const savedMetadata = JSON.parse(updateArg.data.customerMetadata);
    expect(savedMetadata.vendor_job_service_order_released_membership_ids).toEqual(["member-1"]);
    expect(savedMetadata.vendor_job_service_order_released_at).toEqual(expect.any(String));
    expect(json.notifications).toMatchObject({
      sentCount: 1,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER force resends an already released service order link", async () => {
    const metadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_assigned_employees: ["Peter Parker"],
      vendor_job_primary_membership_id: "member-1",
      vendor_job_primary_employee: "Peter Parker",
      vendor_job_recording_location: "business",
      vendor_job_location_verified: false,
      vendor_job_service_order_released_membership_ids: ["member-1"],
      vendor_job_service_order_released_at: "2026-06-11T12:00:00.000Z",
      reliance_ops: { operational_phase: "ASSIGNED" },
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: metadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });
    hoisted.bookingFindUnique.mockResolvedValue({
      status: "PENDING",
      customerMetadata: metadata,
    });
    hoisted.consentRecordFindFirst.mockResolvedValue(null);
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: {
          name: "Peter Parker",
          email: "peter@example.com",
          phone: "4075550123",
        },
      },
    ]);
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "job1",
      status: "PENDING",
      customerMetadata: args.data.customerMetadata,
      updatedAt: new Date("2026-06-11T12:10:00.000Z"),
    }));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "RELEASE_EMPLOYEE_SERVICE_ORDER",
      forceResend: true,
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(200);
    expect(sendJobAssignmentNotification).toHaveBeenCalledTimes(1);
    expect(sendJobAssignmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "job1",
        employeeName: "Peter Parker",
        employeeEmail: "peter@example.com",
        employeePhone: "4075550123",
        employeeJobLink: expect.stringMatching(
          /^http:\/\/localhost\/employee\/jobs\?jobId=job1&ct=.+/
        ),
      })
    );
    const updateArg = hoisted.bookingUpdate.mock.calls[0][0];
    const savedMetadata = JSON.parse(updateArg.data.customerMetadata);
    expect(savedMetadata.vendor_job_service_order_released_membership_ids).toEqual(["member-1"]);
    expect(json.notifications).toMatchObject({
      sentCount: 1,
      forceResend: true,
    });
    expect(json.message).toBe("Employee service order link resent.");
  });

  it("PATCH RESEND_COMPLETED_WORK_ORDER sends an unclaimed customer a fresh secure invitation", async () => {
    const metadata = JSON.stringify({
      claim_status: "UNCLAIMED",
      claim_contact_email: "customer@example.com",
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "COMPLETED",
      customerMetadata: metadata,
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: {
        name: "Carmen Customer",
        email: "unclaimed+job1@reliance.local",
        phone: null,
      },
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "intro-session",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        mediaAssets: [{ id: "intro", moderationStatus: "approved" }],
      },
      {
        id: "progress-session",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "IN_PROGRESS",
        mediaAssets: [{ id: "progress", moderationStatus: "approved" }],
      },
      {
        id: "complete-session",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "COMPLETED",
        mediaAssets: [{ id: "complete", moderationStatus: "approved" }],
      },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({ id: "job1" });
    vi.mocked(sendVideoReadyNotification).mockImplementation(
      async (input: any) =>
        ({
          ok: true,
          channels: [],
          videoUrl: input.videoUrl,
        } as any)
    );

    const { req, ctx } = patchReq(
      "v1",
      "job1",
      "RESEND_COMPLETED_WORK_ORDER"
    );
    const res = await PATCH(req, ctx as any);

    expect(res.status).toBe(200);
    expect(sendVideoReadyNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: "customer@example.com",
        videoUrl: expect.stringMatching(
          /^http:\/\/localhost\/my-bookings\/job1\?videoReady=1&claimToken=/
        ),
      })
    );
    const updateInput = hoisted.bookingUpdate.mock.calls[0][0];
    const savedMetadata = JSON.parse(updateInput.data.customerMetadata);
    expect(savedMetadata.customer_booking_claim_token_hash).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(updateInput.data.customerMetadata).not.toContain("claimToken");
  });

  it("DELETE allows CONFIRMED (in-progress) jobs for vendors", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "CONFIRMED" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(200);
    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.txBookingDelete).toHaveBeenCalledWith({ where: { id: "job1" } });
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
