import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { OWNER_ADMIN_EMAIL, OWNER_ADMIN_USER_ID } from "@/lib/internal-identities";
import { requireRequestActor } from "@/lib/request-actor";

vi.mock("@/lib/request-actor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/request-actor")>();
  return { ...actual, requireRequestActor: vi.fn() };
});

describe("/api/profile/toggle Admin isolation", () => {
  beforeEach(() => {
    vi.mocked(requireRequestActor).mockReset();
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: OWNER_ADMIN_USER_ID,
      email: OWNER_ADMIN_EMAIL,
      accountStatus: "active",
      platformRoles: ["ADMIN"],
      vendorMemberships: [],
    });
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

  it("uses the database-backed admin capability instead of stale profile claims", async () => {
    vi.mocked(requireRequestActor).mockResolvedValue({
      userId: "replacement-admin-id",
      email: OWNER_ADMIN_EMAIL,
      accountStatus: "active",
      platformRoles: ["ADMIN"],
      vendorMemberships: [],
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
  });
});
