import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { loadRecordingPermissionGate } from "@/lib/consent/recording-gate";
import { loadPackageVisibilityView } from "@/lib/service-video-publication";

vi.mock("@/server/db", () => ({
  prisma: {
    booking: {
      findFirst: vi.fn(),
    },
    serviceVideoPackageEvidence: {
      findFirst: vi.fn(),
    },
    serviceVideoAdminAuditDecisionEvidence: {
      findFirst: vi.fn(),
    },
    recordingScopeAssessment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: vi.fn(),
}));

vi.mock("@/lib/service-video-publication", () => ({
  loadPackageVisibilityView: vi.fn(),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/vendors/[vendorId]/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(prisma.booking.findFirst).mockReset();
    vi.mocked((prisma as any).serviceVideoPackageEvidence.findFirst).mockReset();
    vi.mocked((prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst).mockReset();
    vi.mocked((prisma as any).recordingScopeAssessment.findFirst).mockReset();
    vi.mocked(loadRecordingPermissionGate).mockReset();
    vi.mocked(loadPackageVisibilityView).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({
      userId: "manager-1",
      vendorId: "vendor-1",
      role: "MANAGER",
      membershipId: "membership-1",
    } as any);
    vi.mocked(loadRecordingPermissionGate).mockResolvedValue({
      location: "business",
      permissionRequired: false,
      permissionState: "not_required",
    } as any);
    vi.mocked((prisma as any).serviceVideoPackageEvidence.findFirst).mockResolvedValue(null);
    vi.mocked((prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst).mockResolvedValue(null);
    vi.mocked((prisma as any).recordingScopeAssessment.findFirst).mockResolvedValue(null);
    vi.mocked(loadPackageVisibilityView).mockResolvedValue(null);
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

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
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

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const json = await readJson(response);
    expect(json.job).toMatchObject({
      id: "job-legacy-customer",
      source: "customer_booking",
      client: "Maya Bennett",
      assignedEmployees: ["Lena Harbor"],
    });
  });

  it("returns preserved cancellation reason, actor fallback, and timestamp for the activity timeline", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: "job-canceled",
      title: "Canceled service",
      clientName: "Jordan Rivera",
      status: "CANCELED",
      date: new Date("2026-08-15T15:00:00.000Z"),
      createdAt: new Date("2026-08-15T14:00:00.000Z"),
      updatedAt: new Date("2026-08-15T15:30:00.000Z"),
      customerMetadata: JSON.stringify({
        vendor_job_cancellation: {
          status: "CANCELED",
          canceled_at: "2026-08-15T15:30:00.000Z",
          canceled_by_user_id: "manager-1",
          reason: "Customer no longer needs the service",
        },
      }),
      rejectionReason: null,
      rejectedAt: null,
      service: { name: "Canceled service" },
      user: { name: "Jordan Rivera", email: null, phone: null },
    } as any);
    const response = await GET(new Request("http://localhost/api/vendors/vendor-1/jobs/job-canceled"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-canceled" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      job: {
        status: "CANCELED",
        cancellation: {
          reason: "Customer no longer needs the service",
          canceledAt: "2026-08-15T15:30:00.000Z",
          canceledByUserId: "manager-1",
          canceledBy: "Vendor manager",
        },
      },
    });
  });

  it("returns terminal Admin audit evidence for read-only vendor presentation", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({
      id: "job-admin-rejected",
      title: "Outlet Installation",
      clientName: "Reliance Demo Customer",
      status: "REJECTED",
      date: new Date("2026-08-24T15:00:00.000Z"),
      createdAt: new Date("2026-08-24T14:00:00.000Z"),
      updatedAt: new Date("2026-08-24T16:00:00.000Z"),
      customerMetadata: "{}",
      rejectionReason: "UNVERIFIABLE: Evidence could not be verified.",
      rejectedAt: new Date("2026-08-24T16:00:00.000Z"),
      service: { name: "Outlet Installation" },
      user: { name: "Reliance Demo Customer", email: "customer@example.com", phone: null },
    } as any);
    vi.mocked((prisma as any).serviceVideoPackageEvidence.findFirst).mockResolvedValue({
      id: "package-1",
      version: 2,
      status: "ADMIN_REJECTED",
      adminAuditDecisionId: "decision-1",
    });
    vi.mocked((prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst).mockResolvedValue({
      decision: "REJECT",
      rejectionCategory: "UNVERIFIABLE",
      reason: "Evidence could not be verified.",
      decidedAt: new Date("2026-08-24T16:00:00.000Z"),
      packageVersion: 2,
    });

    const response = await GET(new Request("http://localhost/api/vendors/vendor-1/jobs/job-admin-rejected"), {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-admin-rejected" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      job: {
        serviceVideoPackage: { id: "package-1", version: 2, status: "ADMIN_REJECTED" },
        adminAuditDecision: {
          decision: "REJECT",
          rejectionCategory: "UNVERIFIABLE",
          reason: "Evidence could not be verified.",
          packageVersion: 2,
        },
      },
    });
  });
});
