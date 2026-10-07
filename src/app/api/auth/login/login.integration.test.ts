import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { resolveVendorAccessForUser } from "@/lib/vendor-context";

const hoisted = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const platformRoleGrantFindMany = vi.fn();
  const findDbCredentialByEmail = vi.fn();
  const upsertDbCredential = vi.fn();
  const findRegisteredUserByEmail = vi.fn();
  const addRegisteredUser = vi.fn();
  const issueLoginMfaChallenge = vi.fn();
  const resolveTrustedDeviceUserIdFromRequest = vi.fn();
  return {
    prisma: {
      user: { findUnique: userFindUnique },
      platformRoleGrant: { findMany: platformRoleGrantFindMany },
    },
    userFindUnique,
    platformRoleGrantFindMany,
    findDbCredentialByEmail,
    upsertDbCredential,
    findRegisteredUserByEmail,
    addRegisteredUser,
    issueLoginMfaChallenge,
    resolveTrustedDeviceUserIdFromRequest,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/auth-credentials", () => ({
  findDbCredentialByEmail: hoisted.findDbCredentialByEmail,
  upsertDbCredential: hoisted.upsertDbCredential,
}));

vi.mock("@/lib/dev-registered-users", () => ({
  registeredUsers: [],
  findRegisteredUserByEmail: hoisted.findRegisteredUserByEmail,
  addRegisteredUser: hoisted.addRegisteredUser,
}));

vi.mock("@/lib/vendor-context", () => ({
  resolveVendorAccessForUser: vi.fn(),
}));

vi.mock("@/lib/auth-mfa", () => ({
  issueLoginMfaChallenge: hoisted.issueLoginMfaChallenge,
  resolveTrustedDeviceUserIdFromRequest: hoisted.resolveTrustedDeviceUserIdFromRequest,
  requiresLoginMfa: (profiles: string[]) =>
    profiles.includes("vendor") || profiles.includes("admin"),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("POST /api/auth/login account status", () => {
  beforeEach(() => {
    hoisted.userFindUnique.mockReset();
    hoisted.platformRoleGrantFindMany.mockReset();
    hoisted.platformRoleGrantFindMany.mockResolvedValue([]);
    hoisted.findDbCredentialByEmail.mockReset();
    hoisted.upsertDbCredential.mockReset();
    hoisted.findRegisteredUserByEmail.mockReset();
    hoisted.addRegisteredUser.mockReset();
    hoisted.issueLoginMfaChallenge.mockReset();
    hoisted.resolveTrustedDeviceUserIdFromRequest.mockReset();
    hoisted.resolveTrustedDeviceUserIdFromRequest.mockResolvedValue(null);
    vi.mocked(resolveVendorAccessForUser).mockReset();
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "NONE",
      userId: "user-1",
      vendorId: null,
      membershipId: null,
      membershipStatus: null,
      accountStatus: null,
      restrictedAccountType: null,
      role: null,
      businessName: null,
    });
    hoisted.findRegisteredUserByEmail.mockReturnValue({
      id: "user-1",
      email: "test-user@example.com",
      password: "Password123!",
      userType: "customer",
    });
    hoisted.findDbCredentialByEmail.mockResolvedValue({
      id: "cred-1",
      userId: "user-1",
      email: "test-user@example.com",
      passwordHash: "Password123!",
      emailVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
      passwordUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    hoisted.upsertDbCredential.mockResolvedValue({
      id: "cred-1",
      email: "test-user@example.com",
    });
  });

  it("blocks a suspended user from signing in", async () => {
    hoisted.userFindUnique.mockResolvedValue({
      id: "user-1",
      accountStatus: "suspended",
      email: "test-user@example.com",
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test-user@example.com",
          password: "Password123!",
        }),
      }) as any
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      code: "USER_ACCOUNT_RESTRICTED",
      accountStatus: "suspended",
    });
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });

  it("blocks an unverified email from signing in", async () => {
    hoisted.userFindUnique.mockResolvedValue({
      id: "user-1",
      accountStatus: "active",
      email: "test-user@example.com",
      phone: null,
      demo: false,
    });
    hoisted.findDbCredentialByEmail.mockResolvedValue({
      id: "cred-1",
      userId: "user-1",
      email: "test-user@example.com",
      passwordHash: "Password123!",
      emailVerifiedAt: null,
      passwordUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test-user@example.com",
          password: "Password123!",
        }),
      }) as any
    );

    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      email: "test-user@example.com",
    });
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });

  it("does not claim an MFA code was sent when email delivery fails", async () => {
    hoisted.findRegisteredUserByEmail.mockReturnValue({
      id: "user-1",
      email: "test-user@example.com",
      password: "Password123!",
      userType: "vendor",
    });
    hoisted.userFindUnique.mockResolvedValue({
      id: "user-1",
      accountStatus: "active",
      name: "Vendor User",
      email: "test-user@example.com",
      phone: null,
      profilePhoto: null,
      demo: false,
    });
    vi.mocked(resolveVendorAccessForUser).mockResolvedValue({
      state: "ACTIVE",
      userId: "user-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      membershipStatus: "active",
      accountStatus: "active",
      restrictedAccountType: null,
      role: "owner",
      businessName: "Vendor Business",
    });
    hoisted.issueLoginMfaChallenge.mockResolvedValue({
      challengeId: "challenge-1",
      expiresAt: new Date(Date.now() + 60_000),
      reused: false,
      sendResult: {
        ok: false,
        errorMessage: "API key is invalid",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test-user@example.com",
          password: "Password123!",
        }),
      })
    );

    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json).toMatchObject({
      code: "MFA_EMAIL_DELIVERY_FAILED",
    });
  });

  it("binds login to the credential User for identity-specific mailbox aliases", async () => {
    hoisted.findRegisteredUserByEmail.mockReturnValue({
      id: "employee-user",
      email: "owner+reliance-admin-beta@gmail.com",
      password: "Password123!",
      userType: "vendor",
    });
    hoisted.findDbCredentialByEmail.mockResolvedValue({
      id: "admin-credential",
      userId: "admin-user",
      email: "owner+reliance-admin-beta@gmail.com",
      passwordHash: "Password123!",
      emailVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
      passwordUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    hoisted.userFindUnique.mockResolvedValue({
      id: "admin-user",
      accountStatus: "active",
      name: "Reliance Beta Admin",
      email: "owner+reliance-admin-beta@gmail.com",
      phone: null,
      profilePhoto: null,
      demo: true,
    });
    hoisted.platformRoleGrantFindMany.mockResolvedValue([{ role: "ADMIN" }]);
    hoisted.issueLoginMfaChallenge.mockResolvedValue({
      challengeId: "challenge-admin",
      expiresAt: new Date(Date.now() + 60_000),
      reused: false,
      sendResult: { ok: true },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "owner+reliance-admin-beta@gmail.com",
          password: "Password123!",
        }),
      })
    );

    expect(res.status).toBe(202);
    expect(hoisted.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "admin-user" } })
    );
    expect(hoisted.platformRoleGrantFindMany).toHaveBeenCalledWith({
      where: { userId: "admin-user", status: "ACTIVE" },
      select: { role: true },
    });
    expect(hoisted.upsertDbCredential).not.toHaveBeenCalled();
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });

  it("fails closed when the credential User cannot be loaded", async () => {
    hoisted.userFindUnique.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test-user@example.com",
          password: "Password123!",
        }),
      }) as any
    );

    expect(res.status).toBe(503);
    expect(await readJson(res)).toMatchObject({
      code: "AUTH_CREDENTIAL_PRINCIPAL_INCONSISTENT",
    });
    expect(hoisted.upsertDbCredential).not.toHaveBeenCalled();
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });

  it("fails closed when credential and User email identities disagree", async () => {
    hoisted.userFindUnique.mockResolvedValue({
      id: "user-1",
      accountStatus: "active",
      name: "Unexpected Identity",
      email: "different@example.com",
      phone: null,
      profilePhoto: null,
      demo: false,
    });

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test-user@example.com",
          password: "Password123!",
        }),
      }) as any
    );

    expect(res.status).toBe(503);
    expect(await readJson(res)).toMatchObject({
      code: "AUTH_CREDENTIAL_PRINCIPAL_INCONSISTENT",
    });
    expect(hoisted.upsertDbCredential).not.toHaveBeenCalled();
    expect(resolveVendorAccessForUser).not.toHaveBeenCalled();
  });
});
