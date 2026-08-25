import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import { ensureUserAccountCanAct } from "@/lib/account-status";
import { decidePublicationAsCustomer, loadPublicationView } from "@/lib/service-video-publication";

const hoisted = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: hoisted.bookingFindUnique } },
}));

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock("@/lib/account-status", () => ({ ensureUserAccountCanAct: vi.fn() }));
vi.mock("@/lib/service-video-publication", () => ({
  decidePublicationAsCustomer: vi.fn(),
  loadPublicationView: vi.fn(),
}));

describe("customer exact-media publication route", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(ensureUserAccountCanAct).mockReset();
    vi.mocked(decidePublicationAsCustomer).mockReset();
    vi.mocked(loadPublicationView).mockReset();
    hoisted.bookingFindUnique.mockReset();
  });

  it("requires an authenticated customer", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/bookings/booking-1/publication"), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    expect(response.status).toBe(401);
    expect(loadPublicationView).not.toHaveBeenCalled();
  });

  it("blocks a signed-in customer from another customer's work record", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-2");
    hoisted.bookingFindUnique.mockResolvedValue({ userId: "customer-1" });
    const response = await GET(new Request("http://localhost/api/bookings/booking-1/publication"), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    expect(response.status).toBe(403);
    expect(loadPublicationView).not.toHaveBeenCalled();
  });

  it("allows the owning customer to record a decision for the current exact proposal", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.bookingFindUnique.mockResolvedValue({ userId: "customer-1" });
    vi.mocked(loadPublicationView).mockResolvedValue({
      proposal: { id: "proposal-1", contractVersion: 1 },
    } as any);
    vi.mocked(decidePublicationAsCustomer).mockResolvedValue({
      status: "AWAITING_VENDOR_APPROVAL",
    } as any);

    const response = await PATCH(new Request("http://localhost/api/bookings/booking-1/publication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageDecisions: { "stage-1": "APPROVED" } }),
    }), { params: Promise.resolve({ id: "booking-1" }) });

    expect(response.status).toBe(200);
    expect(decidePublicationAsCustomer).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: "proposal-1",
      customerUserId: "customer-1",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    }));
  });

  it("rejects legacy per-stage customer decisions for a complete-package proposal", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.bookingFindUnique.mockResolvedValue({ userId: "customer-1" });
    vi.mocked(loadPublicationView).mockResolvedValue({
      proposal: { id: "proposal-v2", contractVersion: 2 },
    } as any);

    const response = await PATCH(new Request("http://localhost/api/bookings/booking-1/publication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageDecisions: { "stage-1": "APPROVED" } }),
    }), { params: Promise.resolve({ id: "booking-1" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      error: "PUBLICATION_CUSTOMER_STAGE_DECISION_RETIRED",
    }));
    expect(decidePublicationAsCustomer).not.toHaveBeenCalled();
  });
});
