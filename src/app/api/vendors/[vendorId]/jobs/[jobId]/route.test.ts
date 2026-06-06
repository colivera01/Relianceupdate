import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

vi.mock("@/server/db", () => ({
  prisma: {
    booking: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/vendors/[vendorId]/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(prisma.booking.findFirst).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "manager-1",
      vendorId: "vendor-1",
      role: "MANAGER",
      membershipId: "membership-1",
    } as any);
  });

  it("returns 404 when the booking is not found for the vendor", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(null as any);

    const response = await GET(new Request("http://localhost/api/vendors/vendor-1/jobs/job-1"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }),
    });

    expect(response.status).toBe(404);
    const json = await readJson(response);
    expect(json.error).toBe("Job not found for this vendor.");
  });

  it("returns a normalized vendor job detail payload", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: "job-1",
      title: "Metro Apartment Deep Clean",
      clientName: null,
      status: "CONFIRMED",
      date: new Date("2026-06-02T13:00:00.000Z"),
      createdAt: new Date("2026-06-02T12:00:00.000Z"),
      updatedAt: new Date("2026-06-02T12:30:00.000Z"),
      customerMetadata: JSON.stringify({
        booking_source: "customer_booking",
        vendor_job_assigned_employees: ["E2E Trust Employee"],
        user_notes: "Call before arrival",
      }),
      rejectionReason: null,
      rejectedAt: null,
      service: {
        name: "Metro Apartment Deep Clean",
      },
      user: {
        name: "Jordan Rivera",
      },
    } as any);

    const response = await GET(new Request("http://localhost/api/vendors/vendor-1/jobs/job-1"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }),
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.job).toMatchObject({
      id: "job-1",
      title: "Metro Apartment Deep Clean",
      client: "Jordan Rivera",
      status: "IN_PROGRESS",
      source: "customer_booking",
      assignedEmployees: ["E2E Trust Employee"],
      serviceName: "Metro Apartment Deep Clean",
      serviceType: "Metro Apartment Deep Clean",
      notes: [{ text: "Call before arrival" }],
    });
  });

  it("treats booking-backed jobs without explicit source flags as customer bookings", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: "job-legacy-customer",
      title: "Drain Cleaning",
      clientName: "Maya Bennett",
      status: "PENDING",
      date: new Date("2026-06-08T14:00:00.000Z"),
      createdAt: new Date("2026-06-06T13:02:00.000Z"),
      updatedAt: new Date("2026-06-06T13:09:00.000Z"),
      customerMetadata: JSON.stringify({
        client_email: "maya@example.com",
        vendor_job_assigned_employees: ["Lena Harbor"],
      }),
      rejectionReason: null,
      rejectedAt: null,
      service: {
        name: "Drain Cleaning",
      },
      user: {
        name: "Maya Bennett",
      },
    } as any);

    const response = await GET(new Request("http://localhost/api/vendors/vendor-1/jobs/job-legacy-customer"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-legacy-customer" }),
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.job).toMatchObject({
      id: "job-legacy-customer",
      source: "customer_booking",
      client: "Maya Bennett",
      assignedEmployees: ["Lena Harbor"],
    });
  });
});
