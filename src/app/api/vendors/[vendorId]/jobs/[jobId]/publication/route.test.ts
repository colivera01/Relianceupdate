import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH, POST } from "./route";
import { requireVendorManager } from "@/lib/membership-auth";
import {
  approveVendorPublicationRepresentation,
  createPublicationProposal,
  loadPublicationView,
} from "@/lib/service-video-publication";

vi.mock("@/lib/membership-auth", () => ({ requireVendorManager: vi.fn() }));
vi.mock("@/lib/service-video-publication", () => ({
  approveVendorPublicationRepresentation: vi.fn(),
  createPublicationProposal: vi.fn(),
  loadPublicationView: vi.fn(),
}));

const context = { params: Promise.resolve({ vendorId: "vendor-1", jobId: "booking-1" }) };

describe("vendor publication compatibility route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireVendorManager).mockResolvedValue({
      userId: "manager-1",
      membershipId: "membership-1",
    } as any);
  });

  it("rejects vendor stage selection for the new package-level contract", async () => {
    vi.mocked(loadPublicationView).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/vendors/vendor-1/jobs/booking-1/publication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: [{ stage: "COMPLETED" }] }),
    }), context);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("PUBLICATION_VENDOR_STAGE_SELECTION_RETIRED");
    expect(createPublicationProposal).not.toHaveBeenCalled();
  });

  it("rejects vendor approval for a customer complete-package proposal", async () => {
    vi.mocked(loadPublicationView).mockResolvedValue({
      proposal: { id: "proposal-2", contractVersion: 2, authorizationModel: "CUSTOMER_COMPLETE_PACKAGE" },
    } as any);
    const response = await PATCH(new Request("http://localhost/api/vendors/vendor-1/jobs/booking-1/publication", {
      method: "PATCH",
    }), context);

    expect(response.status).toBe(409);
    expect(approveVendorPublicationRepresentation).not.toHaveBeenCalled();
  });

  it("preserves the original route for a current historical contract-version-1 proposal", async () => {
    vi.mocked(loadPublicationView).mockResolvedValue({
      proposal: { id: "proposal-legacy", contractVersion: 1 },
    } as any);
    vi.mocked(createPublicationProposal).mockResolvedValue({ id: "proposal-legacy-2" } as any);

    const response = await POST(new Request("http://localhost/api/vendors/vendor-1/jobs/booking-1/publication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: [{ stage: "COMPLETED" }] }),
    }), context);

    expect(response.status).toBe(201);
    expect(createPublicationProposal).toHaveBeenCalledTimes(1);
  });
});
