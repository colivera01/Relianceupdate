import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";

const hoisted = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();

  return {
    userFindUnique,
    bookingFindUnique,
    bookingUpdate,
    prisma: {
      user: { findUnique: userFindUnique },
      booking: { findUnique: bookingFindUnique, update: bookingUpdate },
    },
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/bookings/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    userId: "placeholder-1",
    vendorId: "ven-1",
    serviceId: "svc-1",
    title: "Job",
    clientName: "Alex",
    amount: 100,
    status: "PENDING",
    scheduledFor: new Date("2026-01-01T10:00:00.000Z"),
    date: new Date("2026-01-01T10:00:00.000Z"),
    createdAt: new Date("2026-01-01T09:00:00.000Z"),
    updatedAt: new Date("2026-01-01T09:00:00.000Z"),
    customerMetadata: JSON.stringify({ client_email: "alex@example.com", claim_status: "UNCLAIMED" }),
    service: { id: "svc-1", name: "Service", description: "", price: 100 },
    vendor: {
      id: "ven-1",
      name: "Vendor",
      businessName: "Vendor Co",
      phone: null,
      email: null,
      city: null,
      state: null,
    },
    ...overrides,
  };
}

describe("POST /api/bookings/claim", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdate.mockReset();
  });

  it("returns 401 without user context", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const res = await POST(request({ bookingId: "booking-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking is not found", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.userFindUnique.mockResolvedValue({ id: "customer-1", email: "alex@example.com" });
    hoisted.bookingFindUnique.mockResolvedValue(null);

    const res = await POST(request({ bookingId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when claim email does not match", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.userFindUnique.mockResolvedValue({ id: "customer-1", email: "other@example.com" });
    hoisted.bookingFindUnique.mockResolvedValue(baseBooking());

    const res = await POST(request({ bookingId: "booking-1" }));
    expect(res.status).toBe(403);
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("claims booking when metadata email matches", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.userFindUnique.mockResolvedValue({ id: "customer-1", email: "alex@example.com" });
    hoisted.bookingFindUnique.mockResolvedValue(baseBooking());
    hoisted.bookingUpdate.mockResolvedValue(
      baseBooking({
        userId: "customer-1",
        customerMetadata: JSON.stringify({ client_email: "alex@example.com", claim_status: "CLAIMED" }),
      })
    );

    const res = await POST(request({ bookingId: "booking-1" }));
    expect(res.status).toBe(200);
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: expect.objectContaining({ userId: "customer-1" }),
      })
    );
  });
});

