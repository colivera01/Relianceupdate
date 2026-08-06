import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  appealFindUnique: vi.fn(),
  caseFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/request-actor", async () => {
  const actual = await vi.importActual<any>("@/lib/request-actor");
  return { ...actual, requirePlatformRole: hoisted.requirePlatformRole };
});
vi.mock("@/server/db", () => ({
  prisma: {
    mediaLifecycleCase: {
      findMany: vi.fn(),
      findUnique: hoisted.caseFindUnique,
    },
    mediaDeletionRequest: { findMany: vi.fn() },
    mediaEvidenceHold: { findMany: vi.fn() },
    mediaLifecycleAppeal: {
      findMany: vi.fn(),
      findUnique: hoisted.appealFindUnique,
    },
    mediaDeletionJob: { findMany: vi.fn() },
    $transaction: hoisted.transaction,
  },
}));
vi.mock("@/lib/media-lifecycle", () => ({
  createEvidenceHold: vi.fn(),
  decideDeletionRequest: vi.fn(),
  decideLifecycleCase: vi.fn(),
  releaseEvidenceHold: vi.fn(),
}));

import { GET, POST } from "./route";
import { AuthorizationError } from "@/lib/request-actor";

describe("admin media lifecycle route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies the lifecycle queue without the database-backed ADMIN role", async () => {
    hoisted.requirePlatformRole.mockRejectedValue(
      new AuthorizationError("FORBIDDEN", "Admin access required.", 403),
    );
    const response = await GET(
      new Request("http://localhost/api/admin/media-lifecycle"),
    );
    expect(response.status).toBe(403);
  });

  it("requires a different admin to decide an appeal", async () => {
    hoisted.requirePlatformRole.mockResolvedValue({
      userId: "admin-1",
      platformRoles: ["ADMIN"],
    });
    hoisted.appealFindUnique.mockResolvedValue({
      id: "appeal-1",
      caseId: "case-1",
      status: "SUBMITTED",
    });
    hoisted.caseFindUnique.mockResolvedValue({
      id: "case-1",
      assignedAdminUserId: "admin-1",
    });
    const response = await POST(
      new Request("http://localhost/api/admin/media-lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DECIDE_APPEAL",
          appealId: "appeal-1",
          decision: "UPHOLD",
          reason: "Evidence reviewed.",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });
});
