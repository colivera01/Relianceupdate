import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  claimCustomerBooking,
  CustomerBookingClaimError,
} from "@/lib/customer-booking-claim-service";

vi.mock("@/server/db", () => ({ prisma: { marker: "prisma" } }));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock("@/lib/customer-booking-claim-service", async () => {
  const actual = await vi.importActual<any>("@/lib/customer-booking-claim-service");
  return { ...actual, claimCustomerBooking: vi.fn() };
});
function request(claimToken = "claim-token") {
  return new Request("https://beta.relianceonline.org/api/bookings/booking-1/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimToken }),
  });
}

describe("POST /api/bookings/[id]/claim", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(claimCustomerBooking).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
  });

  it("uses the transactional claim service for the exact link context", async () => {
    vi.mocked(claimCustomerBooking).mockResolvedValue({
      bookingId: "booking-1",
      grantId: "grant-1",
      packageId: "package-1",
      claimed: true,
      grantRebound: true,
      alreadyConnected: false,
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      claimed: true,
      grantRebound: true,
    });
    expect(claimCustomerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: "claim-token",
      }),
    );
  });

  it("preserves the mismatch denial from the canonical transaction", async () => {
    vi.mocked(claimCustomerBooking).mockRejectedValue(
      new CustomerBookingClaimError(
        "CLAIM_EMAIL_MISMATCH",
        "Use the customer email address that received this service-video link.",
        403,
      ),
    );
    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: "CLAIM_EMAIL_MISMATCH",
    });
  });

  it("returns the completed idempotent state", async () => {
    vi.mocked(claimCustomerBooking).mockResolvedValue({
      bookingId: "booking-1",
      grantId: "grant-1",
      packageId: "package-1",
      claimed: false,
      grantRebound: false,
      alreadyConnected: true,
    });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      alreadyConnected: true,
    });
  });
});
