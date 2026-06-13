import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import {
  buildVendorApprovalContextResolutionFromPendingSource,
  generateVendorApprovalAiStoredResult,
  getLatestVendorApprovalAiStoredResults,
  serializeVendorApprovalAiStoredResult,
} from "@/lib/ai/vendor-approval-review-store";

const hoisted = vi.hoisted(() => ({
  vendorMembershipFindMany: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: {
      findMany: hoisted.vendorMembershipFindMany,
    },
  },
}));

vi.mock("@/lib/launch-content-cleanup", () => ({
  isStaleApprovalQueueFixture: vi.fn(() => false),
}));

vi.mock("@/lib/ai/feature-flags", () => ({
  isAiFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/ai/vendor-approval-review-store", () => ({
  VENDOR_APPROVAL_AI_SYSTEM_ACTOR: "system_ai",
  buildVendorApprovalContextResolutionFromPendingSource: vi.fn(),
  generateVendorApprovalAiStoredResult: vi.fn(),
  getLatestVendorApprovalAiStoredResults: vi.fn(),
  serializeVendorApprovalAiStoredResult: vi.fn((value: unknown) => value),
}));

function createPendingRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/vendors/pending${query}`);
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("GET /api/admin/vendors/pending", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" } as any);
    vi.mocked(isAiFeatureEnabled).mockReset();
    vi.mocked(isAiFeatureEnabled).mockReturnValue(true);
    vi.mocked(buildVendorApprovalContextResolutionFromPendingSource).mockReset();
    vi.mocked(generateVendorApprovalAiStoredResult).mockReset();
    vi.mocked(getLatestVendorApprovalAiStoredResults).mockReset();
    vi.mocked(serializeVendorApprovalAiStoredResult).mockReset();
    vi.mocked(serializeVendorApprovalAiStoredResult).mockImplementation((value: unknown) => value as any);
    hoisted.vendorMembershipFindMany.mockReset();
  });

  it("reuses the latest matching AI review without regenerating it", async () => {
    const submittedAt = "2026-06-09T20:00:00.000Z";
    const existing = {
      aiRunId: "ai_existing",
      fingerprint: "fingerprint-1",
      promptVersion: "vendor-approval.v1",
      model: "gpt-5.4-mini",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      suggestion: {
        summary: "Looks ready for manual approval review.",
        decision: "recommend_approve",
        confidence: "medium",
        findings: [],
        blockingIssues: [],
        recommendedActions: ["Approve after final admin check."],
        scopeNotes: [],
      },
      applicationSnapshot: {
        emailVerified: true,
        serviceDraftCount: 1,
        publishedServiceCount: 0,
        submittedAt,
      },
    };

    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-1",
        status: "PENDING",
        role: "MANAGER",
        requestedAt: new Date(submittedAt),
        vendor: {
          id: "vendor-1",
          businessName: "Electro LLC",
          email: "relianceorg.support@gmail.com",
          phone: "407-555-1111",
          category: "Electrician",
          businessType: "Electrician",
          foundedYear: 2024,
          address: "407 Boxwood Circle",
          city: "Winter Springs",
          state: "Florida",
          zipCode: "32708",
          createdAt: new Date(submittedAt),
          services: [{ id: "svc-1", isPublished: false }],
        },
        user: {
          id: "user-1",
          name: "Ivan Olivera",
          email: "relianceorg.support@gmail.com",
          phone: "407-555-1111",
          authCredential: {
            id: "cred-1",
            emailVerifiedAt: new Date("2026-06-09T19:00:00.000Z"),
            createdAt: new Date("2026-06-09T19:00:00.000Z"),
          },
        },
      },
    ]);
    vi.mocked(getLatestVendorApprovalAiStoredResults).mockResolvedValue({
      "vendor-1": existing as any,
    });
    vi.mocked(buildVendorApprovalContextResolutionFromPendingSource).mockReturnValue({
      status: "ok",
      fingerprint: "fingerprint-1",
      applicationSnapshot: {
        submittedAt,
      },
    } as any);

    const response = await GET(createPendingRequest("?page=1&limit=5"));

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.success).toBe(true);
    expect(json.data.vendors[0]).toMatchObject({
      id: "vendor-1",
      membershipId: "membership-1",
      businessName: "Electro LLC",
      aiRecommendation: {
        aiRunId: "ai_existing",
        suggestion: {
          decision: "recommend_approve",
        },
      },
    });
    expect(generateVendorApprovalAiStoredResult).not.toHaveBeenCalled();
  });

  it("auto-runs a new AI review when the stored result is missing or stale", async () => {
    const submittedAt = "2026-06-09T20:00:00.000Z";
    const generated = {
      aiRunId: "ai_new",
      fingerprint: "fingerprint-new",
      promptVersion: "vendor-approval.v1",
      model: "gpt-5.4-mini",
      usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
      suggestion: {
        summary: "Manual review is still needed before approval.",
        decision: "needs_manual_review",
        confidence: "high",
        findings: [],
        blockingIssues: ["New application with limited history."],
        recommendedActions: ["Confirm business details, then decide manually."],
        scopeNotes: [],
      },
      applicationSnapshot: {
        emailVerified: false,
        serviceDraftCount: 1,
        publishedServiceCount: 0,
        submittedAt,
      },
    };

    hoisted.vendorMembershipFindMany.mockResolvedValue([
      {
        id: "membership-2",
        status: "PENDING",
        role: "MANAGER",
        requestedAt: new Date(submittedAt),
        vendor: {
          id: "vendor-2",
          businessName: "Metro Electric",
          email: "metro@reliance.test",
          phone: "407-555-2222",
          category: "Electrician",
          businessType: "Electrician",
          foundedYear: 2025,
          address: "22 Main St",
          city: "Orlando",
          state: "Florida",
          zipCode: "32801",
          createdAt: new Date(submittedAt),
          services: [{ id: "svc-2", isPublished: false }],
        },
        user: {
          id: "user-2",
          name: "Metro Owner",
          email: "metro@reliance.test",
          phone: "407-555-2222",
          authCredential: {
            id: "cred-2",
            emailVerifiedAt: null,
            createdAt: new Date("2026-06-09T19:30:00.000Z"),
          },
        },
      },
    ]);
    vi.mocked(getLatestVendorApprovalAiStoredResults).mockResolvedValue({});
    vi.mocked(buildVendorApprovalContextResolutionFromPendingSource).mockReturnValue({
      status: "ok",
      fingerprint: "fingerprint-new",
      applicationSnapshot: {
        submittedAt,
      },
    } as any);
    vi.mocked(generateVendorApprovalAiStoredResult).mockResolvedValue(generated as any);

    const response = await GET(createPendingRequest("?page=1&limit=5"));

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.data.vendors[0]).toMatchObject({
      id: "vendor-2",
      membershipId: "membership-2",
      aiRecommendation: {
        aiRunId: "ai_new",
        suggestion: {
          decision: "needs_manual_review",
        },
      },
    });
    expect(generateVendorApprovalAiStoredResult).toHaveBeenCalledWith("vendor-2", {
      actorUserId: "system_ai",
      source: "admin_vendor_approval_queue_autorun",
      resolution: expect.objectContaining({
        status: "ok",
        fingerprint: "fingerprint-new",
      }),
    });
  });
});
