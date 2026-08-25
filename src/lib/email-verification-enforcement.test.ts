import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const findUnique = vi.fn();
  const findDbCredentialByUserId = vi.fn();
  return {
    prisma: {
      user: {
        findUnique,
      },
    },
    findUnique,
    findDbCredentialByUserId,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth-credentials", () => ({
  findDbCredentialByUserId: hoisted.findDbCredentialByUserId,
}));

describe("requireVerifiedEmailForAction", () => {
  beforeEach(() => {
    hoisted.findUnique.mockReset();
    hoisted.findDbCredentialByUserId.mockReset();
  });

  it("allows a verified email", async () => {
    hoisted.findUnique.mockResolvedValue({
      id: "user-1",
      email: "verified@example.net",
      phone: null,
      demo: false,
    });
    hoisted.findDbCredentialByUserId.mockResolvedValue({
      id: "cred-1",
      userId: "user-1",
      email: "verified@example.net",
      emailVerifiedAt: new Date(),
    });

    const { requireVerifiedEmailForAction } = await import("./email-verification-enforcement");
    const result = await requireVerifiedEmailForAction({
      userId: "user-1",
      action: "create_booking",
    });

    expect(result).toBeNull();
  });

  it("blocks an unverified email", async () => {
    hoisted.findUnique.mockResolvedValue({
      id: "user-2",
      email: "unverified@example.net",
      phone: null,
      demo: false,
    });
    hoisted.findDbCredentialByUserId.mockResolvedValue({
      id: "cred-2",
      userId: "user-2",
      email: "unverified@example.net",
      emailVerifiedAt: null,
    });

    const { requireVerifiedEmailForAction } = await import("./email-verification-enforcement");
    const response = await requireVerifiedEmailForAction({
      userId: "user-2",
      action: "submit_review",
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const json = await response?.json();
    expect(json).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      action: "submit_review",
    });
  });

  it("allows internal demo accounts in development", async () => {
    hoisted.findUnique.mockResolvedValue({
      id: "user-3",
      email: "e2e-smoke-customer@reliance.test",
      phone: null,
      demo: true,
    });
    hoisted.findDbCredentialByUserId.mockResolvedValue(null);

    const { requireVerifiedEmailForAction } = await import("./email-verification-enforcement");
    const result = await requireVerifiedEmailForAction({
      userId: "user-3",
      action: "create_booking",
    });

    expect(result).toBeNull();
  });
});
