import {
  isUnclaimedBookingUserEmail,
  markCustomerBookingClaimed,
  parseCustomerBookingClaimMetadata,
  validateCustomerBookingClaim,
} from "@/lib/customer-booking-claim";

export type CustomerBookingClaimVerification =
  | "VERIFIED_ACCOUNT"
  | "REGISTRATION_CLAIM_TOKEN";

export class CustomerBookingClaimError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CustomerBookingClaimError";
  }
}

function claimError(code: string, message: string, status = 409): never {
  throw new CustomerBookingClaimError(code, message, status);
}

async function validateActiveGrantBinding(
  tx: any,
  input: {
    bookingId: string;
    bookingUserId: string;
    customerUserId: string;
  },
) {
  const grants = await tx.privateProofAccessGrant.findMany({
    where: { bookingId: input.bookingId, status: "ACTIVE", revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  if (grants.length > 1) {
    claimError(
      "PRIVATE_PROOF_GRANT_CONFLICT",
      "This Private Proof has conflicting active access evidence.",
    );
  }
  const grant = grants[0] || null;
  const currentPackage = await tx.serviceVideoPackageEvidence.findFirst({
    where: { bookingId: input.bookingId, isCurrent: true },
  });
  if (!grant) {
    if (String(currentPackage?.status || "").toUpperCase() === "PRIVATE_APPROVED") {
      claimError(
        "PRIVATE_PROOF_GRANT_MISSING",
        "This approved Private Proof has no active access grant.",
      );
    }
    return null;
  }

  if (
    grant.customerUserId !== input.bookingUserId &&
    grant.customerUserId !== input.customerUserId
  ) {
    const staleGrantOwner =
      input.bookingUserId === input.customerUserId
        ? await tx.user.findUnique({
            where: { id: grant.customerUserId },
            select: { email: true },
          })
        : null;
    if (!isUnclaimedBookingUserEmail(staleGrantOwner?.email)) {
      claimError(
        "PRIVATE_PROOF_GRANT_OWNER_CONFLICT",
        "This Private Proof is already connected to another customer account.",
        403,
      );
    }
  }
  const pkg = await tx.serviceVideoPackageEvidence.findFirst({
    where: {
      id: grant.packageId,
      bookingId: input.bookingId,
      isCurrent: true,
      status: "PRIVATE_APPROVED",
      managerDecisionId: grant.managerDecisionId,
      customerAccessGrantId: grant.id,
    },
  });
  if (!pkg || currentPackage?.id !== pkg.id) {
    claimError(
      "PRIVATE_PROOF_PACKAGE_BINDING_INVALID",
      "The Private Proof grant does not match the current approved package.",
    );
  }
  if (grant.adminAuditDecisionId || pkg.adminAuditDecisionId) {
    if (
      !grant.adminAuditDecisionId ||
      pkg.adminAuditDecisionId !== grant.adminAuditDecisionId
    ) {
      claimError(
        "PRIVATE_PROOF_ADMIN_BINDING_INVALID",
        "The Private Proof grant does not match its Reliance Audit decision.",
      );
    }
    const auditDecision = await tx.serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: {
        id: grant.adminAuditDecisionId,
        bookingId: input.bookingId,
        packageId: pkg.id,
        managerDecisionId: grant.managerDecisionId,
        packageHash: pkg.packageHash,
        decision: "PASS",
        customerProofReleased: true,
        customerAccessGrantId: grant.id,
      },
      select: { id: true },
    });
    if (!auditDecision) {
      claimError(
        "PRIVATE_PROOF_ADMIN_BINDING_INVALID",
        "The Private Proof grant does not match its Reliance Audit decision.",
      );
    }
  }
  return grant;
}

/** Runs inside the caller's serializable transaction. */
export async function claimCustomerBookingWithinTransaction(input: {
  tx: any;
  bookingId: string;
  customerUserId: string;
  claimToken?: string;
  verification: CustomerBookingClaimVerification;
  now?: Date;
}) {
  const now = input.now || new Date();
  const account = await input.tx.user.findUnique({
    where: { id: input.customerUserId },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      authCredential: { select: { email: true, emailVerifiedAt: true } },
      memberships: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
      platformRoleGrants: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!account?.email || String(account.accountStatus || "active").toLowerCase() !== "active") {
    claimError(
      "CLAIM_ACCOUNT_UNAVAILABLE",
      "The customer account is not available for this Private Proof.",
      403,
    );
  }
  if (account.memberships?.length || account.platformRoleGrants?.length) {
    claimError(
      "CLAIM_CUSTOMER_ACCOUNT_REQUIRED",
      "Sign in with the customer account that received this Private Proof.",
      403,
    );
  }
  if (
    input.verification === "VERIFIED_ACCOUNT" &&
    (!account.authCredential?.emailVerifiedAt ||
      String(account.authCredential.email || "").trim().toLowerCase() !==
        String(account.email).trim().toLowerCase())
  ) {
    claimError(
      "CLAIM_ACCOUNT_EMAIL_UNVERIFIED",
      "Verify the customer account email before opening this Private Proof.",
      403,
    );
  }

  const booking = await input.tx.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      userId: true,
      customerMetadata: true,
      user: { select: { email: true } },
    },
  });
  if (!booking) {
    claimError("CUSTOMER_BOOKING_CLAIM_NOT_FOUND", "Service record not found", 404);
  }
  const currentConsent = await input.tx.consentRecord.findFirst({
    where: {
      bookingId: input.bookingId,
      isCurrent: true,
      supersededAt: null,
      recipientMismatch: false,
      verifiedDecision: true,
      lifecycleStatus: "ALLOWED",
    },
    orderBy: [{ generation: "desc" }, { createdAt: "desc" }],
    select: { recipientEmailHash: true },
  });
  const metadata = parseCustomerBookingClaimMetadata(booking.customerMetadata);
  if (
    input.verification === "REGISTRATION_CLAIM_TOKEN" &&
    !String(metadata.customer_booking_claim_token_hash || "").trim()
  ) {
    claimError(
      "CLAIM_TOKEN_REQUIRED",
      "Open the Private Proof link from the email that Reliance sent you.",
      403,
    );
  }
  const validation = validateCustomerBookingClaim({
    metadata,
    bookingUserEmail: booking.user?.email,
    bookingUserId: booking.userId,
    accountEmail: account.email,
    restorableUserId:
      booking.userId === input.customerUserId ? input.customerUserId : null,
    claimToken: input.claimToken,
    currentRecipientEmailHash: currentConsent?.recipientEmailHash,
    now,
  });
  if (!validation.ok) {
    claimError(
      validation.code,
      validation.error,
      validation.code === "BOOKING_ALREADY_CLAIMED" ? 409 : 403,
    );
  }

  const grant = await validateActiveGrantBinding(input.tx, {
    bookingId: booking.id,
    bookingUserId: booking.userId,
    customerUserId: input.customerUserId,
  });
  const alreadyConnected = booking.userId === input.customerUserId;
  let bookingChanged = false;
  if (!alreadyConnected) {
    const claimed = await input.tx.booking.updateMany({
      where: { id: booking.id, userId: booking.userId },
      data: {
        userId: input.customerUserId,
        customerMetadata: JSON.stringify(
          markCustomerBookingClaimed(metadata, input.customerUserId, now),
        ),
      },
    });
    if (claimed.count !== 1) {
      claimError(
        "BOOKING_CLAIM_CONFLICT",
        "This service record changed while it was being connected. Refresh and try again.",
      );
    }
    bookingChanged = true;
  }

  let grantChanged = false;
  if (grant && grant.customerUserId !== input.customerUserId) {
    const rebound = await input.tx.privateProofAccessGrant.updateMany({
      where: {
        id: grant.id,
        bookingId: booking.id,
        packageId: grant.packageId,
        customerUserId: grant.customerUserId,
        status: "ACTIVE",
        revokedAt: null,
      },
      data: { customerUserId: input.customerUserId },
    });
    if (rebound.count !== 1) {
      claimError(
        "PRIVATE_PROOF_GRANT_REBIND_CONFLICT",
        "This Private Proof changed while it was being connected. Refresh and try again.",
      );
    }
    grantChanged = true;
  }

  if (bookingChanged || grantChanged) {
    await input.tx.adminAuditLog.create({
      data: {
        actionType: "customer_private_proof_claim_rebound",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: input.customerUserId,
        previousValue: JSON.stringify({
          bookingCustomerUserId: booking.userId,
          grantCustomerUserId: grant?.customerUserId || null,
        }),
        newValue: JSON.stringify({
          bookingCustomerUserId: input.customerUserId,
          grantCustomerUserId: grant ? input.customerUserId : null,
        }),
        metadata: JSON.stringify({
          verification: input.verification,
          grantId: grant?.id || null,
          packageId: grant?.packageId || null,
          bookingChanged,
          grantChanged,
        }),
      },
    });
  }

  return {
    bookingId: booking.id,
    grantId: grant?.id || null,
    packageId: grant?.packageId || null,
    claimed: bookingChanged,
    grantRebound: grantChanged,
    alreadyConnected: !bookingChanged && !grantChanged,
  };
}

export async function claimCustomerBooking(input: {
  prisma: any;
  bookingId: string;
  customerUserId: string;
  claimToken?: string;
  verification?: CustomerBookingClaimVerification;
  now?: Date;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await input.prisma.$transaction(
        (tx: any) =>
          claimCustomerBookingWithinTransaction({
            tx,
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            claimToken: input.claimToken,
            verification: input.verification || "VERIFIED_ACCOUNT",
            now: input.now,
          }),
        { isolationLevel: "Serializable" },
      );
    } catch (error: any) {
      const retryable =
        error?.code === "P2034" ||
        (error instanceof CustomerBookingClaimError &&
          error.code === "BOOKING_CLAIM_CONFLICT");
      if (!retryable || attempt === 1) throw error;
    }
  }
  throw new CustomerBookingClaimError(
    "BOOKING_CLAIM_CONFLICT",
    "This service record changed while it was being connected. Refresh and try again.",
    409,
  );
}
