import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const hoisted = vi.hoisted(() => {
  const vendorFindUnique = vi.fn();
  const vendorUpdate = vi.fn();
  const serviceCount = vi.fn();
  return {
    prisma: {
      vendor: {
        findUnique: vendorFindUnique,
        update: vendorUpdate,
      },
      service: {
        count: serviceCount,
      },
    },
    vendorFindUnique,
    vendorUpdate,
    serviceCount,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
  isVendorContextDbTimeoutError: vi.fn(() => false),
}));

vi.mock("@/lib/review-attribution-aggregates", () => ({
  getVendorRatingStats: vi.fn(async () => ({
    averageRating: 4.9,
    reviewCount: 7,
  })),
}));

vi.mock("@/lib/geocoding", () => ({
  addressChanged: vi.fn(() => false),
  geocodeAddress: vi.fn(),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

function vendorRow() {
  return {
    id: "vendor-1",
    firstName: "Rosa",
    lastName: "Vendor",
    name: "Rosa Plumbing Co",
    businessName: "Rosa Plumbing Co",
    businessType: "Plumbing",
    category: "Plumbing",
    foundedYear: 2020,
    email: "rosa.vendor@reliance.test",
    phone: "407-555-1212",
    city: "Orlando",
    state: "Florida",
    address: "123 Main St",
    zipCode: "32801",
    latitude: null,
    longitude: null,
    geocodedAt: null,
    bio: "Trusted local plumbing vendor.",
    website: null,
    licenseNumber: null,
    insuranceStatus: true,
    insuranceProvider: null,
    insuranceExpiry: null,
    bondingStatus: false,
    emergencyContact: null,
    responseTimeSettings: null,
    profilePhoto: null,
    isPubliclyListed: false,
    publiclyListedAt: null,
    serviceTypes: "Leak Repair, Drain Cleaning",
    specializations: null,
    serviceAreas: "Orlando",
    paymentsEnabled: false,
    reminders_review: true,
    reminders_invoice: false,
    reminders_maintenance: true,
    reminders_followUp: true,
    notifications_job: true,
    notifications_review: true,
    notifications_payout: false,
    notifications_support: true,
    notifications_marketing: false,
    notifications_updates: true,
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: 30,
    passwordExpiry: null,
    failedLoginLockout: null,
    _count: {
      employees: 0,
    },
  };
}

describe("vendor profile onboarding access", () => {
  beforeEach(async () => {
    const { getUserIdFromRequest } = await import("@/lib/auth");
    const { resolveVendorAccessForUser } = await import("@/lib/vendor-context");

    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "PENDING",
      userId: "user-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipStatus: "PENDING",
      accountStatus: "active",
      restrictedAccountType: null,
      role: "MANAGER",
      businessName: "Rosa Plumbing Co",
    } as any);

    hoisted.vendorFindUnique.mockReset();
    hoisted.vendorUpdate.mockReset();
    hoisted.serviceCount.mockReset();

    hoisted.vendorFindUnique.mockResolvedValue(vendorRow());
    hoisted.vendorUpdate.mockResolvedValue(vendorRow());
    hoisted.serviceCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
  });

  it("lets pending vendors load onboarding profile truth", async () => {
    const response = await GET(
      new Request("http://localhost/api/vendor/profile", {
        headers: { "x-user-id": "user-1" },
      })
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.approvalPending).toBe(true);
    expect(json.profile.membershipStatus).toBe("PENDING");
    expect(json.profile.onboarding.readyForAdminReview).toBe(true);
    expect(json.profile.onboarding.nextStep).toContain("Wait for admin approval");
  });

  it("lets pending vendors continue updating profile details", async () => {
    const response = await PUT(
      new Request("http://localhost/api/vendor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
        body: JSON.stringify({
          bio: "Updated vendor bio",
        }),
      })
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.approvalPending).toBe(true);
    expect(hoisted.vendorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vendor-1" },
        data: expect.objectContaining({
          bio: "Updated vendor bio",
        }),
      })
    );
  });
});
