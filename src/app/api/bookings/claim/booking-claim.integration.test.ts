import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  claimCustomerBooking,
  CustomerBookingClaimError,
} from "@/lib/customer-booking-claim-service";

const hoisted = vi.hoisted(() => ({ bookingFindUnique: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: hoisted.bookingFindUnique } },
}));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));
vi.mock("@/lib/customer-booking-claim-service", async () => {
  const actual = await vi.importActual<any>("@/lib/customer-booking-claim-service");
  return { ...actual, claimCustomerBooking: vi.fn() };
});

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/bookings/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const booking = {
  id: "booking-1",
  userId: "customer-1",
  vendorId: "vendor-1",
  serviceId: "service-1",
  title: "Job",
  clientName: "Alex",
  amount: 100,
  status: "COMPLETED",
  scheduledFor: null,
  date: new Date("2026-09-01T12:00:00.000Z"),
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  updatedAt: new Date("2026-09-01T12:00:00.000Z"),
  customerMetadata: "{}",
  service: { id: "service-1", name: "Service", description: "", price: 100 },
  vendor: {
    id: "vendor-1",
    name: "Vendor",
    businessName: "Vendor Co",
    phone: null,
    email: null,
    city: null,
    state: null,
  },
};

describe("POST /api/bookings/claim", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(claimCustomerBooking).mockReset();
    hoisted.bookingFindUnique.mockReset();
  });

  it("returns 401 without user context", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    expect((await POST(request({ bookingId: "booking-1" }))).status).toBe(401);
  });

  it("maps canonical wrong-account denial", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    vi.mocked(claimCustomerBooking).mockRejectedValue(
      new CustomerBookingClaimError(
        "CLAIM_EMAIL_MISMATCH",
        "This booking was created for a different customer email.",
        403,
      ),
    );
    const response = await POST(request({ bookingId: "booking-1" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CLAIM_EMAIL_MISMATCH" });
  });

  it("returns the claimed booking after the shared transaction succeeds", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    vi.mocked(claimCustomerBooking).mockResolvedValue({
      bookingId: "booking-1",
      grantId: "grant-1",
      packageId: "package-1",
      claimed: true,
      grantRebound: true,
      alreadyConnected: false,
    });
    hoisted.bookingFindUnique.mockResolvedValue(booking);
    const response = await POST(
      request({ bookingId: "booking-1", claimToken: "claim-token" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      claimed: true,
      grantRebound: true,
    });
  });
});

