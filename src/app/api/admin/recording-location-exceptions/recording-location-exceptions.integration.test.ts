import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  exceptionFindUnique: vi.fn(),
  exceptionUpdateMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    recordingLocationException: {
      findUnique: db.exceptionFindUnique,
      updateMany: db.exceptionUpdateMany,
    },
  },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/lifecycle-audit", () => ({ recordLifecycleAudit: vi.fn(async () => undefined) }));

import { requireAdmin } from "@/lib/admin-auth";

describe("admin location exception decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    db.exceptionFindUnique.mockResolvedValue({
      id: "exception-1",
      bookingId: "job-1",
      vendorId: "vendor-1",
      assessmentId: "assessment-1",
      status: "PENDING",
    });
    db.exceptionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a decision from a non-admin actor", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/admin", {
      method: "PATCH",
      body: JSON.stringify({
        exceptionId: "exception-1",
        decision: "APPROVED",
        decisionNote: "Verified support evidence.",
      }),
    }));
    expect(response.status).toBe(403);
    expect(db.exceptionUpdateMany).not.toHaveBeenCalled();
  });

  it("uses an atomic pending-only update for the independent admin decision", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/admin", {
      method: "PATCH",
      body: JSON.stringify({
        exceptionId: "exception-1",
        decision: "APPROVED",
        decisionNote: "Verified support evidence.",
      }),
    }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.exception.status).toBe("APPROVED");
    expect(db.exceptionUpdateMany).toHaveBeenCalledWith({
      where: { id: "exception-1", status: "PENDING" },
      data: expect.objectContaining({
        status: "APPROVED",
        decidedByAdminUserId: "admin-1",
      }),
    });
  });
});
