import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import { deleteBlob, uploadBlobBuffer } from "@/lib/azure-blob-storage";
import { addRegisteredUser, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/azure-blob-storage", () => ({
  deleteBlob: vi.fn(),
  generateDownloadUrl: vi.fn(),
  getBlobProperties: vi.fn(),
  uploadBlobBuffer: vi.fn(),
}));

vi.mock("@/lib/dev-registered-users", () => ({
  addRegisteredUser: vi.fn(),
  registeredUsers: [
    {
      id: "user-1",
      email: "customer@example.com",
      firstName: "Customer",
      lastName: "Example",
    },
  ],
  syncRegisteredUsersFromDisk: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("customer profile photo route", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(uploadBlobBuffer).mockReset();
    vi.mocked(deleteBlob).mockReset();
    vi.mocked(addRegisteredUser).mockReset();
    vi.mocked(syncRegisteredUsersFromDisk).mockReset();
    vi.mocked(prisma.user.findUnique as any).mockReset();
    vi.mocked(prisma.user.update as any).mockReset();
  });

  it("uploads a customer profile photo and persists the route url", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "customer@example.com",
      profilePhoto: null,
    });
    vi.mocked(uploadBlobBuffer).mockResolvedValue({
      url: "https://storage.example.com/customer/user-1/profile/profile-photo",
    } as any);
    vi.mocked(prisma.user.update as any).mockResolvedValue({
      id: "user-1",
      profilePhoto: "/api/customer/profile/photo?v=123",
    });

    const formData = new FormData();
    formData.append("file", new File(["image-bytes"], "avatar.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/customer/profile/photo", {
        method: "POST",
        body: formData,
      })
    );

    if (!response) {
      throw new Error("Expected POST response");
    }
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      photoUrl: expect.stringContaining("/api/customer/profile/photo?v="),
    });
    expect(uploadBlobBuffer).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          profilePhoto: expect.stringContaining("/api/customer/profile/photo?v="),
        }),
      })
    );
  });

  it("removes the customer profile photo and clears the saved reference", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue("user-1");
    vi.mocked(prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "customer@example.com",
      profilePhoto: "/api/customer/profile/photo?v=123",
    });
    vi.mocked(deleteBlob).mockResolvedValue(true);
    vi.mocked(prisma.user.update as any).mockResolvedValue({
      id: "user-1",
      profilePhoto: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/customer/profile/photo", {
        method: "DELETE",
      })
    );

    if (!response) {
      throw new Error("Expected DELETE response");
    }
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      removed: true,
    });
    expect(deleteBlob).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profilePhoto: null },
    });
  });
});
