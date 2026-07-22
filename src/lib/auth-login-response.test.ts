import { describe, expect, it } from "vitest";
import { buildSuccessfulLoginResponse } from "./auth-login-response";

describe("buildSuccessfulLoginResponse", () => {
  it("issues only path-scoped admin cookies for an admin login", async () => {
    const response = await buildSuccessfulLoginResponse({
      user: {
        id: "admin-user",
        name: "Admin User",
        email: "admin@example.com",
        userType: "admin",
        availableProfiles: ["admin"],
        emailVerified: true,
        emailVerifiedAt: "2026-07-22T00:00:00.000Z",
      },
    });
    const cookies = response.headers.get("set-cookie") || "";

    expect(cookies).toContain("reliance_admin_session=");
    expect(cookies).toContain("Path=/admin");
    expect(cookies).toContain("reliance_admin_api_session=");
    expect(cookies).toContain("Path=/api/admin");
    expect(cookies).not.toMatch(/(?:^|, )reliance_session=/);
  });

  it("keeps vendor login on the general session cookie", async () => {
    const response = await buildSuccessfulLoginResponse({
      user: {
        id: "vendor-user",
        name: "Vendor User",
        email: "vendor@example.com",
        userType: "vendor",
        availableProfiles: ["customer", "vendor"],
        emailVerified: true,
        emailVerifiedAt: "2026-07-22T00:00:00.000Z",
      },
    });
    const cookies = response.headers.get("set-cookie") || "";

    expect(cookies).toContain("reliance_session=");
    expect(cookies).toContain("Path=/");
    expect(cookies).not.toContain("reliance_admin_session=");
    expect(cookies).not.toContain("reliance_admin_api_session=");
  });
});
