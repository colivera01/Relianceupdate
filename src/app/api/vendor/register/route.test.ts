import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userCreate = vi.fn();
  const vendorFindUnique = vi.fn();
  const vendorMembershipFindFirst = vi.fn();
  const serviceFindMany = vi.fn();
  const serviceCreateMany = vi.fn();
  const vendorCreate = vi.fn();
  const vendorMembershipCreate = vi.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      create: userCreate,
    },
    vendor: {
      findUnique: vendorFindUnique,
    },
    vendorMembership: {
      findFirst: vendorMembershipFindFirst,
    },
    service: {
      findMany: serviceFindMany,
      createMany: serviceCreateMany,
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        vendor: { create: vendorCreate },
        vendorMembership: { create: vendorMembershipCreate },
      })
    ),
  };

  return {
    prisma,
    userFindUnique,
    userCreate,
    vendorFindUnique,
    vendorMembershipFindFirst,
    serviceFindMany,
    serviceCreateMany,
    vendorCreate,
    vendorMembershipCreate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/geocoding", () => ({
  addressChanged: vi.fn(() => true),
  geocodeAddress: vi.fn(async () => ({
    status: "success",
    latitude: 28.5383,
    longitude: -81.3792,
    geocodedAt: new Date("2026-06-05T12:00:00.000Z"),
  })),
}));

vi.mock("@/lib/vendor-status", () => ({
  trySetVendorApprovalStatus: vi.fn(async () => true),
}));

vi.mock("@/lib/email-verification-enforcement", () => ({
  requireVerifiedEmailForAction: vi.fn(async () => null),
}));

vi.mock("@/lib/dev-registered-users", () => ({
  addRegisteredUser: vi.fn(),
  findRegisteredUserByEmail: vi.fn(() => null),
}));

vi.mock("@/lib/auth-password", () => ({
  hashPassword: vi.fn(() => "hashed-password"),
}));

vi.mock("@/lib/auth-credentials", () => ({
  findDbCredentialByEmail: vi.fn(async () => null),
  upsertDbCredential: vi.fn(async () => ({ id: "cred-1" })),
}));

vi.mock("@/lib/auth-email-verification", () => ({
  sendOrPreviewEmailVerification: vi.fn(async () => ({
    sendResult: { ok: true },
    verificationLink: "http://localhost:3000/auth/verify-email?token=test-token",
    verificationTokenPreview: "test-token",
  })),
}));

vi.mock("@/lib/ai/feature-flags", () => ({
  isAiFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/ai/vendor-approval-review-store", () => ({
  VENDOR_APPROVAL_AI_SYSTEM_ACTOR: "system_ai",
  generateVendorApprovalAiStoredResult: vi.fn(async () => null),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

function createVendorRegisterRequest(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/vendor/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Request & { nextUrl?: URL };
  request.nextUrl = new URL("http://localhost/api/vendor/register");
  return request as any;
}

describe("POST /api/vendor/register", () => {
  beforeEach(async () => {
    const { getUserIdFromRequest } = await import("@/lib/auth");
    const { findDbCredentialByEmail, upsertDbCredential } = await import("@/lib/auth-credentials");
    const { findRegisteredUserByEmail, addRegisteredUser } = await import("@/lib/dev-registered-users");
    const { sendOrPreviewEmailVerification } = await import("@/lib/auth-email-verification");
    const { trySetVendorApprovalStatus } = await import("@/lib/vendor-status");
    const { isAiFeatureEnabled } = await import("@/lib/ai/feature-flags");
    const { generateVendorApprovalAiStoredResult } = await import("@/lib/ai/vendor-approval-review-store");

    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    vi.mocked(findDbCredentialByEmail).mockReset();
    vi.mocked(findDbCredentialByEmail).mockResolvedValue(null);
    vi.mocked(upsertDbCredential).mockReset();
    vi.mocked(upsertDbCredential).mockResolvedValue({ id: "cred-1" } as any);
    vi.mocked(findRegisteredUserByEmail).mockReset();
    vi.mocked(findRegisteredUserByEmail).mockReturnValue(undefined);
    vi.mocked(addRegisteredUser).mockReset();
    vi.mocked(sendOrPreviewEmailVerification).mockReset();
    vi.mocked(sendOrPreviewEmailVerification).mockResolvedValue({
      sendResult: { ok: true },
      verificationLink: "http://localhost:3000/auth/verify-email?token=test-token",
      verificationTokenPreview: "test-token",
    } as any);
    vi.mocked(trySetVendorApprovalStatus).mockReset();
    vi.mocked(trySetVendorApprovalStatus).mockResolvedValue(true as any);
    vi.mocked(isAiFeatureEnabled).mockReset();
    vi.mocked(isAiFeatureEnabled).mockReturnValue(true);
    vi.mocked(generateVendorApprovalAiStoredResult).mockReset();
    vi.mocked(generateVendorApprovalAiStoredResult).mockResolvedValue(null as any);

    hoisted.userFindUnique.mockReset();
    hoisted.userCreate.mockReset();
    hoisted.vendorMembershipFindFirst.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.serviceFindMany.mockReset();
    hoisted.serviceCreateMany.mockReset();
    hoisted.vendorCreate.mockReset();
    hoisted.vendorMembershipCreate.mockReset();

    hoisted.userFindUnique.mockImplementation(async ({ where }: any) => {
      if (where?.email) return null;
      if (where?.id === "user-1") {
        return {
          id: "user-1",
          name: "Rosa Vendor",
          email: "rosa.vendor@reliance.test",
          phone: "407-555-1212",
        };
      }
      return null;
    });
    hoisted.userCreate.mockResolvedValue({
      id: "user-1",
      name: "Rosa Vendor",
      email: "rosa.vendor@reliance.test",
      phone: "407-555-1212",
    });
    hoisted.vendorMembershipFindFirst.mockResolvedValue(null);
    hoisted.vendorCreate.mockResolvedValue({
      id: "vendor-1",
    });
    hoisted.vendorFindUnique.mockResolvedValue(null);
    hoisted.vendorMembershipCreate.mockResolvedValue({
      id: "membership-1",
    });
    hoisted.serviceFindMany.mockResolvedValue([]);
    hoisted.serviceCreateMany.mockResolvedValue({ count: 2 });
  });

  it("creates a brand-new vendor account and saves pending service drafts", async () => {
    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        category: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
        businessBio: "Family-owned plumbing team serving Orlando homeowners.",
        foundedYear: "2020",
        website: "https://rosaplumbing.test",
        licenseNumber: "LIC-12345",
        insuranceStatus: "true",
        bondingStatus: "false",
        emergencyContact: "Rosa Vendor - 407-555-9999",
        responseTime: "Within 2 hours",
        specializations: "Leak detection, Drain cleaning",
        serviceAreas: "Orlando, Winter Park",
        serviceTypes: "Drain Cleaning, Leak Repair",
        businessHoursJson: JSON.stringify({
          days: [
            { day: "mon", enabled: true, open: "08:30", close: "16:30" },
            { day: "sat", enabled: false, open: "09:00", close: "17:00" },
          ],
        }),
        selectedServices: [
          { name: "Leak Repair", price: 125, description: "Fix leaks", source: "template" },
          { name: "Drain Cleaning", price: 95, source: "vendor_custom" },
        ],
      })
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json).toMatchObject({
      success: true,
      vendorId: "vendor-1",
      membershipId: "membership-1",
      requiresApproval: true,
      emailVerificationRequired: true,
    });
    expect(hoisted.vendorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessName: "Rosa Plumbing Co",
          category: "Plumbing",
          bio: "Family-owned plumbing team serving Orlando homeowners.",
          foundedYear: 2020,
          website: "https://rosaplumbing.test",
          licenseNumber: "LIC-12345",
          insuranceStatus: true,
          bondingStatus: false,
          emergencyContact: "Rosa Vendor - 407-555-9999",
          responseTimeSettings: "Within 2 hours",
          specializations: "Leak detection, Drain cleaning",
          serviceAreas: "Orlando, Winter Park",
          serviceTypes: "Drain Cleaning, Leak Repair",
          businessHoursJson: expect.any(String),
        }),
      })
    );
    const savedHours = JSON.parse(hoisted.vendorCreate.mock.calls[0][0].data.businessHoursJson);
    expect(savedHours.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: "mon", enabled: true, open: "08:30", close: "16:30" }),
        expect.objectContaining({ day: "sat", enabled: false, open: "09:00", close: "17:00" }),
      ])
    );
    expect(hoisted.serviceCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ vendorId: "vendor-1", name: "Leak Repair", price: 125, isPublished: false }),
          expect.objectContaining({ vendorId: "vendor-1", name: "Drain Cleaning", price: 95, isPublished: false }),
        ]),
      })
    );
  });

  it("starts the AI vendor approval review after the application enters the pending queue", async () => {
    const { generateVendorApprovalAiStoredResult, VENDOR_APPROVAL_AI_SYSTEM_ACTOR } = await import(
      "@/lib/ai/vendor-approval-review-store"
    );

    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        category: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
      })
    );

    expect(response.status).toBe(200);
    expect(generateVendorApprovalAiStoredResult).toHaveBeenCalledWith("vendor-1", {
      actorUserId: VENDOR_APPROVAL_AI_SYSTEM_ACTOR,
      source: "vendor_registration_pending_autorun",
    });
  });

  it("skips the auto-run when the AI feature flag is disabled", async () => {
    const { isAiFeatureEnabled } = await import("@/lib/ai/feature-flags");
    const { generateVendorApprovalAiStoredResult } = await import("@/lib/ai/vendor-approval-review-store");
    vi.mocked(isAiFeatureEnabled).mockReturnValue(false);

    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        category: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
      })
    );

    expect(response.status).toBe(200);
    expect(generateVendorApprovalAiStoredResult).not.toHaveBeenCalled();
  });

  it("rejects duplicate vendor registration emails before creating records", async () => {
    const { findRegisteredUserByEmail } = await import("@/lib/dev-registered-users");
    vi.mocked(findRegisteredUserByEmail).mockReturnValue({
      id: "existing-user",
      email: "rosa.vendor@reliance.test",
    } as any);

    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
      })
    );

    expect(response.status).toBe(409);
    const json = await readJson(response);
    expect(json.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(hoisted.userCreate).not.toHaveBeenCalled();
    expect(hoisted.vendorCreate).not.toHaveBeenCalled();
  });

  it("rejects vendor registration when a vendor profile already uses the email", async () => {
    hoisted.vendorFindUnique.mockResolvedValueOnce({ id: "vendor-existing" });

    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
      })
    );

    expect(response.status).toBe(409);
    const json = await readJson(response);
    expect(json.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(hoisted.userCreate).not.toHaveBeenCalled();
    expect(hoisted.vendorCreate).not.toHaveBeenCalled();
  });

  it("returns a truthful temporary-service message when the database is unreachable", async () => {
    hoisted.vendorFindUnique.mockRejectedValueOnce(
      Object.assign(new Error("db down"), { code: "P1001" })
    );

    const response = await POST(
      createVendorRegisterRequest({
        firstName: "Rosa",
        lastName: "Vendor",
        email: "rosa.vendor@reliance.test",
        phone: "407-555-1212",
        password: "VendorTest1!",
        businessName: "Rosa Plumbing Co",
        businessType: "Plumbing",
        address: "123 Main St",
        city: "Orlando",
        state: "Florida",
        zipCode: "32801",
      })
    );

    expect(response.status).toBe(503);
    const json = await readJson(response);
    expect(json.code).toBe("REGISTRATION_SERVICE_UNAVAILABLE");
    expect(String(json.error)).toContain("could not reach");
  });
});
