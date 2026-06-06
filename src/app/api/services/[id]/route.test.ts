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

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("vendor-owned service mutation access", () => {
  beforeEach(async () => {
    const { getUserIdFromRequest } = await import("@/lib/auth");
    const { resolveVendorAccessForUser } = await import("@/lib/vendor-context");

    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(resolveVendorAccessForUser).mockReset();

    hoisted.serviceFindUnique.mockReset();
    hoisted.serviceUpdate.mockReset();
    hoisted.serviceDelete.mockReset();
  });

  it("rejects updates when the signed-in vendor does not own the draft", async () => {
    const { resolveVendorAccessForUser } = await import("@/lib/vendor-context");

    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      isPublished: false,
      publishedAt: null,
      vendor: { accountStatus: "active" },
    });
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "PENDING",
      userId: "user-1",
      vendorId: "vendor-2",
    } as any);

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
    expect(json.error).toContain("Vendor ownership required");
    expect(hoisted.serviceUpdate).not.toHaveBeenCalled();
  });

  it("allows a pending vendor owner to delete their own draft service", async () => {
    const { resolveVendorAccessForUser } = await import("@/lib/vendor-context");

    hoisted.serviceFindUnique.mockResolvedValue({
      id: "service-1",
      vendorId: "vendor-1",
      vendor: { accountStatus: "active" },
    });
    hoisted.serviceDelete.mockResolvedValue({ id: "service-1" });
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "PENDING",
      userId: "user-1",
      vendorId: "vendor-1",
    } as any);

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
});
