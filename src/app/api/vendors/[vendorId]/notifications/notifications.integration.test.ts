import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireVendorManager } from "@/lib/membership-auth";
import {
  listVendorManagerNotificationHistory,
  markVendorManagerNotificationRead,
} from "@/lib/vendor-manager-notifications";
import { GET } from "./route";
import { POST } from "./[notificationId]/read/route";

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/membership-auth", () => ({ requireVendorManager: vi.fn() }));
vi.mock("@/lib/vendor-manager-notifications", () => ({
  listVendorManagerNotificationHistory: vi.fn(),
  markVendorManagerNotificationRead: vi.fn(),
}));

describe("Vendor Manager notification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireVendorManager).mockResolvedValue({
      vendorId: "vendor-1",
      userId: "manager-user-1",
      membershipId: "manager-1",
    });
    vi.mocked(listVendorManagerNotificationHistory).mockResolvedValue([]);
    vi.mocked(markVendorManagerNotificationRead).mockResolvedValue({ historical: false, changed: true } as any);
  });

  it("scopes history to the authenticated manager membership", async () => {
    const request = new Request("http://localhost/api/vendors/vendor-1/notifications");
    const response = await GET(request, { params: Promise.resolve({ vendorId: "vendor-1" }) });

    expect(response.status).toBe(200);
    expect(requireVendorManager).toHaveBeenCalledWith(request, "vendor-1");
    expect(listVendorManagerNotificationHistory).toHaveBeenCalledWith(expect.anything(), {
      vendorId: "vendor-1",
      membershipId: "manager-1",
      limit: 100,
    });
  });

  it("denies Employee or wrong-vendor access through the manager boundary", async () => {
    vi.mocked(requireVendorManager).mockRejectedValue(new Error("Forbidden: Manager role required"));
    const response = await GET(
      new Request("http://localhost/api/vendors/vendor-1/notifications"),
      { params: Promise.resolve({ vendorId: "vendor-1" }) },
    );
    expect(response.status).toBe(403);
    expect(listVendorManagerNotificationHistory).not.toHaveBeenCalled();
  });

  it("marks only the authenticated manager's notice read", async () => {
    const request = new Request("http://localhost/api/vendors/vendor-1/notifications/notice-1/read", { method: "POST" });
    const response = await POST(request, {
      params: Promise.resolve({ vendorId: "vendor-1", notificationId: "notice-1" }),
    });
    expect(response.status).toBe(200);
    expect(markVendorManagerNotificationRead).toHaveBeenCalledWith(expect.anything(), {
      id: "notice-1",
      vendorId: "vendor-1",
      membershipId: "manager-1",
    });
  });
});
