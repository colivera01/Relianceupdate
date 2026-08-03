import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";

const hoisted = vi.hoisted(() => {
  const serviceFindUnique = vi.fn();
  const serviceUpdate = vi.fn();
  const serviceDelete = vi.fn();
  return {
    prisma: {
      service: {
        findUnique: serviceFindUnique,
        update: serviceUpdate,
        delete: serviceDelete,
      },
    },
    serviceFindUnique,
    serviceUpdate,
    serviceDelete,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/request-actor", () => ({
  requireRequestActor: vi.fn(),
  requireActorVendorManager: vi.fn(),
  authorizationErrorResponse: (error: any) =>
    error?.statusCode
      ? Response.json({ error: error.message }, { status: error.statusCode })
      : null,
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("vendor-owned service mutation access", () => {
  beforeEach(async () => {
    const { requireRequestActor, requireActorVendorManager } = await import("@/lib/request-actor");
    vi.mocked(requireRequestActor).mockReset();
    vi.mocked(requireRequestActor).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(requireActorVendorManager).mockReset();

    hoisted.serviceFindUnique.mockReset();
    hoisted.serviceUpdate.mockReset();
    hoisted.serviceDelete.mockReset();
  });

  it("rejects updates when the signed-in vendor does not own the draft", async () => {
    const { requireActorVendorManager } = await import("@/lib/request-actor");

    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      isPublished: false,
      publishedAt: null,
      vendor: { accountStatus: "active" },
    });
    vi.mocked(requireActorVendorManager).mockImplementation(() => {
      throw Object.assign(new Error("Manager access required."), { statusCode: 403 });
    });

    const response = await PUT(
      new Request("http://localhost/api/services/service-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
        body: JSON.stringify({ name: "Updated Service" }),
      }) as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(response.status).toBe(403);
    const json = await readJson(response);
    expect(json.error).toContain("Manager access required");
    expect(hoisted.serviceUpdate).not.toHaveBeenCalled();
  });

  it("allows an active vendor manager to delete their own draft service", async () => {

    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      isPublished: false,
      publishedAt: null,
      _count: { bookings: 0, mediaSessions: 0, favorites: 0, promotionCampaigns: 0 },
      vendor: { accountStatus: "active" },
    });
    hoisted.serviceDelete.mockResolvedValue({ id: "service-1" });
    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "x-user-id": "user-1" },
      }) as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(response.status).toBe(200);
    expect(hoisted.serviceDelete).toHaveBeenCalledWith({
      where: { id: "service-1" },
    });
  });

  it("archives a published service without deleting its work history", async () => {
    const publishedAt = new Date("2026-07-01T12:00:00.000Z");

    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      isPublished: true,
      publishedAt,
      _count: { bookings: 3, mediaSessions: 3, favorites: 2, promotionCampaigns: 0 },
      vendor: { accountStatus: "active" },
    });
    hoisted.serviceUpdate.mockResolvedValue({ id: "service-1", isPublished: false });
    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "x-user-id": "user-1" },
      }) as any,
      { params: Promise.resolve({ id: "service-1" }) }
    );

    expect(response.status).toBe(200);
    expect(hoisted.serviceDelete).not.toHaveBeenCalled();
    expect(hoisted.serviceUpdate).toHaveBeenCalledWith({
      where: { id: "service-1" },
      data: { isPublished: false, publishedAt },
    });
    expect(await readJson(response)).toMatchObject({
      action: "archived",
      preservedReferences: 8,
    });
  });
});
