import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import { decidePublicationAsParticipant, loadPublicationView } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => ({
  membershipFindMany: vi.fn(),
  evidenceFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: { findMany: hoisted.membershipFindMany },
    serviceVideoStageEvidence: { findMany: hoisted.evidenceFindMany },
  },
}));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock("@/lib/account-status", () => ({ ensureUserAccountCanAct: vi.fn() }));
vi.mock("@/lib/service-video-publication", () => ({
  decidePublicationAsParticipant: vi.fn(),
  loadPublicationView: vi.fn(),
}));

const context = { params: Promise.resolve({ jobId: "booking-1" }) };
const publication = {
  proposal: { id: "proposal-1", vendorId: "vendor-1" },
  stages: [{ id: "publication-stage-1", stageEvidenceId: "stage-evidence-1" }],
};

describe("employee Public-sharing participant route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("shared-admin-employee-user");
    vi.mocked(loadPublicationView).mockResolvedValue(publication as any);
    vi.mocked(decidePublicationAsParticipant).mockResolvedValue({ status: "PUBLIC" } as any);
  });

  it("does not let a platform identity write without the exact active employee membership", async () => {
    hoisted.membershipFindMany.mockResolvedValue([]);
    hoisted.evidenceFindMany.mockResolvedValue([]);

    const response = await PATCH(new Request("http://localhost/api/employee/jobs/booking-1/publication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions: [] }),
    }), context);

    expect(response.status).toBe(403);
    expect(decidePublicationAsParticipant).not.toHaveBeenCalled();
  });

  it("allows the same shared identity only through its exact active employee evidence", async () => {
    hoisted.membershipFindMany.mockResolvedValue([{ id: "employee-membership-1" }]);
    hoisted.evidenceFindMany.mockResolvedValue([{ id: "stage-evidence-1" }]);

    const decisions = [{
      stageId: "publication-stage-1",
      authorityType: "EMPLOYEE_AUDIO",
      decision: "APPROVED",
    }];
    const response = await PATCH(new Request("http://localhost/api/employee/jobs/booking-1/publication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions }),
    }), context);

    expect(response.status).toBe(200);
    expect(hoisted.membershipFindMany).toHaveBeenCalledWith({
      where: {
        userId: "shared-admin-employee-user",
        vendorId: "vendor-1",
        status: "ACTIVE",
        role: "EMPLOYEE",
      },
      select: { id: true },
    });
    expect(decidePublicationAsParticipant).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      actorUserId: "shared-admin-employee-user",
      decisions,
      verificationMethod: "SIGNED_IN_EMPLOYEE_SESSION",
    });
  });
});
