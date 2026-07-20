import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const updateMany = vi.fn();
  const create = vi.fn();
  const findFirst = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) =>
    callback({
      authMfaChallenge: {
        updateMany,
        create,
        findUnique,
        update,
      },
    })
  );
  const sendEmail = vi.fn();
  return {
    prisma: {
      $transaction: transaction,
      authMfaChallenge: {
        findFirst,
        update,
      },
    },
    updateMany,
    create,
    findFirst,
    findUnique,
    update,
    transaction,
    sendEmail,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: hoisted.sendEmail,
}));

describe("auth-mfa", () => {
  beforeEach(() => {
    hoisted.updateMany.mockReset();
    hoisted.create.mockReset();
    hoisted.findFirst.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.update.mockReset();
    hoisted.transaction.mockClear();
    hoisted.sendEmail.mockReset();
    delete (globalThis as any).__relianceDevMfaChallenges;
    const devStorePath = path.join(process.cwd(), "tmp", "auth-mfa-dev.json");
    if (fs.existsSync(devStorePath)) {
      fs.rmSync(devStorePath, { force: true });
    }
  });

  it("requires MFA for vendor/admin profiles only", async () => {
    const { requiresLoginMfa } = await import("./auth-mfa");
    expect(requiresLoginMfa(["customer"])).toBe(false);
    expect(requiresLoginMfa(["vendor"])).toBe(true);
    expect(requiresLoginMfa(["admin"])).toBe(true);
    expect(requiresLoginMfa(["customer", "vendor"])).toBe(true);
  });

  it("issues a login challenge and sends email", async () => {
    const { issueLoginMfaChallenge } = await import("./auth-mfa");
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({
      id: "challenge-1",
      userId: "user-1",
      email: "vendor@example.net",
      expiresAt: new Date(Date.now() + 60_000),
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg-1" });

    const result = await issueLoginMfaChallenge({
      credentialId: "cred-1",
      userId: "user-1",
      email: "vendor@example.net",
      recipientName: "Vendor User",
      baseUrl: "http://localhost:3000",
    });

    expect(hoisted.updateMany).toHaveBeenCalledTimes(1);
    expect(hoisted.create).toHaveBeenCalledTimes(1);
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(result.challengeId).toBe("challenge-1");
    expect(result.codePreview).toMatch(/^\d{6}$/);
  });

  it("reuses a very recent login challenge without sending a duplicate code email", async () => {
    const { issueLoginMfaChallenge } = await import("./auth-mfa");
    const expiresAt = new Date(Date.now() + 60_000);
    hoisted.findFirst.mockResolvedValue({
      id: "challenge-reuse",
      expiresAt,
    });

    const result = await issueLoginMfaChallenge({
      credentialId: "cred-1",
      userId: "user-1",
      email: "vendor@example.net",
      recipientName: "Vendor User",
      baseUrl: "http://localhost:3000",
    });

    expect(result).toMatchObject({
      challengeId: "challenge-reuse",
      reused: true,
    });
    expect(hoisted.updateMany).not.toHaveBeenCalled();
    expect(hoisted.create).not.toHaveBeenCalled();
    expect(hoisted.sendEmail).not.toHaveBeenCalled();
  });

  it("invalidates a challenge when the email provider rejects delivery", async () => {
    const { issueLoginMfaChallenge } = await import("./auth-mfa");
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({
      id: "challenge-undelivered",
      userId: "user-1",
      email: "vendor@example.net",
      expiresAt: new Date(Date.now() + 60_000),
    });
    hoisted.sendEmail.mockResolvedValue({
      ok: false,
      errorMessage: "API key is invalid",
    });

    const result = await issueLoginMfaChallenge({
      credentialId: "cred-1",
      userId: "user-1",
      email: "vendor@example.net",
      baseUrl: "http://localhost:3000",
    });

    expect(result.sendResult).toMatchObject({ ok: false });
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: "challenge-undelivered" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("verifies a valid code and rejects reused challenges", async () => {
    const { issueLoginMfaChallenge, verifyLoginMfaChallenge } = await import("./auth-mfa");
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({
      id: "challenge-2",
      userId: "user-2",
      email: "admin@example.net",
      expiresAt: new Date(Date.now() + 60_000),
    });
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg-2" });
    const issued = await issueLoginMfaChallenge({
      credentialId: "cred-2",
      userId: "user-2",
      email: "admin@example.net",
      baseUrl: "http://localhost:3000",
    });

    hoisted.findUnique.mockResolvedValueOnce({
      id: "challenge-2",
      userId: "user-2",
      email: "admin@example.net",
      codeHash: crypto.createHash("sha256").update(issued.codePreview!).digest("hex"),
      purpose: "login",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    const okResult = await verifyLoginMfaChallenge({
      challengeId: "challenge-2",
      code: issued.codePreview!,
    });
    expect(okResult.ok).toBe(true);

    hoisted.findUnique.mockResolvedValueOnce({
      id: "challenge-2",
      userId: "user-2",
      email: "admin@example.net",
      codeHash: crypto.createHash("sha256").update(issued.codePreview!).digest("hex"),
      purpose: "login",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    });
    const reused = await verifyLoginMfaChallenge({
      challengeId: "challenge-2",
      code: issued.codePreview!,
    });
    expect(reused).toMatchObject({ ok: false, reason: "already_used" });
  });

  it("falls back to the local dev challenge store when Prisma is unavailable", async () => {
    hoisted.findFirst.mockRejectedValue(new Error("db unavailable"));
    hoisted.transaction.mockRejectedValue(new Error("db unavailable"));
    const { issueLoginMfaChallenge, verifyLoginMfaChallenge } = await import("./auth-mfa");
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg-dev" });

    const issued = await issueLoginMfaChallenge({
      credentialId: "cred-dev",
      userId: "user-dev",
      email: "admin@example.net",
      recipientName: "Admin User",
      baseUrl: "http://localhost:3000",
      userSnapshot: {
        name: "Admin User",
        email: "admin@example.net",
        userType: "admin",
        availableProfiles: ["admin"],
        emailVerified: false,
        emailVerifiedAt: null,
      },
    });

    const verified = await verifyLoginMfaChallenge({
      challengeId: issued.challengeId,
      code: issued.codePreview!,
    });

    expect(issued.challengeId).toBeTruthy();
    expect(verified).toMatchObject({
      ok: true,
      userId: "user-dev",
      email: "admin@example.net",
      userSnapshot: {
        name: "Admin User",
        availableProfiles: ["admin"],
      },
    });
  });
});
