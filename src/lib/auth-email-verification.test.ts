import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const tokenUpdateMany = vi.fn();
  const create = vi.fn();
  const findUnique = vi.fn();
  const authCredentialFindUnique = vi.fn();
  const authCredentialUpdateMany = vi.fn();
  const registrationEvidenceUpdateMany = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) =>
    callback({
      emailVerificationToken: {
        updateMany: tokenUpdateMany,
        create,
        findUnique,
      },
      authCredential: {
        findUnique: authCredentialFindUnique,
        updateMany: authCredentialUpdateMany,
      },
      customerRegistrationEvidence: {
        updateMany: registrationEvidenceUpdateMany,
      },
    })
  );

  const sendEmail = vi.fn();

  return {
    prisma: {
      $transaction: transaction,
    },
    tokenUpdateMany,
    create,
    findUnique,
    authCredentialFindUnique,
    authCredentialUpdateMany,
    registrationEvidenceUpdateMany,
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
    hoisted.tokenUpdateMany.mockReset();
    hoisted.create.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.authCredentialFindUnique.mockReset();
    hoisted.authCredentialUpdateMany.mockReset();
    hoisted.registrationEvidenceUpdateMany.mockReset();
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
    expect(hoisted.tokenUpdateMany).toHaveBeenCalledTimes(1);
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
    hoisted.authCredentialFindUnique.mockResolvedValue({
      id: "cred-2",
      userId: "user-2",
      email: "verify@example.com",
      emailVerifiedAt: null,
    });
    hoisted.tokenUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.authCredentialUpdateMany.mockResolvedValue({ count: 1 });

    const result = await consumeEmailVerificationToken(issued.rawToken);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credential.email).toBe("verify@example.com");
    }
    expect(hoisted.tokenUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(hoisted.authCredentialUpdateMany).toHaveBeenCalledTimes(1);
    expect(hoisted.registrationEvidenceUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-2",
        verificationMethod: "EMAIL_VERIFICATION_LINK",
        verificationCompletedAt: null,
      },
      data: { verificationCompletedAt: expect.any(Date) },
    });
    expect(hoisted.transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });

  it("rejects a token issued for a previous credential email", async () => {
    const { consumeEmailVerificationToken } = await import("./auth-email-verification");
    hoisted.findUnique.mockResolvedValue({
      id: "token-row-stale",
      credentialId: "cred-2",
      email: "old@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    hoisted.authCredentialFindUnique.mockResolvedValue({
      id: "cred-2",
      userId: "user-2",
      email: "new@example.com",
      emailVerifiedAt: null,
    });

    await expect(consumeEmailVerificationToken("stale-token")).resolves.toEqual({
      ok: false,
      reason: "email_changed",
    });
    expect(hoisted.tokenUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.authCredentialUpdateMany).not.toHaveBeenCalled();
    expect(hoisted.registrationEvidenceUpdateMany).not.toHaveBeenCalled();
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
      nextPath: "/my-bookings/booking-1?videoReady=1&claimToken=claim-1",
    });

    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    expect(hoisted.sendEmail.mock.calls[0][0].subject).toContain("Welcome to Reliance");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("reliance-email-logo.png");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("background:#050a12");
    expect(hoisted.sendEmail.mock.calls[0][0].html).toContain("Finish setting up your customer account");
    expect(result.sendResult.ok).toBe(true);
    expect(result.verificationLink).toContain("/auth/verify-email?token=");
    expect(result.verificationLink).toContain(
      "next=%2Fmy-bookings%2Fbooking-1%3FvideoReady%3D1%26claimToken%3Dclaim-1"
    );
    expect(result.verificationTokenPreview).toMatch(/^[a-f0-9]{64}$/);
  });

  it("replaces an internal request origin with the configured public email host", async () => {
    vi.stubEnv("APP_BASE_URL", "https://beta.relianceonline.org");
    hoisted.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg-public-host" });

    try {
      const { sendOrPreviewEmailVerification } = await import("./auth-email-verification");
      const result = await sendOrPreviewEmailVerification({
        email: "notify@example.com",
        credentialId: "cred-public-host",
        recipientName: "Notify User",
        baseUrl: "https://4a63f37da1dd:8080",
      });

      expect(result.verificationLink).toMatch(
        /^https:\/\/beta\.relianceonline\.org\/auth\/verify-email\?token=/
      );
      expect(result.verificationLink).not.toContain("4a63f37da1dd");
      expect(hoisted.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(
            "https://beta.relianceonline.org/auth/verify-email?token="
          ),
          text: expect.stringContaining(
            "https://beta.relianceonline.org/auth/verify-email?token="
          ),
        })
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
