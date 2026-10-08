import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireVendorManager: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: hoisted.requireVendorManager,
}));

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: { findUnique: hoisted.findUnique },
    $transaction: hoisted.transaction,
  },
}));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/vendors/vendor-1/memberships/membership-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("team member contact editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.requireVendorManager.mockResolvedValue({ userId: "manager-1" });
    hoisted.findUnique.mockResolvedValue({
      id: "membership-1",
      userId: "employee-1",
      vendorId: "vendor-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: {
        id: "employee-1",
        name: "Employee",
        email: "employee@example.com",
        phone: "5550101",
        authCredential: { id: "cred-1", email: "employee@example.com" },
      },
    });
  });

  it("does not let a manager replace a credential email without verification", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      request({ name: "Employee", email: "replacement@example.com", phone: "5550101" }),
      { params: Promise.resolve({ vendorId: "vendor-1", membershipId: "membership-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CREDENTIAL_EMAIL_CHANGE_REQUIRES_VERIFICATION",
    });
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });
});
