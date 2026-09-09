import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  getAuthSessionClaimsFromRequest: vi.fn(),
  getAdminAuthSessionClaimsFromRequest: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: hoisted.headers }));
vi.mock("next/navigation", () => ({ redirect: hoisted.redirect }));
vi.mock("@/lib/auth-session", () => ({
  getAuthSessionClaimsFromRequest: hoisted.getAuthSessionClaimsFromRequest,
  getAdminAuthSessionClaimsFromRequest: hoisted.getAdminAuthSessionClaimsFromRequest,
}));

import LegacyDashboardRedirectPage from "./page";

const claims = (userType: "customer" | "vendor" | "admin" | "both") => ({
  userId: `${userType}-1`,
  userType,
  availableProfiles: [userType],
  issuedAt: 1,
  expiresAt: Number.MAX_SAFE_INTEGER,
  version: 2 as const,
});

describe("legacy /dashboard redirect", () => {
  beforeEach(() => {
    hoisted.headers.mockReset();
    hoisted.redirect.mockReset();
    hoisted.getAuthSessionClaimsFromRequest.mockReset();
    hoisted.getAdminAuthSessionClaimsFromRequest.mockReset();
    hoisted.headers.mockResolvedValue(new Headers());
    hoisted.redirect.mockImplementation((target: string) => {
      throw new Error(`REDIRECT:${target}`);
    });
  });

  it("sends an anonymous request to normal sign-in", async () => {
    hoisted.getAuthSessionClaimsFromRequest.mockReturnValue(null);
    hoisted.getAdminAuthSessionClaimsFromRequest.mockReturnValue(null);

    await expect(LegacyDashboardRedirectPage()).rejects.toThrow("REDIRECT:/auth/login");
  });

  it.each([
    ["customer", "/user-dashboard"],
    ["both", "/user-dashboard"],
    ["vendor", "/vendor/dashboard"],
  ] as const)("sends a %s session to its canonical home", async (userType, target) => {
    hoisted.getAuthSessionClaimsFromRequest.mockReturnValue(claims(userType));

    await expect(LegacyDashboardRedirectPage()).rejects.toThrow(`REDIRECT:${target}`);
  });

  it("recognizes the existing Admin session contract before resolving its home", async () => {
    hoisted.getAuthSessionClaimsFromRequest.mockReturnValue(null);
    hoisted.getAdminAuthSessionClaimsFromRequest.mockReturnValue(claims("admin"));

    await expect(LegacyDashboardRedirectPage()).rejects.toThrow("REDIRECT:/admin/dashboard");
    expect(hoisted.getAdminAuthSessionClaimsFromRequest).toHaveBeenCalledOnce();
  });
});
