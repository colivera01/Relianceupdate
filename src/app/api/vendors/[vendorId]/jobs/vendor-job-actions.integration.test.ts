import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./[jobId]/actions/route";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import { releaseEmployeeServiceOrderWhenReady } from "@/lib/employee-service-order-release";
import { sendServiceOrderCanceledNotifications } from "@/lib/notifications/send-service-order-canceled";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { AuthorizationError } from "@/lib/request-actor";
import { loadPackageVisibilityView } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const bookingDelete = vi.fn();
  const vendorMembershipFindMany = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const mediaSessionUpdateMany = vi.fn();
  const mediaSessionCount = vi.fn();
  const mediaAssetCount = vi.fn();
  const mediaAssetUpdateMany = vi.fn();
  const consentRecordFindFirst = vi.fn();
  const consentRecordCount = vi.fn();
  const bookingNotificationCount = vi.fn();
  const serviceVideoPackageFindFirst = vi.fn();
  const serviceVideoAdminDecisionFindFirst = vi.fn();
  const txEmployeeCertificationUpdateMany = vi.fn();
  const txConsentRequestLinkUpdateMany = vi.fn();
  const txBookingNotificationUpdateMany = vi.fn();
  const txMediaSessionUpdateMany = vi.fn();
  const txMediaAssetUpdateMany = vi.fn();
  const txBookingDelete = vi.fn();
  const transaction = vi.fn(async (cb: any) =>
    cb({
      mediaSession: { updateMany: txMediaSessionUpdateMany },
      mediaAsset: { updateMany: txMediaAssetUpdateMany },
      employeeRecordingCertification: { updateMany: txEmployeeCertificationUpdateMany },
      consentRequestLink: { updateMany: txConsentRequestLinkUpdateMany },
      bookingNotification: { updateMany: txBookingNotificationUpdateMany },
      booking: { findUnique: bookingFindUnique, delete: txBookingDelete, update: bookingUpdate },
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
      count: mediaSessionCount,
    },
    mediaAsset: {
      count: mediaAssetCount,
      updateMany: mediaAssetUpdateMany,
    },
    consentRecord: {
      findFirst: consentRecordFindFirst,
      count: consentRecordCount,
    },
    bookingNotification: { count: bookingNotificationCount },
    serviceVideoPackageEvidence: { findFirst: serviceVideoPackageFindFirst },
    serviceVideoAdminAuditDecisionEvidence: { findFirst: serviceVideoAdminDecisionFindFirst },
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
    mediaSessionCount,
    mediaAssetCount,
    mediaAssetUpdateMany,
    consentRecordFindFirst,
    consentRecordCount,
    bookingNotificationCount,
    serviceVideoPackageFindFirst,
    serviceVideoAdminDecisionFindFirst,
    txEmployeeCertificationUpdateMany,
    txConsentRequestLinkUpdateMany,
    txBookingNotificationUpdateMany,
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

vi.mock("@/lib/employee-service-order-release", () => ({
  releaseEmployeeServiceOrderWhenReady: vi.fn(),
}));

vi.mock("@/lib/notifications/send-service-order-canceled", () => ({
  sendServiceOrderCanceledNotifications: vi.fn(),
}));

vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: vi.fn(),
}));

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(),
}));

vi.mock("@/lib/service-video-publication", () => ({
  loadPackageVisibilityView: vi.fn(),
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
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "manager-1",
      membershipId: "manager-membership-1",
      role: "MANAGER",
    });
    vi.mocked(requireVendorManager).mockReset();
    vi.mocked(requireVendorManager).mockResolvedValue({
      userId: "manager-1",
      membershipId: "manager-membership-1",
      vendorId: "v1",
    });
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockReset();
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: false,
      alreadyReleased: false,
      sentCount: 0,
      releasedMembershipIds: [],
      results: [],
    });
    vi.mocked(sendServiceOrderCanceledNotifications).mockReset();
    vi.mocked(sendServiceOrderCanceledNotifications).mockResolvedValue([] as any);
    vi.mocked(sendVideoReadyNotification).mockReset();
    vi.mocked(sendVideoReadyNotification).mockResolvedValue({
      ok: true,
      channels: [],
      videoUrl: "",
    } as any);
    vi.mocked(recordLifecycleAudit).mockReset();
    vi.mocked(recordLifecycleAudit).mockResolvedValue(undefined);
    vi.mocked(loadPackageVisibilityView).mockReset();
    vi.mocked(loadPackageVisibilityView).mockResolvedValue({ privateProofReleased: true } as any);
    hoisted.bookingFindFirst.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.mediaSessionUpdateMany.mockReset();
    hoisted.mediaSessionCount.mockReset();
    hoisted.mediaSessionCount.mockResolvedValue(0);
    hoisted.mediaAssetCount.mockReset();
    hoisted.mediaAssetUpdateMany.mockReset();
    hoisted.consentRecordFindFirst.mockReset();
    hoisted.consentRecordCount.mockReset();
    hoisted.consentRecordCount.mockResolvedValue(0);
    hoisted.bookingNotificationCount.mockReset();
    hoisted.bookingNotificationCount.mockResolvedValue(0);
    hoisted.serviceVideoPackageFindFirst.mockReset();
    hoisted.serviceVideoPackageFindFirst.mockResolvedValue(null);
    hoisted.serviceVideoAdminDecisionFindFirst.mockReset();
    hoisted.txEmployeeCertificationUpdateMany.mockReset();
    hoisted.txConsentRequestLinkUpdateMany.mockReset();
    hoisted.txBookingNotificationUpdateMany.mockReset();
    hoisted.txMediaSessionUpdateMany.mockReset();
    hoisted.txMediaAssetUpdateMany.mockReset();
    hoisted.txBookingDelete.mockReset();
    hoisted.transaction.mockClear();
  });

  it("PATCH returns 403 when vendor auth is forbidden", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden"));
    const { req, ctx } = patchReq("v1", "job1", "ARCHIVE_JOB");
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(403);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
  });

  it("blocks every general manager mutation while the exact package awaits Reliance Audit", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "COMPLETED" });
    hoisted.serviceVideoPackageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "AWAITING_ADMIN_REVIEW",
      adminAuditDecisionId: null,
    });
    const { req, ctx } = patchReq("v1", "job1", "MOVE_CONTENT_TO_ARCHIVE");

    const res = await PATCH(req, ctx as any);

    expect(res.status).toBe(409);
    expect(await toJson(res)).toMatchObject({ code: "ADMIN_AUDIT_IN_PROGRESS" });
    expect(hoisted.mediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks destructive deletion after terminal Admin REJECT", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "REJECTED" });
    hoisted.serviceVideoPackageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "ADMIN_REJECTED",
      adminAuditDecisionId: "admin-audit-1",
    });
    const { req, ctx } = deleteReq("v1", "job1");

    const res = await DELETE(req, ctx as any);

    expect(res.status).toBe(409);
    expect(await toJson(res)).toMatchObject({ code: "ADMIN_AUDIT_REJECTED_TERMINAL" });
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });

  it.each([
    "ARCHIVE_JOB",
    "MOVE_CONTENT_TO_ARCHIVE",
    "UNARCHIVE_JOB",
    "UPDATE_JOB",
    "ASSIGN_JOB",
    "UPDATE_RECORDING_COMPLIANCE",
    "RELEASE_EMPLOYEE_SERVICE_ORDER",
    "CANCEL_SERVICE_ORDER",
    "RESEND_COMPLETED_WORK_ORDER",
    "UPDATE_STATUS",
    "APPROVE_JOB_COMPLETION",
  ])(
    "PATCH %s denies an employee before any vendor-management lookup or mutation",
    async (action) => {
      vi.mocked(requireVendorMembership).mockResolvedValue({
        userId: "employee-1",
        membershipId: "employee-membership-1",
        role: "EMPLOYEE",
      });
      vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));

      const { req, ctx } = patchReq("v1", "job1", action);
      const res = await PATCH(req, ctx as any);

      expect(res.status).toBe(403);
      expect(requireVendorManager).toHaveBeenCalledTimes(1);
      expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
      expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
      expect(hoisted.mediaSessionFindMany).not.toHaveBeenCalled();
      expect(hoisted.mediaSessionUpdateMany).not.toHaveBeenCalled();
      expect(hoisted.mediaAssetUpdateMany).not.toHaveBeenCalled();
      expect(hoisted.transaction).not.toHaveBeenCalled();
    },
  );

  it("PATCH UPDATE_STATUS cannot be used by an employee as an alternate archive path", async () => {
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "employee-1",
      membershipId: "employee-membership-1",
      role: "EMPLOYEE",
    });
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "archived",
    });
    const res = await PATCH(req, ctx as any);

    expect(res.status).toBe(403);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionFindMany).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_STATUS cannot bypass the evidence-preserving cancellation action", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: JSON.stringify({}),
    });

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "UPDATE_STATUS",
      status: "canceled",
    });
    const res = await PATCH(req, ctx as any);
    const body = await toJson(res);

    expect(res.status).toBe(409);
    expect(body.code).toBe("SERVICE_ORDER_CANCELLATION_ACTION_REQUIRED");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH CANCEL_SERVICE_ORDER preserves evidence and closes employee access", async () => {
    const metadata = JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_service_order_released_membership_ids: ["member-1"],
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "CONFIRMED",
      customerMetadata: metadata,
      title: "Wire Stipping",
      service: { name: "Wire Stipping" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Bart Simpson", email: "bart@example.com", phone: null },
    });
    hoisted.bookingFindUnique.mockResolvedValue({ status: "CONFIRMED", customerMetadata: metadata });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "unused-session", _count: { mediaAssets: 0 } }]);
    hoisted.vendorMembershipFindMany.mockResolvedValue([
      { user: { name: "Bradley Coopers", email: "employee@example.com", phone: null } },
    ]);
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job1",
      status: "CANCELED",
      customerMetadata: JSON.stringify({ vendor_job_cancellation: { status: "CANCELED" } }),
      updatedAt: new Date(),
    });

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "CANCEL_SERVICE_ORDER",
      reason: "Customer canceled the scheduled service.",
    });
    const res = await PATCH(req, ctx as any);
    const body = await toJson(res);

    expect(res.status).toBe(200);
    expect((body.job as any).status).toBe("CANCELED");
    expect(hoisted.txEmployeeCertificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "INVALIDATED" }) }),
    );
    expect(hoisted.txMediaSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["unused-session"] } }) }),
    );
    expect(hoisted.txConsentRequestLinkUpdateMany).toHaveBeenCalled();
    expect(hoisted.txBookingNotificationUpdateMany).toHaveBeenCalled();
    expect(sendServiceOrderCanceledNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job1", reason: "Customer canceled the scheduled service." }),
    );
    expect(recordLifecycleAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "service_order_canceled", entityId: "job1" }),
    );
  });

  it("PATCH MOVE_CONTENT_TO_ARCHIVE denies an employee for an awaiting-review work record", async () => {
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "employee-1",
      membershipId: "employee-membership-1",
      role: "EMPLOYEE",
    });
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", vendorId: "v1", status: "AWAITING_REVIEW" });

    const { req, ctx } = patchReq("v1", "job1", "MOVE_CONTENT_TO_ARCHIVE");
    const res = await PATCH(req, ctx as any);

    expect(res.status).toBe(403);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetUpdateMany).not.toHaveBeenCalled();
  });

  it("PATCH destructive actions fail closed for ambiguous manager authority", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(
      new AuthorizationError("FORBIDDEN", "Manager access required.", 403),
    );

    const { req, ctx } = patchReq("v1", "job1", "MOVE_CONTENT_TO_ARCHIVE");
    const res = await PATCH(req, ctx as any);
    const body = await toJson(res);

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetUpdateMany).not.toHaveBeenCalled();
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
    expect(requireVendorManager).toHaveBeenCalledTimes(1);
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

  it("GET requires cancellation instead of deleting an active Service Order", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "CONFIRMED" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    const { req, ctx } = getReq("v1", "job1");
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);
    const j = await toJson(res);
    expect(j.canVendorDelete).toBe(false);
    expect(j.canCancelServiceOrder).toBe(true);
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

  it("DELETE denies an employee awaiting-review access before destructive mutation", async () => {
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "employee-1",
      membershipId: "employee-membership-1",
      role: "EMPLOYEE",
    });
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "AWAITING_REVIEW" });

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    const body = await toJson(res);

    expect(res.status).toBe(403);
    expect(body.code).toBe("JOB_DELETE_BLOCKED_FORBIDDEN");
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
    expect(hoisted.mediaSessionFindMany).not.toHaveBeenCalled();
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.txMediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.txMediaAssetUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.txBookingDelete).not.toHaveBeenCalled();
  });

  it("DELETE fails closed when manager authority is missing or ambiguous", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Unauthorized"));

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);

    expect(res.status).toBe(403);
    expect(hoisted.bookingFindFirst).not.toHaveBeenCalled();
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

  it("GET keeps manager-review Service Orders out of hard-delete and cancellation paths", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "AWAITING_REVIEW" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(3);
    const { req, ctx } = getReq("v1", "job1");
    const res = await GET(req, ctx as any);
    const j = await toJson(res);

    expect(res.status).toBe(200);
    expect(j.canVendorDelete).toBe(false);
    expect(j.canCancelServiceOrder).toBe(false);
    expect(j.linkedSessionCount).toBe(1);
    expect(j.linkedAssetCount).toBe(3);
  });

  it("DELETE blocks awaiting-review Service Orders without mutating evidence", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "AWAITING_REVIEW" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    hoisted.mediaAssetCount.mockResolvedValue(2);

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    const j = await toJson(res);

    expect(res.status).toBe(409);
    expect(j.code).toBe("JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY");
    expect(hoisted.transaction).not.toHaveBeenCalled();
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
    expect(releaseEmployeeServiceOrderWhenReady).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job1", vendorId: "v1", actorUserId: "manager-1" }),
    );
    expect(json.notifications).toMatchObject({
      newlyAssignedCount: 1,
      sentCount: 0,
      deferred: true,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER sends business-address jobs for employee phone location verification", async () => {
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: true,
      alreadyReleased: false,
      sentCount: 1,
      releasedMembershipIds: ["member-1"],
      results: [{ membershipId: "member-1", anySuccess: true }],
    });
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
    expect(releaseEmployeeServiceOrderWhenReady).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job1", vendorId: "v1", actorUserId: "manager-1" }),
    );
    expect(json.notifications).toMatchObject({
      sentCount: 1,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER reports a failed initial delivery truthfully", async () => {
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: true,
      alreadyReleased: false,
      sentCount: 0,
      releasedMembershipIds: [],
      results: [{ membershipId: "member-1", anySuccess: false }],
    });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "PENDING",
      customerMetadata: JSON.stringify({ vendor_job_assigned_membership_ids: ["member-1"] }),
      title: "Outlet Installation",
      clientName: "Carmen Customer",
      scheduledFor: null,
      date: null,
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Carmen Customer", email: "carmen@example.com", phone: "4075550100" },
    });

    const { req, ctx } = patchReqBody("v1", "job1", {
      action: "RELEASE_EMPLOYEE_SERVICE_ORDER",
    });
    const res = await PATCH(req, ctx as any);
    const json = await toJson(res);

    expect(res.status).toBe(502);
    expect(json.code).toBe("SERVICE_ORDER_NOTIFICATION_FAILED");
    expect(recordLifecycleAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "employee_service_order_released" }),
    );
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER blocks a declined residence request despite mutable business metadata", async () => {
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: false,
      alreadyReleased: false,
      sentCount: 0,
      releasedMembershipIds: [],
      results: [],
      blocked: {
        code: "VERIFIED_PERMISSION_REQUIRED",
        why: "The customer declined recording.",
        resolution: "Continue the service without recording.",
      },
    });
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
    expect((json.details as any).blocked).toMatchObject({
      code: "VERIFIED_PERMISSION_REQUIRED",
      resolution: "Continue the service without recording.",
    });
    expect(releaseEmployeeServiceOrderWhenReady).toHaveBeenCalledTimes(1);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH UPDATE_RECORDING_COMPLIANCE cannot manufacture a snapshot from mutable profile data", async () => {
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

    expect(response.status).toBe(409);
    expect(json.code).toBe("RECORDING_LOCATION_SNAPSHOT_IMMUTABLE");
    expect(json.message).toContain("cannot be replaced");
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER sends the service order after business location verification", async () => {
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: true,
      alreadyReleased: false,
      sentCount: 1,
      releasedMembershipIds: ["member-1"],
      results: [{ membershipId: "member-1", anySuccess: true }],
    });
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
    expect(releaseEmployeeServiceOrderWhenReady).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job1", vendorId: "v1", forceResend: false }),
    );
    expect(json.notifications).toMatchObject({
      sentCount: 1,
    });
  });

  it("PATCH RELEASE_EMPLOYEE_SERVICE_ORDER force resends an already released service order link", async () => {
    vi.mocked(releaseEmployeeServiceOrderWhenReady).mockResolvedValue({
      ready: true,
      alreadyReleased: false,
      sentCount: 1,
      releasedMembershipIds: ["member-1"],
      results: [{ membershipId: "member-1", anySuccess: true }],
    });
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
    expect(releaseEmployeeServiceOrderWhenReady).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job1", vendorId: "v1", forceResend: true }),
    );
    expect(json.notifications).toMatchObject({
      sentCount: 1,
      forceResend: true,
    });
    expect(json.message).toBe("Employee Service Order link resent.");
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
    expect(recordLifecycleAudit).toHaveBeenCalledWith(expect.objectContaining({
      actionType: "private_proof_access_resent",
      entityId: "job1",
    }));
  });

  it("PATCH RESEND_COMPLETED_WORK_ORDER remains blocked until Admin PASS releases Private Proof", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job1",
      vendorId: "v1",
      status: "COMPLETED",
      customerMetadata: JSON.stringify({ claim_contact_email: "customer@example.com" }),
      title: "Outlet Installation",
      clientName: "Customer",
      service: { name: "Electrical Service" },
      vendor: { businessName: "Electro LLC", name: "Electro" },
      user: { name: "Customer", email: "customer@example.com", phone: null },
    });
    hoisted.mediaSessionFindMany.mockResolvedValue([
      { id: "intro-session", sessionType: "JOB_SERVICE_VIDEO", vendorJobVideoStage: "INTRO", mediaAssets: [{ id: "intro", moderationStatus: "approved" }] },
      { id: "progress-session", sessionType: "JOB_SERVICE_VIDEO", vendorJobVideoStage: "IN_PROGRESS", mediaAssets: [{ id: "progress", moderationStatus: "approved" }] },
      { id: "complete-session", sessionType: "JOB_SERVICE_VIDEO", vendorJobVideoStage: "COMPLETED", mediaAssets: [{ id: "complete", moderationStatus: "approved" }] },
    ]);
    vi.mocked(loadPackageVisibilityView).mockResolvedValue({ privateProofReleased: false } as any);

    const { req, ctx } = patchReq("v1", "job1", "RESEND_COMPLETED_WORK_ORDER");
    const response = await PATCH(req, ctx as any);

    expect(response.status).toBe(409);
    expect(sendVideoReadyNotification).not.toHaveBeenCalled();
  });

  it("DELETE blocks CONFIRMED Service Orders and directs managers to cancellation", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "CONFIRMED" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(409);
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.txBookingDelete).not.toHaveBeenCalled();
    expect(requireVendorManager).toHaveBeenCalledTimes(1);
  });

  it("DELETE preserves a pending Service Order once linked media evidence exists", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    hoisted.mediaAssetCount.mockResolvedValue(2);
    hoisted.mediaSessionCount.mockResolvedValue(2);

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(409);
    const j = await toJson(res);
    expect(j.code).toBe("JOB_DELETE_BLOCKED_DURABLE_EVIDENCE");
    expect(hoisted.transaction).not.toHaveBeenCalled();
    expect(hoisted.txBookingDelete).not.toHaveBeenCalled();
  });

  it("DELETE allows only an empty disposable pending draft", async () => {
    hoisted.bookingFindFirst.mockResolvedValue({ id: "job1", status: "PENDING" });
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);

    const { req, ctx } = deleteReq("v1", "job1");
    const res = await DELETE(req, ctx as any);

    expect(res.status).toBe(200);
    expect(requireVendorManager).toHaveBeenCalledTimes(1);
    expect(hoisted.txMediaSessionUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.txMediaAssetUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.txBookingDelete).toHaveBeenCalledWith({ where: { id: "job1" } });
  });
});
