import crypto from "crypto";

const CLAIM_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type CustomerBookingClaimMetadata = Record<string, unknown>;

export type CustomerBookingClaimValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "CLAIM_EMAIL_MISMATCH"
        | "CLAIM_TOKEN_REQUIRED"
        | "CLAIM_TOKEN_INVALID"
        | "CLAIM_TOKEN_EXPIRED"
        | "BOOKING_ALREADY_CLAIMED";
      error: string;
    };

export function parseCustomerBookingClaimMetadata(
  value: string | null | undefined
): CustomerBookingClaimMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as CustomerBookingClaimMetadata)
      : {};
  } catch {
    return {};
  }
}

export function normalizeCustomerBookingClaimEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isUnclaimedBookingUserEmail(value: unknown): boolean {
  return normalizeCustomerBookingClaimEmail(value).endsWith("@reliance.local");
}

export function getCustomerBookingClaimContactEmail(
  metadata: CustomerBookingClaimMetadata
): string {
  return normalizeCustomerBookingClaimEmail(
    metadata.claim_contact_email || metadata.client_email
  );
}

export function hashCustomerBookingClaimToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

export function issueCustomerBookingClaimToken(
  metadata: CustomerBookingClaimMetadata,
  now = new Date()
): {
  rawToken: string;
  metadata: CustomerBookingClaimMetadata;
} {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);
  return {
    rawToken,
    metadata: {
      ...metadata,
      claim_status: "UNCLAIMED",
      customer_booking_claim_token_hash: hashCustomerBookingClaimToken(rawToken),
      customer_booking_claim_token_issued_at: now.toISOString(),
      customer_booking_claim_token_expires_at: expiresAt.toISOString(),
    },
  };
}

export function validateCustomerBookingClaim(input: {
  metadata: CustomerBookingClaimMetadata;
  bookingUserEmail: unknown;
  bookingUserId?: unknown;
  accountEmail: unknown;
  restorableUserId?: unknown;
  claimToken?: unknown;
  now?: Date;
}): CustomerBookingClaimValidation {
  const accountEmail = normalizeCustomerBookingClaimEmail(input.accountEmail);
  const contactEmail = getCustomerBookingClaimContactEmail(input.metadata);
  if (!accountEmail || !contactEmail || accountEmail !== contactEmail) {
    return {
      ok: false,
      code: "CLAIM_EMAIL_MISMATCH",
      error: "Use the customer email address that received this service-video link.",
    };
  }

  if (!isUnclaimedBookingUserEmail(input.bookingUserEmail)) {
    const bookingUserId = String(input.bookingUserId || "").trim();
    const restorableUserId = String(input.restorableUserId || "").trim();
    if (bookingUserId && restorableUserId && bookingUserId === restorableUserId) {
      return { ok: true };
    }
    return {
      ok: false,
      code: "BOOKING_ALREADY_CLAIMED",
      error: "This service record is already connected to a customer account.",
    };
  }

  const expectedHash = String(
    input.metadata.customer_booking_claim_token_hash || ""
  ).trim();
  if (!expectedHash) {
    // Older video-ready emails did not include a claim token. The exact
    // work-order email match remains required before the placeholder can move.
    return { ok: true };
  }

  const rawToken = String(input.claimToken || "").trim();
  if (!rawToken) {
    return {
      ok: false,
      code: "CLAIM_TOKEN_REQUIRED",
      error: "Open the service-video link from the email that Reliance sent you.",
    };
  }

  const expiresAt = new Date(
    String(input.metadata.customer_booking_claim_token_expires_at || "")
  );
  const now = input.now || new Date();
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime()
  ) {
    return {
      ok: false,
      code: "CLAIM_TOKEN_EXPIRED",
      error: "This service-video link has expired. Ask the provider to resend it.",
    };
  }

  const actualHash = hashCustomerBookingClaimToken(rawToken);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return {
      ok: false,
      code: "CLAIM_TOKEN_INVALID",
      error: "This service-video link is not valid. Open the latest email from Reliance.",
    };
  }

  return { ok: true };
}

export function markCustomerBookingClaimed(
  metadata: CustomerBookingClaimMetadata,
  userId: string,
  now = new Date()
): CustomerBookingClaimMetadata {
  const next: CustomerBookingClaimMetadata = {
    ...metadata,
    claim_status: "CLAIMED",
    customer_account_linked: true,
    linked_customer_user_id: userId,
    claim_completed_at: now.toISOString(),
  };
  delete next.customer_booking_claim_token_hash;
  delete next.customer_booking_claim_token_issued_at;
  delete next.customer_booking_claim_token_expires_at;
  return next;
}
