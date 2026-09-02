import { describe, expect, it } from "vitest";
import {
  issueCustomerBookingClaimToken,
  markCustomerBookingClaimed,
  validateCustomerBookingClaim,
} from "./customer-booking-claim";
import { hashPermissionContact } from "@/lib/consent/recipient";

describe("customer booking claim helpers", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("issues a hashed, expiring claim token and validates the intended email", () => {
    const issued = issueCustomerBookingClaimToken(
      { claim_contact_email: "Customer@Example.com" },
      now
    );

    expect(issued.rawToken).toBeTruthy();
    expect(issued.metadata.customer_booking_claim_token_hash).not.toBe(
      issued.rawToken
    );
    expect(
      validateCustomerBookingClaim({
        metadata: issued.metadata,
        bookingUserEmail: "unclaimed+123@reliance.local",
        accountEmail: "customer@example.com",
        claimToken: issued.rawToken,
        now,
      })
    ).toEqual({ ok: true });
  });

  it("rejects a different customer email even with the correct token", () => {
    const issued = issueCustomerBookingClaimToken(
      { client_email: "customer@example.com" },
      now
    );

    expect(
      validateCustomerBookingClaim({
        metadata: issued.metadata,
        bookingUserEmail: "unclaimed+123@reliance.local",
        accountEmail: "other@example.com",
        claimToken: issued.rawToken,
        now,
      })
    ).toMatchObject({ ok: false, code: "CLAIM_EMAIL_MISMATCH" });
  });

  it("uses the current permission recipient instead of stale historical claim metadata", () => {
    const issued = issueCustomerBookingClaimToken(
      {
        client_email: "current@example.com",
        claim_contact_email: "historical@example.com",
      },
      now,
    );
    expect(
      validateCustomerBookingClaim({
        metadata: issued.metadata,
        bookingUserEmail: "unclaimed+123@reliance.local",
        accountEmail: "current@example.com",
        claimToken: issued.rawToken,
        currentRecipientEmailHash: hashPermissionContact("current@example.com"),
        now,
      }),
    ).toEqual({ ok: true });
    expect(
      validateCustomerBookingClaim({
        metadata: issued.metadata,
        bookingUserEmail: "unclaimed+123@reliance.local",
        accountEmail: "historical@example.com",
        claimToken: issued.rawToken,
        currentRecipientEmailHash: hashPermissionContact("current@example.com"),
        now,
      }),
    ).toMatchObject({ ok: false, code: "CLAIM_EMAIL_MISMATCH" });
  });

  it("supports legacy email links only while the booking still belongs to an unclaimed placeholder", () => {
    const metadata = { claim_contact_email: "customer@example.com" };
    expect(
      validateCustomerBookingClaim({
        metadata,
        bookingUserEmail: "unclaimed+legacy@reliance.local",
        accountEmail: "customer@example.com",
      })
    ).toEqual({ ok: true });

    expect(
      validateCustomerBookingClaim({
        metadata,
        bookingUserEmail: "customer@example.com",
        accountEmail: "customer@example.com",
      })
    ).toMatchObject({ ok: false, code: "BOOKING_ALREADY_CLAIMED" });
  });

  it("allows a deactivated identity to reclaim its own already-linked booking", () => {
    expect(
      validateCustomerBookingClaim({
        metadata: { claim_contact_email: "customer@example.com" },
        bookingUserEmail: "customer@example.com",
        bookingUserId: "customer-1",
        accountEmail: "customer@example.com",
        restorableUserId: "customer-1",
      })
    ).toEqual({ ok: true });
  });

  it("removes the claim secret when the booking is connected to the customer", () => {
    const claimed = markCustomerBookingClaimed(
      {
        claim_status: "UNCLAIMED",
        customer_booking_claim_token_hash: "secret-hash",
        customer_booking_claim_token_expires_at:
          "2026-08-24T12:00:00.000Z",
      },
      "customer-1",
      now
    );

    expect(claimed).toMatchObject({
      claim_status: "CLAIMED",
      customer_account_linked: true,
      linked_customer_user_id: "customer-1",
    });
    expect(claimed).not.toHaveProperty(
      "customer_booking_claim_token_hash"
    );
  });
});
