import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
import { requireAdmin } from "@/lib/admin-auth";

const hoisted = vi.hoisted(() => {
  const contentReportCount = vi.fn();
  const contentReportFindMany = vi.fn();
  const contentReportUpdate = vi.fn();
  const prisma = {
    contentReport: {
      count: contentReportCount,
      findMany: contentReportFindMany,
      update: contentReportUpdate,
    },
  };
  return { prisma, contentReportCount, contentReportFindMany, contentReportUpdate };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("/api/admin/reported-content", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    hoisted.contentReportCount.mockReset();
    hoisted.contentReportFindMany.mockReset();
    hoisted.contentReportUpdate.mockReset();
  });

  it("lists filtered content reports for admins", async () => {
    hoisted.contentReportCount.mockResolvedValue(1);
    hoisted.contentReportFindMany.mockResolvedValue([
      {
        id: "report-1",
        targetType: "review",
        targetId: "review-1",
        bookingId: "booking-1",
        vendorId: "vendor-1",
        reportedUserId: "user-1",
        reportedVendorId: "vendor-1",
        reporterUserId: "reporter-1",
        reporterVendorId: null,
        reporterRole: "customer",
        reasonCategory: "harassment",
        reasonDetail: "Abusive language",
        status: "open",
        severity: "high",
        autoHidden: false,
        notificationSentAt: null,
        createdAt: new Date("2026-05-25T12:00:00.000Z"),
        updatedAt: new Date("2026-05-25T12:00:00.000Z"),
        resolvedAt: null,
        resolutionNotes: null,
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/admin/reported-content?targetType=review&status=open&severity=high")
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.reports[0]).toMatchObject({
      id: "report-1",
      moderationHref: "/admin/reviews?q=review-1",
      severity: "high",
      status: "open",
    });
    expect(hoisted.contentReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: "review",
          status: "open",
          severity: "high",
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ reporterUserId: null }),
                expect.objectContaining({
                  reporterUserId: expect.objectContaining({
                    notIn: expect.arrayContaining(["e2e-smoke-customer"]),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("requires resolution notes when closing a report", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/admin/reported-content", {
        method: "PATCH",
        body: JSON.stringify({
          reportId: "report-1",
          status: "resolved_action_taken",
        }),
      })
    );

    expect(res.status).toBe(422);
    expect(hoisted.contentReportUpdate).not.toHaveBeenCalled();
  });

  it("updates a report status for admins", async () => {
    hoisted.contentReportUpdate.mockResolvedValue({
      id: "report-1",
      status: "triaged",
      resolutionNotes: null,
      resolvedAt: null,
      updatedAt: new Date("2026-05-25T12:05:00.000Z"),
    });

    const res = await PATCH(
      new Request("http://localhost/api/admin/reported-content", {
        method: "PATCH",
        body: JSON.stringify({
          reportId: "report-1",
          status: "triaged",
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(hoisted.contentReportUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: expect.objectContaining({
        status: "triaged",
        adminOwnerUserId: "admin-1",
        resolvedAt: null,
      }),
    });
  });
});
