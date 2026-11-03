import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVendorManager: vi.fn(),
  loadContext: vi.fn(),
  getStatus: vi.fn(),
  record: vi.fn(),
  presentation: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/membership-auth", () => ({
  requireVendorManager: mocks.requireVendorManager,
}));
vi.mock("@/lib/legal/role-assent-service", () => ({
  loadManagerWorkRecordAttestationContext: mocks.loadContext,
  getManagerWorkRecordAttestationStatus: mocks.getStatus,
  recordManagerWorkRecordAttestation: mocks.record,
}));
vi.mock("@/lib/legal/beta-role-assent-content", () => ({
  managerWorkRecordAttestationPresentation: mocks.presentation,
}));

import { AuthorizationError } from "@/lib/request-actor";
import { GET, POST } from "./route";

const routeContext = {
  params: Promise.resolve({ vendorId: "vendor-a", jobId: "job-1" }),
};

function postRequest() {
  return new Request("http://localhost/api/vendors/vendor-a/jobs/job-1/manager-attestation", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "route-test" },
    body: JSON.stringify({
      contextHash: "context-hash",
      contentSetHash: "content-set-hash",
      authorityConfirmed: true,
      requestId: "request-1",
    }),
  });
}

describe("manager Work Record attestation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVendorManager.mockResolvedValue({
      userId: "manager-1",
      membershipId: "membership-1",
      vendorId: "vendor-a",
    });
    mocks.loadContext.mockResolvedValue({
      contextHash: "context-hash",
      context: { bookingId: "job-1" },
    });
    mocks.getStatus.mockResolvedValue({ required: true, current: false });
    mocks.presentation.mockReturnValue({
      contentSetHash: "content-set-hash",
      checkboxLabel: "I confirm",
    });
    mocks.record.mockResolvedValue({
      status: { required: true, current: true },
      evidenceId: "evidence-1",
    });
  });

  it.each([
    ["an unauthenticated request", new AuthorizationError("UNAUTHENTICATED", "Sign in required.", 401), 401],
    ["a customer without vendor membership", new AuthorizationError("FORBIDDEN", "Vendor access required.", 403), 403],
    ["a manager of another vendor", new AuthorizationError("FORBIDDEN", "Vendor access required.", 403), 403],
    ["an employee", new AuthorizationError("FORBIDDEN", "Manager access required.", 403), 403],
  ])("denies GET and POST for %s before protected attestation work", async (_label, error, expectedStatus) => {
    mocks.requireVendorManager.mockRejectedValue(error);

    const getResponse = await GET(
      new Request("http://localhost/api/vendors/vendor-a/jobs/job-1/manager-attestation"),
      routeContext,
    );
    const postResponse = await POST(postRequest(), routeContext);

    expect(getResponse.status).toBe(expectedStatus);
    expect(postResponse.status).toBe(expectedStatus);
    expect(mocks.loadContext).not.toHaveBeenCalled();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("loads attestation context only after the targeted vendor manager is authorized", async () => {
    const response = await GET(
      new Request("http://localhost/api/vendors/vendor-a/jobs/job-1/manager-attestation"),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(mocks.requireVendorManager).toHaveBeenCalledWith(expect.any(Request), "vendor-a");
    expect(mocks.loadContext).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: "manager-1",
      vendorId: "vendor-a",
      membershipId: "membership-1",
      bookingId: "job-1",
    });
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
  });

  it("records an attestation only after the targeted vendor manager is authorized", async () => {
    const response = await POST(postRequest(), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.requireVendorManager).toHaveBeenCalledWith(expect.any(Request), "vendor-a");
    expect(mocks.record).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: "manager-1",
      vendorId: "vendor-a",
      membershipId: "membership-1",
      bookingId: "job-1",
      displayedContextHash: "context-hash",
      displayedContentSetHash: "content-set-hash",
      authorityConfirmed: true,
      requestId: "request-1",
      userAgent: "route-test",
    });
    expect(mocks.loadContext).not.toHaveBeenCalled();
  });
});
