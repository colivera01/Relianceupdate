import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import {
  getUserIdFromRequest,
  getVendorMembership,
  requireVendorMembership,
} from "@/lib/membership-auth";
import {
  getEmployeeRatingsForVendor,
  getVendorRatingStats,
} from "@/lib/review-attribution-aggregates";
import { calculateStorageUsage } from "@/lib/storage-helpers";

const hoisted = vi.hoisted(() => {
  const vendorFindUnique = vi.fn();
  const bookingGroupBy = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingCount = vi.fn();
  const bookingAggregate = vi.fn();
  const reviewFindMany = vi.fn();
  const reviewCount = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const consentRecordFindMany = vi.fn();
  const mediaAssetGroupBy = vi.fn();
  const mediaAssetCount = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const vendorMembershipFindMany = vi.fn();

  const prisma = {
    vendor: {
      findUnique: vendorFindUnique,
    },
    booking: {
      groupBy: bookingGroupBy,
      findMany: bookingFindMany,
      count: bookingCount,
      aggregate: bookingAggregate,
    },
    review: {
      findMany: reviewFindMany,
      count: reviewCount,
    },
    mediaSession: {
      findMany: mediaSessionFindMany,
    },
    consentRecord: {
      findMany: consentRecordFindMany,
    },
    mediaAsset: {
      groupBy: mediaAssetGroupBy,
      count: mediaAssetCount,
      findMany: mediaAssetFindMany,
    },
    vendorMembership: {
      findFirst: vendorMembershipFindFirst,
      findMany: vendorMembershipFindMany,
    },
  };

  return {
    prisma,
    vendorFindUnique,
    bookingGroupBy,
    bookingFindMany,
    bookingCount,
    bookingAggregate,
    reviewFindMany,
    reviewCount,
    mediaSessionFindMany,
    consentRecordFindMany,
    mediaAssetGroupBy,
    mediaAssetCount,
    mediaAssetFindMany,
    vendorMembershipFindFirst,
    vendorMembershipFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  getUserIdFromRequest: vi.fn(),
  getVendorMembership: vi.fn(),
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/review-attribution-aggregates", () => ({
  getEmployeeRatingsForVendor: vi.fn(),
  getVendorRatingStats: vi.fn(),
}));

vi.mock("@/lib/storage-helpers", () => ({
  calculateStorageUsage: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

function mockHappyPathData() {
  vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
  vi.mocked(getVendorMembership).mockResolvedValue({
    id: "membership-1",
    role: "MANAGER",
    status: "ACTIVE",
    badgeId: null,
  } as any);
  vi.mocked(requireVendorMembership).mockResolvedValue({
    userId: "user-1",
    membershipId: "membership-1",
    role: "MANAGER",
  } as any);

  hoisted.vendorFindUnique.mockResolvedValue({
    id: "v1",
    firstName: "Cesar",
    lastName: "Olivera",
    name: "Sparkle Clean Pro",
    businessName: "Sparkle Clean Pro",
    businessType: "Cleaning",
    category: "Cleaning",
    foundedYear: 2020,
    email: "sparkle@example.com",
    phone: "555-0000",
    city: "Orlando",
    state: "FL",
    serviceTypes: null,
    specializations: null,
    serviceAreas: null,
  });
  hoisted.bookingGroupBy.mockResolvedValue([{ _count: { _all: 1 }, _sum: { amount: 10 } }]);
  hoisted.bookingFindMany
    .mockResolvedValueOnce([
      {
        id: "job-1",
        vendorId: "v1",
        serviceId: "service-1",
        title: "Kitchen deep clean",
        clientName: "Pat",
        amount: 120,
        status: "PENDING",
        date: new Date("2026-04-15T12:00:00.000Z"),
        scheduledFor: new Date("2026-04-15T12:00:00.000Z"),
        createdAt: new Date("2026-04-15T10:00:00.000Z"),
        updatedAt: new Date("2026-04-15T11:00:00.000Z"),
        customerMetadata: JSON.stringify({
          client_email: "pat.client@example.com",
          client_phone: "555-0101",
        }),
        user: { id: "user-customer", name: "Pat", email: "unclaimed@example.test", phone: "555-9999" },
        service: { id: "service-1", name: "Deep Cleaning", isPublished: true },
      },
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ userId: "user-customer" }])
    .mockResolvedValueOnce([{ amount: 120 }]);
  hoisted.reviewFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  vi.mocked(getVendorRatingStats).mockResolvedValue({
    averageRating: 0,
    reviewCount: 0,
    ratingSum: 0,
  });
  vi.mocked(getEmployeeRatingsForVendor).mockResolvedValue([]);
  hoisted.mediaSessionFindMany.mockResolvedValue([]);
  hoisted.consentRecordFindMany.mockResolvedValue([]);
  hoisted.mediaAssetGroupBy.mockResolvedValue([]);
  hoisted.mediaAssetCount.mockResolvedValue(0);
  hoisted.vendorMembershipFindMany.mockResolvedValue([]);
  vi.mocked(calculateStorageUsage).mockResolvedValue({
    usedBytes: BigInt(0),
    limitBytes: BigInt(0),
    percentUsed: 0,
    isOverLimit: false,
  });
}

describe("GET /api/vendors/[vendorId]/dashboard integration", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.bookingGroupBy.mockReset();
    hoisted.bookingFindMany.mockReset();
    hoisted.bookingCount.mockReset();
    hoisted.bookingAggregate.mockReset();
    hoisted.reviewFindMany.mockReset();
    hoisted.reviewCount.mockReset();
    hoisted.mediaSessionFindMany.mockReset();
    hoisted.consentRecordFindMany.mockReset();
    hoisted.mediaAssetGroupBy.mockReset();
    hoisted.mediaAssetCount.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.vendorMembershipFindMany.mockReset();
    vi.mocked(getVendorRatingStats).mockReset();
    vi.mocked(getEmployeeRatingsForVendor).mockReset();
    vi.mocked(calculateStorageUsage).mockReset();
  });

  it("returns structured forbidden response with suggestedVendorId when active membership exists on different vendor", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getVendorMembership).mockResolvedValue(null);
    hoisted.vendorMembershipFindFirst.mockResolvedValue({
      vendorId: "vendor-active-2",
      role: "MANAGER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/vendors/vendor-requested-1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "vendor-requested-1" }) });
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body).toMatchObject({
      success: false,
      code: "FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED",
      error: "Forbidden: Active membership required",
      vendorId: "vendor-requested-1",
      userId: "user-1",
      suggestedVendorId: "vendor-active-2",
    });
    expect(vi.mocked(requireVendorMembership)).not.toHaveBeenCalled();
    expect(hoisted.vendorFindUnique).not.toHaveBeenCalled();
  });

  it("returns structured forbidden response without suggestedVendorId when no active membership exists", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getVendorMembership).mockResolvedValue(null);
    hoisted.vendorMembershipFindFirst.mockResolvedValue(null);

    const req = new Request("http://localhost/api/vendors/vendor-requested-1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "vendor-requested-1" }) });
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body).toMatchObject({
      success: false,
      code: "FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED",
      error: "Forbidden: Active membership required",
      vendorId: "vendor-requested-1",
      userId: "user-1",
    });
    expect(body).not.toHaveProperty("suggestedVendorId");
    expect(vi.mocked(requireVendorMembership)).not.toHaveBeenCalled();
    expect(hoisted.vendorFindUnique).not.toHaveBeenCalled();
  });

  it("returns success payload for valid active membership", async () => {
    mockHappyPathData();

    const req = new Request("http://localhost/api/vendors/v1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body).toMatchObject({
      recentJobs: expect.any(Array),
      archivedJobs: expect.any(Array),
      lifecycleCounts: expect.any(Object),
      recentReviews: expect.any(Array),
      notifications: expect.any(Array),
    });
    const recentJobs = body.recentJobs as Array<Record<string, unknown>>;
    expect(recentJobs[0]).toMatchObject({
      customerEmail: "pat.client@example.com",
      customerPhone: "555-0101",
    });
    expect(body.lifecycleCounts).toMatchObject({
      scheduled: 1,
      inProgress: 0,
      awaitingReview: 0,
      completed: 0,
      canceled: 0,
      rejected: 0,
      archived: 0,
    });
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("suggestedVendorId");
    expect(vi.mocked(requireVendorMembership)).toHaveBeenCalledWith(req, "v1");
  });

  it("counts an approved package as an approved service order while keeping private proof out of public counts", async () => {
    mockHappyPathData();
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "asset-intro",
        vendorId: "v1",
        moderationStatus: "approved",
        visibilityStatus: "private",
        uploadedByMembershipId: "membership-1",
        createdAt: new Date("2026-04-15T12:10:00.000Z"),
        mediaSession: {
          bookingId: "job-private-approved",
          vendorJobVideoStage: "INTRO",
          booking: {
            id: "job-private-approved",
            title: "Private proof package",
            status: "COMPLETED",
            clientName: "Pat",
            vendor: { businessName: "Sparkle Services", name: "Sparkle Services" },
            service: { name: "Deep Cleaning" },
          },
        },
      },
      {
        id: "asset-progress",
        vendorId: "v1",
        moderationStatus: "approved",
        visibilityStatus: "private",
        uploadedByMembershipId: "membership-1",
        createdAt: new Date("2026-04-15T12:15:00.000Z"),
        mediaSession: {
          bookingId: "job-private-approved",
          vendorJobVideoStage: "IN_PROGRESS",
          booking: {
            id: "job-private-approved",
            title: "Private proof package",
            status: "COMPLETED",
            clientName: "Pat",
            vendor: { businessName: "Sparkle Services", name: "Sparkle Services" },
            service: { name: "Deep Cleaning" },
          },
        },
      },
      {
        id: "asset-completed",
        vendorId: "v1",
        moderationStatus: "approved",
        visibilityStatus: "private",
        uploadedByMembershipId: "membership-1",
        createdAt: new Date("2026-04-15T12:20:00.000Z"),
        mediaSession: {
          bookingId: "job-private-approved",
          vendorJobVideoStage: "COMPLETED",
          booking: {
            id: "job-private-approved",
            title: "Private proof package",
            status: "COMPLETED",
            clientName: "Pat",
            vendor: { businessName: "Sparkle Services", name: "Sparkle Services" },
            service: { name: "Deep Cleaning" },
          },
        },
      },
    ]);

    const req = new Request("http://localhost/api/vendors/v1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.approvedProofs).toBe(1);
    expect(body.approvedServiceOrderCount).toBe(1);
    expect(body.publicServiceOrderCount).toBe(0);
  });

  it("reports awaiting-review lifecycle counts from actual booking status instead of inferring from reviews", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getVendorMembership).mockResolvedValue({
      id: "membership-1",
      role: "MANAGER",
      status: "ACTIVE",
      badgeId: null,
    } as any);
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "user-1",
      membershipId: "membership-1",
      role: "MANAGER",
    } as any);

    hoisted.vendorFindUnique.mockResolvedValue({
      id: "v1",
      name: "Metro Home Care Pros",
      businessName: "Metro Home Care Pros",
      email: "metro@example.com",
      phone: "555-0000",
      city: "Orlando",
      state: "FL",
    });
    hoisted.bookingGroupBy.mockResolvedValue([{ _count: { _all: 2 }, _sum: { amount: 20 } }]);
    hoisted.bookingFindMany
      .mockResolvedValueOnce([
        {
          id: "job-awaiting",
          vendorId: "v1",
          serviceId: "service-1",
          title: "Staged video package",
          clientName: "Jordan",
          amount: 120,
          status: "AWAITING_REVIEW",
          date: new Date("2026-04-15T12:00:00.000Z"),
          scheduledFor: new Date("2026-04-15T12:00:00.000Z"),
          createdAt: new Date("2026-04-15T10:00:00.000Z"),
          updatedAt: new Date("2026-04-15T11:00:00.000Z"),
          customerMetadata: "{}",
          user: { id: "user-customer", name: "Jordan", email: "jordan@example.com", phone: "555-0101" },
          service: { id: "service-1", name: "Deep Cleaning", isPublished: true },
        },
        {
          id: "job-complete",
          vendorId: "v1",
          serviceId: "service-2",
          title: "Completed service",
          clientName: "Pat",
          amount: 120,
          status: "COMPLETED",
          date: new Date("2026-04-16T12:00:00.000Z"),
          scheduledFor: new Date("2026-04-16T12:00:00.000Z"),
          createdAt: new Date("2026-04-16T10:00:00.000Z"),
          updatedAt: new Date("2026-04-16T11:00:00.000Z"),
          customerMetadata: "{}",
          user: { id: "user-customer-2", name: "Pat", email: "pat@example.com", phone: "555-0102" },
          service: { id: "service-2", name: "Move-out Cleaning", isPublished: true },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: "user-customer" }, { userId: "user-customer-2" }])
      .mockResolvedValueOnce([{ amount: 120 }]);
    hoisted.reviewFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.mocked(getVendorRatingStats).mockResolvedValue({
      averageRating: 0,
      reviewCount: 0,
      ratingSum: 0,
    });
    vi.mocked(getEmployeeRatingsForVendor).mockResolvedValue([]);
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.consentRecordFindMany.mockResolvedValue([]);
    hoisted.mediaAssetGroupBy.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    hoisted.vendorMembershipFindMany.mockResolvedValue([]);
    vi.mocked(calculateStorageUsage).mockResolvedValue({
      usedBytes: BigInt(0),
      limitBytes: BigInt(0),
      percentUsed: 0,
      isOverLimit: false,
    });

    const req = new Request("http://localhost/api/vendors/v1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.lifecycleCounts).toMatchObject({
      scheduled: 0,
      inProgress: 0,
      awaitingReview: 1,
      completed: 1,
      canceled: 0,
      rejected: 0,
      archived: 0,
    });
    expect((body.stats as Record<string, unknown>).completionEligibleBookingCount).toBe(2);
  });

  it("keeps rejected staged media out of awaiting-review dashboard counts", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(getVendorMembership).mockResolvedValue({
      id: "membership-1",
      role: "MANAGER",
      status: "ACTIVE",
      badgeId: null,
    } as any);
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "user-1",
      membershipId: "membership-1",
      role: "MANAGER",
    } as any);

    hoisted.vendorFindUnique.mockResolvedValue({
      id: "v1",
      name: "Metro Home Care Pros",
      businessName: "Metro Home Care Pros",
      email: "metro@example.com",
      phone: "555-0000",
      city: "Orlando",
      state: "FL",
    });
    hoisted.bookingGroupBy.mockResolvedValue([{ _count: { _all: 1 }, _sum: { amount: 120 } }]);
    hoisted.bookingFindMany
      .mockResolvedValueOnce([
        {
          id: "job-rejected-stage",
          vendorId: "v1",
          serviceId: "service-1",
          title: "Rejected staged package",
          clientName: "Jordan",
          amount: 120,
          status: "AWAITING_REVIEW",
          date: new Date("2026-04-15T12:00:00.000Z"),
          scheduledFor: new Date("2026-04-15T12:00:00.000Z"),
          createdAt: new Date("2026-04-15T10:00:00.000Z"),
          updatedAt: new Date("2026-04-15T11:00:00.000Z"),
          customerMetadata: "{}",
          user: { id: "user-customer", name: "Jordan", email: "jordan@example.com", phone: "555-0101" },
          service: { id: "service-1", name: "Deep Cleaning", isPublished: true },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: "user-customer" }])
      .mockResolvedValueOnce([]);
    hoisted.reviewFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.mocked(getVendorRatingStats).mockResolvedValue({
      averageRating: 0,
      reviewCount: 0,
      ratingSum: 0,
    });
    vi.mocked(getEmployeeRatingsForVendor).mockResolvedValue([]);
    hoisted.mediaSessionFindMany.mockResolvedValue([
      {
        id: "session-rejected-intro",
        bookingId: "job-rejected-stage",
        vendorJobVideoStage: "INTRO",
        sessionType: "JOB_SERVICE_VIDEO",
        _count: { mediaAssets: 1 },
        mediaAssets: [
          {
            id: "asset-rejected-intro",
            moderationStatus: "rejected",
            createdAt: new Date("2026-04-15T12:10:00.000Z"),
          },
        ],
      },
    ]);
    hoisted.consentRecordFindMany.mockResolvedValue([]);
    hoisted.mediaAssetGroupBy.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    hoisted.vendorMembershipFindMany.mockResolvedValue([]);
    vi.mocked(calculateStorageUsage).mockResolvedValue({
      usedBytes: BigInt(0),
      limitBytes: BigInt(0),
      percentUsed: 0,
      isOverLimit: false,
    });

    const req = new Request("http://localhost/api/vendors/v1/dashboard", {
      method: "GET",
      headers: { "x-user-id": "user-1" },
    });
    const res = await GET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.lifecycleCounts).toMatchObject({
      scheduled: 0,
      inProgress: 0,
      awaitingReview: 0,
      completed: 0,
      canceled: 0,
      rejected: 1,
      archived: 0,
    });
    expect(body.recentJobs).toEqual([
      expect.objectContaining({
        id: "job-rejected-stage",
        status: "rejected",
        operationalPhase: "REJECTED",
      }),
    ]);
  });
});

