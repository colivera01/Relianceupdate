import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";
import { requireRequestActor } from "@/lib/request-actor";
import { decidePackageVisibility, loadPackageVisibilityView } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => ({ bookingFindUnique: vi.fn() }));

vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: hoisted.bookingFindUnique } },
}));
vi.mock("@/lib/account-status", () => ({ ensureUserAccountCanAct: vi.fn() }));
vi.mock("@/lib/request-actor", async () => {
  const actual = await vi.importActual<any>("@/lib/request-actor");
  return { ...actual, requireRequestActor: vi.fn() };
});
vi.mock("@/lib/service-video-publication", () => ({
  decidePackageVisibility: vi.fn(),
  loadPackageVisibilityView: vi.fn(),
}));

const context = { params: Promise.resolve({ id: "booking-1" }) };

describe("package visibility route authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.bookingFindUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1", vendorId: "vendor-1" });
    vi.mocked(loadPackageVisibilityView).mockResolvedValue({ auditPassed: true, state: "PRIVATE_DEFAULT" } as any);
  });

  it("allows the owning customer to decide for the complete package", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "customer-1",
      vendorMemberships: [],
      platformRoles: [],
    } as any);
    vi.mocked(decidePackageVisibility).mockResolvedValue({ decision: { id: "visibility-1" } } as any);

    const response = await POST(new Request("http://localhost/api/bookings/booking-1/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "SHARE_PUBLICLY" }),
    }), context);

    expect(response.status).toBe(200);
    expect(decidePackageVisibility).toHaveBeenCalledWith({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
      audioConfirmation: false,
    });
  });

  it("gives a manager read-only visibility but rejects a manager decision", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "manager-1",
      vendorMemberships: [{ id: "membership-1", vendorId: "vendor-1", role: "MANAGER" }],
      platformRoles: [],
    } as any);

    const read = await GET(new Request("http://localhost/api/bookings/booking-1/visibility"), context);
    const write = await POST(new Request("http://localhost/api/bookings/booking-1/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "KEEP_PRIVATE" }),
    }), context);

    expect(read.status).toBe(200);
    expect((await read.json()).canDecide).toBe(false);
    expect(write.status).toBe(403);
    expect(decidePackageVisibility).not.toHaveBeenCalled();
  });

  it("fails closed for an employee with only active vendor membership", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "employee-1",
      vendorMemberships: [{ id: "membership-2", vendorId: "vendor-1", role: "EMPLOYEE" }],
      platformRoles: [],
    } as any);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/visibility"), context);

    expect(response.status).toBe(403);
    expect(loadPackageVisibilityView).not.toHaveBeenCalled();
  });

  it("does not inherit Admin visibility through a general Employee session", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "shared-admin-employee",
      vendorMemberships: [{ id: "membership-3", vendorId: "vendor-1", role: "EMPLOYEE" }],
      platformRoles: ["ADMIN"],
    } as any);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/visibility"), context);

    expect(response.status).toBe(403);
    expect(loadPackageVisibilityView).not.toHaveBeenCalled();
  });

  it("keeps the internal Audit eligibility reason out of the manager response", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "manager-1",
      vendorMemberships: [{ id: "membership-1", vendorId: "vendor-1", role: "MANAGER" }],
      platformRoles: [],
    } as any);
    vi.mocked(loadPackageVisibilityView).mockResolvedValue({
      auditPassed: true,
      state: "PRIVATE_ONLY",
      publicDisplayReason: "Internal Audit evidence",
    } as any);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/visibility"), context);

    expect(response.status).toBe(200);
    expect((await response.json()).visibility.publicDisplayReason).toBeNull();
  });

  it("keeps customer visibility control available during a Public hold so the customer can make it Private", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "customer-1",
      vendorMemberships: [],
      platformRoles: [],
    } as any);
    vi.mocked(loadPackageVisibilityView).mockResolvedValue({
      auditPassed: true,
      state: "PUBLIC_VISIBILITY_HOLD",
      publicRestrictionActive: true,
      publicDisplayEligibility: "PUBLIC_DISPLAY_ELIGIBLE",
    } as any);

    const response = await GET(new Request("http://localhost/api/bookings/booking-1/visibility"), context);

    expect(response.status).toBe(200);
    expect((await response.json()).canDecide).toBe(true);
  });
});
