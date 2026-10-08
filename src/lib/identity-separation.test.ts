import { describe, expect, it, vi } from "vitest";
import { moveEmployeeCredentialEmailForIdentitySeparation } from "./identity-separation";

function makeDb(overrides: Record<string, unknown> = {}) {
  const state = {
    userEmail: "old@example.com",
    credentialEmail: "old@example.com",
    verifiedAt: new Date("2026-01-01T00:00:00.000Z") as Date | null,
  };
  const tx: any = {
    user: {
      findUnique: vi.fn(async () => ({
        id: "user-1",
        name: "Bradley Coopers",
        email: state.userEmail,
        accountStatus: "active",
      })),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async (args) => {
        if (args.where.id === "user-1" && args.where.email === state.userEmail) {
          state.userEmail = args.data.email;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    authCredential: {
      findUnique: vi.fn(async () => ({
        id: "cred-1",
        userId: "user-1",
        email: state.credentialEmail,
        emailVerifiedAt: state.verifiedAt,
      })),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async (args) => {
        if (args.where.id === "cred-1" && args.where.email === state.credentialEmail) {
          state.credentialEmail = args.data.email;
          state.verifiedAt = args.data.emailVerifiedAt;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    vendorMembership: { count: vi.fn(async () => 2) },
    platformRoleGrant: {
      findUnique: vi.fn(async () => ({
        id: "grant-1",
        userId: "user-1",
        role: "ADMIN",
        status: "ACTIVE",
      })),
    },
    authTrustedDevice: {
      count: vi.fn(async () => 2),
      updateMany: vi.fn(async () => ({ count: 2 })),
    },
    authMfaChallenge: {
      count: vi.fn(async () => 1),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    emailVerificationToken: {
      count: vi.fn(async () => 1),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    authPasskeyChallenge: {
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    employeeDecisionVerificationChallenge: { count: vi.fn(async () => 0) },
    employeeVerifiedDecisionSession: { count: vi.fn(async () => 0) },
    ...overrides,
  };
  const db: any = {
    $transaction: vi.fn(async (callback, options) => callback(tx, options)),
  };
  return { db, tx, state };
}

const input = {
  userId: "user-1",
  credentialId: "cred-1",
  expectedUserName: "Bradley Coopers",
  expectedCurrentEmail: "old@example.com",
  nextEmail: "new+bradley@example.com",
  expectedAdminGrantId: "grant-1",
  expectedActiveMembershipCount: 2,
  now: new Date("2026-10-08T01:00:00.000Z"),
};

describe("identity separation email move", () => {
  it("moves both current emails atomically and revokes only active auth state", async () => {
    const { db, tx, state } = makeDb();
    const result = await moveEmployeeCredentialEmailForIdentitySeparation({ db, input });

    expect(result).toMatchObject({
      idempotent: false,
      email: "new+bradley@example.com",
      revoked: {
        trustedDevices: 2,
        mfaChallenges: 1,
        emailVerificationTokens: 1,
        passkeyChallenges: 0,
      },
    });
    expect(state).toEqual({
      userEmail: "new+bradley@example.com",
      credentialEmail: "new+bradley@example.com",
      verifiedAt: null,
    });
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
    expect(tx.authTrustedDevice.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        credentialId: "cred-1",
        userId: "user-1",
        revokedAt: null,
      }),
      data: { revokedAt: input.now },
    });
  });

  it("fails before writes when the target email belongs to another identity", async () => {
    const { db, tx } = makeDb();
    tx.user.findFirst.mockResolvedValue({ id: "other-user" });

    await expect(
      moveEmployeeCredentialEmailForIdentitySeparation({ db, input })
    ).rejects.toThrow("IDENTITY_SEPARATION_TARGET_EMAIL_IN_USE");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.authCredential.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed when active Employee verification authority exists", async () => {
    const { db, tx } = makeDb();
    tx.employeeVerifiedDecisionSession.count.mockResolvedValue(1);

    await expect(
      moveEmployeeCredentialEmailForIdentitySeparation({ db, input })
    ).rejects.toThrow("IDENTITY_SEPARATION_ACTIVE_EMPLOYEE_VERIFICATION_STATE");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed when either current email no longer matches the approved source", async () => {
    const { db, tx } = makeDb();
    tx.authCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      userId: "user-1",
      email: "unexpected@example.com",
      emailVerifiedAt: new Date(),
    });

    await expect(
      moveEmployeeCredentialEmailForIdentitySeparation({ db, input })
    ).rejects.toThrow("IDENTITY_SEPARATION_CURRENT_EMAIL_PREDICATE_FAILED");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
