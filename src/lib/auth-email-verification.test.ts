import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const updateMany = vi.fn();
  const create = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const authCredentialUpdate = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) =>
    callback({
      emailVerificationToken: {
        updateMany,
        create,
        findUnique,
        update,
      },
      authCredential: {
        update: authCredentialUpdate,
      },
    })
  );

  const sendEmail = vi.fn();

  return {
    prisma: {
      $transaction: transaction,
    },
    updateMany,
    create,
    findUnique,
    update,
    authCredentialUpdate,
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

describe("auth email verification", () => {
  beforeEach(() => {
    hoisted.updateMany.mockReset();
    hoisted.create.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.update.mockReset();
    hoisted.authCredentialUpdate.mockReset();
    hoisted.transaction.mockClear();
    hoisted.sendEmail.mockReset();
  });

  it("issues a token and stores it in the database transaction", async () => {
    const { issueEmailVerificationToken } = await import("./auth-email-verification");

    const result = await issueEmailVerificationToken({
      credentialId: "cred-1",
      email: "TEST@Example.com",
      ttlMs: 60_000,
    });

    expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(hoisted.updateMany).toHaveBeenCalledTimes(1);
    expect(hoisted.create).toHaveBeenCalledTimes(1);
    expect(hoisted.create.mock.calls[0][0].data).toMatchObject({
      credentialId: "cred-1",
      email: "test@example.com",
    });
    expect(hoisted.create.mock.calls[0][0].data.tokenHash).not.toBe(result.rawToken);
  });

  it("consumes a valid token and marks the credential verified", async () => {
    const { consumeEmailVerificationToken, issueEmailVerificationToken } = await import(
      "./auth-email-verification"
    );

    const issued = await issueEmailVerificationToken({
      credentialId: "cred-2",
      email: "verify@example.com",
    });

    hoisted.findUnique.mockResolvedValue({
      id: "token-row-1",
      credentialId: "cred-2",
      email: "verify@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    hoisted.authCredentialUpdate.mockResolvedValue({
      id: "cred-2",
      userId: "user-2",
      email: "verify@example.com",
      emailVerifiedAt: new Date(),
    });

    const result = await consumeEmailVerificationToken(issued.rawToken);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credential.email).toBe("verify@example.com");
    }
    expect(hoisted.update).toHaveBeenCalledTimes(1);
    expect(hoisted.authCredentialUpdate).toHaveBeenCalledTimes(1);
  });

  it("sends a verification email and returns a preview link in development", async () => {
    const { sendOrPreviewEmailVerification } = await import("./auth-email-verification");
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg-1" });

    const result = await sendOrPreviewEmailVerification({
      email: "notify@example.com",
      credentialId: "cred-3",
      recipientName: "Notify User",
      baseUrl: "http://localhost:3000",
      audience: "customer",
    });

    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendEmail.mock.calls[0][0].subject).toContain("Welcome to Reliance");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("reliance-email-logo.png");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("background:#050a12");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("Finish setting up your customer account");
    expect(result.sendResult.ok).toBe(true);
    expect(result.verificationLink).toContain("/auth/verify-email?token=");
    expect(result.verificationTokenPreview).toMatch(/^[a-f0-9]{64}$/);
  });
});
