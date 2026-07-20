import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import { getAuthSessionClaimsFromRequest } from "@/lib/auth-session";
import { OWNER_ADMIN_EMAIL, OWNER_ADMIN_USER_ID } from "@/lib/internal-identities";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";
import { prisma } from "@/server/db";

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({
  getAuthSessionClaimsFromRequest: vi.fn(),
  verifyAuthBearerToken: vi.fn(),
}));

vi.mock("@/lib/dev-registered-users", () => ({
  registeredUsers: [],
  syncRegisteredUsersFromDisk: vi.fn(),
}));

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("/api/profile/toggle Admin isolation", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue(OWNER_ADMIN_USER_ID);
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked(getAuthSessionClaimsFromRequest).mockReset();
    vi.mocked(getAuthSessionClaimsFromRequest).mockReturnValue(null);
    vi.mocked((prisma as any).user.findUnique).mockReset();
  });

  it("reports no Customer or Vendor profiles for the Admin identity", async () => {
    const response = await GET(
      new Request("http://localhost/api/profile/toggle") as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      availableProfiles: [],
      currentProfile: null,
      canSwitch: false,
    });
    expect((prisma as any).user.findUnique).not.toHaveBeenCalled();
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });

  it("rejects attempts to switch the Admin identity to Customer", async () => {
    const response = await POST(
      new Request("http://localhost/api/profile/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: OWNER_ADMIN_USER_ID,
          targetProfileType: "customer",
        }),
      }) as any
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "This account cannot switch to the customer profile.",
    });
  });

  it("reports no switchable profiles for a stale session identified by Admin email", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("replacement-admin-id");
    vi.mocked(getAuthSessionClaimsFromRequest).mockReturnValue({
      userId: "replacement-admin-id",
      email: OWNER_ADMIN_EMAIL,
      userType: "both",
      availableProfiles: ["customer", "vendor"],
      issuedAt: 1,
      expiresAt: 9999999999,
      version: 1,
    });

    const response = await GET(
      new Request("http://localhost/api/profile/toggle") as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      availableProfiles: [],
      currentProfile: null,
      canSwitch: false,
    });
    expect((prisma as any).user.findUnique).not.toHaveBeenCalled();
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });
});
