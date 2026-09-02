import { describe, expect, it } from "vitest";
import { resolveBookingCustomer } from "./booking-customer";
import { hashPermissionContact } from "@/lib/consent/recipient";

describe("resolveBookingCustomer", () => {
  it("keeps the customer saved on the work order ahead of a linked account", () => {
    expect(
      resolveBookingCustomer({
        clientName: "Emily Matos",
        customerMetadata: JSON.stringify({
          client_name: "Emily Matos",
          client_email: "emily@example.com",
          client_phone: "4075550101",
        }),
        user: { id: "linked-user", name: "Ivan Olivera", email: "ivan@example.com", phone: "4075550102" },
      })
    ).toEqual({
      id: "linked-user",
      name: "Emily Matos",
      email: "emily@example.com",
      phone: "4075550101",
    });
  });

  it("uses current permission evidence when historical claim metadata disagrees", () => {
    expect(
      resolveBookingCustomer({
        customerMetadata: JSON.stringify({
          client_email: "current@example.com",
          claim_contact_email: "historical@example.com",
        }),
        currentRecipientEmailHash: hashPermissionContact("current@example.com"),
        user: { email: "unclaimed+booking@reliance.local" },
      }).email,
    ).toBe("current@example.com");
  });
});
