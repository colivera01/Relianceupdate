import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  ensureUserAccountCanAct: vi.fn(),
  loadEmployeePublicMediaConsentView: vi.fn(),
  decideEmployeePublicMediaConsent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: mocks.getUserIdFromRequest }));
vi.mock("@/lib/account-status", () => ({ ensureUserAccountCanAct: mocks.ensureUserAccountCanAct }));
vi.mock("@/lib/service-video-publication", () => ({
  loadEmployeePublicMediaConsentView: mocks.loadEmployeePublicMediaConsentView,
  decideEmployeePublicMediaConsent: mocks.decideEmployeePublicMediaConsent,
}));

import { GET, POST } from "./route";

describe("Employee standing Public Media Consent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserIdFromRequest.mockResolvedValue("employee-1");
    mocks.ensureUserAccountCanAct.mockResolvedValue(undefined);
    mocks.loadEmployeePublicMediaConsentView.mockResolvedValue({ memberships: [] });
    mocks.decideEmployeePublicMediaConsent.mockResolvedValue({
      decision: { id: "consent-1", decision: "ALLOW" },
      idempotent: false,
      publishedProposalIds: [],
    });
  });

  it("loads only the signed-in Employee's standing-consent view", async () => {
    const response = await GET(new Request("http://localhost/api/employee/public-media-consent"));
    expect(response.status).toBe(200);
    expect(mocks.loadEmployeePublicMediaConsentView).toHaveBeenCalledWith({ userId: "employee-1" });
  });

  it("records an explicit choice without accepting a default", async () => {
    const response = await POST(new Request("http://localhost/api/employee/public-media-consent", {
      method: "POST",
      body: JSON.stringify({ membershipId: "membership-1", decision: "ALLOW" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.decideEmployeePublicMediaConsent).toHaveBeenCalledWith({
      userId: "employee-1",
      membershipId: "membership-1",
      decision: "ALLOW",
      verificationMethod: "SIGNED_IN_EMPLOYEE_SESSION",
    });
  });

  it("rejects unauthenticated access", async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/employee/public-media-consent"));
    expect(response.status).toBe(401);
    expect(mocks.loadEmployeePublicMediaConsentView).not.toHaveBeenCalled();
  });

  it("returns the server's already-Public policy flag without inventing a media transition", async () => {
    mocks.decideEmployeePublicMediaConsent.mockResolvedValue({
      decision: { id: "consent-2", decision: "DENY" },
      idempotent: false,
      publishedProposalIds: [],
      alreadyPublicAffected: true,
    });
    const response = await POST(new Request("http://localhost/api/employee/public-media-consent", {
      method: "POST",
      body: JSON.stringify({ membershipId: "membership-1", decision: "DENY" }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyPublicAffected: true });
  });
});
