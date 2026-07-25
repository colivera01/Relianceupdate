import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingUpdateMany = vi.fn();
  const userFindUnique = vi.fn();
  return {
    bookingFindUnique,
    bookingUpdateMany,
    userFindUnique,
    prisma: {
      booking: {
        findUnique: bookingFindUnique,
        updateMany: bookingUpdateMany,
      },
      user: {
        findUnique: userFindUnique,
      },
    },
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn() }));

function request(claimToken = "") {
  return new Request("https://beta.relianceonline.org/api/bookings/booking-1/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimToken }),
  });
}

describe("POST /api/bookings/[id]/claim", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingUpdateMany.mockReset();
    hoisted.userFindUnique.mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    hoisted.userFindUnique.mockResolvedValue({
      id: "customer-1",
      email: "customer@example.com",
    });
  });

  it("connects a legacy unclaimed work order to the signed-in matching customer", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "placeholder-1",
      customerMetadata: JSON.stringify({
        claim_status: "UNCLAIMED",
        claim_contact_email: "customer@example.com",
      }),
      user: { email: "unclaimed+123@reliance.local" },
    });
    hoisted.bookingUpdateMany.mockResolvedValue({ count: 1 });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, claimed: true });
    expect(hoisted.bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1", userId: "placeholder-1" },
        data: expect.objectContaining({ userId: "customer-1" }),
      })
    );
  });

  it("does not connect the work order to a different email account", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "placeholder-1",
      customerMetadata: JSON.stringify({
        claim_status: "UNCLAIMED",
        claim_contact_email: "intended@example.com",
      }),
      user: { email: "unclaimed+123@reliance.local" },
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toMatchObject({ code: "CLAIM_EMAIL_MISMATCH" });
    expect(hoisted.bookingUpdateMany).not.toHaveBeenCalled();
  });

  it("is idempotent when the booking already belongs to the signed-in customer", async () => {
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "customer-1",
      customerMetadata: "{}",
      user: { email: "customer@example.com" },
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "booking-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      alreadyConnected: true,
    });
    expect(hoisted.bookingUpdateMany).not.toHaveBeenCalled();
  });
});
