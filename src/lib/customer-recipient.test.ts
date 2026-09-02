import { describe, expect, it } from "vitest";
import { hashPermissionContact } from "@/lib/consent/recipient";
import { resolveCanonicalCustomerRecipient } from "./customer-recipient";

describe("resolveCanonicalCustomerRecipient", () => {
  it("uses the corrected current permission recipient and preserves the old address as history", () => {
    const current = "customer.reliancedemo@proton.me";
    const historical = "customer.relianceonline@proton.me";
    expect(
      resolveCanonicalCustomerRecipient({
        customerMetadata: {
          client_email: current,
          claim_contact_email: historical,
        },
        currentRecipientEmailHash: hashPermissionContact(current),
      }),
    ).toEqual({
      email: current,
      source: "CURRENT_PERMISSION_RECIPIENT",
      currentRecipientEmailHash: hashPermissionContact(current),
      historicalEmails: [historical],
    });
  });

  it("fails closed when current permission evidence matches no plaintext candidate", () => {
    expect(
      resolveCanonicalCustomerRecipient({
        customerMetadata: {
          client_email: "current@example.com",
          claim_contact_email: "historical@example.com",
        },
        currentRecipientEmailHash: hashPermissionContact("unknown@example.com"),
      }),
    ).toMatchObject({ email: null, source: "NONE" });
  });

  it("uses the current client email before historical claim metadata when no versioned evidence exists", () => {
    expect(
      resolveCanonicalCustomerRecipient({
        customerMetadata: {
          client_email: "current@example.com",
          claim_contact_email: "historical@example.com",
        },
      }),
    ).toMatchObject({ email: "current@example.com", source: "CLIENT_EMAIL" });
  });
});
