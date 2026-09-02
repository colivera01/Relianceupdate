import { describe, expect, it, vi } from "vitest";
import { hashPermissionContact } from "@/lib/consent/recipient";
import { issueCustomerBookingClaimToken } from "./customer-booking-claim";
import {
  claimCustomerBooking,
  CustomerBookingClaimError,
} from "./customer-booking-claim-service";

function createState(input: {
  accountEmail?: string;
  verified?: boolean;
  currentRecipient?: string;
  bookingUserId?: string;
  grantUserId?: string;
  tokenExpiresAt?: Date;
} = {}) {
  const accountEmail = input.accountEmail || "current@example.com";
  const currentRecipient = input.currentRecipient || "current@example.com";
  const now = new Date("2026-09-01T12:00:00.000Z");
  const issued = issueCustomerBookingClaimToken(
    {
      client_email: currentRecipient,
      claim_contact_email: "historical@example.com",
    },
    now,
  );
  if (input.tokenExpiresAt) {
    issued.metadata.customer_booking_claim_token_expires_at =
      input.tokenExpiresAt.toISOString();
  }
  const state = {
    booking: {
      id: "booking-1",
      userId: input.bookingUserId || "placeholder-1",
      customerMetadata: JSON.stringify(issued.metadata),
      user: { email: "unclaimed+booking-1@reliance.local" },
    },
    grant: {
      id: "grant-1",
      packageId: "package-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      customerUserId: input.grantUserId || "placeholder-1",
      managerDecisionId: "manager-1",
      adminAuditDecisionId: "admin-pass-1",
      status: "ACTIVE",
      revokedAt: null,
      grantedAt: now,
    },
    package: {
      id: "package-1",
      bookingId: "booking-1",
      isCurrent: true,
      status: "PRIVATE_APPROVED",
      managerDecisionId: "manager-1",
      adminAuditDecisionId: "admin-pass-1",
      customerAccessGrantId: "grant-1",
      packageHash: "package-hash",
    },
  };
  const auditCreate = vi.fn(async () => ({ id: "claim-audit-1" }));
  const bookingUpdateMany = vi.fn(async (args: any) => {
    if (state.booking.userId !== args.where.userId) return { count: 0 };
    state.booking.userId = args.data.userId;
    state.booking.customerMetadata = args.data.customerMetadata;
    state.booking.user = { email: accountEmail };
    return { count: 1 };
  });
  const grantUpdateMany = vi.fn(async (args: any) => {
    if (state.grant.customerUserId !== args.where.customerUserId) return { count: 0 };
    state.grant.customerUserId = args.data.customerUserId;
    return { count: 1 };
  });
  const tx = {
    user: {
      findUnique: vi.fn(async (args: any) =>
        args.where.id === "customer-1"
          ? {
              id: "customer-1",
              email: accountEmail,
              accountStatus: "active",
              authCredential: {
                email: accountEmail,
                emailVerifiedAt: input.verified === false ? null : now,
              },
              memberships: [] as Array<{ id: string }>,
              platformRoleGrants: [] as Array<{ id: string }>,
            }
          : { email: "unclaimed+booking-1@reliance.local" },
      ),
    },
    booking: {
      findUnique: vi.fn(async () => ({ ...state.booking })),
      updateMany: bookingUpdateMany,
    },
    consentRecord: {
      findFirst: vi.fn(async () => ({
        recipientEmailHash: hashPermissionContact(currentRecipient),
      })),
    },
    privateProofAccessGrant: {
      findMany: vi.fn(async () => [{ ...state.grant }]),
      updateMany: grantUpdateMany,
    },
    serviceVideoPackageEvidence: {
      findFirst: vi.fn(async (args: any) => {
        if (args.where.id && args.where.id !== state.package.id) return null;
        return { ...state.package };
      }),
    },
    serviceVideoAdminAuditDecisionEvidence: {
      findFirst: vi.fn(async () => ({ id: "admin-pass-1" })),
    },
    adminAuditLog: { create: auditCreate },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: any) => unknown) => callback(tx)),
  };
  return {
    now,
    token: issued.rawToken,
    state,
    tx,
    prisma,
    auditCreate,
    bookingUpdateMany,
    grantUpdateMany,
  };
}

describe("customer Private Proof booking claim transaction", () => {
  it("uses the corrected recipient and atomically rebinds the same active grant", async () => {
    const fixture = createState();
    const result = await claimCustomerBooking({
      prisma: fixture.prisma,
      bookingId: "booking-1",
      customerUserId: "customer-1",
      claimToken: fixture.token,
      now: fixture.now,
    });

    expect(result).toMatchObject({
      bookingId: "booking-1",
      grantId: "grant-1",
      packageId: "package-1",
      claimed: true,
      grantRebound: true,
    });
    expect(fixture.state.booking.userId).toBe("customer-1");
    expect(fixture.state.grant).toMatchObject({
      id: "grant-1",
      packageId: "package-1",
      adminAuditDecisionId: "admin-pass-1",
      customerUserId: "customer-1",
    });
    expect(fixture.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(fixture.tx.consentRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isCurrent: true,
          verifiedDecision: true,
          lifecycleStatus: "ALLOWED",
          recipientMismatch: false,
        }),
      }),
    );
    expect(fixture.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "customer_private_proof_claim_rebound",
        entityId: "booking-1",
        actorUserId: "customer-1",
      }),
    });
    expect(fixture.tx.privateProofAccessGrant).not.toHaveProperty("create");
  });

  it("denies the stale historical recipient even with the valid link token", async () => {
    const fixture = createState({ accountEmail: "historical@example.com" });
    await expect(
      claimCustomerBooking({
        prisma: fixture.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: fixture.token,
        now: fixture.now,
      }),
    ).rejects.toMatchObject({ code: "CLAIM_EMAIL_MISMATCH" });
    expect(fixture.bookingUpdateMany).not.toHaveBeenCalled();
    expect(fixture.grantUpdateMany).not.toHaveBeenCalled();
  });

  it("is idempotent after the booking and grant already belong to the same customer", async () => {
    const fixture = createState({
      bookingUserId: "customer-1",
      grantUserId: "customer-1",
    });
    fixture.state.booking.user = { email: "current@example.com" };
    const result = await claimCustomerBooking({
      prisma: fixture.prisma,
      bookingId: "booking-1",
      customerUserId: "customer-1",
      claimToken: fixture.token,
      now: fixture.now,
    });
    expect(result).toMatchObject({ alreadyConnected: true, claimed: false, grantRebound: false });
    expect(fixture.bookingUpdateMany).not.toHaveBeenCalled();
    expect(fixture.grantUpdateMany).not.toHaveBeenCalled();
    expect(fixture.auditCreate).not.toHaveBeenCalled();
  });

  it("repairs an existing claimed booking whose original grant still points at the placeholder", async () => {
    const fixture = createState({
      bookingUserId: "customer-1",
      grantUserId: "placeholder-1",
    });
    fixture.state.booking.user = { email: "current@example.com" };
    const result = await claimCustomerBooking({
      prisma: fixture.prisma,
      bookingId: "booking-1",
      customerUserId: "customer-1",
      claimToken: fixture.token,
      now: fixture.now,
    });
    expect(result).toMatchObject({ claimed: false, grantRebound: true });
    expect(fixture.state.grant).toMatchObject({
      id: "grant-1",
      customerUserId: "customer-1",
    });
  });

  it("does not treat an unrelated grant owner as a repairable placeholder", async () => {
    const fixture = createState({
      bookingUserId: "customer-1",
      grantUserId: "unrelated-customer-1",
    });
    fixture.state.booking.user = { email: "current@example.com" };
    fixture.tx.user.findUnique.mockImplementation(async (args: any) =>
      args.where.id === "customer-1"
        ? {
            id: "customer-1",
            email: "current@example.com",
            accountStatus: "active",
            authCredential: {
              email: "current@example.com",
              emailVerifiedAt: fixture.now,
            },
            memberships: [],
            platformRoleGrants: [],
          }
        : { email: "unrelated@example.com" },
    );

    await expect(
      claimCustomerBooking({
        prisma: fixture.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: fixture.token,
        now: fixture.now,
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_PROOF_GRANT_OWNER_CONFLICT" });
    expect(fixture.grantUpdateMany).not.toHaveBeenCalled();
  });

  it("denies a role-bearing vendor account even if its email were supplied", async () => {
    const fixture = createState();
    fixture.tx.user.findUnique.mockResolvedValueOnce({
      id: "customer-1",
      email: "current@example.com",
      accountStatus: "active",
      authCredential: {
        email: "current@example.com",
        emailVerifiedAt: fixture.now,
      },
      memberships: [{ id: "membership-1" }],
      platformRoleGrants: [],
    });
    await expect(
      claimCustomerBooking({
        prisma: fixture.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: fixture.token,
        now: fixture.now,
      }),
    ).rejects.toMatchObject({ code: "CLAIM_CUSTOMER_ACCOUNT_REQUIRED" });
  });

  it("fails closed when the claim token is invalid or expired", async () => {
    const invalid = createState();
    await expect(
      claimCustomerBooking({
        prisma: invalid.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: "not-the-token",
        now: invalid.now,
      }),
    ).rejects.toMatchObject({ code: "CLAIM_TOKEN_INVALID" });

    const expired = createState({
      tokenExpiresAt: new Date("2026-08-31T12:00:00.000Z"),
    });
    await expect(
      claimCustomerBooking({
        prisma: expired.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: expired.token,
        now: expired.now,
      }),
    ).rejects.toMatchObject({ code: "CLAIM_TOKEN_EXPIRED" });
  });

  it("permits a new registration only with the recipient-bound claim token", async () => {
    const fixture = createState({ verified: false });
    const result = await claimCustomerBooking({
      prisma: fixture.prisma,
      bookingId: "booking-1",
      customerUserId: "customer-1",
      claimToken: fixture.token,
      verification: "REGISTRATION_CLAIM_TOKEN",
      now: fixture.now,
    });
    expect(result.claimed).toBe(true);

    const missingToken = createState({ verified: false });
    await expect(
      claimCustomerBooking({
        prisma: missingToken.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        verification: "REGISTRATION_CLAIM_TOKEN",
        now: missingToken.now,
      }),
    ).rejects.toBeInstanceOf(CustomerBookingClaimError);
  });

  it("retries once and fails both writes when the booking compare-and-set keeps losing a race", async () => {
    const fixture = createState();
    fixture.bookingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      claimCustomerBooking({
        prisma: fixture.prisma,
        bookingId: "booking-1",
        customerUserId: "customer-1",
        claimToken: fixture.token,
        now: fixture.now,
      }),
    ).rejects.toMatchObject({ code: "BOOKING_CLAIM_CONFLICT" });
    expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(fixture.grantUpdateMany).not.toHaveBeenCalled();
  });
});
