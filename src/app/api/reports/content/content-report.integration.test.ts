import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx: any = {
    contentReport: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    contentReportRequest: { findUnique: vi.fn(), create: vi.fn() },
    contentReportCaseEvent: { create: vi.fn() },
    mediaLifecycleCase: { create: vi.fn() },
    mediaLifecycleRestriction: { create: vi.fn() },
    mediaLifecycleAuditEvent: { create: vi.fn() },
    publicServiceVideoEligibility: { findMany: vi.fn(), updateMany: vi.fn() },
    mediaAsset: { updateMany: vi.fn() },
  };
  const prisma: any = {
    mediaAsset: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    privateProofAccessGrant: { findFirst: vi.fn() },
    serviceVideoPackageEvidence: { findFirst: vi.fn() },
    serviceVideoAdminAuditDecisionEvidence: { findFirst: vi.fn() },
    serviceVideoStageEvidence: { findFirst: vi.fn() },
    publicServiceVideoEligibility: { findFirst: vi.fn() },
    contentReport: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    contentReportRequest: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(tx)),
  };
  return { prisma, tx, resolvePublic: vi.fn(), notify: vi.fn() };
});

vi.mock("@/server/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/service-video-publication", async (original) => ({ ...(await original<any>()), resolveCanonicalPublicAssetIds: h.resolvePublic }));
vi.mock("@/lib/admin-notifications", () => ({ createAdminNotificationWithEmail: h.notify }));
vi.mock("@/lib/request-actor", async (original) => {
  const actual = await original<any>();
  return { ...actual, requireRequestActor: vi.fn() };
});

import { requireRequestActor } from "@/lib/request-actor";
import { GET, POST } from "./route";

const packageStages = [{ stage: "INTRO", stageEvidenceId: "stage-1", stageVersion: 1, mediaAssetId: "asset-1", contentHash: "hash-1" }];

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/reports/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "media_asset", targetId: "asset-1", requestId: "request-1", reasonCategory: "private_sensitive_information", ...body }) });
}

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1", caseReference: "RP-A1B2C3D4", status: "open", createdAt: new Date(),
    targetType: "media_asset", targetId: "asset-1", bookingId: "booking-1", vendorId: "vendor-1",
    packageId: "package-1", stage: "INTRO", severity: "high", reporterUserId: "customer-1",
    ...overrides,
  };
}

describe("Service Video content reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRequestActor).mockResolvedValue({ userId: "customer-1", email: "customer@example.com", accountStatus: "active", platformRoles: [], vendorMemberships: [] });
    h.prisma.mediaAsset.findUnique.mockResolvedValue({ id: "asset-1", vendorId: "vendor-1", contentHash: "hash-1", moderationStatus: "approved", visibilityStatus: "customer_only", archiveStatus: "active", uploadState: "SAVED", deletedAt: null, mediaSession: { bookingId: "booking-1", vendorId: "vendor-1", vendorJobVideoStage: "INTRO" } });
    h.prisma.booking.findUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1", vendorId: "vendor-1" });
    h.resolvePublic.mockResolvedValue([]);
    h.prisma.privateProofAccessGrant.findFirst.mockResolvedValue({ id: "grant-1", packageId: "package-1", managerDecisionId: "manager-1", adminAuditDecisionId: "audit-1" });
    h.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({ id: "package-1", version: 2, packageHash: "package-hash", stageEvidenceJson: JSON.stringify(packageStages), adminAuditDecisionId: "audit-1" });
    h.prisma.serviceVideoAdminAuditDecisionEvidence.findFirst.mockResolvedValue({ id: "audit-1", decision: "PASS" });
    h.prisma.serviceVideoStageEvidence.findFirst.mockResolvedValue({ id: "stage-1", stage: "INTRO", stageVersion: 1, contentHash: "hash-1" });
    h.tx.contentReportRequest.findUnique.mockResolvedValue(null);
    h.tx.contentReport.count.mockResolvedValue(0);
    h.tx.contentReport.create.mockResolvedValue(reportRow());
    h.tx.contentReport.update.mockImplementation(async ({ data }: any) => reportRow(data));
    h.tx.contentReportCaseEvent.create.mockResolvedValue({ id: "event-1" });
    h.tx.contentReportRequest.create.mockResolvedValue({ id: "request-row-1" });
    h.prisma.contentReport.update.mockResolvedValue(reportRow());
    h.notify.mockResolvedValue({ notification: { id: "notification-1" }, emailSent: true });
  });

  it("allows the owning customer with exact active Private Proof evidence", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, report: { caseReference: "RP-A1B2C3D4", status: "Received" } });
    expect(h.tx.contentReport.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accessBasis: "OWNING_CUSTOMER_PRIVATE_PROOF", packageHash: "package-hash", stageEvidenceId: "stage-1", mediaContentHash: "hash-1", adminAuditDecisionId: "audit-1" }) });
    expect(h.tx.contentReportCaseEvent.create).toHaveBeenCalled();
  });

  it("denies asset-ID guessing by an unrelated account", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({ userId: "stranger", email: "stranger@example.com", accountStatus: "active", platformRoles: [], vendorMemberships: [] });
    const response = await POST(request({}));
    expect(response.status).toBe(403);
    expect(h.tx.contentReport.create).not.toHaveBeenCalled();
  });

  it("denies the owning customer when no active Private Proof grant exists", async () => {
    h.prisma.privateProofAccessGrant.findFirst.mockResolvedValue(null);
    const response = await POST(request({}));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("REPORT_PRIVATE_PROOF_REQUIRED");
  });

  it("allows an authenticated viewer to report canonically Public media", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({ userId: "viewer-1", email: "viewer@example.com", accountStatus: "active", platformRoles: [], vendorMemberships: [] });
    h.resolvePublic.mockResolvedValue(["asset-1"]);
    h.prisma.publicServiceVideoEligibility.findFirst.mockResolvedValue({ packageId: "package-1", packageHash: "package-hash", proposalId: "proposal-1" });
    const response = await POST(request({ reasonCategory: "copyright" }));
    expect(response.status).toBe(201);
    expect(h.tx.contentReport.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accessBasis: "AUTHENTICATED_PUBLIC_VIEWER", visibilityAtReport: "PUBLIC" }) });
    expect(h.tx.mediaLifecycleCase.create).not.toHaveBeenCalled();
  });

  it("applies an evidence-preserving Public hold for an owning-customer privacy report", async () => {
    h.resolvePublic.mockResolvedValue(["asset-1"]);
    h.prisma.publicServiceVideoEligibility.findFirst.mockResolvedValue({ packageId: "package-1", packageHash: "package-hash", proposalId: "proposal-1" });
    h.tx.mediaLifecycleCase.create.mockResolvedValue({ id: "case-1", status: "RESTRICTED" });
    h.tx.publicServiceVideoEligibility.findMany.mockResolvedValue([{ mediaAssetId: "asset-1" }]);
    const response = await POST(request({}));
    expect(response.status).toBe(201);
    expect(h.tx.mediaLifecycleRestriction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ scope: "PUBLIC", active: true }) });
    expect(h.tx.publicServiceVideoEligibility.updateMany).toHaveBeenCalled();
    expect(h.tx.mediaAsset.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["asset-1"] }, visibilityStatus: "public" }, data: { visibilityStatus: "customer_only" } });
  });

  it("returns the original case for an identical idempotent retry", async () => {
    h.tx.contentReportRequest.findUnique.mockResolvedValue({ reportId: "report-1", payloadHash: expect.anything() });
    const { contentReportHash } = await import("@/lib/content-reporting");
    h.tx.contentReportRequest.findUnique.mockResolvedValue({ reportId: "report-1", payloadHash: contentReportHash({ targetType: "media_asset", targetId: "asset-1", reasonCategory: "private_sensitive_information", reasonDetail: null }) });
    h.tx.contentReport.findUnique.mockResolvedValue(reportRow());
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect((await response.json()).idempotent).toBe(true);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("deduplicates the same semantic submission from another browser tab", async () => {
    const { contentReportHash } = await import("@/lib/content-reporting");
    const payloadHash = contentReportHash({ targetType: "media_asset", targetId: "asset-1", reasonCategory: "private_sensitive_information", reasonDetail: null });
    h.tx.contentReportRequest.findUnique.mockImplementation(async ({ where }: any) =>
      where.idempotencyKey
        ? null
        : { reportId: "report-1", payloadHash },
    );
    h.tx.contentReport.findUnique.mockResolvedValue(reportRow());
    const response = await POST(request({ requestId: "request-from-another-tab" }));
    expect(response.status).toBe(200);
    expect((await response.json()).idempotent).toBe(true);
    expect(h.tx.contentReport.create).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("fails closed instead of dereferencing a stale grant with no matching package", async () => {
    h.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue(null);
    const response = await POST(request({ requestId: "request-stale-grant" }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("REPORT_PACKAGE_EVIDENCE_MISMATCH");
    expect(h.tx.contentReport.create).not.toHaveBeenCalled();
  });

  it("fails closed when an idempotency key is replayed with changed content", async () => {
    h.tx.contentReportRequest.findUnique.mockResolvedValue({ reportId: "report-1", payloadHash: "different-payload" });
    const response = await POST(request({}));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("REPORT_IDEMPOTENCY_CONFLICT");
    expect(h.tx.contentReport.create).not.toHaveBeenCalled();
  });

  it("keeps the report durable and leaves notificationSentAt empty when email delivery fails", async () => {
    h.notify.mockResolvedValue({ notification: { id: "notification-1" }, emailSent: false, emailError: "provider unavailable" });
    const response = await POST(request({}));
    expect(response.status).toBe(201);
    expect(h.tx.contentReport.update).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: expect.objectContaining({ notificationSentAt: null, notificationFailedAt: expect.any(Date) }),
    });
    expect(h.tx.contentReport.create).toHaveBeenCalledTimes(1);
  });

  it("still confirms the durable case when notification bookkeeping is unavailable", async () => {
    h.prisma.contentReport.update.mockRejectedValueOnce(new Error("notification tracking unavailable"));
    const response = await POST(request({ requestId: "request-notification-tracking" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, report: { caseReference: "RP-A1B2C3D4" } });
    expect(h.tx.contentReport.create).toHaveBeenCalledTimes(1);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("rate limits repeated reports without collapsing different reporters", async () => {
    h.tx.contentReport.count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    const response = await POST(request({ requestId: "request-rate-limited" }));
    expect(response.status).toBe(429);
    expect(h.tx.contentReport.create).not.toHaveBeenCalled();
  });

  it("shows only the signed-in reporter's safe case status", async () => {
    h.prisma.contentReport.findMany.mockResolvedValue([reportRow({ status: "under_review" })]);
    const response = await GET(new Request("http://localhost/api/reports/content?targetType=media_asset&targetId=asset-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reports: [{ caseReference: "RP-A1B2C3D4", status: "Under review" }] });
    expect(h.prisma.contentReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ reporterUserId: "customer-1" }) }));
  });
});
