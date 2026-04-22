import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import {
  getUserIdFromRequest,
  getVendorMembership,
  requireVendorMembership,
} from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => {
  const vendorFindUnique = vi.fn();
  const bookingGroupBy = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingCount = vi.fn();
  const bookingAggregate = vi.fn();
  const reviewFindMany = vi.fn();
  const reviewCount = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const adminNotificationFindMany = vi.fn();
  const vendorMembershipFindFirst = vi.fn();

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
    adminNotification: {
      findMany: adminNotificationFindMany,
    },
    vendorMembership: {
      findFirst: vendorMembershipFindFirst,
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
    adminNotificationFindMany,
    vendorMembershipFindFirst,
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
        customerMetadata: null,
        user: { id: "user-customer", name: "Pat", email: "pat@example.com" },
        service: { id: "service-1", name: "Deep Cleaning" },
      },
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ userId: "user-customer" }])
    .mockResolvedValueOnce([{ amount: 120 }]);
  hoisted.reviewFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  hoisted.bookingCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
  hoisted.reviewCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
  hoisted.bookingAggregate
    .mockResolvedValueOnce({ _sum: { amount: 0 } })
    .mockResolvedValueOnce({ _sum: { amount: 0 } });
  hoisted.mediaSessionFindMany.mockResolvedValue([]);
  hoisted.adminNotificationFindMany.mockResolvedValue([]);
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
    hoisted.adminNotificationFindMany.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
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
      recentReviews: expect.any(Array),
      notifications: expect.any(Array),
    });
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("suggestedVendorId");
    expect(vi.mocked(requireVendorMembership)).toHaveBeenCalledWith(req, "v1");
  });
});

