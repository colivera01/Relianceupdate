import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  ensureUserAccountCanAct: vi.fn(),
  loadEmployeePublicMediaConsentView: vi.fn(),
  decideEmployeePublicMediaConsent: vi.fn(),
  readEmployeeCaptureToken: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  readEmployeePublicMediaConsentToken: vi.fn(),
  resolveEmployeePublicMediaConsentAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: mocks.getUserIdFromRequest }));
vi.mock("@/lib/account-status", () => ({ ensureUserAccountCanAct: mocks.ensureUserAccountCanAct }));
vi.mock("@/lib/employee-capture-token", () => ({
  readEmployeeCaptureToken: mocks.readEmployeeCaptureToken,
  resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess,
}));
vi.mock("@/lib/employee-public-media-consent-token", () => ({
  readEmployeePublicMediaConsentToken: mocks.readEmployeePublicMediaConsentToken,
  resolveEmployeePublicMediaConsentAccess: mocks.resolveEmployeePublicMediaConsentAccess,
}));
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
    mocks.readEmployeeCaptureToken.mockReturnValue(null);
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue(null);
    mocks.readEmployeePublicMediaConsentToken.mockReturnValue(null);
    mocks.resolveEmployeePublicMediaConsentAccess.mockResolvedValue(null);
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
    expect(mocks.loadEmployeePublicMediaConsentView).toHaveBeenCalledWith({
      userId: "employee-1",
      membershipId: null,
    });
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

  it("lets an accountless Employee use the exact active Service Order membership", async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    mocks.readEmployeeCaptureToken.mockReturnValue("capture-token");
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      userId: "employee-1",
      membershipId: "membership-1",
      vendorId: "vendor-1",
    });
    const request = new Request("http://localhost/api/employee/public-media-consent?ct=capture-token");

    const getResponse = await GET(request);
    expect(getResponse.status).toBe(200);
    expect(mocks.ensureUserAccountCanAct).not.toHaveBeenCalled();
    expect(mocks.loadEmployeePublicMediaConsentView).toHaveBeenCalledWith({
      userId: "employee-1",
      membershipId: "membership-1",
    });

    const postResponse = await POST(new Request("http://localhost/api/employee/public-media-consent?ct=capture-token", {
      method: "POST",
      body: JSON.stringify({ membershipId: "membership-1", decision: "ALLOW" }),
    }));
    expect(postResponse.status).toBe(200);
    expect(mocks.decideEmployeePublicMediaConsent).toHaveBeenCalledWith({
      userId: "employee-1",
      membershipId: "membership-1",
      decision: "ALLOW",
      verificationMethod: "SIGNED_EMPLOYEE_SERVICE_ORDER_LINK",
    });
  });

  it("lets a short-lived accountless participation link reach only its bound membership", async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    mocks.readEmployeePublicMediaConsentToken.mockReturnValue("participation-token");
    mocks.resolveEmployeePublicMediaConsentAccess.mockResolvedValue({
      userId: "employee-1",
      membershipId: "membership-1",
      vendorId: "vendor-1",
    });
    const response = await POST(new Request("http://localhost/api/employee/public-media-consent?pct=participation-token", {
      method: "POST",
      body: JSON.stringify({ membershipId: "membership-2", decision: "DENY" }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.decideEmployeePublicMediaConsent).not.toHaveBeenCalled();
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
