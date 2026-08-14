import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/server/db", () => ({ prisma: { consentRecord: { findFirst: h.findFirst } } }));
vi.mock("@/lib/membership-auth", () => ({ requireVendorManager: vi.fn() }));

import { requireVendorManager } from "@/lib/membership-auth";
import { GET } from "./route";

describe("manager recording-permission evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireVendorManager).mockResolvedValue({
      userId: "manager-1",
      membershipId: "membership-1",
      vendorId: "vendor-1",
    });
  });

  it("fails before evidence lookup when canonical manager authority is missing", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));
    const response = await GET(new Request("http://localhost/evidence"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }),
    });

    expect(response.status).toBe(403);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("returns durable accepted permission evidence as a read-only, redacted view", async () => {
    h.findFirst.mockResolvedValue({
      id: "permission-1",
      lifecycleStatus: "ALLOWED",
      verifiedDecision: true,
      generation: 2,
      recipientName: "Controlled Customer",
      recipientEmailMasked: "c***@example.com",
      recipientPhoneMasked: "***8888",
      audioEnabled: false,
      scopeJson: JSON.stringify({ propertyScope: "customer_owned", peopleScope: "none" }),
      scopeHash: "scope-hash",
      requestedAt: new Date("2026-08-13T12:00:00.000Z"),
      acceptedAt: new Date("2026-08-13T12:05:00.000Z"),
      declinedAt: null,
      decisionEvidence: {
        id: "evidence-1",
        decision: "ALLOW",
        claimedRole: "CUSTOMER",
        authorityScope: "CUSTOMER_PROPERTY",
        verificationMethod: "EMAIL_OTP",
        requestHash: "request-hash",
        scopeHash: "scope-hash",
        contentHash: "content-hash",
        contentVersion: "v1",
        decidedAt: new Date("2026-08-13T12:05:00.000Z"),
      },
      booking: { id: "job-1", title: "Controlled Service", service: { name: "Controlled Service" } },
    });

    const response = await GET(new Request("http://localhost/evidence"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      readOnly: true,
      permission: {
        lifecycleStatus: "ALLOWED",
        audioEnabled: false,
        recipient: { email: "c***@example.com", phone: "***8888" },
        decisionEvidence: { decision: "ALLOW", verificationMethod: "EMAIL_OTP" },
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("otp");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("userAgent");
    expect(serialized).not.toContain("ipAddress");
  });
});
